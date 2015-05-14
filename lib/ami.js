/**
 * @file Asterisk Manager Interface (AMI).
 * @author Zugravu Eugen Marius <marius@zugravu.com>
 * @see {@link https://wiki.asterisk.org/wiki/display/AST/Asterisk+13+AMI+Events|Asterisk 13 AMI Events Documentation.}
 * @see {@link https://wiki.asterisk.org/wiki/display/AST/Asterisk+13+AMI+Actions|Asterisk 13 AMI Actions Documentation.}
 * @example
 *      // create a new client for asterisk ami
 *      var ami = require('asterisk.io').ami(
 *          'localhost',        // hostname or ip address or asterisk server
 *          5038,               // asterisk ami server port
 *          'admin',            // asterisk ami server configured username
 *          'admin'             // asterisk ami server configured password
 *      );
 *
 *      // error throw if
 *      // - could not connect to hostname
 *      // - could not log in with username/password
 *      // - asterisk server close socket
 *      ami.on('error', function(err){
 *          throw err;
 *      });
 *
 *      // connected and logged with asterisk ami
 *      ami.on('ready', function(){
 *      });
 *
 *      // fired for any event emitted by asterisk ami
 *      ami.on('eventAny', function(data){
 *          console.log(data);
 *      });
 *
 *      // when 'Shutdown' was emitted by asterisk ami, the event is 'event'+'Shutdown' will be emitted
 *      // data have full body message from asterisk ami
 *      ami.on('eventShutdown', function(data){
 *          // data is a JSON object
 *          console.log(data);
 *      });
 *
 *      // send an action to asterisk
 *      ami.action('CoreSettings', {}, function(data){
 *          console.log(data);
 *      });
 */

/** Node modules used. */
var node = {
        util: require('util'),
        net: require('net'),
        Transform: require('stream').Transform,
        EventEmitter: require('events').EventEmitter
    },
    /** Const errors used by module. */
    error = {
        E_AMI_UNDEFINED:            "Undefined error.",
        E_AMI_ARGUMENT_HOSTNAME:    "Argument 'hostname' missing in function call.",
        E_AMI_ARGUMENT_PORT:        "Argument 'port' missing in function call.",
        E_AMI_ARGUMENT_USERNAME:    "Argument 'username' missing in function call.",
        E_AMI_ARGUMENT_PASSWORD:    "Argument 'password' missing in function call.",
        E_AMI_SOCKED_ERROR:         "Could not connect to server. Code: %s.",
        E_AMI_SOCKED_CLOSE:         "Lost connection to server.",
        E_AMI_AUTH_FAILED:          "Authentication failed."
    };

/**
 * AMI Error.
 *
 * @constructor
 * @param {string} name - error const name
 */
function AMIError(name){
    var name = name || null,
        args = args || [],
        i = 1,
        message = '';

    if(!error[name]){
        name = 'E_AMI_UNDEFINED';
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

AMIError.prototype.__proto__ = Error.prototype;

/**
 * Stream parser.
 *
 * @constructor
 * @param {object} options - stream.Transform object
 */
function AMIParser(options){
    node.Transform.call(this, options);
    this._localBuffer = '';
}

node.util.inherits(AMIParser, node.Transform);

AMIParser.prototype._transform = function(chunk, encoding, done){
    var eol = "\n",                     // end of line
        eom = ["\n\n", "\r\n\r\n"],     // end of message
        foundEom = -1,
        foundEomStr = '',
        eomIndex = 0,
        tmpLocalBuffer = '',
        message = '';

    // add chunk to local buffer
    this._localBuffer += chunk.toString();

    // temporary variable of local buffer as string
    tmpLocalBuffer = this._localBuffer;

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

            // test what type of message we have: response or event
            if(messajeJson['Response'] && messajeJson['ActionID'] && messajeJson['Event'] ){
                // this is an event
                this.emit('event', messajeJson);
            } else if(messajeJson['Response'] && messajeJson['ActionID'] ){
                this.emit('response', messajeJson);
            } else if(messajeJson['Event']){
                // this is an event
                this.emit('event', messajeJson);
            }
        }

        eomIndex++;
    }

    // save the new local buffer
    this._localBuffer = tmpLocalBuffer;

    // tell stream.Transform to continue
    done();
}

