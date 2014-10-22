# asterisk.io

node.js asterisk pbx io

## How to use

```javascript
var aio = require('asterisk.io'),
    ami = null;


ami = aio.ami(
    '192.168.1.31',     // this is my virtual machine where I have Asterisk PBX installed
                        // you should change with yours

    5038,               // the default port number setup in "/etc/asterisk/manager.conf"
                        // in "general" section

    'admin',            // manager username

    'admin'             // manager password
);

ami.on('error', function(err){
    throw err;
});

ami.on('ready', function(){

    // connected && authenticated

    ami.action('CoreSettings', {}, function(data){
        console.log('CoreSettings', data);
    });

});

// this is any event from asterisk pbx
ami.on('eventAny', function(data){
    console.log(data.Event, data);
});

// this is the 'Shutdown' event from asterisk pbx
ami.on('eventShutdown', function(data){
    console.log(data.Event, data);
});
```

### Events

A list of events from asterisk pbx can be found at [asterisk wiki](https://wiki.asterisk.org/wiki/display/AST/Asterisk+13+AMI+Events) page.

IMPORTANT: The list of events depends of your asterisk version installed.

Catch all events from asterisk ami with **eventAny**. Example:

```javascript
ami.on('eventAny', function(data){
    console.log(data.Event, data);
});
```

Catch specific event from asterisk ami with **eventXYZ**. Example:

```javascript
// Bridge
app.ami.on('eventBridge', function(data){
    console.log('eventBridge', data);
});

// Hangup
app.ami.on('eventHangup', function(data){
    console.log('eventHangup', data);
});
```

### Methods (Actions)

A list of actions that can be send to asterisk pbx can be found at [asterisk wiki](https://wiki.asterisk.org/wiki/display/AST/Asterisk+13+AMI+Actions) page.

IMPORTANT: The list of actions depends of your asterisk version installed.

Send an action and get the response in a callback function.

```javascript
ami.action('CoreSettings', {}, function(data){
    console.log('CoreSettings', data);
});

ami.action('BridgeKick', {Channel: 'channel id'}, function(data){
    console.log('BridgeKick', data);
});
```

IMPORTANT: In the second parameter (key/value pairs) **don't put** ActionID key, it will be rewritten by the library to keep internal track of actions send and callback functions.

## TODO

- [ARI](https://wiki.asterisk.org/wiki/display/AST/Asterisk+13+ARI)
- [AGI](https://wiki.asterisk.org/wiki/display/AST/Asterisk+13+AGI+Commands)
- UI