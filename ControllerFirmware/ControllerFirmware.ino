#include <Arduino.h>  //not needed in the arduino ide

// Captive Portal
#include <WiFi.h>
#include <AsyncTCP.h>  //https://github.com/me-no-dev/AsyncTCP using the latest dev version from @me-no-dev
#include <DNSServer.h>
#include <ESPAsyncWebServer.h>  //https://github.com/me-no-dev/ESPAsyncWebServer using the latest dev version from @me-no-dev
#include <esp_wifi.h>           //Used for mpdu_rx_disable android workaround
#include <ArduinoJson.h>        //For handling profile Jsons
#include <LittleFS.h>           //Replictes a file system on an ESP32 device.
#include "HX711.h"
#include <BleGamepad.h>

//define pressure sensors
HX711 scaleAB;
HX711 scaleXY;
HX711 scaleTrigger;

//pins for clock, joystick X and Y, and pressure sensors
//TODO read these from file during setup + support up to 5 pins for sensors
const int CLK = 18;
const int joystickY = 4;
const int joystickX = 14;
const int p2 = 15;
const int p3 = 26;
const int p4 = 25;

const int key1 = 33;
const int key2 = 32;

int curState = 0;
//define threshold to register an input 
//difference from base state must be > base + 300000 or < base - 300000 (these numbers have no units, it is raw data from the pressure sensors. base sensor never deviates from ~2000000)
const int base = 700000; 
const int thres = 200000; 
const int baseX = 3550000; 

//center of joystick in potentiometer land
const int CENTER_X_RAW = 1931;
const int CENTER_Y_RAW = 1776;
int curLight = 9999;
//int lastLight = 0;
const int HID_CENTER = 32768;

BleGamepad bleGamepad;

bool pressA = false;
bool pressB = false;
bool pressX = false;
bool pressY = false;
bool pressLT = false;
bool pressRT = false;

const int DNS_INTERVAL = 30;
// Pre reading on the fundamentals of captive portals https://textslashplain.com/2022/06/24/captive-portals/

const char *ssid = "captive";  // FYI The SSID can't have a space in it.
// const char * password = "12345678"; //Atleast 8 chars
const char *password = NULL;  // no password

#define MAX_CLIENTS 4   // ESP32 supports up to 10 but I have not tested it yet
#define WIFI_CHANNEL 6  // 2.4ghz channel 6 https://en.wikipedia.org/wiki/List_of_WLAN_channels#2.4_GHz_(802.11b/g/n/ax)

const IPAddress localIP(4, 3, 2, 1);           // the IP address the web server, Samsung requires the IP to be in public space
const IPAddress gatewayIP(4, 3, 2, 1);         // IP address of the network should be the same as the local IP for captive portals
const IPAddress subnetMask(255, 255, 255, 0);  // no need to change: https://avinetworks.com/glossary/subnet-mask/

const String localIPURL = "http://4.3.2.1";  // a string version of the local IP with http, used for redirecting clients to your webpage

String currentProfile = "default";

String profilePath(String name) {
	return "/profiles/" + name + ".json";
}

// Maps a sensor port + direction to a BLE button
struct SensorBinding {
  int buttonId;
  bool isPuff;
};

struct SensorConfig {
  SensorBinding puff;
  SensorBinding sip;
  bool hasPuff = false;
  bool hasSip = false;
  float base;
  float threshold;
};


struct SensorConfig cfgSP1, cfgSP2, cfgSP3;

int resolveButton(const char* name) {
  // Map your button name strings to BLE button constants
  if (strcmp(name, "A") == 0) return BUTTON_1;
  if (strcmp(name, "B") == 0) return BUTTON_2;
  if (strcmp(name, "X") == 0) return BUTTON_3;
  if (strcmp(name, "Y") == 0) return BUTTON_4;
  return -1; // unrecognized
}

void parseSensorBindings(JsonObject &sp, struct SensorConfig &cfg) { //relevant to loadActiveProfile, parses whatever config is current and stores it in the config structs
  cfg.hasPuff = false;
  cfg.hasSip  = false;

  for (JsonPair kv : sp) {
    const char* buttonName = kv.key().c_str();
    const char* action     = kv.value().as<const char*>();
    int btnId = resolveButton(buttonName);
    if (btnId == -1) continue;

    if (strcmp(action, "puff") == 0) {
      cfg.puff    = { btnId, true };
      cfg.hasPuff = true;
    } else if (strcmp(action, "sip") == 0) {
      cfg.sip    = { btnId, false };
      cfg.hasSip = true;
    }
  }
}