/**
 * Asterisk Manager Interface.
 *
 * @constructor
 * @fires eventAny - Any event from asterisk ami.
 * @fires eventXYZ - Particular asterisk ami event.
 * @param {string} hostname - asterisk pbx server hostname or ip address
 * @param {int} port - asterisk pbx server port number, by default is 5038
 * @param {string} username - username (see /etc/asterisk/manager.conf)
 * @param {string} password - password (see /etc/asterisk/manager.conf)
 */
function AMI(hostname, port, username, password){
    var me = this,
        hostname = hostname || null,
        port = port || null,
        username = username || null,
        password = password || null,

        _ready = false,
        _parser = null,
        _socket = null,
        _actions = {};

    node.EventEmitter.call(me);

    function run(){
        if(!hostname){
            me.emit('error', new AMIError('E_AMI_ARGUMENT_HOSTNAME'));
            return false;
        }
        if(!port){
            me.emit('error', new AMIError('E_AMI_ARGUMENT_PORT'));
            return false;
        }
        if(!username){
            me.emit('error', new AMIError('E_AMI_ARGUMENT_USERNAME'));
            return false;
        }
        if(!password){
            me.emit('error', new AMIError('E_AMI_ARGUMENT_PASSWORD'));
            return false;
        }

        _parser = new AMIParser();
        _parser.setEncoding('utf8');

        _parser.on('response', function(data){
            if(data['ActionID'] && _actions[data['ActionID']] && _actions[data['ActionID']].cb){
                _actions[data['ActionID']].cb(data);
                // @TODO: what to do with multi body response messages
                // folow responses, then delete from _actions
                delete _actions[data['ActionID']];
            }
        });

        _parser.on('event', function(data){
            if(data['Event']){
                me.emit('eventAny', data);
                me.emit('event'+data['Event'], data);
            }
        });

        _socket = node.net.connect(port, hostname);
        _socket.setEncoding('utf8');

        _socket.on('connect', function(){
            me.action("Login", {Username: username, Secret: password, Events: "On"}, function(data){
                if(data['Response'] == 'Success'){
                    me.emit('ready', data);
                } else {
                    me.emit('error', new AMIError('E_AMI_AUTH_FAILED'));
                }
            });
        });

        _socket.on('error', function(err){
            me.emit('error', new AMIError('E_AMI_SOCKED_ERROR', err.code));
        });

        _socket.on('close', function(){
            me.emit('error', new AMIError('E_AMI_SOCKED_CLOSE'));
        });

        _socket.pipe(_parser);

    }

    process.nextTick(function(){
        run();
    });

    /**
     * Execute action on asterisk and return response in first parameter of callback function.
     *
     * @param {string} name - Asterisk action name.
     * @param {object} data - Key, Value pairs.
     * @param {function} cb - Callback function when response is available.
     */
    this.action = function(name, data, cb){
        var name = name || '',
            data = data || {},
            dataJson = {},
            dataTxt = '',
            //tmp = '',
            cb = (typeof cb == 'function') ? cb : new Function();

        data.Action = null;
        data.ActionID = null;

        dataJson.Action = name;
        dataJson.ActionID = actionIDGenerator();

        for(var x in data){
            if(data[x]){
                dataJson[x] = data[x];
            }
        }

        for(var x in dataJson){
            dataTxt += x+": "+dataJson[x]+"\r\n";
        }
        dataTxt += "\r\n";

        _actions[dataJson.ActionID] = {
            json: dataJson,
            txt: dataTxt,
            cb: cb
        }

        _socket.write(dataTxt);
    }
}

node.util.inherits(AMI, node.EventEmitter);

/**
 * Generate UUID strings.
 *
 * @return {string} generated uuid
 */
function actionIDGenerator(){
    var d = new Date().getTime();
    var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = (d + Math.random()*16)%16 | 0;
        d = Math.floor(d/16);
        return (c=='x' ? r : (r&0x7|0x8)).toString(16);
    });
    return uuid;
}


module.exports = function(server, port, username, password){

    /** New instance fo AMI class. */
    return new AMI(server, port, username, password);
}
