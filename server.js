var express = require("express");
var multer = require('multer');
var app = express();
var upload = multer({ dest: './st_files/'});
var spawn = require('child_process').spawn;
var plcLog = '';
var time = '';
var outCheck = '';
var idsLog = '';

var openplc = spawn('./core/openplc');
openplc.stdout.on('data', function(data)
{
	plcLog += data;
	intrusionDetection(data);
	plcLog += '\r\n';
	
});
openplc.stderr.on('data', function(data)
{
	plcLog += data;
	plcLog += '\r\n';
});
openplc.on('close', function(code)
{
	plcLog += 'OpenPLC application terminated\r\n';
});

var plcRunning = true;
var compilationOutput = '';
var compilationEnded = false;
var compilationSuccess = false;
var uploadedFileName = '';
var uploadedFilePath = '';

app.use(multer({ dest: './st_files/',
    rename: function (fieldname, filename) 
    {
		return filename;
    },
	onFileUploadStart: function (file) 
	{
		console.log(file.originalname + ' is starting ...');
	},
	onFileUploadComplete: function (file) 
	{
		uploadedFileName = file.originalname;
		console.log("Uploaded file name:	",uploadedFileName);
		uploadedFilePath = file.path;
		console.log("Uploaded file name:	",uploadedFilePath);
	}
}));

app.get('/',function(req,res)
{
	showMainPage(req,res);
});

app.get('/run',function(req,res)
{
	if (plcRunning == false)
	{
		console.log('Starting OpenPLC Software...');
		plcLog = 'Starting OpenPLC Application...\r\n';
		openplc = spawn('./core/openplc');
		openplc.stdout.on('data', function(data)
		{
			plcLog += data;
			plcLog += '\r\n';
		});
		openplc.stderr.on('data', function(data)
		{
			plcLog += data;
			plcLog += '\r\n';
		});
		openplc.on('close', function(code)
		{
			plcLog += 'OpenPLC application terminated\r\n';
		});
		
		plcRunning = true;
	}
	
	var htmlString = '\
	<!DOCTYPE html>\
	<html>\
		<header>\
			<meta http-equiv="refresh" content="0; url=/" />\
		</header>\
	</html>';
	
	res.send(htmlString);
});

app.get('/stop',function(req,res)
{
	if (plcRunning == true)
	{
		console.log('Stopping OpenPLC Software...');
		openplc.kill('SIGTERM');
		plcRunning = false;
	}
	
	var htmlString = '\
	<!DOCTYPE html>\
	<html>\
		<header>\
			<meta http-equiv="refresh" content="0; url=/" />\
		</header>\
	</html>';
	
	res.send(htmlString);
});

app.post('/api/upload',function(req,res)
{
    upload(req,res,function(err) 
    {
        if(err) 
        {
            return res.end("Error uploading file.");
        }
        
		var htmlString = '\
		<!DOCTYPE html>\
		<html>\
			<header>\
				<meta http-equiv="refresh" content="0; url=/uploadStatus" />\
			</header>\
		</html>';
		
		res.send(htmlString);
		
		console.log(uploadedFileName + ' uploaded to  ' + uploadedFilePath);
		console.log('finishing old program...');
		openplc.kill('SIGTERM');
		plcRunning = false;
		compilationOutput = '';
		compilationEnded = false;
		compilationSuccess = false;
		optimizeCode(uploadedFileName);
    });
});

app.post('/api/changeModbusCfg',function(req,res)
{
    upload(req,res,function(err) 
    {
        if(err) 
        {
            return res.end("Error uploading file.");
        }
		
        var htmlString = '\
		<!DOCTYPE html>\
		<html>\
			<header>\
				<meta http-equiv="refresh" content="5; url=/" />\
				<meta name="viewport" content="width=device-width, user-scalable=no">\
				<style>\
					input[type=text] {border:0px; border-bottom:1px solid black; width:100%}\
					button[type=button] \
					{\
						padding:10px; \
						background-color:#4369DB; \
						border-radius:10px; \
						border-style:double; \
						color:white;\
						font-size:large;\
						margin: 5 auto;\
						width: 150px;\
					} \
				</style>\
			</header>\
			<body>\
				<p align="center" style="font-family:verdana; font-size:60px; margin-top: 0px; margin-bottom: 10px">OpenPLC Server</p>\
				<p align="center" style="font-family:verdana; font-size:25px; margin-top: 0px; margin-bottom: 10px"><br>Modbus configuration file uploaded</p>\
			</body>\
		</html>';
		
		res.send(htmlString);
		
		var mover = spawn('mv', ['-f', './st_files/' + uploadedFileName, './core/mbconfig.cfg']);
		mover.on('close', function(code)
		{
			if (code != 0)
			{
				console.log('error moving modbus config file');
			}
		});
		var copier = spawn('cp', ['-f', './core/mbconfig.cfg', './']);
		copier.on('close', function(code)
		{
			if (code != 0)
			{
				console.log('error copying modbus config file');
			}
		});
    });
});

