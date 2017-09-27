/**
 * @namespace wsUtil
 */



//*************************************************//
//*             variable declarations             *//
//*************************************************//

var websocket = require('/lib/xp/websocket');

var responseObject = {
    webSocket: {
        data: {
            user: "test"
        },
        subProtocols: ["text"]
    }
};
var groups = {};

function defaultEventHandler(event) {
    log.info(JSON.stringify(event));
}

var additionalEventHandlers = {
    error: [],
    message: [],
    open: [],
    close: []
};

var eventHandlers = {
    error: defaultEventHandler,
    message: defaultEventHandler,
    open: defaultEventHandler,
    close: defaultEventHandler
};


//*************************************************//
//*                 Bindings                      *//
//*************************************************//


/**
 * @module wsUtil
 * @description Server side websocket utility extension library for Enonic XP
 * @requires /lib/xp/websocket
 * @author Per Arne Drevland
 * @version 0.0.1
 * @example
 * var ws = require('/lib/xp/wsUtil');
 */

exports.addHandlers                 = addHandlers;


exports.getGroupUsers               = getGroupUsers;


exports.addUserToGroup              = addUserToGroup;


exports.createGroup                 = createGroup;


exports.send                        = send;

exports.openWebsockets              = openWebsockets;

exports.sendSocketResponse          = sendSocketResponse;


exports.setEventHandler             = setEventHandler;

exports.setEventHandlers            = setEventHandlers;


exports.setSocketRequestResponse    = setSocketRequestResponse;


exports.SocketEmitter               = SocketEmitter;

exports.removeUserFromGroup         = removeUserFromGroup;


exports.sendToGroup                 = sendToGroup;


//*************************************************//
//*           Function declarations               *//
//*************************************************//


/**
 * @description extends the sendToGroup function from EnonicXP to stringify objects
 * @param {string} name Name of the group
 * @param {object|string} message Message to send to the group
 * @since 0.0.1
 * @example
 * // send to space 'global'
 * ws.sendToGroup('global', { hello: 'everyone in global' });
 */
function sendToGroup(name, message) {
    if (typeof message === 'object') message = JSON.stringify(message);
    websocket.sendToGroup(name, message);
}


/**
 * @name SocketEmitter
 * @type wsUtil.SocketEmitter
 * @class
 * @description Create a new SocketEmitter instance to handle individual socket connections and emit events and listen
 * to events created by the client.
 * @returns {SocketEmitterInterface}
 * @since 0.0.1
 * @constructor
 * @example
 * // create a new emitter instance
 * var socketEmitter = new ws.SocketEmitter();
 */
