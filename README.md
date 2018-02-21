# Enonic XP web socket utility library #

## Documentation ##

Go [here](https://itemconsulting.github.io/wsutil-server/) for documentation

## Version ##

### 1.0.0 ###
 * Initital release

Compatibility Enonic XP 6.4.0



## Purpose ##

Make Websockets integration with EnonicXP easy and more dynamic. 

This library extends the Enonic XP websocket library with additional features to
make socket integration easier to handle on the server side. The library includes both client side and server side libraries

The library's primary purpose is to allow communication with JSON objects, but it also comes with additional features like multiple handlers, 
expansion, easy group management and a built in event driven add-on. 

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
    include "no.item.wsUtil:wsUtil:1.0.0"
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

Create a handler for both server side and client side to manage web socket communication

```javascript
//Server side
var ws = require('/lib/wsUtil');

ws.openWebsockets(exports);

// Your server side logic goes here

``` 

```javascript
// Client side
var cws = new ExpWS();


// Your client side logic goes here

```


## How it works ##

The route to the websocket library goes to some URL and binds the ExpWs object to the ``window`` object
```html
<script src="someURL/clientlib.js"></script> <!-- Not a web socket request --> 
```
The handler source is then loaded to the client
```html
<script src="someURL/clientHandler.js"></script> 
```
The handler source create a new ExpWS instance that opens a web socket connection

```javascript
var cws = new ExpWS(); // <-- Request to same route as clientlib.js but with web socket enabled
```

The library will now serve the request as a web socket request and start web socket communication


## License ##

This project is under the Apache 2.0 license. For more information please read [LICENSE.txt](LICENSE.txt)


## Author ##

**Per Arne Drevland** *Consultant* [Item Consulting AS](www.item.no)


