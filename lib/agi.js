/**
 * @file Asterisk Gateway Interface (AGI).
 * @author Zugravu Eugen Marius <marius@zugravu.com>
 * @see {@link https://wiki.asterisk.org/wiki/display/AST/Asterisk+13+AGI+Commands|Asterisk 13 AGI Commands.}
 */

/** Node modules used. */
var node = {
        net: require('net'),
        util: require('util'),
        Transform: require('stream').Transform,
        EventEmitter: require('events').EventEmitter
    },
    /** Const errors used by module. */
    error = {
        E_AGI_UNDEFINED:                "Undefined error.",
        E_AGI_ARGUMENT_PORT:            "Argument 'port' missing in function call.",
        E_AGI_SERVER_ERROR:             "Server error. Code: %s.",
        E_AGI_SERVER_CLOSE:             "Server closed.",
        E_AGI_SOCKET_ERROR:             "Socket error. Code: %s.",
        E_AGI_SOCKET_CLOSE:             "Socket closed.",
        E_AGI_COMMAND_EMPTY:            "Empty command.",
        E_AGI_IVR_AGI_NETWORK_SCRIPT:   "Missing 'ivr.agi_network_script'.",
        E_AGI_IVR_ENTRY:                "Missing 'ivr.entry' menu."
    };

/**
 * AGI Error.
 *
 * @constructor
 * @param {string} name - error const name
 */
function AGIError(name){
    var name = name || null,
        args = args || [],
        i = 1,
        message = '';

    if(!error[name]){
        name = 'E_AGI_UNDEFINED';
    }

    args.push(error[name]);

    while(arguments[i]){
        args.push(arguments[i]);
        i++;
    }

    message = node.util.format.apply(node.util, args);

    Error.call(this);
    Error.captureStackTrace(this, arguments.callee);
    this.message = message;
    this.name = name;
}

AGIError.prototype.__proto__ = Error.prototype;


/**
 * Stream parser.
 *
 * @constructor
 * @param {object} options - stream.Transform object
 */
function AGIParser(options){
    node.Transform.call(this, options);
    this._localBuffer = '';
    this._inBody = false;
}

node.util.inherits(AGIParser, node.Transform);

AGIParser.prototype._transform = function(chunk, encoding, done){
    var eol = "\n",                     // end of line
        eom = ["\n\n", "\r\n\r\n"],     // end of message
        foundEol = -1,
        foundEom = -1,
        foundEomStr = '',
        eomIndex = 0,
        tmpLocalBuffer = '',
        message = '';

    // add chunk to local buffer
    this._localBuffer += chunk.toString();

    // temporary variable of local buffer as string
    tmpLocalBuffer = this._localBuffer;

    // we have agi_xyz variables?
    if(!this._inBody){

        // try to find end of message with any separator
        eomIndex = 0;
        while(eom[eomIndex]){

            // search at least one message separator
            while((foundEom = tmpLocalBuffer.indexOf(eom[eomIndex])) != -1){
                // we have a message

                // separator found, save it
                foundEomStr = eom[eomIndex];

                // get a message
                message = tmpLocalBuffer.substring(0, foundEom);

                // remove this message from local buffer
                tmpLocalBuffer = tmpLocalBuffer.substring(foundEom+foundEomStr.length);

                // we have a complete message, build key, value pairs
                var lines = message.split(eol),
                    lineIndex = 0,
                    messajeJson = {},
                    key = '',
                    value = '',
                    foundColon = -1;

                // parse evey line from the message
                while(lines[lineIndex]){

                    // found colon on line
                    foundColon = lines[lineIndex].indexOf(':');

                    // check if we have a colon in the line
                    if(foundColon != -1){
                        // we have a good line let extract key, value pair
                        key = lines[lineIndex].slice(0, foundColon).trim();
                        value = lines[lineIndex].slice(foundColon+1).trim();

                        if(key.length > 0){
                            // add key, value to object
                            messajeJson[key] = value;
                        }
                    } else {
                        // not a good line message, do nothing with it
                    }
                    lineIndex++;
                }

                this.emit('headers', messajeJson);
                this._inBody = true;
            }

            eomIndex++;
        }

        // save the new local buffer
        this._localBuffer = tmpLocalBuffer;

    } else {

        while((foundEol = tmpLocalBuffer.indexOf(eol)) != -1){

            // get the first message, until \n
            message = tmpLocalBuffer.substring(0, foundEol);

            this.emit('line', message);

            // remove this message from local buffer
            tmpLocalBuffer = tmpLocalBuffer.substring(foundEol+eol.length);
        }

        // save the new local buffer
        this._localBuffer = tmpLocalBuffer;

    }

    // tell stream.Transform to continue
    done();
}

