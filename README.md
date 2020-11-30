# Enonic XP web socket utility library #

## Documentation ##

Go [here](https://itemconsulting.github.io/wsutil-server/) for documentation

## Versions ##

### 2.0.0 ###

* Turn of logging by setting `no.item.wsUtils.printLog` to `false` in the config file for the project using this lib.
* Upgraded to build on XP 7.5.0.
* Compatibility Enonic XP 7.5.0.

### 1.1.1 ###

* Added ```getWsEvents``` method to improve reusability

### 1.0.0 ###
 * Initital release

Compatibility Enonic XP 6.4.0




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

Add these dependencies in your `build.gradle` file
```
dependencies {
    include "com.enonic.xp:lib-portal:${xpVersion}"
    include "com.enonic.xp:lib-io:${xpVersion}"
    include "com.enonic.xp:lib-websocket:${xpVersion}"
    include "no.item.wsUtil:wsUtil:1.1.1"
}
```
Add this repository 
```
repositories {
   maven {
        url  "https://dl.bintray.com/pdrevland/wsUtil"
   }
}
```

## Hello sockets ##

Here is the shortest example for opening websocket communication in your project

```html
<!-- Add these tags to your html for page part etc.. -->
<script src="mysite/_/service/com.my.app/websocket"></script>
<script src="mysite/_/asset/com.my.app/clientws.js"></script>

```
```javascript
// Create a service called websocket
var ws = require('/lib/wsUtil');
ws.openWebsockets(exports);
```
```javascript
// Create an asset called clientws.js
var clientWs = new ExpWS();
clientWs.connect();
```
Check the console/server logs to see that your connection is alive

## License ##

This project is under the Apache 2.0 license. For more information please read [LICENSE.txt](LICENSE.txt)


## Author ##

**Per Arne Drevland** *Consultant* [Item Consulting AS](www.item.no)