function SocketEmitter() {


    /**
     * @property {SocketEmitter.EmitterUsers} _users Users that has a socket connection
     * @member SocketEmitter
     * @type {SocketEmitter.EmitterUsers}
     */
    var _users = {};

    /**
     * @property {SocketEmitter.EmitterHandlers} _handlers Handlers for all users and events
     * @member SocketEmitter
     * @type {SocketEmitter.EmitterHandlers}
     */
    var _handlers = {};
    var cb;

    //
    // When a new user connects, do the following
    // Create a new user object and instantiate new on and emit functionalities.
    // Bind the new user object to the users object
    // Call the connect function
    //

    addHandlers("open", function (event) {
        var user = { id: event.session.id, on: new On(event.session.id), emit: new Emit(event.session.id), sendTo: sendTo};
        _users[event.session.id] = user;
        cb(user);
    });

    //
    // When a user close the connection, do the following
    // If handlers have disconnect event, fire the disconnect handler
    // Delete the user object from the users object
    // Remove the handlers for the user
    //

    addHandlers("close", function (event) {
        if (_handlers[event.session.id].hasOwnProperty("disconnect")) {
            _handlers[event.session.id].disconnect()
        }
        delete _users[event.session.id];
        delete _handlers[event.session.id];
    });

    //
    // When a new message event arrives, do the following
    // Try to parse the message, if the client side don't send the message as an object, it is probably an error
    // Log error as info
    // Try to call the users handler function for the event. If it fails it could be that the event handler doesn't exist
    // Log error as info
    //

    addHandlers("message", function(event) {
        try {
            var msg = JSON.parse(event.message);
            if (_handlers.hasOwnProperty(event.session.id) && _handlers[event.session.id].hasOwnProperty(msg.event)) {
                try {
                    _handlers[event.session.id][msg.event](msg.object);
                } catch (e) {
                    log.info(e);
                }
            }
            else {
                log.info("SOCKET-LIB: Unhandled event: " + msg.event);
                log.info(JSON.stringify(event));
            }
        } catch (e) {
            log.info("SOCKET-LIB: Wrong JSON format for client emit object");
            log.info(JSON.stringify(event));
        }
    });

    /**
     * @methodOf EmitterUsers
     * @description Let the connected socket object send message to other socket objects
     * @param {string} id The id of the socket recipient
     * @param {string} event The name of the event to emit
     * @param {object|string} message The content of the event
     * @since 0.0.1
     * @example
     * // Send message to a connected user
     * socketEmitter.sendTo('someId', 'someEvent', someMessage);
     */
    function sendTo(id, event, message) {
        var object = { event: event, object: message};
        send(id, object);
    }

    /**
     * @class Emit
     * @memberOf wsUtil.SocketEmitter
     * @description Emit events with content to specific socket connection
     * @param {string} id The id of the socket connection
     * @returns {EmitFunction} Takes an event and a message object and sends to the socket connection
     * @since 0.0.1
     */
    function Emit(id) {
        return function (event, object) {
            var obj = { event: event, object: object};
            send(id, obj);
        }
    }

    /**
     * @class On
     * @memberOf wsUtil.SocketEmitter
     * @description The emit event handlers acts on emit events from the clients
     * @param {string} id The id of the connection
     * @returns {Function} Binds a handler to an emit event
     * @since 0.0.1
     * */
    function On(id) {
        if (!_handlers.hasOwnProperty(id)) {
            _handlers[id] = {};
        }
        return function(event, handler) {
            _handlers[id][event] = handler;
        }

    }

    /**
     * @description This is the event that is being called when a new user connects
     * @param {ConnectionCallback} callback The callback to call when users connects
     * @memberOf wsUtil.SocketEmitter
     * */
    function connect(callback) {
        cb = callback;
    }

    /**
     * @description Emit an event to every connected users
     * @param {string} event The name of the event
     * @param {object|string} object The message of the emit event
     * @memberOf wsUtil.SocketEmitter
     * @since 0.0.1
     * */
    function broadcast(event, object) {
        var msg = {event: event, object: object};

        for (var id in _users) {
            if (_users.hasOwnProperty(id)) {
                send(id, msg);
            }
        }
    }

    return {
        connect: connect,
        broadcast: broadcast
    }
}


/**
 * @memberOf module:wsUtil
 * @description Add additional socket event handlers. This is the secondary handlers for the event and they are being pushed to the additional event handlers array
 * @param {string} event The name of the socket event
 * @param {function} handler The handler to bind to the event
 * @since 0.0.1
 * */
function addHandlers(event, handler) {
    if (additionalEventHandlers[event]) {
        additionalEventHandlers[event].push(handler);
    }
    else {
        log.error("Event missing, must be one of 'open', 'close', 'error' or 'message'")
    }
}

/**
 * @description Get all connected users from a group
 * @param {string} group Name of the group
 * @returns {?string[]} The array of users or undefined if group doesn't exist
 * @since 0.0.1
 */
function getGroupUsers(group) {
    if (groups[group]) {
        return groups[group].users;
    }
    else return undefined;
}

/**
 * @description Adds a user to a group if it exists. Create the group if it doesn't exist and the autoCreate flag is set
 * or log an error if not
 * @param {string} id The id of the user
 * @param {string} group The name of the group
 * @param {boolean} [autoCreate] The flag to create the group if it doesn't exist
 * @since 0.0.1
 *
 */
