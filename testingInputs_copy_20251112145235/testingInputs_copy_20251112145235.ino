#include <Arduino.h>
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
const int p2 = 27;
const int p3 = 26;
const int p4 = 25;

//define threshold to register an input 
//difference from base state must be > base + 300000 or < base - 300000 (these numbers have no units, it is raw data from the pressure sensors. base sensor never deviates from ~2000000)
const int thres = 300000; 

//center of joystick in potentiometer land
const int CENTER_X = 1887;
const int CENTER_Y = 1711;

const int AXIS_CENTER = 16383;

BleGamepadConfiguration bleGamepadConfig;
BleGamepad bleGamepad;

bool pressA = false;
bool pressB = false;
bool pressX = false;
bool pressY = false;
bool pressLT = false;
bool pressRT = false;

void setup() {
  Serial.begin(115200);
  delay(2000);
  
  //Serial.println("Starting BLE Gamepad...");
  
  bleGamepadConfig.setVid(1118); //xbox one s VID and PID
  bleGamepadConfig.setPid(736);
  bleGamepadConfig.setSimulationMin(0x8000); //set 
  bleGamepadConfig.setAutoReport(false);
  
  bleGamepad.begin(&bleGamepadConfig);
  
  delay(1000);
  
  //Serial.println("Initializing HX711 sensors...");
  scaleAB.begin(p2, CLK);
  delay(100);
  scaleXY.begin(p3, CLK);
  delay(100);
  scaleTrigger.begin(p4, CLK);
  delay(100);
  //Serial.println("Setup complete!");
}

void loop() {
if(bleGamepad.isConnected()){     
  //read from joystick
  int rawx = analogRead(joystickX);
  int rawy = analogRead(joystickY);
      
  int mappedX, mappedY;

  //map joystick values to values that console can use
  if(rawx < CENTER_X) {
    mappedX = map(rawx, 0, CENTER_X, -32768, 0);
  } 
  else {
    mappedX = map(rawx, CENTER_X, 4095, 0, 32767);
  }

  if(rawy < CENTER_Y) {
    mappedY = map(rawy, 0, CENTER_Y, -32768, 0);
  } 
  else {
    mappedY = map(rawy, CENTER_Y, 4095, 0, 32767);
  }

  //deadzone so no drift
  if(abs(mappedX) < 100) mappedX = 0;
  if(abs(mappedY) < 100) mappedY = 0;

  mappedX = constrain(mappedX, -32768, 32767);
  mappedY = constrain(mappedY, -32768, 32767);

  bleGamepad.setX(mappedX);
  bleGamepad.setY(mappedY);
    
    //handle AB sensor
    if(scaleAB.is_ready()){
      float val = scaleAB.read();
        
      if(val > thres && !pressA){
        bleGamepad.press(BUTTON_2);
        Serial.println("A pressed");          
        pressA = true;
      }
      else if(val < -thres && !pressB){
        bleGamepad.press(BUTTON_1);
      //Serial.println("B pressed");
        pressB = true;
      }
      else if(val < thres && pressA){
        bleGamepad.release(BUTTON_2);
        pressA = false;
      }
      else if(val > -thres && pressB){
        bleGamepad.release(BUTTON_1);
        pressB = false;
      }
    }
    //handle XY sensor  
    if(scaleXY.is_ready()){
      float val = scaleXY.read();
        
      if(val > 2*thres && !pressX){
        bleGamepad.press(BUTTON_4);
        Serial.println("X pressed");
        pressX = true;
      }
      else if(val < -thres && !pressY){
        bleGamepad.press(BUTTON_3);
       //Serial.println("Y pressed");
        pressY = true;
      }
      else if(val < 2*thres && pressX){
        bleGamepad.release(BUTTON_4);
        pressX = false;
      }
      else if(val > -thres && pressY){
        bleGamepad.release(BUTTON_3);
        pressY = false;
      }
    }
    //handle trigger scale (TODO)
    if(scaleTrigger.is_ready()){
      float val = scaleXY.read();

      if(val > 2*thres && !pressLT){
        bleGamepad.press(BUTTON_4);
        Serial.println("X pressed");
        pressLT = true;
      }
      else if(val < -thres && !pressRT){
        bleGamepad.press(BUTTON_3);
        //Serial.println("Y pressed");
        pressRT = true;
      }
      else if(val < 2*thres && pressLT){
        bleGamepad.release(BUTTON_4);
        pressLT = false;
      }
      else if(val > -thres && pressRT){
        bleGamepad.release(BUTTON_3);
        pressRT = false;
      }
    }
    bleGamepad.sendReport();
  }
}

