# Snapshotter: Lightweight intrusion detection and prevention system for industrial control systems

This repository contains the source codes produced by the UConn team in [CSAW Embedded System Challenge 2017](https://github.com/momalab/csaw_esc_2017). The team members are Chenglu Jin, Saeed Valizadeh, Mason Ginter, and Marten van Dijk (advisor). Also, the research findings of this project have been documented in ["Snapshotter: Lightweight intrusion detection and prevention system for industrial control systems"](https://ieeexplore.ieee.org/abstract/document/8390813) at IEEE International Conference on Industrial Cyber-Physical Systems in 2018.

The source codes are based on [OpenPLC v2](https://github.com/thiagoralves/OpenPLC_v2), so you can compile and use the system just like OpenPLC v2. Our main modification is the introduction of stealth logging of security-related information. More details of the design of Snapshotter can be found in our paper ["Snapshotter: Lightweight intrusion detection and prevention system for industrial control systems"](https://ieeexplore.ieee.org/abstract/document/8390813). 

# OpenPLC v2
This program is intended to emulate a PLC on a Linux machine. This virtual PLC uses the OpenPLC Software Stack to execute IEC 61131-3 programs and reply to MODBUS/TCP requests. Programs can be created using the PLCopen editor and then uploaded to this virtual PLC.

The OpenPLC has different hardware layers to support physical devices. More hardware layers can be added to the project. For instance, there is a hardware layer for the RaspberryPi, which makes the OpenPLC controls its IO pins. 

There is a NodeJS application that works as a http server for the user to upload new programs.

You must have NodeJS and WiringPi (in case you are using Raspberry Pi) installed to use this program. Usage:

1) ./build.sh

2) sudo nodejs server.js

A server will be created on port 8080. Just open your browser and navigate to localhost:8080. After the application is running, you can connect to the virtual PLC using any MODBUS/TCP HMI software.