/**
 * AGI Handler.
 *
 * @constructor
 * @param {socket} object - net.Socket object
 */
function AGIHandler(socket){
    var me = this,
        parser = new AGIParser(),
        multiline = false,
        command = {};

    node.EventEmitter.call(me);

    socket.setEncoding('utf8');
    parser.setEncoding('utf8');

    parser.on('headers', function(headers){
        for(var x in headers){
            me[x] = headers[x];
        }
        me.emit('ready');
    });

    parser.on('line', function(line){

        if(line.toLowerCase() == 'hangup'){
            me.emit('hangup');
            socket.destroy();
            return;
        }

        if(line.substring(0, 11) == '520-Invalid'){
            multiline = true;
        }

        if(multiline){
            command.rx += line+"\n";
            if(line.search('520 End of proper') != -1){
                multiline = false;
            }
        } else {
            command.rx = line;
        }

        if(multiline){
            return;
        }

        if(typeof command.cb == 'function'){

            var code = command.rx.substring(0, 3),
                result = null,
                data = null;

            code = parseInt(code);

            if(isNaN(code)){
                command.cb();
                return;
            }

            if(code != 200){
                command.cb(code);
                return;
            }

            result = command.rx.substring(4).replace('result=', '');
            if(result.indexOf(" ") != -1){
                result = result.substr(0, result.indexOf(" "));
            }
            result = parseInt(result);

            data = command.rx.split(" ");
            if(data.length == 3){
                data = data[2].substring(1, data[2].length-1);
            } else {
                data = null;
            }

            command.cb(code, result, data);
        }

    });

    socket.on('error', function(err){
        me.emit('error', new AGIError('E_AGI_SOCKET_ERROR', err.code));
    });

    socket.on('close', function(){
        me.emit('close', new AGIError('E_AGI_SOCKET_CLOSE'));
    });

    socket.pipe(parser);

    /**
     * Execute command on asterisk and return code, result and data in callback function.
     *
     * @param {string} cmd - AGI Command with paramentes.
     * @param {function} cb - Callback function when response is available.
     */
    this.command = function(cmd, cb){
        var cmd = cmd || '',
            cb = (typeof cb == 'function') ? cb : new Function();

        command = {
            tx: cmd,
            rx: '',
            cb: cb
        }

        socket.write(cmd+"\n");
    },

    /**
     * Close client socket connection.
     */
    this.close = function(){
        socket.destroy();
    }
}

node.util.inherits(AGIHandler, node.EventEmitter);

/**
 * AGI IVR Handler.
 *
 * @param {object} agiHandler - AGIHandler instance.
 * @param {object} ivr - user defined IVR object.
 */
