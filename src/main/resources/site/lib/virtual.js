//**************************************************************************//
//*                                                                        *//
//*                          License                                       *//
//*                                                                        *//
//* Copyright (C) 2017  Per Arne Drevland                                  *//
//*                                                                        *//
//* This program is free software: you can redistribute it and/or modify   *//
//* it under the terms of the GNU General Public License as published by   *//
//* the Free Software Foundation, either version 3 of the License, or      *//
//* (at your option) any later version.                                    *//
//*                                                                        *//
//* This program is distributed in the hope that it will be useful,        *//
//* but WITHOUT ANY WARRANTY; without even the implied warranty of         *//
//* MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the          *//
//* GNU General Public License for more details.                           *//
//*                                                                        *//
//* You should have received a copy of the GNU General Public License      *//
//* along with this program.  If not, see <https://www.gnu.org/licenses/>. *//
//*                                                                        *//
//**************************************************************************//

/** @namespace EnonicXP */

/**
 *
 * @class Ws
 * @memberOf EnonicXP
 * @classdesc The client EnonicXP web socket utility framework. The constructor will
 * try to guess the protocol and host for the connection if the optional host parameter is not provided
 * @since 0.0.1
 * @author Per Arne Drevland
 * @param [host] {string} The web socket hostname
 * @example
 * var cws = new EnonicXP.Ws();
 * @return {ClientWS} The new ClientWS instance
 */

/**
 * @name setHost
 * @function
 * @public
 * @memberOf ClientWS
 * @param host {string} The url to the host to connect to
 * @param [autoConnect] {boolean} If this flag is set the connection will be opened after this function has been called
 * @description Sets the hostname for the socket connection
 * @example
 * cws.setHost('wss://example.com');
 *
 */

/**
 * @name send
 * @function
 * @public
 * @memberOf ClientWS
 * @param message {string|object} The message to send to the server.
 * The function tries to stringify the message from JSON and sends the string message if it fails
 */

/**
 * @name setEventHandler
 * @function
 * @public
 * @description Sets a web socket event handler. Note that the 'message' handler takes the event.message string and tries to JSON parse it before it calls the handler
 * @param event {'open'|'close'|'message'|'error'} The web socket event to set handler on
 * @param handler {function} The handler for the provided event
 * @throws Will throw an exception if unknown event or if handler is not a function
 * @memberOf ClientWS
 */

/**
 * @name connect
 * @function
 * @public
 * @description Creates a new WebSocket object and sets the handlers for the web socket events
 * @memberOf ClientWS
 */

/**
 * @name setEventHandlers
 * @function
 * @public
 * @description This function takes an object and sets the web socket event handlers for each key=event value=handler
 * @param handlerObject {object} The handler object
 * @throws Will throw an error if supplied object is not valid
 * @see {@link setEventHandler}
 * @memberOf ClientWS
 */

/**
 * @name setDefaultHandler
 * @function
 * @public
 * @description Set the default handler for all events. If an event don't have a handler, the default handler will be called
 * @param defaultHandler {function}
 * @throws Invalid handler exception
 * @memberOf ClientWS
 */

/**
 * @name addHandlers
 * @function
 * @public
 * @description Add additional handlers for the web socket events. Note that the 'message' event takes the whole event object and not only the event.message as opposed to the [setEventHandler]{@link setEventHandler}
 * @param event {string} The web socket event
 * @param handler {function} The web socket event handler
 * @memberOf ClientWS
 */

/**
 * @name Io
 * @class
 * @public
 * @description Create a new Io instance to work with the server side SocketEmitter
 * @return {IoInterface}
 */

/**
 * @name isConnected
 * @property {boolean}
 * @public
 * @description Boolean value set to true by the internal WebSocket.onopen listener, and set to false again by the internal WebSocket.onclose listener
 * @memberOf ClientWS
 */

/**
 * @interface ClientWS
 * @description The interface for your web socket connection
 */

/**
 * @name on
 * @function
 * @public
 * @description Listens for provided server side emitted events
 * @param event {string} The name of the server side emitted event
 * @param handler {function} The handler for the server side emitted event
 * @throws Invalid handler exception
 * @memberOf IoInterface
 */

/**
 * @name emit
 * @function
 * @public
 * @description Emits an event to the server with provided message
 * @param event {string} The name of the event to emit
 * @param message {string | object} The message to send
 * @memberOf IoInterface
 */


/**
 * @interface IoInterface
 * @description The interface for the emitted events communications. This will automatically connect to the web socket server if no connection
 *
 */