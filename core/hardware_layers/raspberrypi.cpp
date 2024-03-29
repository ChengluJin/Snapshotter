//-----------------------------------------------------------------------------
// Copyright 2015 Thiago Alves
//
// Based on the LDmicro software by Jonathan Westhues
// This file is part of the OpenPLC Software Stack.
//
// OpenPLC is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// OpenPLC is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with OpenPLC.  If not, see <http://www.gnu.org/licenses/>.
//------
//
// This file is the hardware layer for the OpenPLC. If you change the platform
// where it is running, you may only need to change this file. All the I/O
// related stuff is here. Basically it provides functions to read and write
// to the OpenPLC internal buffers in order to update I/O state.
// Thiago Alves, Dec 2015
//-----------------------------------------------------------------------------

#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>
#include <wiringPi.h>
#include <wiringSerial.h>
#include <pthread.h>

#include "ladder.h"
#include "aes.h"
#include "sha256.h"

#define MAX_INPUT 		14
#define MAX_OUTPUT 		11
#define MAX_ANALOG_OUT	1

/********************I/O PINS CONFIGURATION*********************
 * A good source for RaspberryPi I/O pins information is:
 * http://pinout.xyz
 *
 * The buffers below works as an internal mask, so that the
 * OpenPLC can access each pin sequentially
****************************************************************/
//inBufferPinMask: pin mask for each input, which
//means what pin is mapped to that OpenPLC input
int inBufferPinMask[MAX_INPUT] = { 8, 9, 7, 0, 2, 3, 12, 13, 14, 21, 22, 23, 24, 25 };

//outBufferPinMask: pin mask for each output, which
//means what pin is mapped to that OpenPLC output
int outBufferPinMask[MAX_OUTPUT] =	{ 15, 16, 4, 5, 6, 10, 11, 26, 27, 28, 29 };

//analogOutBufferPinMask: pin mask for the analog PWM
//output of the RaspberryPi
int analogOutBufferPinMask[MAX_ANALOG_OUT] = { 1 };

//-----------------------------------------------------------------------------
// This function is called by the main OpenPLC routine when it is initializing.
// Hardware initialization procedures should be here.
//-----------------------------------------------------------------------------
void initializeHardware()
{
	wiringPiSetup();
	//piHiPri(99);

	//set pins as input
	for (int i = 0; i < MAX_INPUT; i++)
	{
		pinMode(inBufferPinMask[i], INPUT);
		if (i != 0 && i != 1) //pull down can't be enabled on the first two pins
		{
			pullUpDnControl(inBufferPinMask[i], PUD_DOWN); //pull down enabled
		}
	}

	//set pins as output
	for (int i = 0; i < MAX_OUTPUT; i++)
	{
		pinMode(outBufferPinMask[i], OUTPUT);
	}

	//set PWM pins as output
	for (int i = 0; i < MAX_ANALOG_OUT; i++)
	{
		pinMode(analogOutBufferPinMask[i], PWM_OUTPUT);
	}
}

//-----------------------------------------------------------------------------
// This function is called by the OpenPLC in a loop. Here the internal buffers
// must be updated to reflect the actual state of the input pins. The mutex buffer_lock
// must be used to protect access to the buffers on a threaded environment.
//-----------------------------------------------------------------------------
int updateBuffersIn()
{
	IEC_BOOL temp;
	update_flag = 0;

	pthread_mutex_lock(&bufferLock); //lock mutex

	//INPUT
	for (int i = 0; i < MAX_INPUT; i++)
	{
		if (bool_input[i/8][i%8] != NULL)
		{
			temp = *bool_input[i/8][i%8];
			*bool_input[i/8][i%8] = digitalRead(inBufferPinMask[i]);
			if (temp != *bool_input[i/8][i%8])
			{
				update_flag = 1;
			}
		}
	}


	//OUTPUT
	for (int i = 0; i < MAX_OUTPUT; i++)
	{
		if (bool_output[i/8][i%8] != NULL)
		{
			bool_output_temp[i] = *bool_output[i/8][i%8];
			//printf("temp: %d, value: %d\n", bool_output_temp[i], *bool_output[i/8][i%8]);
		}
	}

	//ANALOG OUT (PWM)
	for (int i = 0; i < MAX_ANALOG_OUT; i++)
	{
		if (int_output[i] != NULL)
		{
			int_output_temp = *int_output[i];
		}
	}

	pthread_mutex_unlock(&bufferLock); //unlock mutex

	return update_flag;
}

