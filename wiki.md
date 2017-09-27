<a name="wsUtil"></a>

## wsUtil
Server side websocket utility extension library for Enonic XP

**Kind**: global class  
**Requires**: <code>module:/lib/xp/websocket</code>  
**Hideconstructor**:   
**Version**: 0.0.1  
**Author**: Per Arne Drevland  

* [wsUtil](#wsUtil)
    * [.SocketEmitter](#wsUtil.SocketEmitter)
        * [.Emit](#wsUtil.SocketEmitter.Emit)
            * [new Emit(id)](#new_wsUtil.SocketEmitter.Emit_new)
        * [.On](#wsUtil.SocketEmitter.On)
            * [new On(id)](#new_wsUtil.SocketEmitter.On_new)
            * [.OnFunction](#wsUtil.SocketEmitter.On.OnFunction) : <code>function</code>
        * [._users](#wsUtil.SocketEmitter._users) : <code>EmitterUsers</code>
        * [._handlers](#wsUtil.SocketEmitter._handlers) : <code>EmitterHandlers</code>
        * [.connect(callback)](#wsUtil.SocketEmitter.connect)
        * [.broadcast(event, object)](#wsUtil.SocketEmitter.broadcast)
        * [.EmitterUsers](#wsUtil.SocketEmitter.EmitterUsers) : <code>object</code>
            * [.sendTo(id, event, message)](#wsUtil.SocketEmitter.EmitterUsers.sendTo)
        * [.EmitterHandlers](#wsUtil.SocketEmitter.EmitterHandlers) : <code>object</code>
        * [.ConnectionCallback](#wsUtil.SocketEmitter.ConnectionCallback) : <code>function</code>
        * [.SocketEmitterInterface](#wsUtil.SocketEmitter.SocketEmitterInterface) : <code>object</code>
    * [.sendToGroup(name, message)](#wsUtil.sendToGroup)
    * [.addHandlers(event, handler)](#wsUtil.addHandlers)
    * [.getGroupUsers(group)](#wsUtil.getGroupUsers) ⇒ <code>Array.&lt;string&gt;</code>
    * [.addUserToGroup(id, group, [autoCreate])](#wsUtil.addUserToGroup)
    * [.removeUserFromGroup(name, id)](#wsUtil.removeUserFromGroup)
    * [.createGroup(name, [autoRemove])](#wsUtil.createGroup)
    * [.send(id, message)](#wsUtil.send)
    * [.openWebsockets(exp)](#wsUtil.openWebsockets)
    * [.sendSocketResponse(req)](#wsUtil.sendSocketResponse) ⇒ <code>SocketResponse</code>
    * [.setEventHandler(event, handler)](#wsUtil.setEventHandler)
    * [.setEventHandlers(handlers)](#wsUtil.setEventHandlers)
    * [.setSocketRequestResponse(response)](#wsUtil.setSocketRequestResponse)
    * [.SocketResponse](#wsUtil.SocketResponse) : <code>object</code>

<a name="wsUtil.SocketEmitter"></a>

### wsUtil.SocketEmitter
Create a new SocketEmitter instance to handle individual socket connections and emit events and listen
to events created by the client.

**Kind**: static class of [<code>wsUtil</code>](#wsUtil)  
**Since**: 0.0.1  

* [.SocketEmitter](#wsUtil.SocketEmitter)
    * [.Emit](#wsUtil.SocketEmitter.Emit)
        * [new Emit(id)](#new_wsUtil.SocketEmitter.Emit_new)
    * [.On](#wsUtil.SocketEmitter.On)
        * [new On(id)](#new_wsUtil.SocketEmitter.On_new)
        * [.OnFunction](#wsUtil.SocketEmitter.On.OnFunction) : <code>function</code>
    * [._users](#wsUtil.SocketEmitter._users) : <code>EmitterUsers</code>
    * [._handlers](#wsUtil.SocketEmitter._handlers) : <code>EmitterHandlers</code>
    * [.connect(callback)](#wsUtil.SocketEmitter.connect)
    * [.broadcast(event, object)](#wsUtil.SocketEmitter.broadcast)
    * [.EmitterUsers](#wsUtil.SocketEmitter.EmitterUsers) : <code>object</code>
        * [.sendTo(id, event, message)](#wsUtil.SocketEmitter.EmitterUsers.sendTo)
    * [.EmitterHandlers](#wsUtil.SocketEmitter.EmitterHandlers) : <code>object</code>
    * [.ConnectionCallback](#wsUtil.SocketEmitter.ConnectionCallback) : <code>function</code>
    * [.SocketEmitterInterface](#wsUtil.SocketEmitter.SocketEmitterInterface) : <code>object</code>

<a name="wsUtil.SocketEmitter.Emit"></a>

#### SocketEmitter.Emit
**Kind**: static class of [<code>SocketEmitter</code>](#wsUtil.SocketEmitter)  
**Since**: 0.0.1  
<a name="new_wsUtil.SocketEmitter.Emit_new"></a>

##### new Emit(id)
Emit events with content to specific socket connection

**Returns**: <code>EmitFunction</code> - Takes an event and a message object and sends to the socket connection  

| Param | Type | Description |
| --- | --- | --- |
| id | <code>string</code> | The id of the socket connection |

<a name="wsUtil.SocketEmitter.On"></a>

#### SocketEmitter.On
**Kind**: static class of [<code>SocketEmitter</code>](#wsUtil.SocketEmitter)  
**Since**: 0.0.1  

* [.On](#wsUtil.SocketEmitter.On)
    * [new On(id)](#new_wsUtil.SocketEmitter.On_new)
    * [.OnFunction](#wsUtil.SocketEmitter.On.OnFunction) : <code>function</code>

<a name="new_wsUtil.SocketEmitter.On_new"></a>

##### new On(id)
The emit event handlers acts on emit events from the clients

**Returns**: <code>function</code> - Binds a handler to an emit event  

| Param | Type | Description |
| --- | --- | --- |
| id | <code>string</code> | The id of the connection |

<a name="wsUtil.SocketEmitter.On.OnFunction"></a>

##### On.OnFunction : <code>function</code>
Returned function from the On class instance. This function takes an event and a handler. The handler is being called when a client emits the event
with or without parameters

**Kind**: static typedef of [<code>On</code>](#wsUtil.SocketEmitter.On)  

| Param | Type | Description |
| --- | --- | --- |
| event | <code>string</code> | The name of the emitted event from the client |
| handler | <code>function</code> | The emitted event handler |

**Example**  
```js
socketEmitter.connect(function(socket) {
 // example of handler without parameters
 socket.on('What is the meaning of life, the universe and everything?', function() {
     socket.emit('answer', calculateTheMeaningOfLifeTheUniverseAndEverything());
 });
 // example of handler with parameters
 socket.on('isPrime?', function(number) {
     function isPrime(num, iter) {
       if (!iter) iter = Math.floor(Math.sqrt(num));
       if (iter > 1) return isPrime(num, iter-1) ? num % iter !== 0 : false;
        return true
      }
      socket.emit('isPrime!', isPrime(number));
 });
})
```
<a name="wsUtil.SocketEmitter._users"></a>

#### SocketEmitter._users : <code>EmitterUsers</code>
**Kind**: static property of [<code>SocketEmitter</code>](#wsUtil.SocketEmitter)  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| _users | <code>EmitterUsers</code> | Users that has a socket connection |

<a name="wsUtil.SocketEmitter._handlers"></a>

#### SocketEmitter._handlers : <code>EmitterHandlers</code>
**Kind**: static property of [<code>SocketEmitter</code>](#wsUtil.SocketEmitter)  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| _handlers | <code>EmitterHandlers</code> | Handlers for all users and events |

<a name="wsUtil.SocketEmitter.connect"></a>

#### SocketEmitter.connect(callback)
This is the event that is being called when a new user connects

**Kind**: static method of [<code>SocketEmitter</code>](#wsUtil.SocketEmitter)  

| Param | Type | Description |
| --- | --- | --- |
| callback | <code>ConnectionCallback</code> | The callback to call when users connects |

<a name="wsUtil.SocketEmitter.broadcast"></a>

#### SocketEmitter.broadcast(event, object)
Emit an event to every connected users

**Kind**: static method of [<code>SocketEmitter</code>](#wsUtil.SocketEmitter)  
**Since**: 0.0.1  

| Param | Type | Description |
| --- | --- | --- |
| event | <code>string</code> | The name of the event |
| object | <code>object</code> \| <code>string</code> | The message of the emit event |

<a name="wsUtil.SocketEmitter.EmitterUsers"></a>

#### SocketEmitter.EmitterUsers : <code>object</code>
**Kind**: static typedef of [<code>SocketEmitter</code>](#wsUtil.SocketEmitter)  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| id | <code>string</code> | The session id of the user |
| on | <code>On</code> | The client emitted event handler interface |
| emit | <code>Emit</code> | The server side emit message functionality, |
| sendTo | <code>function</code> | The server side send message to specific user functionality |

<a name="wsUtil.SocketEmitter.EmitterUsers.sendTo"></a>

##### EmitterUsers.sendTo(id, event, message)
Let the connected socket object send message to other socket objects

**Kind**: static method of [<code>EmitterUsers</code>](#wsUtil.SocketEmitter.EmitterUsers)  
**Since**: 0.0.1  

| Param | Type | Description |
| --- | --- | --- |
| id | <code>string</code> | The id of the socket recipient |
| event | <code>string</code> | The name of the event to emit |
| message | <code>object</code> \| <code>string</code> | The content of the event |

**Example**  
```js
// Send message to a connected user
socketEmitter.sendTo('someId', 'someEvent', someMessage);
```
<a name="wsUtil.SocketEmitter.EmitterHandlers"></a>

#### SocketEmitter.EmitterHandlers : <code>object</code>
**Kind**: static typedef of [<code>SocketEmitter</code>](#wsUtil.SocketEmitter)  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| id | <code>object</code> | Id of the user |
| id.event | <code>object</code> | name of the event |
| id.event.function | <code>function</code> | the actual handler |

<a name="wsUtil.SocketEmitter.ConnectionCallback"></a>

#### SocketEmitter.ConnectionCallback : <code>function</code>
Callback function for connected users, this is being called with the connected user interface

**Kind**: static typedef of [<code>SocketEmitter</code>](#wsUtil.SocketEmitter)  

| Param | Type | Description |
| --- | --- | --- |
| socket | <code>EmitterUsers</code> | The connected user interface |

**Example**  
```js
socketEmitter.connect(connectionCallback);

function connectionCallback(socket) {
 // do something with connected socket
}
```
<a name="wsUtil.SocketEmitter.SocketEmitterInterface"></a>

#### SocketEmitter.SocketEmitterInterface : <code>object</code>
Call the SocketEmitter constructor to receive a SocketEmitter interface
Use the interface to act on connection events from clients and broadcast events from the server

**Kind**: static typedef of [<code>SocketEmitter</code>](#wsUtil.SocketEmitter)  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| connect | <code>ConnectionCallback</code> | A event that fires every time a user connects to the web socket |
| broadcast | <code>function</code> | Emit an event to all connected users |

**Example**  
```js
// Create the SocketEmitter
var socketEmitter = new ws.SocketEmitter();
// Get connection events
socketEmitter.connect(function(socket) {
 // Use the client socket connection to emit messages
 socket.emit('new-connection', { greetings: 'Hello from server' });
 // Use the client socket connection to listen to emitted events from user
 socket.on('some-event', function(message) {
   log.info('some-event message ' + JSON.stringify(message));
   });
 });
 // Broadcast messages to all users
 socketEmitter.broadcast('hello-everybody', { message: 'Hello from server' });
```
<a name="wsUtil.sendToGroup"></a>

### wsUtil.sendToGroup(name, message)
extends the sendToGroup function from EnonicXP to stringify objects

**Kind**: static method of [<code>wsUtil</code>](#wsUtil)  
**Since**: 0.0.1  

| Param | Type | Description |
| --- | --- | --- |
| name | <code>string</code> | Name of the group |
| message | <code>object</code> \| <code>string</code> | Message to send to the group |

**Example**  
```js
// send to space 'global'
ws.sendToGroup('global', { hello: 'everyone in global' });
```
<a name="wsUtil.addHandlers"></a>

### wsUtil.addHandlers(event, handler)
Add additional socket event handlers. This is the secondary handlers for the event and they are being pushed to the additional event handlers array

**Kind**: static method of [<code>wsUtil</code>](#wsUtil)  
**Since**: 0.0.1  

| Param | Type | Description |
| --- | --- | --- |
| event | <code>string</code> | The name of the socket event |
| handler | <code>function</code> | The handler to bind to the event |

<a name="wsUtil.getGroupUsers"></a>

### wsUtil.getGroupUsers(group) ⇒ <code>Array.&lt;string&gt;</code>
Get all connected users from a group

**Kind**: static method of [<code>wsUtil</code>](#wsUtil)  
**Returns**: <code>Array.&lt;string&gt;</code> - The array of users or undefined if group doesn't exist  
**Since**: 0.0.1  

| Param | Type | Description |
| --- | --- | --- |
| group | <code>string</code> | Name of the group |

<a name="wsUtil.addUserToGroup"></a>

### wsUtil.addUserToGroup(id, group, [autoCreate])
Adds a user to a group if it exists. Create the group if it doesn't exist and the autoCreate flag is set
or log an error if not

**Kind**: static method of [<code>wsUtil</code>](#wsUtil)  
**Since**: 0.0.1  

| Param | Type | Description |
| --- | --- | --- |
| id | <code>string</code> | The id of the user |
| group | <code>string</code> | The name of the group |
| [autoCreate] | <code>boolean</code> | The flag to create the group if it doesn't exist |

<a name="wsUtil.removeUserFromGroup"></a>

### wsUtil.removeUserFromGroup(name, id)
Removes a user from a group of given name, if the group is empty, it removes the group

**Kind**: static method of [<code>wsUtil</code>](#wsUtil)  
**Since**: 0.0.1  

| Param | Type | Description |
| --- | --- | --- |
| name | <code>string</code> | Name of the group |
| id | <code>string</code> | The id of the user |

<a name="wsUtil.createGroup"></a>

### wsUtil.createGroup(name, [autoRemove])
Creates a group with given name. If the autoRemove flag is set, if removes a user from the group when user closes connection

**Kind**: static method of [<code>wsUtil</code>](#wsUtil)  
**Since**: 0.0.1  

| Param | Type | Description |
| --- | --- | --- |
| name | <code>string</code> | The name of the group |
| [autoRemove] | <code>boolean</code> | Removes the user from the group on close connection |

<a name="wsUtil.send"></a>

### wsUtil.send(id, message)
Sends a message to given client, if the message is of type object it will be stringified

**Kind**: static method of [<code>wsUtil</code>](#wsUtil)  
**Since**: 0.0.1  

| Param | Type | Description |
| --- | --- | --- |
| id | <code>string</code> | The id of the user |
| message | <code>string</code> \| <code>object</code> | The message to send |

<a name="wsUtil.openWebsockets"></a>

### wsUtil.openWebsockets(exp)
Opens the websocket connection and delegate events to handlers

**Kind**: static method of [<code>wsUtil</code>](#wsUtil)  
**Since**: 0.0.1  

| Param | Type | Description |
| --- | --- | --- |
| exp | <code>object</code> | The exports object from the Enonic module that is assigned to handle websocket events |

<a name="wsUtil.sendSocketResponse"></a>

### wsUtil.sendSocketResponse(req) ⇒ <code>SocketResponse</code>
Send the socket response for a socket request

**Kind**: static method of [<code>wsUtil</code>](#wsUtil)  
**Returns**: <code>SocketResponse</code> - The response object  
**Since**: 0.0.1  

| Param | Type | Description |
| --- | --- | --- |
| req | <code>object</code> | The request object passed to the server |

**Example**  
```js
// someSocketService.js
ws = require('/lib/xp/wsUtil');
exports.get = ws.sendSocketResponse;
// or
exports.get = function(req) {
 return ws.sendSocketResponse(req);
 }
```
<a name="wsUtil.setEventHandler"></a>

### wsUtil.setEventHandler(event, handler)
Sets a handler for given socket event

**Kind**: static method of [<code>wsUtil</code>](#wsUtil)  
**Since**: 0.0.1  

| Param | Type | Description |
| --- | --- | --- |
| event | <code>&#x27;open&#x27;</code> \| <code>&#x27;close&#x27;</code> \| <code>&#x27;message&#x27;</code> \| <code>&#x27;error&#x27;</code> | The name of the event |
| handler | <code>function</code> | The event handler |

<a name="wsUtil.setEventHandlers"></a>

### wsUtil.setEventHandlers(handlers)
Set all socket event handlers

**Kind**: static method of [<code>wsUtil</code>](#wsUtil)  
**Since**: 0.0.1  

| Param | Type |
| --- | --- |
| handlers | <code>object</code> | 

<a name="wsUtil.setSocketRequestResponse"></a>

### wsUtil.setSocketRequestResponse(response)
set custom socket response object. Default object is taken from [Enonic doc](http://docs.enonic.com/en/stable/developer/ssjs/websockets.html)

**Kind**: static method of [<code>wsUtil</code>](#wsUtil)  
**Since**: 0.0.1  

| Param | Type | Description |
| --- | --- | --- |
| response | <code>SocketResponse</code> | The socket response object |

<a name="wsUtil.SocketResponse"></a>

### wsUtil.SocketResponse : <code>object</code>
The response object sent from the server

**Kind**: static typedef of [<code>wsUtil</code>](#wsUtil)  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| webSocket | <code>object</code> | Main response object |
| webSocket.data | <code>object</code> | Additional data object |
| webSocket.subProtocols | <code>Array.&lt;string&gt;</code> | Array of sub protocols to support |

