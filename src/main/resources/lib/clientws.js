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

(function (w) {
    if (!w.hasOwnProperty("ExpWS")) {
        w.ExpWS = {};
    }

    w.ExpWS = clientWebSocket;

    // noinspection UnterminatedStatementJS
    function clientWebSocket(hst) {

        var debug = w.location.host.indexOf('localhost') > -1 || w.location.host.indexOf('127.0.0') > -1;
        var prot = (w.isSecureContext && !debug) ? 'wss://' : 'ws://';
        var host = hst || prot + w.location.host  + '&HOST&';
        var ws;
        var additionalHandlers = {
            open: [],
            close: [],
            message: [],
            error: []
        };
        var defaultHandler = function (event) {
            console.log(event);
        };
        var handlers = {
            open: defaultHandler,
            close: defaultHandler,
            message: defaultHandler,
            error: defaultHandler
        };
        var connected = false;
        function connect() {
            ws = new WebSocket(host);
            ws.onopen =  function (event) {
                connected = true;
                if (handlers.hasOwnProperty('open')) {
                    handlers['open'](event);
                }
                additionalHandlers['open'].forEach(function (handler) {
                    handler(event);
                })
            };
            ws.onmessage = function (event) {
                var msg;
                try {
                    msg = JSON.parse(event.data);
                }
                catch (e) {
                    msg = event.data;
                }
                if (handlers.hasOwnProperty('message')) {
                    handlers['message'](msg);
                }
                additionalHandlers['message'].forEach(function (handler) {
                    handler(event);
                })
            };
            ws.onerror = function (event) {
                if (handlers.hasOwnProperty('error')) {
                    handlers['error'](event);
                }
                additionalHandlers['error'].forEach(function (handler) {
                    handler(event);
                })
            };
            ws.onclose = function (event) {
                connected = false;
                if (handlers.hasOwnProperty('close')) {
                    handlers['close'](event);
                }
                additionalHandlers['close'].forEach(function (handler) {
                    handler(event);
                })
            };
        }

        if (hst) connect();


        var ret = {
            setHost: function (hst, autoConnect) {
                host = hst;
                if (autoConnect) connect();
            },
            connect: connect,
            send: send,
            setEventHandler: setHandler,
            setEventHandlers: setHandlers,
            setDefaultHandler: setDefaultHandler,
            addHandlers: addHandlers,
            Io: io,
            isConnected: connected
        };

        var expansions = &CLIENTEXPANSIONS&;

        for (var exp in expansions) {
            if (expansions.hasOwnProperty(exp)) {
                ret[exp] = expansions[exp];
            }
        }

        return ret;

        function send(message) {
            if (typeof message === 'object') {
                message = JSON.stringify(message);
            }
            ws.send(message);
        }

        function setHandler(event, handler) {
            if (!handlers.hasOwnProperty(event)) {
                throw "Handler must be one of 'open', 'close', 'message', 'error'. Provided " + event + " not allowed";
            }
            if (typeof handler !== 'function') {
                throw 'Handler must be a function. Provided handler is of type ' + typeof handler;
            }
            handlers[event] = handler;
        }
        function setHandlers(pHandlers) {
            if (typeof pHandlers !== 'object') {
                throw "Handlers must be of type object. Provided " + typeof pHandlers + " not allowed";
            }
            for (var name in pHandlers) {
                if (pHandlers.hasOwnProperty(name)) {
                    if (typeof pHandlers[name] !== 'function') {
                        throw "Handler with property " + name + " is not a function. Provided type for " + name + ": " + typeof pHandlers[name] + " not allowed";
                    }
                    try {
                        setHandler(name, pHandlers[name]);
                    }
                    catch (e) {
                        throw "Error with property " + name + "\n" + e
                    }
                }
            }
        }
        function setDefaultHandler(pDefaultHandler) {
            if (typeof pDefaultHandler !== 'function') {
                throw "Default handler must be of type function. Provided " + typeof pDefaultHandler + " not allowed";
            }
            defaultHandler = pDefaultHandler;
        }

        function addHandlers(event, handler) {
            if (!additionalHandlers.hasOwnProperty(event)) {
                throw "Additional handler event must be one of 'open', 'close', 'message', 'error'. Provided " + event + " is not allowed";
            }
            additionalHandlers[event].push(handler);
        }

        function io() {
            var ioHandlers = {};
            if (!connected) connect();
            addHandlers('message', function (event) {
                var msg;
                try {
                    msg = JSON.parse(event.data);
                    if (ioHandlers.hasOwnProperty(msg.event)) {
                        ioHandlers[msg.event](msg.object);
                    }
                } catch (e) {
                    console.log(e);
                }
            });
            return {
                on: on,
                emit: emit
            };
            function on(event, handler) {
                if (typeof handler !== 'function') {
                    throw "IO Handler must be of type function. Provided " + typeof handler + " is not allowed";
                }
                ioHandlers[event] = handler;
            }
            function emit(event, message) {
                send({event: event, object: message});
            }
        }

    }



})(window);