

# Enonic XP websocket extension library #


## Contents ##

[Server API](server/index.html)

[Client API](client/index.html)

[Tutorials](tutorial.html)

[Creating extensions](extensions.html)

## Purpose ##

Make Websockets integration with EnonicXP easy and more dynamic.

Websocket can be a powerful tool for real time communication between client and server. But there are some implementation code needed to handle both 
server side logic and client side logic. This library will try to reduce some of the coded needed to get started.
Some use-cases for websockets includes
* Real time chat
* IoT data flow
* WebRTC p2p signaling
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


## Dependencies ##

Add these dependencies in your `build.gradle` file

```groovy
dependencies {
  include "com.enonic.xp:lib-portal:${xpVersion}"
  include "com.enonic.xp:lib-io:${xpVersion}"
  include "com.enonic.xp:lib-websocket:${xpVersion}"
  include "no.item:lib-xp-wsutil:2.0.0"
}
```

Add this repository 

```groovy
repositories {
   maven { url 'https://jitpack.io' }
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
 
 The ``GET`` request will serve the client side library, and expose the `ExpWS` object to the client´s global scope 
 
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
<script src="mySite/_/services/websockets"></script> <!-- This is the GET request serving client side library -->
<script src="mySite/_/assets/client.js"></script>
```

Remember the ``ExpWS`` object will be exposed after the client library has loaded, so a call to `new ExpWS()` will cause an error if the script is loaded first.



## Example ##

This is a short example that shows how to use library as a WebRTC signaling server

For 

`../views/page.html`

```html

    <video id="local" autoplay></video>
    <video id="remote" autoplay></video>
    <div id="users"></div>
    <input type="text" id="uname">
    
    <script src="mySite/_/asset/com.my.app/jquery.min.js"></script>
    <script src="mySite/_/service/com.my.app/websocket"></script>
    <script src="mySite/_/asset/com.my.app/client.js"></script>

```


`../assets/client.js`
```javascript
var cws = new ExpWS();
var username;
var local = $('#local');
var remote = $('#remote');
var uname = $('#uname');
var peerConnection;

// Register your username
uname.keyup(function(e) {
    if (e.keyCode === 13) {
        cws.send({type: 'regUsername', username: uname.val()});
        uname.val('');
    }
    else console.log(e.keyCode);
});

// Pipe each message to the correct handler
cws.setEventHandler('message', function(message) {
    switch (message.type) {
        case 'username': username = message.username; uname.hide(); break;
        case 'invite': handleInvite(message); break;
        case 'accept': handleAccept(message); break;
        case 'sdp': handleSDP(message); break;
        case 'candidate': handleCandidate(message); break;
        case 'error': alert(message.err); break;
        case 'users': handleUsers(message); break;
        case 'leave': handleUserLeft(message); break;
        case 'enter': userEnter(message.username); break;
        default: console.log(message);
    }
});

// If the client get an invite and accepts then prepare to start a video call
function handleInvite(message) {
    if (confirm(message.from + ' wants to start a video chat, Accept?')) {
        start(message.from);
        // Send the accept to the invitee
        cws.send({ from: username, to: message.from, type: 'accept'});
    }
}

// If the invite is accepted start a video call
function handleAccept(message) {
   start(message.from);
}

// Start the video calling, NB: This way of doing WebRTC will be deprecated
// The clients will start to negotiate how to connect with each other and send
// instructions on how to do that
// Check out MDN´s website on WebRTC for more information
function start(from) {
    if (peerConnection) return err({ err: 'Video call already in progress'});
    
    peerConnection = new RTCPeerConnection();

    peerConnection.onicecandidate = function(e) {
        if (e.candidate) {
            cws.send({
                from: username,
                to: from,
                type: 'candidate',
                candidate: e.candidate
            });
        }
    };

    peerConnection.onnegotiationneeded = function (ev) {
        peerConnection.createOffer(function(desc) {
            peerConnection.setLocalDescription(desc, function() {
                cws.send({
                    from: username,
                    to: from,
                    type: 'sdp',
                    sdp: peerConnection.localDescription
                })
            }, err)
        }, err)
    };

    peerConnection.onaddstream = function (e) {
        remote.attr('src', URL.createObjectURL(event.stream));
    };

    navigator.getUserMedia({
        audio: true,
        video: {
            width: 600,
            height: 400
        }
    }, function(stream) {
        local.attr('src',URL.createObjectURL(stream));
        peerConnection.addStream(stream);
    }, err);
}

function handleSDP(message) {
    peerConnection.setRemoteDescription(new RTCSessionDescription(message.sdp), function() {
        if (peerConnection.remoteDescription.type === 'offer') {
            peerConnection.createAnswer(function(desc) {
                peerConnection.setLocalDescription(desc, function() {
                    cws.send({
                        from: username,
                        to: message.from,
                        type: 'sdp',
                        sdp: peerConnection.localDescription
                    })
                }, err)
            }  ,err)
        }
    })
}

function handleCandidate(message) {
    peerConnection.addIceCandidate(message.candidate);
}

function handleUsers(message) {
    message.users.forEach(userEnter);
}

function handleUserLeft(message) {
    $('#' + message.username).remove();
}
// Add users to our list
function userEnter(user) {
    var u = $('<a></a>');
    u.text(user);
    u.attr('href','#');
    u.attr('id',user);
    u.click(function() {
        invite(user);
    });
    u.append('<br>');
    $('#users').append(u);
    
}

// Send an invite
function invite(user) {
    if (username) {
        cws.send({
            from: username,
            to: user,
            type: 'invite'
        })
    }
    else alert('You must register first');
}



function err(err) {
    console.error(err);
}

// Start a websocket connection
cws.connect();
```

`../services/websocket/index.js`
```javascript
var ws = require('/lib/wsUtil');

ws.openWebsockets(exports); // Open websocket communication

var users = {};

// Handle username registration
ws.addHandlers('message', function(event) {
    var message = JSON.parse(event.message);
    if (message.type === 'regUsername') {
        if (users.hasOwnProperty(message.username)) {
            //Send an error if username is taken
            ws.send(event.session.id, {type: 'error', err: 'Username taken'});
        }
        else {
            users[message.username] = event.session.id;
            ws.send(event.session.id, {type: 'username', username: message.username});
            // If username is not taken, broadcast the newly entered user
            userUpdate('enter', message.username);
        }
    }
});
// When a user enter out site
ws.setEventHandler('open', function(event) {

    // Add the user to the 'all' group
    ws.addUserToGroup(event.session.id, 'all', true);

    var arr = [];
    for (var k in users) {
        if (users.hasOwnProperty(k)) arr.push(k);
    }
    // Send the user list to our new arrival
    ws.send(event.session.id, { type: 'users', users: arr});
});

// Relay messages to and from clients
ws.setEventHandler('message', function(message) {
    if (message.type !== 'regUsername') {
        ws.send(users[message.to], message)
    }
});

ws.setEventHandler('close', function(event) {
    var username;
    for (var k in users) {
        if (users.hasOwnProperty(k) && users[k] === event.session.id) {
            username = k;
            delete users[k];
        }
    }
    userUpdate('leave', username);

});

function userUpdate(type, username) {
    ws.sendToGroup('all', { type: type, username: username})
}

```



