# quad-rx
Repository for the QuadRX gaming controller, created by Rose-Hulman 2026 ECE Capstone Team 11.

# FIRMWARE SETUP
A guide on how to use the controller from the perspective of the user is included in the final report. This guide is for power users, or manufacturers. 
We do not have access to the steps used to create the controller housing, nor integrate the basic parts such as the joystick, keycap buttons, or other ports. 
Since all of this was done by QuadRX, this guide will focus on our contribution to the project.

To compile and flash our firmware, version 2.3.7 of the Arduino IDE is required. In the future, new versions may work, but at the time of writing 
versions 2.3.8 and newer do not compile. 

Once the IDE is installed, next install the LittleFS Filesystem Uploader. This tutorial is the one we followed, and explains the process well.
https://randomnerdtutorials.com/arduino-ide-2-install-esp32-littlefs/

Next, make sure you have the newest version of git installed
https://github.com/git-guides/install-git

Clone the repository somewhere on your machine.

From here, open ControllerFirmware.ino.

Follow the steps in the LittleFS tutorial previously linked to upload the files necessary to your TinyPico. 

Then, press the arrow button in the top left corner of the IDE to compile and flash the firmware to the board. 

# HARDWARE SETUP

