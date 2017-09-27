

# Enonic XP websocket extension library #

This library extends the Enonic XP websocket library with additional features to
make socket integration easier to handle on the server side. This is developed to work seamlessly with the client ws extension application.

## Usage ##
### Basic features ###

```javascript
//load library
var ws = require('/lib/xp/wsUtil');

exports.get = function(req) {
    // Send socket connection to client
    return ws.sendSocketResponse(req);  
}; 
// Bind the websocket event handler to the ws object
ws.openWebsockets(exports);
```

That's it. Now your socket connection is live and ready.

There are two ways to listen for the four different websocket events.

```javascript
// Set main handlers

// set individual event handlers
ws.setEventHandler('open',      openHandler);
ws.setEventHandler('close',     closeHandler);
ws.setEventHandler('message',   messageHandler);
ws.setEventHandler('error',     errorHandler);

// set them all at once
ws.setEventHandlers({
    open:       openHandler,
    close:      closeHandler,
    message:    messageHandler,
    error:      errorHandler
});

// Set additional handlers (for logging and none immediate actions or extra features)

ws.addHandlers('open',    additionalHandler);
ws.addHandlers('close',   additionalHandler);
ws.addHandlers('message', additionalHandler);
ws.addHandlers('error',   additionalHandler);

// Add as many handlers as you want

```
Group your users

```javascript
function openHandler(event) {
    var autoremove = true; // Remove client from group when close event
    ws.createGroup('global', autoremove); // Idempotent function
    ws.addUserToGroup(event.session.id, 'global');
}

function closeHandler(event) {
    // since autoremove is set, we don't care about removing manually
    // but we might want to keep track in some objects
    delete serverUsers[event.session.id];
    var message = {
        event: 'user_exit',
        id: event.session.id
    };
    ws.sendToGroup('global', message); // message will be JSON.stringified
}

function messageHandler(msg) { // For event.type === message it is only the message that is passed to the handler
    var message = {         // The event message will try to be parsed as JSON
        event: msg.event,   
        message: msg.message,
        username: msg.username,
        timestamp: Date.now()
    };
    ws.sendToGroup(msg.room, message);
}
```

Send individual messages to clients

```javascript
var randomIndex = Math.floor(Math.random() * ws.getGroupUsers('global').length);
var id = ws.getGroupUsers('global')[randomIndex];
var message = { hello: 'world'};
ws.send(id, message); // Will be stringified
```

This is the basic features for the web socket library.
Some notes

 * The sendSocketResponseObject is the same object from the Enonic XP [example](http://xp.readthedocs.io/en/stable/developer/ssjs/websockets.html)
 * Since messages from the socket is always string, the library will always try to convert it to JSON
 * Sending messages will check for type and stringify it if needed

### Additional features ###

Create a new SocketEmitter to make the websocket implementation act like a pub/sub provider

Functionalities here are shamelessly inspired by [socket.io](socket.io) nodeJS library, with limitations

```javascript
// how to use
var io = new ws.SocketEmitter();

io.connect(function(socket) {
    io.broadcast("new-connection", {id: socket.id});
    socket.emit("hi", {msg: "hello from server"});
    socket.on('ping', function(message) {
        // do something with message or
        socket.emit('pong', message); // send the message back to client
        socket.sendTo(message.recipient, message.content); // send message between clients
    });
})
```