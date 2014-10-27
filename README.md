# asterisk.io

node.js asterisk pbx io

[1. Install](#1-install)

[2. How to use](#2-how-to-use)

[2.1 AMI](#2-1-ami)

[2.1.1 Actions](#2-1-1-actions)

[2.1.2 Events](#2-1-2-events)

[2.2 AGI](#2-2-agi)

[3. TODO](#3-todo)

## 1. Install

```
npm install asterisk.io
```

## 2. How to use

```javascript
var aio = require('asterisk.io'),
    ami = null,   // see ami section
    agi = null;   // see agi section
```

### 2.1 AMI

Read more at [asterisk wiki](https://wiki.asterisk.org/wiki/display/AST/Asterisk+13+Documentation) for: [actions](https://wiki.asterisk.org/wiki/display/AST/Asterisk+13+AMI+Actions), [events](https://wiki.asterisk.org/wiki/display/AST/Asterisk+13+AMI+Events).

#### 2.1.1 Actions

A list of actions that can be send to asterisk pbx can be found at [asterisk wiki](https://wiki.asterisk.org/wiki/display/AST/Asterisk+13+AMI+Actions) page.

IMPORTANT: The list of actions depends of your asterisk version installed.

Send an action and get the response in a callback function.

```javascript
var aio = require('asterisk.io'),
    ami = null;

ami = aio.ami(
    'ip_or_hostname',   // Asterisk PBX machine

    5038,               // the default port number setup
                        // in "/etc/asterisk/manager.conf"
                        // in "general" section

    'admin',            // manager username

    'admin'             // manager password
);

ami.on('error', function(err){
    throw err;
});

ami.on('ready', function(){

    // connected && authenticated

    ami.action(
        'Originate',
        {
            Channel: 'SIP/101',
            Context: 'default',
            Priority: 1,
            Async: 'false',     // set Async to 'false' to
                                // get response in the callback function
            Exten: '102'
        },
        function(data){
            if(data.Response == 'Error'){
                console.log('Originate', data.Message);
                return;
            }
            console.log('Originate', data.Message);
        }
    );

});
```

#### 2.1.2 Events

A list of events from asterisk pbx can be found at [asterisk wiki](https://wiki.asterisk.org/wiki/display/AST/Asterisk+13+AMI+Events) page.

IMPORTANT: The list of events depends of your asterisk version installed.

Catch all events from asterisk ami with **eventAny**. Example:

```javascript
var aio = require('asterisk.io'),
    ami = null;

ami = aio.ami(
    'ip_or_hostname',   // Asterisk PBX machine

    5038,               // the default port number setup
                        // in "/etc/asterisk/manager.conf"
                        // in "general" section

    'admin',            // manager username

    'admin'             // manager password
);

ami.on('error', function(err){
    throw err;
});

// this catch any event from asterisk pbx
ami.on('eventAny', function(data){
    console.log(data.Event, data);
});
```

Catch specific event from asterisk ami with **eventXYZ**. Example:

```javascript
var aio = require('asterisk.io'),
    ami = null;

ami = aio.ami(
    'ip_or_hostname',   // Asterisk PBX machine

    5038,               // the default port number setup
                        // in "/etc/asterisk/manager.conf"
                        // in "general" section

    'admin',            // manager username

    'admin'             // manager password
);

ami.on('error', function(err){
    throw err;
});

// Bridge event
ami.on('eventBridge', function(data){
    console.log('eventBridge', data);
});

// Hangup event
ami.on('eventHangup', function(data){
    console.log('eventHangup', data);
});
```

### 2.2 AGI

Documetation for [agi commands](https://wiki.asterisk.org/wiki/display/AST/Asterisk+13+AGI+Commands) on [asterisk wiki](https://wiki.asterisk.org/wiki/display/AST/Asterisk+13+Documentation) page.

```javascript
var aio = require('../'),
    agi = null;

agi = aio.agi(14000); // port and host, if host is missing then '0.0.0.0' is used as host

agi.on('error', function(err){
    throw err;
});

agi.on('listening', function(){
    console.log('listening on port 14000');
});

agi.on('close', function(){
    console.log('close');
});

agi.on('connection', function(agiHandler){

    // all variables (key, value pairs) are
    // avaiable in agiHandler
    // example: agiHandler.agi_network
    //          agiHandler.agi_network_script
    //          agiHandler.agi_channel
    //          agiHandler.agi_xyz

    agiHandler.on('hangup', function(){
        console.log('hangup');
    });

    agiHandler.on('error', function(err){
        throw err;
    });

    agiHandler.on('close', function(){
        console.log('close');
    });

    // answer the channel
    agiHandler.command('Answer', function(code, result, data){

        // say date with "unix_timestamp" and "" as escape digits
        agiHandler.command('Say Date "1414330073" ""', function(code, result, data){

            // say time with "unix_timestamp" and "" as escape digits
            agiHandler.command('Say Time "1414330073" ""', function(code, result, data){

                // hangup the channel, this will raise hangup and close event
                agiHandler.command('HangUp', function(code, result, data){
                });

            });

        });

    });

});
```

## TODO

- [ARI](https://wiki.asterisk.org/wiki/display/AST/Asterisk+13+ARI)
- UI: real time user interface