app.listen(8080,function()
{
    console.log("Working on port 8080");
});

app.get('/viewLogs',function(req,res)
{
	var htmlString = '\
	<!DOCTYPE html>\
	<html>\
		<header>\
			<meta http-equiv="refresh" content="3">\
			<meta name="viewport" content="width=device-width, user-scalable=no">\
			<style>\
				input[type=text] {border:0px; border-bottom:1px solid black; width:100%}\
				button[type=button] \
				{\
					padding:10px; \
					background-color:#4369DB; \
					border-radius:10px; \
					border-style:double; \
					color:white;\
					font-size:large;\
					margin: 5 auto;\
					width: 150px;\
				} \
			</style>\
		</header>\
		\
		<body>\
			<p align="center" style="font-family:verdana; font-size:60px; margin-top: 0px; margin-bottom: 10px">OpenPLC Server</p>\
			<div style="text-align:left; font-family:verdana; font-size:16px"> \
				<p>';
					htmlString += plcLog;
					htmlString += '\
				</p>\
			</div>\
		</body>\
	</html>';
	
	htmlString = htmlString.replace(/(?:\r\n|\r|\n)/g, '<br />');
	res.send(htmlString);
});



app.get('/IDS',function(req,res)
{
	var htmlString = '\
	<!DOCTYPE html>\
	<html>\
		<header>\
			<meta http-equiv="refresh" content="3">\
			<meta name="viewport" content="width=device-width, user-scalable=no">\
			<style>\
				input[type=text] {border:0px; border-bottom:1px solid black; width:100%}\
				button[type=button] \
				{\
					padding:10px; \
					background-color:#4369DB; \
					border-radius:10px; \
					border-style:double; \
					color:white;\
					font-size:large;\
					margin: 5 auto;\
					width: 150px;\
				} \
			</style>\
		</header>\
		\
		<body>\
			<p align="center" style="font-family:verdana; font-size:60px; margin-top: 0px; margin-bottom: 10px">SnapShotter IDS Logs</p>\
			<div style="text-align:left; font-family:verdana; font-size:16px"> \
				<p>';
					htmlString += idsLog;
					htmlString += '\
				</p>\
			</div>\
		</body>\
	</html>';

	htmlString = htmlString.replace(/(?:\r\n|\r|\n)/g, '<br />');
	res.send(htmlString);
});




app.get('/uploadStatus',function(req,res)
{
	var htmlString = '\
	<!DOCTYPE html>\
	<html>\
		<header>';
			if (!compilationEnded)
			{
				htmlString += '<meta http-equiv="refresh" content="3">';
			}
			htmlString += '\
			<meta name="viewport" content="width=device-width, user-scalable=no">\
			<style>\
				input[type=text] {border:0px; border-bottom:1px solid black; width:100%}\
				button[type=button] \
				{\
					padding:10px; \
					background-color:#4369DB; \
					border-radius:10px; \
					border-style:double; \
					color:white;\
					font-size:large;\
					margin: 5 auto;\
					width: 150px;\
				} \
			</style>\
		</header>\
		\
		<body>\
			<p align="center" style="font-family:verdana; font-size:60px; margin-top: 0px; margin-bottom: 10px">OpenPLC Server</p>\
			<p align="center" style="font-family:verdana; font-size:25px; margin-top: 0px; margin-bottom: 10px"><br>';
			if (compilationEnded)
			{
				if (compilationSuccess)
				{
					htmlString += 'Program compiled without errors!</p>';
				}
				else
				{
					htmlString += 'Error compiling program. Please check console log.</p>';
				}
			}
			else
			{
				htmlString += 'Uploading program...</p>';
			}
			htmlString += '\
			<div style="text-align:left; font-family:verdana; font-size:16px"> \
				<p>';
					htmlString += compilationOutput;
					htmlString += '\
				</p>\
			</div>\
		</body>\
	</html>';
	
	htmlString = htmlString.replace(/(?:\r\n|\r|\n)/g, '<br />');
	res.send(htmlString);
});

