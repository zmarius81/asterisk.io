var aio = require('../'),
    agi = null,
    ivr = {};

agi = aio.agi(14000);

agi.on('error', function(err){
    console.log('agi.error', arguments);
});

agi.on('listening', function(){
    console.log('agi.listening on port 14000');
});

ivr = {
    agi_network_script: 'app300',
    entry: {
        cmds: [{
            command: 'Answer'
        },{
            command: 'Control Stream File "silence/10" "123"'
        }]
    },
    key1: {
        cmds: [{
            command: 'Verbose "key1" "1"'
        },{
            command: 'Control Stream File "silence/10" ""'
        }, {
            command: 'HangUp'
        }]
    },
    key2: {
        cmds: [{
            command: 'Verbose "key2" "1"'
        },{
            command: 'Control Stream File "silence/10" ""'
        }, {
            command: 'HangUp'
        }]
    },
    key3: {
        cmds: [{
            command: 'Verbose "key3" "1"'
        },{
            command: 'Control Stream File "silence/10" ""'
        }, {
            command: 'HangUp'
        }]
    }
};

ivr.entry.cmds[1].key1 = ivr.key1;
ivr.entry.cmds[1].key2 = ivr.key2;
ivr.entry.cmds[1].key3 = ivr.key3;
//ivr.entry.cmds[1].keyNone = ivr.entry;

agi.ivr(ivr, function(err){
    if(err){
        throw err;
    }
});

agi.on('close', function(){
    console.log('agi.close', arguments);
});

