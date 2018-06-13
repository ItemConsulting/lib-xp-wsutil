# Enonic XP web socket utility library #

## Documentation ##

Go [here](https://itemconsulting.github.io/wsutil-server/) for documentation

## Versions ##

### 1.1.0 ###

* Added ```getWsEvents``` method to improve reusability

### 1.0.0 ###
 * Initital release

Compatibility Enonic XP 6.4.0



## Purpose ##

Make Websockets integration with EnonicXP easy and more dynamic.

Websocket can be a powerful tool for real time communication between client and server. But there are some implementation code needed to handle both 
server side logic and client side logic. This library will try to reduce some of the coded needed to get started.
Some use-cases for websockets includes
* Real time chat
* IoT data flow
* Establish WebRTC
* Real time server notifications
* nGram search suggestions
* .. and so on

This library extends the Enonic XP websockets library with additional features to
make socket integration easier to handle on the server and client side.

* Send any objects, not only string messaging
* Automatic check for secure context
* Main handler and additional handlers for background jobs
* Built-in extension with the SocketEmitter for custom server/client event handling
* Easier group handling with automatic group creation and user list
* Create extension for reusability on both server and client



## Files included ##

```
src/
   |- main/
          |- resources/
                      |- assets/
                      |        |- clientws.js // Client side library
                      |- lib/
                            |- virtual.js // Virtual documentation file
                            |- wsUtils.js // Server side library
```

## Dependencies ##

```
# build.gradle

dependencies {
    include "com.enonic.xp:lib-portal:${xpVersion}"
    include "com.enonic.xp:lib-io:${xpVersion}"
    include "com.enonic.xp:lib-websocket:${xpVersion}"
    include "no.item.wsUtil:wsUtil:1.1.0"
}

repositories {
    mavenLocal()
    jcenter()
    maven {
        url 'http://repo.enonic.com/public'
    }
   maven {
        url  "https://dl.bintray.com/pdrevland/wsUtil"
   }
}
```

## Usage ##

First of all, add dependencies in ``build.gradle`` as described above.

Websocket communication requires both server and client side implementations. 

Second, create a service in your project to handle your server logic

```javascript
//Server side
var ws = require('/lib/wsUtil');

ws.openWebsockets(exports);

// Here goes your server websocket logic

``` 
This will bind the handlers for your service to the websocket library and handle the ``GET`` and ``webSocketEvent``
 request. 
 
 The ``GET`` request will serve the client side library, and expose the `ExpWs` object to the client´s global scope 
 
 Next make a reference to your service in your HTML
 ```html
<script src="mySite/_/services/websockets"></script> <!-- This is the GET request serving client side library -->
```
 
 Next, create a client side script in your assets to handle client side logic.

```javascript
// Client side
var cws = new ExpWS(); // This will create a "webSocketEvent" request on connect


// Your client side logic goes here

```

Last of all, add your client script

```html
<script src="mySite/_/assets/client.js"></script>
```

Remember the ``ExpWs`` object will be exposed after the client library has loaded, so a call to `new ExpWs()` will cause an error if the script is loaded first.

## Example ##

This is a short example that shows how to use library with simple search suggestions

```../views/search.html```
```html

    <div>
        <input type="text" id="search">
    </div>
    <div id="results"></div>
    
    <script src="mySite/_/assets/jquery.min.js"></script>
    <script src="mySite/_/services/websocket"></script>
    <script src="mySite/_/assets/client.js"></script>

```
`../services/websocket/index.js`
```javascript
var ws = require('/lib/wsUtil');
var contentLib = require('/lib/xp/content');
var logger = require('lib/logger'); // Lets say there is a logger library

ws.openWebsockets(exports);

ws.setEventHandler('message', checkMessage);
ws.setEventHandler('open', shareId);

ws.addHandlers('message', logMessage);

function checkMessage(message) {
    if (message.type === 'nGramSearch') {
        ws.send(message.id, {type: 'result', result: nGramSearch(message.text) });
    }
    else if (message.type === 'search') {
        // full search here
    }
}

function shareId(event) {
    ws.send(event.session.id, {type: 'id', id: event.session.id});
}

function nGramSearch(text) {
    return contentLib.query({
        start: 0,
        count: 15,
        query: 'nGram("data.title","' + text + '", "OR")'
    }).hits.map(function(hit) {
        return { title: hit.data.title, description: hit.data.description }
    });
}

function logMessage(event) {
  if (event.data.text.length > 4) logger.log(event);
}

```

`../assets/client.js`
```javascript
var cws = new ExpWs();
var search = $('#search');
var results = $('#results');
var id;

cws.connect();
cws.setEventHandler('message', handleMessage);

search.keyup(getSuggestions);

function handleMessage(message) {
    if (message.type === 'result') {
        results.empty();
        message.results.forEach(function(hit) {
          results.append($('em').text(hit.title));
          results.append($('p').text(hit.description));
          results.append($('hr'))
        });
    }
    else if (message.type === 'id') id = message.id;
}

function getSuggestions(e) {
    if (e.keyCode !== 13) { // not enter
        if (search.val().length > 2) {
            cws.send({type: 'nGramSearch', text: search.val(), id: id})
        }
  }
  else {
        cws.send({ type: 'search', text: search.val(), id: id });
        search.val('');
  }
}

```

## License ##

This project is under the Apache 2.0 license. For more information please read [LICENSE.txt](LICENSE.txt)


## Author ##

**Per Arne Drevland** *Consultant* [Item Consulting AS](www.item.no)


