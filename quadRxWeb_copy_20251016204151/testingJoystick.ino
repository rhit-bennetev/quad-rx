#include <Arduino.h>
#include <BleGamepad.h>

int joystickY = 4;
int joystickX = 14;

int p2 = 27;
int p3 = 26;
int p4 = 25;

void setup() {
  // put your setup code here, to run once:
Serial.begin(115200);
Serial.println("start");
}

void loop() {
  // put your main code here, to run repeatedly:
  int x = analogRead(joystickX);
	int y = analogRead(joystickY);
  int z = analogRead(p2);
  int s = analogRead(p3);
  int k = analogRead(p4);
	Serial.println(x);
	Serial.println(y);
  Serial.println(p2);
  Serial.println(p3);
  Serial.println(p4);
}