//-----------------------------------------------------------------------------
// This function is called by the OpenPLC in a loop. Here the internal buffers
// must be updated to reflect the actual state of the output pins. The mutex buffer_lock
// must be used to protect access to the buffers on a threaded environment.
//-----------------------------------------------------------------------------
int updateBuffersOut()
{
	pthread_mutex_lock(&bufferLock); //lock mutex

	//OUTPUT
	for (int i = 0; i < MAX_OUTPUT; i++)
	{
		if (bool_output[i/8][i%8] != NULL)
		{
			digitalWrite(outBufferPinMask[i], *bool_output[i/8][i%8]);
			//printf("temp: %d, value: %d\n", bool_output_temp[i], *bool_output[i/8][i%8]);
			if (bool_output_temp[i] != *bool_output[i/8][i%8])
			//if (bool_output_temp[i] != *bool_output[i/8][i%8])
			{
				update_flag = 1;
			}
		}
	}

	//ANALOG OUT (PWM)
	for (int i = 0; i < MAX_ANALOG_OUT; i++)
	{
		if (int_output[i] != NULL)
		{
			pwmWrite(analogOutBufferPinMask[i], (*int_output[i] / 64));
			if (int_output_temp != *int_output[i])
			{
				update_flag = 1;
			}
		}
	}


	pthread_mutex_unlock(&bufferLock); //unlock mutex

	return update_flag;
}

void print_log(int tick)
{
	//time
	printf("time: %d\n", tick);

	//INPUT
	for (int i = 0; i < MAX_INPUT; i++)
	{
		if (bool_input[i/8][i%8] != NULL)
		{
			printf("Input %d: %x, ",i,  *bool_input[i/8][i%8]);
		}
	}

	printf("\n");

	//OUTPUT
	for (int i = 0; i < MAX_OUTPUT; i++)
	{
		if (bool_output[i/8][i%8] != NULL)
		{
			printf("Output %d: %x, ", i, *bool_output[i/8][i%8]);
		}
	}

	printf("\n");

	//ANALOG OUT (PWM)
	for (int i = 0; i < MAX_ANALOG_OUT; i++)
	{
		if (int_output[i] != NULL)
		{
			printf("Analog output: %x\n", (*int_output[i] / 64));
		}
	}
}

void compose_log(int tick, int event_id, BYTE* log)
{
	//clear log
	for (int i = 0; i < 16; i++)
	{
		log[i] = 0;
	}
	
	//start log
	log[0] = 0xFF;

	//event id in this log
	log[1] = (event_id & (0x0000ff00))>>8;
	log[2] = (event_id & (0x000000ff));

	//device ID
	log[3] = 0x00;
	log[4] = 0x01;

	//time
	log[5] = (tick & (0xff000000)) >> 24;
	log[6] = (tick & (0x00ff0000)) >> 16;
	log[7] = (tick & (0x0000ff00)) >> 8;
	log[8] = tick & (0x000000ff);

	//Digital Input
	BYTE temp_byte[2];
	temp_byte[0] = 0;
	temp_byte[1] = 0;
	for (int i = 0; i < MAX_INPUT; i++)
	{
		if (bool_input[i/8][i%8] != NULL)
		{
			if (*bool_input[i/8][i%8] != 0)
			{
				temp_byte[i/8] = temp_byte[i/8] | (0x80>>(i%8));	
			}
		}
	}

	log[9] = temp_byte[0];
	log[10] = temp_byte[1];

	//Digital Output
	temp_byte[0] = 0;
	temp_byte[1] = 0;
	for (int i = 0; i < MAX_OUTPUT; i++)
	{
		if (bool_output[i/8][i%8] != NULL)
		{
			if (*bool_output[i/8][i%8] != 0)
			{
				temp_byte[i/8] = temp_byte[i/8] | (0x80>>(i%8));	
			}
		}
	}

	log[11] = temp_byte[0];
	log[12] = temp_byte[1];

	//Analog output
	if (int_output[0] != NULL)
	{
		log[13] = ((*int_output[0])>>8); 
		log[14] = ((*int_output[0])); 
	}

	//End
	log[15] = 0xFF;
}
	


void encrypt_log(int tick, int event_id)
{
	WORD key_schedule[60];
	BYTE log[16];
	BYTE encrypted_log[16];
	BYTE buf[SHA256_BLOCK_SIZE];
	SHA256_CTX ctx;

	compose_log(tick, event_id, log);

	aes_key_setup(key, key_schedule, 128);

	aes_encrypt(log, encrypted_log, key_schedule, 128);
	
	printf("plaintext log:");
	for (int i = 0; i < 16; i++)
	{	
		printf("%02x", log[i]);
		log[i] = 0;
	}
	printf("\n");
	printf("ciphertext log:");
	for (int i = 0; i < 16; i++)
	{	
		printf("%02x", encrypted_log[i]);
	}

	sha256_init(&ctx);
	sha256_update(&ctx, key, 16);
	sha256_final(&ctx, buf);
	//just for demo
	///////////////////////
	printf("\n");
	printf("Old Key:");
	for (int i = 0; i < 16; i++)
	{
		printf("%02x", key[i]);
		key[i] = buf[i];
	}

	printf("\n");
	printf("New Key:");
	for (int i = 0; i < 16; i++)
	{
		printf("%02x", key[i]);
	}
	/////////////////////

}