void loadActiveProfile() { //i'll be honest i dont SUPER know how this works but from all the stuff ive looked at online + asking claude a bit it should be good.
  String filename = profilePath(currentProfile);
  if (!LittleFS.exists(filename)) {
    Serial.println("No profile found, using defaults");
    // default configuration if user hasnt made one
    cfgSP1 = { {BUTTON_4, true}, {BUTTON_3, false}, true, true, (float)baseX, (float)thres };
    cfgSP2 = { {BUTTON_2, true}, {BUTTON_1, false}, true, true, (float)base,  (float)thres };
    return;
  }

  File file = LittleFS.open(filename, "r");
  DynamicJsonDocument doc(2048);
  deserializeJson(doc, file);
  file.close();

  JsonObject bindings = doc["bindings"];

  if (bindings.containsKey("SP1")) {
    JsonObject sp1 = bindings["SP1"];
    cfgSP1.base      = baseX;
    cfgSP1.threshold = thres;
    parseSensorBindings(sp1, cfgSP1);
  }
  if (bindings.containsKey("SP2")) {
    JsonObject sp2 = bindings["SP2"];
    cfgSP2.base      = base;
    cfgSP2.threshold = thres;
    parseSensorBindings(sp2, cfgSP2);
  }
  if (bindings.containsKey("SP3")) {
    JsonObject sp3 = bindings["SP3"];
    cfgSP3.base      = base;  // adjust if SP3 has a different base
    cfgSP3.threshold = thres;
    parseSensorBindings(sp3, cfgSP3);
  }

  Serial.println("Loaded profile: " + currentProfile);
}

void handleSensor(HX711 &scale, struct SensorConfig &cfg, bool &pressHigh, bool &pressLow) { //put this in its own function because it was ugly to have it all in loop()
  if (!scale.is_ready()) return;
  float val = scale.read();

  // Puff 
  if (cfg.hasPuff) {
    if (val > (cfg.base + cfg.threshold) && !pressHigh) {
      bleGamepad.press(cfg.puff.buttonId);
      pressHigh = true;
    } else if (val <= (cfg.base + cfg.threshold) && pressHigh) {
      bleGamepad.release(cfg.puff.buttonId);
      pressHigh = false;
    }
  }

  // Sip 
  if (cfg.hasSip) {
    if (val < (cfg.base - cfg.threshold) && !pressLow) {
      bleGamepad.press(cfg.sip.buttonId);
      pressLow = true;
    } else if (val >= (cfg.base - cfg.threshold) && pressLow) {
      bleGamepad.release(cfg.sip.buttonId);
      pressLow = false;
    }
  }
}


DNSServer dnsServer;
AsyncWebServer server(80);

void setUpDNSServer(DNSServer &dnsServer, const IPAddress &localIP) {
	// Define the DNS interval in milliseconds between processing DNS request

	// Set the TTL for DNS response and start the DNS server
	dnsServer.setTTL(3600);
	dnsServer.start(53, "*", localIP);
}

void startSoftAccessPoint(const char *ssid, const char *password, const IPAddress &localIP, const IPAddress &gatewayIP) {
// Define the maximum number of clients that can connect to the server
#define MAX_CLIENTS 4
// Define the WiFi channel to be used (channel 6 in this case)
#define WIFI_CHANNEL 6

	// Set the WiFi mode to access point and station
	WiFi.mode(WIFI_MODE_AP);

	// Define the subnet mask for the WiFi network
	const IPAddress subnetMask(255, 255, 255, 0);

	// Configure the soft access point with a specific IP and subnet mask
	WiFi.softAPConfig(localIP, gatewayIP, subnetMask);

	// Start the soft access point with the given ssid, password, channel, max number of clients
	WiFi.softAP(ssid, password, WIFI_CHANNEL, 0, MAX_CLIENTS);

	// Disable AMPDU RX on the ESP32 WiFi to fix a bug on Android
	esp_wifi_stop();
	esp_wifi_deinit();
	wifi_init_config_t my_config = WIFI_INIT_CONFIG_DEFAULT();
	my_config.ampdu_rx_enable = false;
	esp_wifi_init(&my_config);
	esp_wifi_start();
	vTaskDelay(100 / portTICK_PERIOD_MS);  // Add a small delay
}

