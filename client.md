# Client side web socket utility #

## Basic features ##

| **Name** | **Parameters** | **Definition**
| -------- | --------------- | -------------|
| `send()` | *message*: string,object | send a message to socket server |
| `setEventHandler()` | *event*: string *handler*: function | sets a handler for a socket event |
| `setEventHandlers()` | *handlers*: object | sets handlers for events. Handlers follow key=event value=handler |
| `addHandlers()` | *event*: string *handler* function | Adds additional handlers for socket events |
| `setDefaultHandler()` | *handler*: function | sets the default action handler for all events |
| `new Io()` | | Create a new instance of a event emitting client. 

## Usage ##

Your client library is served through the websocket service.

One thing to remember is the host parameter in the server `openWebsockets(exports, host)` call, sends the host value to 
the client library and uses that value to create a `new WebSocket(protocol + host)` instance. The `protocol` 
parameter is determined by the context of which the page is loaded. So if served behind a secure context
the `protocol` value will be `wss://` otherwise in develop mode or insecure context `ws://`

To send the client library add a script tag to your page that want to use your websocket service
```html
<script src="mySite/_/service/com.my.app/websocket"></script>
```
The client library is ready to create the `new WebSocket(ws://mySite/_/service/com.my.app/websocket)` instance
which will open a websocket connection.

To actually open the connection, you need to implement the code that does the websocket logic, including connect.

Create a javaScript file in your assets folder and add it to your page with the client library

```html
<script src="mySite/_/asset/com.my.app/clientws.js"></script> 
```

The minimal code needed to open a connection

```javascript
// assets/clientws.js
var clientWs = new ExpWs();
clientWs.connect();

// More logic here if needed
```



**IMPORTANT** The library must be loaded first.




