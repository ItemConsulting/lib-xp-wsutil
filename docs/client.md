# Client API

The client side library is a JavaScript module, served by the `get` handler of your [websocket service](server.md).
It exports the class `WebSocketClient`, also under its old name `ExpWS`.

## Loading the library

Import it from the URL of your service. In a page or part controller, that URL is returned by
`serviceUrl({ service: "websocket" })`:

```html
<script type="module">
  import { WebSocketClient } from "/mysite/_/service/com.my.app/websocket";

  const cws = new WebSocketClient();
  cws.connect();
</script>
```

From a script that is bundled into your app, import it with a dynamic `import()`, since the URL is only known when
the page is rendered:

```typescript
import type * as ClientWs from "@item-enonic-types/lib-wsutil/dist/assets/clientws";

const { WebSocketClient }: typeof ClientWs = await import(websocketServiceUrl);
```

See [TypeScript](../README.md#typescript) for installing the types.

## Connecting

```javascript
const cws = new WebSocketClient();
cws.connect();
```

- `WebSocketClient` connects to the URL of the service that served it, with `wss://` on a page served over
  `https://`, and `ws://` otherwise.
- `new WebSocketClient(url)` connects to `url` instead, and opens the connection right away.
- `cws.setHost(url, true)` changes the URL later. Without `true`, the new URL is used on the next `connect()`.
- `connect()` on an open connection closes it and opens a new one.
- `cws.isConnected` is `true` while the connection is open.
- `send()` before `connect()` throws, as there is nothing to send on yet.

## Handling events

Like on the server, each of the four events (`open`, `message`, `close` and `error`) has one main handler and any
number of additional handlers.

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

## Sending messages

Objects are serialized to JSON before they are sent.

```javascript
cws.send({ hello: "server" });
```

## Io

`Io()` sends and receives *named events* with a payload, together with
[`SocketEmitter`](server.md#socketemitter) on the server. It opens the connection if it isn't open, and returns the
same instance every time.

```javascript
const io = cws.Io();

// Emit an event to the server
io.emit("ping", { recipient: "some-session-id", content: "Hello" });

// Handle an event emitted by the server
io.on("pong", (message) => console.log(message));
```

In TypeScript, the type parameter of `on()` is the type of the payload: `io.on<{ text: string }>("pong", …)`.

## Client expansions

Functions added on the server with [`expandClient()`](extensions.md#client-expansions) are methods of the client:

```javascript
cws.hello();
```

## Reference

| Member                                 | Description                                                         |
| -------------------------------------- | ------------------------------------------------------------------- |
| `new WebSocketClient(url?)`            | Creates a client. Connects right away if `url` is given             |
| `connect()`                            | Opens the connection, closing an open one first                     |
| `setHost(url, autoConnect?)`           | Changes the URL of the connection                                   |
| `isConnected`                          | `true` while the connection is open                                 |
| `send(message)`                        | Sends a message to the server                                       |
| `setEventHandler(event, handler)`      | Sets the main handler of an event                                   |
| `setEventHandlers(handlers)`           | Sets the main handlers of several events                            |
| `setDefaultHandler(handler)`           | Sets the handler for events without a main handler                  |
| `addHandler(event, handler)`           | Adds an additional handler to an event                              |
| `Io()`                                 | Named events with [`SocketEmitter`](server.md#socketemitter)        |