function showMainPage(req,res)
{
	var htmlString = '\
	<!DOCTYPE html>\
	<html>\
		<header>\
			<meta name="viewport" content="width=device-width, user-scalable=no">\
			<style>\
				input[type=text] {border:0px; border-bottom:1px solid black; width:100%}\
				button[type=button] \
				{\
					padding:10px; \
					background-color:#555555; \
					border-radius:10px; \
					border-style:double; \
					color:white;\
					font-size:large;\
					margin: 5 auto;\
					width: 150px;\
				} \
			</style>\
		</header>\
		\
		<body>\
			<p align="center" style="font-family:verdana; font-size:60px; margin-top: 0px; margin-bottom: 10px">OpenPLC Server</p>';
			if (plcRunning == true)
			{
				htmlString += '<p align="center" style="font-family:verdana; font-size:25px; margin-top: 0px; margin-bottom: 10px"><br>Current PLC Status: <font color = "green">Running</font></p>';
			}
			else
			{
				htmlString += '<p align="center" style="font-family:verdana; font-size:25px; margin-top: 0px; margin-bottom: 10px"><br>Current PLC Status: <font color = "red">Stopped</font></p>';
			}
			htmlString += '\
			<br>\
			<div style="text-align:center">  \
				<button type="button" style="background-color:green" onclick="location.href=\'run\';">Run</button>\
				<button type="button" style="background-color:FireBrick" onclick="location.href=\'stop\';">Stop</button>\
			</div> \
			<br>\
			<div style="text-align:center">  \
				<button type="button" value="New Tab"  style="width:300px" onclick="window.open(\'viewLogs\')">View PLC logs</button>\
			</div> \
			<br>\
			<div style="text-align:center">  \
				<button type="button" value="New Tab"  style="width:300px" onclick="window.open(\'IDS\')">SnapShotter IDS Logs</button>\
			</div> \
			<br><br><br>\
			<p align="center" style="font-family:verdana; font-size:25px; margin-top: 0px; margin-bottom: 10px">Change PLC Program</p>\
			<div style="text-align:center">  \
				<form id        =  "uploadForm"\
					enctype   =  "multipart/form-data"\
					action    =  "/api/upload"\
					method    =  "post">\
					<br>\
					<input type="file" name="file" id="file" class="inputfile" accept=".st">\
					<input type="submit" value="Upload Program" name="submit">\
				</form>\
			</div> \
			<br><br><br>\
			<p align="center" style="font-family:verdana; font-size:25px; margin-top: 0px; margin-bottom: 10px">Change Modbus Master Configuration</p>\
			<p align="center" style="font-family:verdana; font-size:14px; margin-top: 0px; margin-bottom: 10px">Changing this only have effect if OpenPLC is using the Modbus Master Driver</p>\
			<div style="text-align:center">  \
				<form id        =  "uploadMB"\
					enctype   =  "multipart/form-data"\
					action    =  "/api/changeModbusCfg"\
					method    =  "post">\
					<br>\
					<input type="file" name="mbConfig" id="mbConfig" class="inputfile" accept=".cfg">\
					<input type="submit" value="Upload Configuration" name="submit">\
				</form>\
			</div> \
		</body>\
	</html>';
	
	res.send(htmlString);
}

function optimizeCode(fileName)
{
	console.log('optimizing ST code...');
	compilationOutput += 'optimizing ST code...\r\n';
	var optimizer = spawn('./st_optimizer', ['./st_files/' + fileName, './st_files/' + fileName]);
	
	optimizer.stdout.on('data', function(data)
	{
		console.log('' + data);
		compilationOutput += data;
		compilationOutput += '\r\n';
	});
	optimizer.stderr.on('data', function(data)
	{
		console.log('' + data);
		compilationOutput += data;
		compilationOutput += '\r\n';
	});
	optimizer.on('close', function(code)
	{
		if (code != 0)
		{
			console.log('Error optimizing program. Please check console log');
			compilationOutput += 'Error optimizing program. Please check console log\r\n';
			compilationEnded = true;
		}
		else
		{
			console.log('Program optimized successfully');
			compilationOutput += 'Program optimized successfully\r\n';
			compileProgram(fileName);
		}
	});
}

function compileProgram(fileName)
{
	console.log('compiling new program...');
	compilationOutput += 'compiling new program...\r\n';
	var compiler = spawn('./iec2c', ['./st_files/' + fileName]);
	
	compiler.stdout.on('data', function(data)
	{
		console.log('' + data);
		compilationOutput += data;
		compilationOutput += '\r\n';
	});
	compiler.stderr.on('data', function(data)
	{
		console.log('' + data);
		compilationOutput += data;
		compilationOutput += '\r\n';
	});
	compiler.on('close', function(code)
	{
		if (code != 0)
		{
			console.log('Error compiling program. Please check console log');
			compilationOutput += 'Error compiling program. Please check console log\r\n';
			compilationEnded = true;
		}
		else
		{
			console.log('Program compiled successfully');
			compilationOutput += 'Program compiled successfully\r\n';
			moveFiles();
		}
	});
}

