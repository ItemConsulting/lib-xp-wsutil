
//****************************************************************************//
//*                                                                          *//
//*                          License                                         *//
//*                                                                          *//
//* Copyright 2017 Item Consulting AS                                        *//
//*                                                                          *//
//* Licensed under the Apache License, Version 2.0 (the "License");          *//
//* you may not use this file except in compliance with the License.         *//
//* You may obtain a copy of the License at                                  *//
//*                                                                          *//
//*     http://www.apache.org/licenses/LICENSE-2.0                           *//
//*                                                                          *//
//* Unless required by applicable law or agreed to in writing, software      *//
//* distributed under the License is distributed on an "AS IS" BASIS,        *//
//* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. *//
//* See the License for the specific language governing permissions and      *//
//* limitations under the License.                                           *//
//*                                                                          *//
//*                                                                          *//
//****************************************************************************//



//*************************************************//
//*             variable declarations             *//
//*************************************************//

var websocket = require('/lib/xp/websocket');
var ioLib = require('/lib/xp/io');
var portal = require('/lib/xp/portal');

var clientExpansions = {};

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
 * @name wsUtil
 * @class wsUtil
 * @classdesc Server side websocket utility extension library for Enonic XP
 * @requires /lib/xp/websocket
 * @requires /lib/xp/io
 * @requires /lib/xp/portal
 * @author Per Arne Drevland
 * @version 1.1.0
 * @example
 * var ws = require('/lib/wsUtil');
 * @hideconstructor
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
exports.returnScript                = returnScript;
exports.extend                      = extend;
exports.expandClient                = expandClient;
exports.getWsEvents                 = getWsEvents;


//*************************************************//
//*           Function declarations               *//
//*************************************************//


/**
 * @memberOf wsUtil
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
 * @class wsUtil.SocketEmitter
 * @memberOf wsUtil
 * @classdesc Create a new SocketEmitter instance to handle individual socket connections and emit events and listen
 * to events created by the client.
 * @returns {SocketEmitterInterface} Interface for handling incoming sockets
 * @since 0.0.1
 * @example
 * // Simple chat example
 *
 * var socketEmitter = new ws.SocketEmitter(); // create instance
 * var motd = 'Welcome to our chat';
 * var users = {};
 * socketEmitter.connect(connectionCallback);
 * function connectionCallback(socket) {
 *
 *  socket.emit('motd', motd); // Send message of the day
 *
 *  socket.on('register-username', function(username) { // Register username
 *   if (!users[username]) {              // if not taken
 *     users[username] = socket.id;       // Register the new user
 *     socket.emit('username', 'ok');     // Tell the client that username is ok
 *     socket.broadcast('user-enter', username); // Tell all clients that a new user has entered the chat
 *   }
 *   else {                              // if taken
 *     socket.emit('username', 'taken'); // Tell the client to chose again
 *   }
 *  });
 *
 *  socket.on('public-message', function(message) {
 *   socketEmitter.broadcast('public-message', message); // Broadcast public messages
 *  });
 *
 *  socket.on('private-message', function(message) {
 *   socket.sendTo(users[message.username], message.content); // Send private message with a simple user lookup
 *  });
 *
 *  socket.on('disconnect', function() {         // Clean up stuff when user leaves
 *   for (var username in users) {               // Find the correct user id
 *      if (users.hasOwnProperty(username) && users[username] === socket.id) {
 *        delete users[username];                // remove the user
 *        socketEmitter.broadcast('user-leave', username); // Broadcast that a user has left the chat
 *      }
 *   }
 *  });
 * }
 */
