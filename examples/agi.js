var aio = require('../'),
    agi = null;

agi = aio.agi(14000);

agi.on('error', function(err){
    console.log('agi.error', arguments);
});

agi.on('listening', function(){
    console.log('agi.listening on port 14000');
});

agi.on('connection', function(agiHandler){
    console.log('agi.connection', arguments);

    agiHandler.on('hangup', function(){
        console.log('agiHandler.hangup', arguments);
    });

    agiHandler.on('error', function(err){
        console.log('agiHandler.error', arguments);
    });

    agiHandler.on('close', function(){
        console.log('agiHandler.close');
    });

    agiHandler.command('Answer', function(){
        agiHandler.command('Say Date "1414330073" ""', function(){
            agiHandler.command('Say Time "1414330073" ""', function(){
                agiHandler.command('HangUp', function(){

                });
            });
        });
    });

});

agi.on('close', function(){
    console.log('agi.close', arguments);
});