function moveFiles()
{
	console.log('moving files...');
	compilationOutput += 'moving files...\r\n';
	var copier = spawn('mv', ['-f', 'POUS.c', 'POUS.h', 'LOCATED_VARIABLES.h', 'VARIABLES.csv', 'Config0.c', 'Config0.h', 'Res0.c', './core/']);
	copier.on('close', function(code)
	{
		if (code != 0)
		{
			console.log('error moving files');
			compilationOutput += 'error moving files\r\n';
			compilationEnded = true;
		}
		else
		{
			compileOpenPLC();
		}
	});
}



function intrusionDetection(indata)
	{
	var ids_report = indata.toString();
	var pt_index = ids_report.indexOf("plaintext");
	var currentOp ='';
	var currentTime ='';
	if (pt_index !== -1){
	console.log(ids_report.substring(pt_index));
	//plcLog += ids_report.substring(pt_index); 
	//plcLog += '\r\n';
	currentOp = ids_report.substring(pt_index+36,pt_index+40);
	outCheck += currentOp;
	currentTime = ids_report.substring(pt_index+24,pt_index+32);
	time += currentTime;
	idsLog += "\n Current op: "+currentOp+"\n"+"Previous op: "+outCheck.substring(outCheck.length -8,outCheck.length-4)+"\n"+"Current time: "+parseInt(currentTime,16)+"\n"+"Previous time: "+parseInt(time.substring(time.length -16,time.length-8),16)+"\n"; 
	//idsLog += '\r\n';
	//console.log("outputCheck: ",outCheck);
	//console.log("Time: ",time);
	console.log("Current op: ",currentOp);
	console.log("Previous op: ",outCheck.substring(outCheck.length -8,outCheck.length-4));
	console.log("Current time: ",parseInt(currentTime,16));
	console.log("Previous time: ",parseInt(time.substring(time.length -16,time.length-8),16));
	if (currentOp == "0000" && outCheck.substring(outCheck.length -8,outCheck.length-4)=="8000" && (parseInt(currentTime,16)-(parseInt(time.substring(time.length -16,time.length-8),16)))!=40){
	console.log('******Intrusion is detected!!!******');
	idsLog += '******Intrusion is detected!!!******'; 
	idsLog += '\r\n';
	idsLog = '******Alert: Intrusion is detected!!!******\r\n';
	idsLog += 'Response: Reseting PLC to last clean state...\r\n';
	idsLog += 'Response: Ending malicious program...';
	console.log('Reseting PLC to last clean state...');
	console.log('Ending malicious program...');
	openplc.kill('SIGTERM');
	plcRunning = false;
	compilationOutput = '';
	compilationEnded = false;
	compilationSuccess = false;
	//idsLog = 'Reseting PLC to last clean state...\r\n';
	//openplc = spawn('./core/openplc');
	uploadedFileName = 'helloworld.st';
	uploadedFilePath = 'st_files/helloworld.st'
	compileProgram(uploadedFileName);
	}
	}
	}







function compileOpenPLC()
{
	console.log('compiling OpenPLC...');
	compilationOutput += 'compiling OpenPLC...\r\n';
	
	var exec = require('child_process').exec;
	exec('./build_core.sh', function(error, stdout, stderr) 
	{
		console.log('stdout: ' + stdout);
		console.log('stderr: ' + stderr);
		compilationOutput += stdout + '\r\n';
		compilationOutput += stderr + '\r\n';
		if (error !== null) 
		{
			console.log('exec error: ' + error);
			console.log('error compiling OpenPLC. Please check your program');
			compilationOutput += 'exec error: ' + error + '\r\n';
			compilationOutput += 'error compiling OpenPLC. Please check your program\r\n';
		}
		else 
		{
			console.log('compiled without errors');
			compilationOutput += 'compiled without errors\r\n';
			console.log('Starting OpenPLC Software...');
			plcLog = 'Starting OpenPLC Application...\r\n';
			openplc = spawn('./core/openplc');
			openplc.stdout.on('data', function(data)
			{
				plcLog += data;
				intrusionDetection(data);
								
				plcLog += '\r\n';
			});
			openplc.stderr.on('data', function(data)
			{
				plcLog += data;
				plcLog += '\r\n';
			});
			openplc.on('close', function(code)
			{
				plcLog += 'OpenPLC application terminated\r\n';
			});
			
			plcRunning = true;
			compilationSuccess = true;
		}
		compilationEnded = true;
	});
}