function AGIIVR(agiHandler, ivr){
    var playMenu = null;

    playMenu = function(menu, index){
//        if(!ivr[menu]) {
//            agiHandler.close();
//            return;
//        }
        if(!menu.cmds){
            agiHandler.close();
            return;
        }
        if(!menu.cmds[index]){
            agiHandler.close();
            return;
        }
        if(!menu.cmds[index].command) {
            agiHandler.close();
            return;
        }

        console.log(menu.cmds[index].command);

        agiHandler.command(menu.cmds[index].command, function(code, result, data){
            console.log('     %s', JSON.stringify(arguments));
            if(code == 200){

                if(String.fromCharCode(result) == "1" && menu.cmds[index].key1){
                    playMenu(menu.cmds[index].key1, 0);
                    return;
                } else if(String.fromCharCode(result) == "2" && menu.cmds[index].key2){
                    playMenu(menu.cmds[index].key2, 0);
                    return;
                } else if(String.fromCharCode(result) == "3" && menu.cmds[index].key3){
                    playMenu(menu.cmds[index].key3, 0);
                    return;
                } else if(String.fromCharCode(result) == "4" && menu.cmds[index].key4){
                    playMenu(menu.cmds[index].key4, 0);
                    return;
                } else if(String.fromCharCode(result) == "5" && menu.cmds[index].key5){
                    playMenu(menu.cmds[index].key5, 0);
                    return;
                } else if(String.fromCharCode(result) == "6" && menu.cmds[index].key6){
                    playMenu(menu.cmds[index].key6, 0);
                    return;
                } else if(String.fromCharCode(result) == "7" && menu.cmds[index].key7){
                    playMenu(menu.cmds[index].key7, 0);
                    return;
                } else if(String.fromCharCode(result) == "8" && menu.cmds[index].key8){
                    playMenu(menu.cmds[index].key8, 0);
                    return;
                } else if(String.fromCharCode(result) == "9" && menu.cmds[index].key9){
                    playMenu(menu.cmds[index].key9, 0);
                    return;
                } else if(String.fromCharCode(result) == "0" && menu.cmds[index].key0){
                    playMenu(menu.cmds[index].key0, 0);
                    return;
                } else if(String.fromCharCode(result) == "*" && menu.cmds[index].keyAsterisk){
                    playMenu(menu.cmds[index].keyAsterisk, 0);
                    return;
                } else if(String.fromCharCode(result) == "#" && menu.cmds[index].keyPound){
                    playMenu(menu.cmds[index].keyPound, 0);
                    return;
                } else if(result == 0 && menu.cmds[index].keyNone){
                    playMenu(menu.cmds[index].keyNone, 0);
                    return;
                }

                playMenu(menu, index+1);

                return;
            }

            agiHandler.close();
        });
    }

    playMenu(ivr.entry, 0);
}

/**
 * Asterisk Gateway Interface.
 *
 * @constructor
 * @param {int} port - agi server port number
 * @param {string} host - agi host, default '0.0.0.0'
 */
function AGI(port, host){
    var me = this,
        port = port || 0,
        host = host || '0.0.0.0',
        server = null,

        ivrs = {};

    node.EventEmitter.call(me);

    function run(){
        if(!port){
            me.emit('error', new AGIError('E_AGI_ARGUMENT_PORT'));
            return false;
        }

        server = node.net.createServer();

        server.listen(port, host);

        server.on('listening', function(){
            me.emit('listening');
        });

        server.on('connection', function(socket){
            var handler = new AGIHandler(socket);

            handler.on('ready', function(){
                var ivrFound = false;

                for(var x in ivrs){
                    if(handler.agi_network_script && (x == handler.agi_network_script)){
                        AGIIVR(handler, ivrs[x]);
                        ivrFound = true;
                    }
                }

                if(!ivrFound){
                    me.emit('connection', handler);
                }
            });

        });

        server.on('error', function(err){
            me.emit('error', new AGIError('E_AGI_SERVER_ERROR', err.code));
        });

        server.on('close', function(){
            me.emit('close', new AGIError('E_AGI_SERVER_CLOSE'));
        });
    }

    process.nextTick(function(){
        run();
    });

    /**
     * Handler for 'close' method of server.
     *
     * @param {function} cb - Callback function when response is available.
     */
    this.close = function(cb){
        var cb = (typeof cb == 'function') ? cb : null;

        if(cb){
            server.close(cb);
            return;
        }

        server.close();
    }

    /**
     * Play a defined IVR object for all connection with agi_network_script = ivr.agi_network_script.
     *
     * @param {object} ivr - IVR as JSON object.
     */
    this.ivr = function(ivr, cb){
        var ivr = (typeof ivr == 'object') ? ivr : {},
            cb = (typeof cb == 'function') ? cb : new Function();

        if(!ivr.agi_network_script){
            cb(new AGIError('E_AGI_IVR_AGI_NETWORK_SCRIPT'));
            return;
        }

        if(typeof ivr.entry != 'object'){
            cb(new AGIError('E_AGI_IVR_ENTRY'));
            return;
        }

        ivrs[ivr.agi_network_script] = ivr;

        cb(null);
    }
}

node.util.inherits(AGI, node.EventEmitter);

module.exports = function(port, host){

    /** New instance fo AGI class. */
    return new AGI(port, host);
}
