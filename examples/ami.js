var aio = require('../'),
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

