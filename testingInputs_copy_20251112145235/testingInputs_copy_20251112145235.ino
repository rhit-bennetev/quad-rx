#include <Arduino.h>
#include <BleGamepad.h>
#include "HX711.h"
#include "switch_ESP32.h"

HX711 scaleAB;
HX711 scaleXY;

NSGamepad Gamepad;

int CLK = 18;
int joystickY = 4;
int joystickX = 14;

int p2 = 27;
int p3 = 26;

int thres = 200000;

BleGamepad game("QuadRX", "RxGaming", 100);

bool pressA = false;
bool pressB = false;
bool pressX = false;
bool pressY = false;

double sensitivity = 1.5;

void setup() {
  Serial.begin(115200);
  game.begin();
  scaleAB.begin(p2, CLK);
  scaleXY.begin(p3, CLK);
  delay(1000);

}

void loop() {
  int rawx = analogRead(joystickX);
  int rawy = analogRead(joystickY);
  //double afterSensX = sensitivity * rawx;
  //double afterSensY = sensitivity * rawy;

  game.setX(map(rawx, 0, 4095, 32767, 0)); 
  game.setY(map(rawy, 0, 4095, 0, 32767)); //six seven

  if(game.isConnected()){
    if(scaleAB.is_ready()){  //read from sensor only when its ready
      float val = scaleAB.read();
      Serial.print("AB: ");
      Serial.println(val);
      if(val > thres){
        game.press(BUTTON_1);
        pressA = true;
      }
      else if(val < -thres){
        game.press(BUTTON_2);
        pressB = true;
      }
      else if(val < thres && pressA){
        game.release(BUTTON_1);
        pressA = false;
      }
      else if(val > -thres && pressB){
        game.release(BUTTON_2);
        pressB = false;
      }
    }
    if(scaleXY.is_ready()){ //same as before
      float val = scaleXY.read();
      Serial.print("XY: ");
      Serial.println(val);
      if(val > 2*thres){
        game.press(BUTTON_3);
        pressX = true;
      }
      else if(val < -thres){
        game.press(BUTTON_4);
        pressY = true;
      }
      else if(val < 2*thres && pressX){
        game.release(BUTTON_3);
        pressX = false;
      }
      else if(val < -thres && pressY){
        game.release(BUTTON_4);
        pressY = false;
      }
    }
  }
}