void setUpWebserver(AsyncWebServer &server, const IPAddress &localIP) {
	//======================== Webserver ========================
	// WARNING IOS (and maybe macos) WILL NOT POP UP IF IT CONTAINS THE WORD "Success" https://www.esp8266.com/viewtopic.php?f=34&t=4398
	// SAFARI (IOS) IS STUPID, G-ZIPPED FILES CAN'T END IN .GZ https://github.com/homieiot/homie-esp8266/issues/476 this is fixed by the webserver serve static function.
	// SAFARI (IOS) there is a 128KB limit to the size of the HTML. The HTML can reference external resources/images that bring the total over 128KB
	// SAFARI (IOS) popup browser has some severe limitations (javascript disabled, cookies disabled)

	// Required
	server.on("/connecttest.txt", [](AsyncWebServerRequest *request) {
		request->redirect("http://logout.net");
	});  // windows 11 captive portal workaround
	server.on("/wpad.dat", [](AsyncWebServerRequest *request) {
		request->send(404);
	});  // Honestly don't understand what this is but a 404 stops win 10 keep calling this repeatedly and panicking the esp32 :)

	// Background responses: Probably not all are Required, but some are. Others might speed things up?
	// A Tier (commonly used by modern systems)
	server.on("/generate_204", [](AsyncWebServerRequest *request) {
		request->redirect(localIPURL);
	});  // android captive portal redirect
	server.on("/redirect", [](AsyncWebServerRequest *request) {
		request->redirect(localIPURL);
	});  // microsoft redirect
	server.on("/hotspot-detect.html", [](AsyncWebServerRequest *request) {
		request->redirect(localIPURL);
	});  // apple call home
	server.on("/canonical.html", [](AsyncWebServerRequest *request) {
		request->redirect(localIPURL);
	});  // firefox captive portal call home
	server.on("/success.txt", [](AsyncWebServerRequest *request) {
		request->send(200);
	});  // firefox captive portal call home
	server.on("/ncsi.txt", [](AsyncWebServerRequest *request) {
		request->redirect(localIPURL);
	});  // windows call home

	// B Tier (uncommon)
	//  server.on("/chrome-variations/seed",[](AsyncWebServerRequest *request){request->send(200);}); //chrome captive portal call home
	//  server.on("/service/update2/json",[](AsyncWebServerRequest *request){request->send(200);}); //firefox?
	//  server.on("/chat",[](AsyncWebServerRequest *request){request->send(404);}); //No stop asking Whatsapp, there is no internet connection
	//  server.on("/startpage",[](AsyncWebServerRequest *request){request->redirect(localIPURL);});

	// return 404 to webpage icon
	server.on("/favicon.ico", [](AsyncWebServerRequest *request) {
		request->send(404);
	});  // webpage icon

	// the catch all
	server.onNotFound([](AsyncWebServerRequest *request) {
		request->redirect(localIPURL);
		Serial.print("onnotfound ");
		Serial.print(request->host());  // This gives some insight into whatever was being requested on the serial monitor
		Serial.print(" ");
		Serial.print(request->url());
		Serial.print(" sent redirect to " + localIPURL + "\n");
	});
}

void listDir(fs::FS &fs, const char *dirname, uint8_t levels) {
    Serial.printf("Listing directory: %s\n", dirname);

    File root = fs.open(dirname);
    if (!root) {
        Serial.println("Failed to open directory");
        return;
    }
    if (!root.isDirectory()) {
        Serial.println("Not a directory");
        return;
    }

    File file = root.openNextFile();
    while (file) {
        if (file.isDirectory()) {
            Serial.print("  DIR : ");
            Serial.println(file.name());
            if (levels) {
                listDir(fs, file.path(), levels - 1);
            }
        } else {
            Serial.print("  FILE: ");
            Serial.print(file.name());
            Serial.print("  SIZE: ");
            Serial.println(file.size());
        }
        file = root.openNextFile();
    }

		Serial.print("Current Profile: ");
		Serial.println(currentProfile);
}

