

# Enonic XP websocket extension library #

This library extends the Enonic XP websocket library with additional features to
make socket integration easier to handle on the server side. The library includes both client side lib and server side lib


## Usage ##

Create a service for the server side handling of your websockets.
Default is `services/websocket/websocket.js`

In your `websocket.js` file

```javascript
var ws = require('/path/to/wsUtil'); // '/lib/wsUtil'

ws.openWebsockets(exports);

``` 
Or for `services/sockethandler/sockethandler.js`

```javascript
var ws = require('/path/to/wsUtil'); // '/lib/wsUtil'
var portal = require('/lib/xp/portal');

ws.openWebsockets(exports, portal.serviceUrl({ service: 'sockethandler' }));

``` 


## Contents ##

[Server API](server.html)

[Client API](client.html)

[Tutorials](tutorial.html)

[Creating extensions](extensions.html)

## How it works ##

Create a script tag on your document for your service

The initial request will not be a websocket request and will receive the client side library

When the client side web socket handler creates a new EnonicXP.Ws instance it will send a websocket request
to the server, and start the websocket communication.