function addUserToGroup(id, group, autoCreate) {
    if (groups[group]) {
        groups[group].users.push(id);
        websocket.addToGroup(group, id);
    }
    else if (autoCreate) {
        createGroup(group, true);
        addUserToGroup(id, group, autoCreate);
    }
    else {
        log.error('No such group, try setting the autoCreate flag to true');
    }
}

/**
 * @description Removes a user from a group of given name, if the group is empty, it removes the group
 * @param {string} name Name of the group
 * @param {string} id The id of the user
 * @since 0.0.1
 */
function removeUserFromGroup(name, id) {
    groups[name].users.splice(groups[name].users.indexOf(id),1);
    if (groups[name].users.length === 0) {
        delete groups[name];
    }
    websocket.removeFromGroup(name, id);
}

/**
 * @description Creates a group with given name. If the autoRemove flag is set, if removes a user from the group when user closes connection
 * @param {string} name The name of the group
 * @param {boolean} [autoRemove] Removes the user from the group on close connection
 * @since 0.0.1
 */
function createGroup(name, autoRemove) {
    if (!groups.hasOwnProperty(name)) {
        groups[name] = {users: []};
        websocket.addGroup(name);
        if (autoRemove) {
            var found = false;
            additionalEventHandlers.close.forEach(function (t) {
                if (t.name === 'autoRemove') {
                    found = true;
                }
            });
            if (!found) {
                additionalEventHandlers.close.push(function autoRemove(event) {
                    websocket.removeFromGroup(name, event.session.id);
                    groups[name].users.splice(groups[name].users.indexOf(event.session.id), 1);
                    if (groups[name].users.length === 0) {
                        delete groups[name];
                    }
                })
            }

        }
    }
}

/**
 * @description Sends a message to given client, if the message is of type object it will be stringified
 * @param {string} id The id of the user
 * @param {string|object} message The message to send
 * @since 0.0.1
 */
function send(id, message) {
    if (typeof message === 'object') {
        websocket.send(id, JSON.stringify(message));
    }
    else {
        websocket.send(id, message);
    }
}

/**
 * @description Opens the websocket connection and delegate events to handlers
 * @param {object} exp The exports object from the Enonic module that is assigned to handle websocket events
 * @since 0.0.1
 */
function openWebsockets(exp) {
    exp.webSocketEvent = function (event) {
        if (eventHandlers[event.type]) {
            if (event.type === 'message') {
                try {
                    eventHandlers.message(JSON.parse(event.message));
                } catch(e) {
                    eventHandlers.message(event.message);
                }
            }
            else {
                eventHandlers[event.type](event);
            }

        }
        additionalEventHandlers[event.type].forEach(function(handler) {
            handler(event);
        })
    }
}

/**
 * @description Send the socket response for a socket request
 * @example
 * // someSocketService.js
 * ws = require('/path/to/socketUtils');
 * exports.get = ws.sendSocketResponse;
 * // or
 * exports.get = function(req) {
 *  return ws.sendSocketResponse(req);
 *  }
 * @param {object} req The request object passed to the server
 * @returns {SocketResponse} The response object
 * @since 0.0.1
 */
function sendSocketResponse(req) {
    if (!req.webSocket) {
        return { status: 404 }
    }
    else return responseObject;
}

/**
 * @description Sets a handler for given socket event
 * @param {'open'|'close'|'message'|'error'} event The name of the event
 * @param {function} handler The event handler
 * @since 0.0.1
 */
function setEventHandler(event, handler) {
    if (eventHandlers.hasOwnProperty(event)) {
        eventHandlers[event] = handler;
    }
    else {
        log.error("Event missing, must be one of 'open', 'close', 'error' or 'message'")
    }
}

/**
 * @description Set all socket event handlers
 * @param {object} handlers
 * @since 0.0.1
 */
function setEventHandlers(handlers) {
    eventHandlers = handlers;
}