BleGamepadConfiguration config;

void setup() {
	// Set the transmit buffer size for the Serial object and start it with a baud rate of 115200.
	Serial.setTxBufferSize(1024);
	Serial.begin(115200);
	// Wait for the Serial object to become available.
	while (!Serial)
		;

	// Print a welcome message to the Serial port.
	Serial.printf("%s-%d\n\r", ESP.getChipModel(), ESP.getChipRevision());

	startSoftAccessPoint(ssid, password, localIP, gatewayIP);

	setUpDNSServer(dnsServer, localIP);

	if (!LittleFS.begin(true)) {
		Serial.println("LittleFS Mount Failed!");
		return;
	}

	if (!LittleFS.exists("/profiles")) {
		LittleFS.mkdir("/profiles");
	}
	delay(100);
	Serial.println("Files on TinyPICO:");
  Serial.println("------------------------");
  listDir(LittleFS, "/", 3);  // List all files, 3 levels deep
  Serial.println("------------------------\n");

	setupEndpoints();

	setUpWebserver(server, localIP);
	server.begin();

  config.setControllerType(CONTROLLER_TYPE_GAMEPAD);
  //config.setVid(0x045e);  
  //config.setPid(0x028e);  

  bleGamepad.begin(&config);
  
  //Serial.println("Initializing HX711 sensors...");
  scaleAB.begin(p2, CLK);
  delay(100);
  scaleXY.begin(p3, CLK);
  delay(100);
  scaleTrigger.begin(p4, CLK);
  delay(100);

	pinMode(key1, INPUT_PULLUP);
	pinMode(key2, INPUT_PULLUP);

	loadActiveProfile();

	Serial.print("\n");
	Serial.print("Startup Time:");  
	Serial.println(millis());
	Serial.print("\n");
}

void setupEndpoints() {
	//Serve Website
	server.serveStatic("/", LittleFS, "/").setDefaultFile("Main.html");

	//Save Profile
	server.on(
	  "/saveProfile", HTTP_POST, [](AsyncWebServerRequest *request) {}, NULL, [](AsyncWebServerRequest *request, uint8_t *data, size_t len, size_t index, size_t total) {
		  DynamicJsonDocument doc(2048);
		  if (deserializeJson(doc, data)) {
			  request->send(400, "application/json", "{\"error\":\"Bad JSON\"}");
			  return;
		  }

		  String profileName = doc["profile"];
		  JsonObject bindings = doc["bindings"];

		  if (profileName == "") {
			  request->send(400, "application/json", "{\"error\":\"Missing profile name\"}");
			  return;
		  }

		  currentProfile = profileName;
		  String filename = profilePath(profileName);

		  File file = LittleFS.open(filename, "w");
		  if (!file) {
			  request->send(500, "application/json", "{\"error\":\"Write failed\"}");
			  return;
		  }

		  serializeJson(bindings, file);
		  file.close();

		  Serial.println("Saved: " + filename);

			loadActiveProfile();
			
		  request->send(200, "application/json", "{\"status\":\"Profile saved\"}");
	  });

	//Load Profile by Name
	server.on("/loadConfig", HTTP_GET, [](AsyncWebServerRequest *request) {
		if (!request->hasParam("profile")) {
			request->send(400, "application/json", "{\"error\":\"Missing profile parameter\"}");
			return;
		}

		String profileName = request->getParam("profile")->value();
		String filename = profilePath(profileName);

		if (!LittleFS.exists(filename)) {
			request->send(404, "application/json", "{\"error\":\"Profile not found\"}");
			return;
		}

		File file = LittleFS.open(filename, "r");
		String json = file.readString();
		file.close();

		currentProfile = profileName;

		loadActiveProfile();

		request->send(200, "application/json", json);
	});

	// List All Profiles
	server.on("/listProfiles", HTTP_GET, [](AsyncWebServerRequest *request) {
		File root = LittleFS.open("/profiles");
		if (!root || !root.isDirectory()) {
			request->send(500, "application/json", "{\"error\":\"Profiles folder missing\"}");
			return;
		}

		DynamicJsonDocument doc(2048);
		JsonArray arr = doc.to<JsonArray>();

		File file = root.openNextFile();
		while (file) {
			String name = file.name();  // "/profiles/test.json"
			name.replace("/profiles/", "");
			name.replace(".json", "");
			arr.add(name);

			file = root.openNextFile();
		}

		String output;
		serializeJson(arr, output);

		request->send(200, "application/json", output);
	});

	// Delete Profile
	server.on("/deleteProfile", HTTP_DELETE, [](AsyncWebServerRequest *request) {
		if (!request->hasParam("profile")) {
			request->send(400, "application/json", "{\"error\":\"Missing profile\"}");
			return;
		}

		String profileName = request->getParam("profile")->value();
		String filename = profilePath(profileName);

		if (!LittleFS.exists(filename)) {
			request->send(404, "application/json", "{\"error\":\"Profile not found\"}");
			return;
		}

		LittleFS.remove(filename);

		request->send(200, "application/json", "{\"status\":\"Profile deleted\"}");
	});
}