function SocketEmitter() {


    /**
     * @memberOf wsUtil.SocketEmitter
     * @property {EmitterUsers} _users Users that has a socket connection
     * @private
     * @inner
     */
    var _users = {};

    /**
     * @memberOf wsUtil.SocketEmitter
     * @property {EmitterHandlers} _handlers Handlers for all users and events
     * @private
     * @inner
     */
    var _handlers = {};

    /**
     * @memberOf wsUtil.SocketEmitter
     * @property {ConnectionCallback} _cb The callback function to call when a user connects
     * @private
     * @inner
     */
    var _cb;

    //
    // When a new user connects, do the following
    // Create a new user object and instantiate new on and emit functionalities.
    // Bind the new user object to the users object
    // Call the connect function
    //

    addHandlers("open", function (event) {
        var user = { id: event.session.id, on: new On(event.session.id), emit: new Emit(event.session.id), sendTo: sendTo};
        _users[event.session.id] = user;
        _cb(user);
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
     * @memberOf wsUtil.SocketEmitter.EmitterUsers
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
     * @class
     * @description Emit events with content to specific socket connection
     * @param {string} id The id of the socket connection
     * @returns {EmitInterface} Takes an event and a message object and sends to the socket connection
     * @since 0.0.1
     * @inner
     * @memberOf wsUtil.SocketEmitter
     * @private
     */
    function Emit(id) {
        /**
         *  @interface EmitInterface
         */
        return function (event, object) {
            var obj = { event: event, object: object};
            send(id, obj);
        }
    }

    /**
     * @class
     * @memberOf wsUtil.SocketEmitter
     * @description The emit event handlers acts on emit events from the clients
     * @param {string} id The id of the connection
     * @returns {OnInterface} Binds a handler to an emit event
     * @since 0.0.1
     * @inner
     * @private
     * */
    function On(id) {
        if (!_handlers.hasOwnProperty(id)) {
            _handlers[id] = {};
        }
        /**
         * @interface OnInterface
         */
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
        _cb = callback;
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

    /**
     * @interface SocketEmitterInterface
     */
    return {
        connect: connect,
        broadcast: broadcast
    }
}

/**
 * @memberOf wsUtil
 * @description Extends the library functionalities to create reusable extensions
 * @param exportObject {object} The object that extends the library
 * @see [Creating extensions]{@link https://itemconsulting.github.io/wsutil-server/extensions.html}
 * @example
 * // lib/extension.js
 * var ws = require('/lib/wsUtil');
 *
 * var extensionObject = { extension: extension };
 * ws.extend(extensionObject);
 *
 * function extension() {
 *   ws.addHandler('open', function(event) { log.info('Extension says hi!'); });
 * }
 * exports.extension = ws;
 *
 *
 * // service/extensionService/extensionService.js
 *
 * var extensionLib = require('extension').extension
 *
 * extensionLib.openWebsockets(exports);
 * extensionLib.extension(); // Activate extension
 */
function extend(exportObject) {
    for (var name in exportObject) {
        if (exportObject.hasOwnProperty(name)) exports[name] = exportObject[name]
    }
    return exports;
}

/**
 * @description Expand the client library with new functionalities. NOTE: The expansion object have direct access to the client library's inner variables and functions
 * @memberOf wsUtil
 * @param name {string | object} Name of the new client function or an object with key=name value=function
 * @param func {function} The function for the new client interface.
 * @example
 * // service/websocket/websocket.js
 * var ws = require('path/to/wsUtil');
 *
 * ws.expandClient('hello', function() { send('Hello'); // use the inner send function });
 *
 * ws.openWebsockets(exports);
 *
 * // socket.js
 *
 * var cws = new ExpWs();
 *
 * cws.hello();
 */
function expandClient(name, func) {
    if (typeof name === 'string') {
        clientExpansions[name] = func;
    }
    else if (typeof name === 'object' && !func) {
        for (var n in name) {
            if (name.hasOwnProperty(n)) {
                clientExpansions[n] = name[n];
            }
        }
    }
}


/**
 * @memberOf wsUtil
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
 * @memberOf wsUtil
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
 * @memberOf wsUtil
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
 * @memberOf wsUtil
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
 * @memberOf wsUtil
 * @description Creates a group with given name. If the autoRemove flag is set, if removes a user from the group when user closes connection
 * @param {string} name The name of the group
 * @param {boolean} [autoRemove] Removes the user from the group on close connection
 * @since 0.0.1
 */
function createGroup(name, autoRemove) {
    if (!groups.hasOwnProperty(name)) {
        groups[name] = {users: []};
        websocket.addToGroup(name);
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
 * @memberOf wsUtil
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
 * @memberOf wsUtil
 * @desc The function that binds to the exports webSocketEvent method. This function checks the ws event object for type
 * and calls the appropriate handler. Then it loops over the additional handlers and calls each one of them.
 * @param {object} event The event sent from the client
 * @since 1.1.0
 */
function getWsEvents(event) {
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

/**
 * @memberOf wsUtil
 * @description Opens the websocket connection and delegate events to handlers
 * @param {object} exp The exports object from the Enonic module that is assigned to handle websocket events
 * @param {string} [host=portal.serviceUrl({ service: 'websocket'})] The host for the service that serves the web sockets
 * @since 0.0.1
 */
function openWebsockets(exp, host) {
    exp.get = function(req) {
        return sendSocketResponse(req, host);
    };
    exp.webSocketEvent = getWsEvents;
}



function returnScript(host) {
    host = host || portal.serviceUrl({ service: 'websocket'});
    var file = ioLib.readText(ioLib.getResource(resolve('../assets/clientws.js')).getStream());
    file = file.replace('&HOST&', host).replace('&CLIENTEXPANSIONS&', JSON.stringify(clientExpansions, function(key, val) {
        return (typeof val === 'function') ? '' + val : val;
    }).replace(/"/g, "").replace(/\\n/g, "").replace(/\\/g, '"'));

    return {
        body: file,
        contentType: 'application/javascript'
    }
}

/**
 * @memberOf wsUtil
 * @description Send the socket response for a socket request
 * @example
 * // someSocketService.js
 * ws = require('/lib/wsUtil');
 * exports.get = ws.sendSocketResponse;
 * // or
 * exports.get = function(req) {
 *  return ws.sendSocketResponse(req);
 *  }
 * @param {object} req The request object passed to the server
 * @param {string} [host=portal.serviceUrl({ service: 'websocket'})] - The url to the service that serves the web sockets
 * @returns {SocketResponse} The response object
 * @since 0.0.1
 */
function sendSocketResponse(req, host) {
    if (!req.webSocket) {
       return returnScript(host);
    }
    else return responseObject;
}

/**
 * @memberOf wsUtil
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
 * @memberOf wsUtil
 * @description Set all socket event handlers
 * @param {object} handlers
 * @since 0.0.1
 */
function setEventHandlers(handlers) {
    eventHandlers = handlers;
}

/**
 * @memberOf wsUtil
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
 * @typedef {object} EmitterUsers
 * @memberOf wsUtil.SocketEmitter
 * @alias EmitterUsers
 * @property {string} id The session id of the user
 * @property on {wsUtil.SocketEmitter~On} The client emitted event handler interface
 * @property {wsUtil.SocketEmitter~Emit} emit The server side emit message functionality,
 * @property {function} sendTo The server side send message to specific user functionality
 */

/**
 * @typedef {object} EmitterHandlers
 * @alias EmitterHandlers
 * @memberOf wsUtil.SocketEmitter
 * @property {object} id Id of the user
 * @property {object} id.event name of the event
 * @property {function} id.event.function the actual handler
 */

/**
 * @typedef {function} ConnectionCallback
 * @alias ConnectionCallback
 * @memberOf wsUtil.SocketEmitter
 * @description Callback function for connected users, this is being called with the connected user interface
 * @param {EmitterUsers} socket The connected user interface
 * @example
 * socketEmitter.connect(connectionCallback);
 *
 * function connectionCallback(socket) {
 *  // do something with connected socket
 * }
 */

/**
 * @typedef {object} SocketEmitterInterface
 * @alias SocketEmitterInterface
 * @memberOf wsUtil.SocketEmitter
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
 * @typedef {function} EmitInterface
 * @alias EmitFunction
 * @memberOf wsUtil.SocketEmitter~Emit
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
 * @typedef {function} OnInterface
 * @alias OnFunction
 * @memberOf wsUtil.SocketEmitter~On
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
 * @typedef {object} SocketResponse
 * @memberOf wsUtil
 * @description The response object sent from the server
 * @property {object} webSocket Main response object
 * @property {object} webSocket.data Additional data object
 * @property {string[]} webSocket.subProtocols Array of sub protocols to support
 */