/**
 * @description set custom socket response object. Default object is taken from {@link http://docs.enonic.com/en/stable/developer/ssjs/websockets.html Enonic doc}
 * @param {SocketResponse} response The socket response object
 * @since 0.0.1
 */
function setSocketRequestResponse(response) {
    responseObject = response;
}


//*************************************************//
//*                Type definitions               *//
//*************************************************//

/**
 * @namespace SocketEmitter
 */

/**
 * @typedef {object} SocketEmitter.EmitterUsers
 * @property {string} id The session id of the user
 * @property {wsUtil.SocketEmitter.On} on The client emitted event handler interface
 * @property {wsUtil.SocketEmitter.Emit} emit The server side emit message functionality,
 * @property {function} sendTo The server side send message to specific user functionality
 */

/**
 * @typedef {object} SocketEmitter.EmitterHandlers
 * @property {object} id Id of the user
 * @property {object} id.event name of the event
 * @property {function} id.event.function the actual handler
 */

/**
 * @namespace SocketEmitter
 * @typedef {function} SocketEmitter.ConnectionCallback
 * @description Callback function for connected users, this is being called with the connected user interface
 * @param {EmitterUsers} socket The connected user interface
 */

/**
 * @typedef {object} SocketEmitter.SocketEmitterInterface
 * @description Call the SocketEmitter constructor to receive a SocketEmitter interface
 * Use the interface to act on connection events from clients and broadcast events from the server
 *
 * @example
 * // Create the SocketEmitter
 * var socketEmitter = new ws.SocketEmitter();
 * // Get connection events
 * socketEmitter.connect(function(socket) {
 *  // Use the client socket connection to emit messages
 *  socket.emit('new-connection', { greetings: 'Hello from server' });
 *  // Use the client socket connection to listen to emitted events from user
 *  socket.on('some-event', function(message) {
 *    log.info('some-event message ' + JSON.stringify(message));
 *    });
 *  });
 *  // Broadcast messages to all users
 *  socketEmitter.broadcast('hello-everybody', { message: 'Hello from server' });
 *
 * @property {ConnectionCallback} connect A event that fires every time a user connects to the web socket
 * @property {function} broadcast Emit an event to all connected users
 */

/**
 * @typedef {function} SocketEmitter.EmitFunction
 * @description Returned function from the Emit class created by a user that has connected. This function takes an event and a message object/string and sends it to the
 * user that created the instance
 * @param {string} event The name of the emitted event
 * @param {string|object} message The message being sent
 * @example
 * // emitting any events
 * socketEmitter.connect(function(socket) {
 *  socket.emit('Hello is there anyone in there?', { just: 'nod if you can hear me' });
 * });
 *
 */

/**
 * @typedef {function} SocketEmitter.OnFunction
 * @description Returned function from the On class instance. This function takes an event and a handler. The handler is being called when a client emits the event
 * with or without parameters
 * @param {string} event The name of the emitted event from the client
 * @param {function} handler The emitted event handler
 * @example
 *
 * socketEmitter.connect(function(socket) {
 *  // example of handler without parameters
 *  socket.on('What is the meaning of life, the universe and everything?', function() {
 *      socket.emit('answer', calculateTheMeaningOfLifeTheUniverseAndEverything());
 *  });
 *  // example of handler with parameters
 *  socket.on('isPrime?', function(number) {
 *      function isPrime(num, iter) {
 *        if (!iter) iter = Math.floor(Math.sqrt(num));
 *        if (iter > 1) return isPrime(num, iter-1) ? num % iter !== 0 : false;
 *         return true
 *       }
 *       socket.emit('isPrime!', isPrime(number));
 *  });
 * })
 */

/**
 *@typedef {object} wsUtil.SocketResponse
 * @description The response object sent from the server
 * @property {object} webSocket Main response object
 * @property {object} webSocket.data Additional data object
 * @property {string[]} webSocket.subProtocols Array of sub protocols to support
 */