int lastState = -1;
void loop() {
	//listDir(LittleFS, "/", 3);
	
	int switchKey = digitalRead(key1);
    if (switchKey == LOW) {
        curState = !curState;
        delay(500); // debounce
    }
	int switchKey2 = digitalRead(key2);
		if(switchKey2 == LOW){
			listDir(LittleFS, "/", 3);
			delay(100);
		}
    if (curState != lastState) {
        lastState = curState;
        switch (curState) {
            case 0:
                esp_wifi_stop();
								Serial.println("WIFI OFF");
                break;
            case 1:
                esp_wifi_start();
								Serial.println("WIFI ON");
                break;
        }
    }

	if(curState == 1){
		dnsServer.processNextRequest();  // I call this atleast every 10ms in my other projects (can be higher but I haven't tested it for stability)
		delay(DNS_INTERVAL);
	}

	if(bleGamepad.isConnected()){     
  //read from joystick
uint16_t rawx = analogRead(joystickX);
uint16_t rawy = analogRead(joystickY);

rawx = constrain(rawx, 750, 3500);
rawy = constrain(rawy, 750, 3500);

// X is inverted (left=4095, right=0), so flip it
uint16_t mappedX = map(rawx, 3500, 750, 0, 32767); //six seven
// Y: up=0, down=4095 — joy.cpl wants up=0 so no flip needed
uint16_t mappedY = map(rawy, 750, 3500, 0, 32767);


bleGamepad.setX(mappedX);
bleGamepad.setY(mappedY);

  //   //handle AB sensor
  //   if(scaleAB.is_ready()){
  //     float val = scaleAB.read();
  //     if(val > (thres + base) && !pressA){
  //       //Serial.println("A press");
  //       bleGamepad.press(BUTTON_2);    
  //       pressA = true;
  //     }
  //     else if(val < (base - thres) && !pressB){
  //       bleGamepad.press(BUTTON_1);
  //     //Serial.println("B pressed");
  //       pressB = true;
  //     }
  //     else if(val < (thres + base) && pressA){
  //       bleGamepad.release(BUTTON_2);
  //       pressA = false;
  //     }
  //     else if(val > (base - thres) && pressB){
  //       bleGamepad.release(BUTTON_1);
  //       pressB = false;
  //     }
  //   }
  //   //handle XY sensor  
  //   if(scaleXY.is_ready()){
  //     float val = scaleXY.read();
	// 		//Serial.println(val);
  //     if(val > (thres + baseX) && !pressX ){
  //       //Serial.println("A press");
  //       bleGamepad.press(BUTTON_4);    
  //       pressX = true;
  //     }
  //     else if(val < (baseX - thres) && !pressY){
  //       bleGamepad.press(BUTTON_3);
  //     //Serial.println("B pressed");
  //       pressY = true;
  //     }
  //     else if(val < (thres + baseX) && pressX){
  //       bleGamepad.release(BUTTON_4);
  //       pressX = false;
  //     }
  //     else if(val > (baseX - thres) && pressY){
  //       bleGamepad.release(BUTTON_3);
  //       pressY = false;
  //     }
  //   }
  // }

handleSensor(scaleAB,      cfgSP2, pressA, pressB);
handleSensor(scaleXY,      cfgSP1, pressX, pressY);
handleSensor(scaleTrigger, cfgSP3, pressLT, pressRT);
	}
}
