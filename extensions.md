# Creating extensions #

Create websokcet extensions to speed up your development process when working with the websocket utility library.
It is both easy and fun.

And if you create something you think is useful for others, share it.

## Basic server expansion ##

Expand functionality by adding additional handlers.

Say we want to create a simple logger for our application

In our `/lib/wsLogger.js` file we could add our logger

```javascript
var ws = require('/lib/wsUtil');
var http = require('/lib/xp/http-client');

ws.expand({ 'logger': logger});
exports.logger = ws;
function logger() {
  ws.addHandlers('open', function(e) {
    http.request({
        method: 'POST',
        body: JSON.stringify({ logItem: e, event: 'open', ts: Date.now() }),
        ... // Additional request params
    });
  })
  ... // Additional handlers
}

```
Use 
```javascript
// service/websocket
var wsl = require('logger').logger;
wsl.logger();
wsl.openWebsockets();
```

## Basic client expansion ##

Expand the client library

```javascript
var ws = require('/lib/wsUtil');

ws.expandClient('hello', hello);

function hello() {
    send("Hello");
}
```

Use on client side

```javascript
var ws = new EnonicXP.Ws();
ws.hello();
```

## Advanced ##

Expand expansions

```javascript
var wsl = require('/logger').logger;

wsl.expand({loggerExpansion: someExpansion});

exports.someExpansion = wsl;
```

Join expansions

```javascript
// lib/abExpansion.js

var a = require('expansionA').a;
var b = require('expansionB').b;

var exp = {};

for (var name in a) {
    if (a.hasOwnProperty(name) && !b.hasOwnProperty(name)) {
        exp[name] = a[name]; // add whats in a but not b
    }
}

b.expand(exp); // join a with b

exports.ab = b;

```