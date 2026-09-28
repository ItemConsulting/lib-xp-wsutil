# Client API

The client side library is an asset of your app, `assets/wsutil/xp-websocket.js`, which the library brings along. It
defines the custom element `<xp-websocket>`, and exports the class `WebSocketClient` the element is built on.

## Loading the library

Load the script with `assetUrl()` from [lib-asset](https://developer.enonic.com/docs/lib-asset/stable), and add an
`<xp-websocket>` element with the WebSocket URL of your service, from `serviceUrl()` with `type: "websocket"`. In a
page or part controller, here rendering the view with
[lib-xp-freemarker](https://github.com/ItemConsulting/lib-xp-freemarker):

```typescript
import { render } from "/lib/freemarker";
import { assetUrl } from "/lib/enonic/asset";
import { serviceUrl } from "/lib/xp/portal";

const view = resolve("view.ftlh");

export function get(): Response {
  const model = {
    clientUrl: assetUrl({
      path: "wsutil/xp-websocket.js"
    }),
    socketUrl: serviceUrl({
      service: "websocket",
      type: "websocket"
    }),
  };

  return {
    body: render(view, model),
  };
}
```

```ftlh
[#-- @ftlvariable name="clientUrl" type="String" --]
[#-- @ftlvariable name="socketUrl" type="String" --]
<script type="module" src="${clientUrl}"></script>
<xp-websocket src="${socketUrl}"></xp-websocket>
```

Your own client code goes in a script of the app, loaded the same way. FreeMarker reads `${...}` inside `<script>`
tags as interpolations too, so keep JavaScript with template literals out of the template, or wrap it in
`[#noparse]`.

`serviceUrl()` with `type: "websocket"` returns a `ws://` or `wss://` URL, matching the protocol the page was served
over.

## The element

`<xp-websocket>` connects to `src` when it is added to the page, and closes the connection when it is removed, like
`<turbo-stream-source>`. Changing `src` while it is in the page reconnects.

```javascript
const socket = document.querySelector("xp-websocket");

socket.addEventListener("ws:message", (event) => console.log(event.detail));
socket.send({ hello: "server" });
```

### Events

The events of the connection are dispatched on the element, and bubble, so they can also be listened for on
`document`:

| Event        | `event.detail`                                                                   |
| ------------ | -------------------------------------------------------------------------------- |
| `ws:open`    | The `Event` of the WebSocket                                                     |
| `ws:message` | The message, parsed as JSON. A message that is not JSON is passed on as a string |
| `ws:close`   | The `CloseEvent` of the WebSocket                                                |
| `ws:error`   | The `Event` of the WebSocket                                                     |

### Properties and methods

| Member          | Description                                                                    |
| --------------- | ------------------------------------------------------------------------------ |
| `src`           | The URL of the service. Setting it reconnects                                  |
| `connected`     | `true` while the connection is open. (`isConnected` is the DOM's: in the page) |
| `send(message)` | Sends a message to the server. Objects are serialized to JSON                  |
| `io`            | Named events with [`SocketEmitter`](server.md#socketemitter), see [io](#io)    |
| `rpc()`         | The methods registered with `socket.rpc()` on the server, see [Rpc](#rpc)      |
| `connect()`     | Reconnects to `src`, closing an open connection first                          |
| `close()`       | Closes the connection                                                          |
| `client`        | The `WebSocketClient` behind the element, see [below](#websocketclient)        |

A message sent while the connection is being opened is sent once it is open, so a script can `send()` right after
the element is added to the page. `send()` throws only when there is no connection: after it has closed, or on a
`WebSocketClient` before `connect()`.

## io

`socket.io` sends and receives *named events* with a payload, together with
[`SocketEmitter`](server.md#socketemitter) on the server.

```javascript
const io = socket.io;

// Emit an event to the server
io.emit("ping", { recipient: "some-session-id", content: "Hello" });

// Handle an event emitted by the server
io.on("pong", (message) => console.log(message));
```

In TypeScript, the type parameter of `on()` is the type of the payload: `io.on<{ text: string }>("pong", …)`.

## Rpc

`socket.rpc()` returns the methods registered with [`socket.rpc()`](server.md#rpc) on the server, as async
functions. Calling one sends the arguments to the server, and the promise settles with what the method returns or
throws there:

```javascript
const rpc = socket.rpc();

console.log(await rpc.greet("Tom")); // "Hello Tom"

try {
  await rpc.register("Tom");
} catch (e) {
  console.error(e.message); // The message of the error thrown on the server
}
```

- Calls made before the connection is open are sent once it is. If the connection closes, pending calls are
  rejected.
- The type parameter is the type of the methods on the server. In client code that is bundled into your app, import
  it from the service controller, so the calls are type checked and autocompleted:

```typescript
import type { api } from "../../services/websocket/websocket";

const rpc = socket.rpc<typeof api>();
const greeting: string = await rpc.greet("Tom");
```

## WebSocketClient

The element is built on the class `WebSocketClient`, for scripts that want a connection without an element. A
script that is an asset of your app imports it with a relative path, since the two assets are served side by side:

```javascript
// assets/my-script.js
import { WebSocketClient } from "./wsutil/xp-websocket.js";

const cws = new WebSocketClient(socketUrl); // Connects right away
```

- `new WebSocketClient(url)` connects to `url` right away. Without `url`, call `setUrl(url)` and `connect()`.
- `setUrl(url, true)` changes the URL and reconnects. Without `true`, the new URL is used on the next `connect()`.
- `connect()` on an open connection closes it and opens a new one. `close()` closes it.
- `isConnected` is `true` while the connection is open.
- `send()`, `Io()` and `rpc()` work as on the element.

### Handling events

The class has one main handler and any number of additional handlers for each of the four events, like the server.
The element uses the main handlers to dispatch its DOM events, so on an element's `client`, add handlers with
`addHandler()` or listen to the DOM events instead.

```javascript
// Set the main handler of one event
cws.setEventHandler("message", (message) => console.log(message));

// Or of several events at once. The handlers of the events left out are kept
cws.setEventHandlers({
  open: (event) => console.log("Connected"),
  close: (event) => console.log("Disconnected"),
});

// The handler for events without a main handler of their own
cws.setDefaultHandler((event) => {});

// Add as many additional handlers as you want
cws.addHandler("message", (event) => console.log(event.data));
```

- The main `message` handler receives the **message**, parsed as JSON. A message that is not JSON is passed on as a
  string.
- The additional `message` handlers receive the
  [`MessageEvent`](https://developer.mozilla.org/en-US/docs/Web/API/MessageEvent), with the raw message in
  `event.data`.
- By default, `error` events are logged with `console.error`, and the other events with `console.debug`, which the
  browser console shows at its *verbose* level.
- An unknown event name, or a handler that is not a function, throws a `TypeError`.

## TypeScript

The types of the client are in the npm package, see [TypeScript](../README.md#typescript) in the README. Add the
global declarations to the *tsconfig.json* of your client code:

```json
{
  "compilerOptions": {
    "types": ["@item-enonic-types/lib-wsutil/global"]
  }
}
```

With them, `document.querySelector("xp-websocket")` is an `XpWebSocketElement`, and the `ws:` events are typed, on
the element as well as on `document`, since they bubble:

```typescript
const socket = document.querySelector("xp-websocket")!; // XpWebSocketElement

socket.addEventListener("ws:message", (event) => {
  console.log(event.detail); // unknown: the message, parsed as JSON
});
socket.addEventListener("ws:close", (event) => {
  console.log(event.detail.code); // CloseEvent
});
```

To name the types, import them from the package: `XpWebSocketElement`, `XpWebSocketEventMap`, `WebSocketClient`,
`RpcClient` and `IoInterface` from `@item-enonic-types/lib-wsutil/dist/assets/wsutil/xp-websocket`.
