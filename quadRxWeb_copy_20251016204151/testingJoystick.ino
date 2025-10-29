int joystickY = 4;
int joystickX = 14;

void setup() {
  // put your setup code here, to run once:
Serial.begin(115200);
Serial.println("start");
}

void loop() {
  // put your main code here, to run repeatedly:
  int x = analogRead(joystickX);
	int y = analogRead(joystickY);
	Serial.println(x);
	Serial.println(y);
}
