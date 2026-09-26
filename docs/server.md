# Server API

The server side library is imported from `/lib/wsUtil`. It has one function, `createWebSocketService()`, which
creates a *websocket service*: the two handlers to export from the service controller that serves the web sockets,
and the functions to work with the connections of that service.

## Creating the service

```typescript
// src/main/resources/services/websocket/websocket.ts
import { createWebSocketService } from "/lib/wsUtil";

const socket = createWebSocketService();
export const { get, webSocketEvent } = socket;

// Your server websocket logic goes here, using `socket`
```

`get` serves the [client library](client.md) to plain requests, and accepts WebSocket connections. `webSocketEvent`
passes the WebSocket events on to your handlers.

In JavaScript, `openWebsockets(exports)` sets both of them on the `exports` object of the service:

```javascript
const { createWebSocketService } = require("/lib/wsUtil");

const socket = createWebSocketService();
socket.openWebsockets(exports);
```

Every service created has its own handlers, groups, emitter and client expansions, so an app can run several
independent websocket services, each from its own service controller.

### Options

```typescript
const socket = createWebSocketService({
  // The name of the service the client connects to, as in serviceUrl({ service }). Defaults to "websocket"
  service: "chat",

  // Or the full url the client connects to, which overrides `service`
  host: "wss://example.com/socket",

  // The response a websocket request is answered with. Defaults to {}
  webSocketResponse: {
    subProtocols: ["text"],
    terminateOnSessionExit: false,
  },
});
```

The client connects to the URL of the service it was served from, so when the service controller isn't named
`websocket`, pass its name as `service`. `webSocketResponse` takes the options Enonic XP supports for a WebSocket
response.

## Handling events

There are four WebSocket events: `open`, `message`, `close` and `error`. Each event has one **main handler**, and
any number of **additional handlers**, for logging and other background work.

```typescript
// Set the main handler of one event
socket.setEventHandler("open", (event) => log.info(`Connected: ${event.session.id}`));

// Or set the main handlers of several events at once
socket.setEventHandlers({
  open: openHandler,
  close: closeHandler,
});

// Add as many additional handlers as you want
socket.addHandler("message", (message, event) => log.info(`${event.session.id} sent ${JSON.stringify(message)}`));
```

- The `message` handlers receive the **message**, parsed as JSON, and the event. A message that is not JSON is
  passed on as a string.
- The other handlers receive the **event**, with the sender in `event.session.id`.
- Additional handlers are called after the main handler, with the same arguments.
- The default main handlers log every event at debug level, so they show up when debug logging is enabled for
  your application in Enonic XP.

## Sending messages

Objects are serialized to JSON before they are sent.

```typescript
// To one client, by its session id
socket.send(event.session.id, { hello: "world" });

// To every client in a group
socket.sendToGroup("global", { hello: "everyone" });
```

## Groups

```typescript
socket.setEventHandler("open", (event) => {
  // The group is created if it doesn't exist. With autoRemove set to true, users are removed
  // from the group when they disconnect
  socket.addUserToGroup("global", event.session.id, true);
});

// Or create the group up front. Does nothing if the group exists
socket.createGroup("global", true);

// The session ids of the users in a group, or undefined if there is no such group
const users = socket.getGroupUsers("global") ?? [];

// A group is removed when its last user is removed
socket.removeUserFromGroup("global", event.session.id);
```

## SocketEmitter

The emitter of a service sends and receives *named events* with a payload, together with [`Io()`](client.md#io)
on the client. It is inspired by [socket.io](https://socket.io/), and created on first use: `socket.emitter()`
returns the same instance every time.

```typescript
const emitter = socket.emitter();

emitter.connect((client) => {
  // Emit an event to every connected client, except this one
  emitter.broadcast("user-enter", { id: client.id }, { except: client.id });

  // Emit an event to this client
  client.emit("hi", { msg: "hello from server" });

  // Handle an event emitted by this client. The type parameter is the type of the payload
  client.on<{ recipient: string; content: string }>("ping", (message) => {
    client.emit("pong", message); // Send it back to the client
    emitter.emitTo(message.recipient, "private", message.content); // Or on to another client
  });

  // Called when this client closes the connection
  client.onDisconnect(() => log.info(`${client.id} left`));
});
```

`client.id` is the session id of the client, so it works with `socket.send()` and the group functions too.

## Reference

`createWebSocketService(options?)` returns a `WebSocketService` with these members:

| Member                                   | Description                                                          |
| ---------------------------------------- | -------------------------------------------------------------------- |
| `get(req)`                               | The `get` handler: serves the client library or accepts a connection |
| `webSocketEvent(event)`                  | The `webSocketEvent` handler: passes events on to your handlers      |
| `openWebsockets(exports)`                | Sets `get` and `webSocketEvent` on the `exports` object of a service |
| `setEventHandler(event, handler)`        | Sets the main handler of an event                                    |
| `setEventHandlers(handlers)`             | Sets the main handlers of several events                             |
| `addHandler(event, handler)`             | Adds an additional handler to an event                               |
| `send(id, message)`                      | Sends a message to one client                                        |
| `sendToGroup(group, message)`            | Sends a message to every client in a group                           |
| `createGroup(group, autoRemove?)`        | Creates a group                                                      |
| `addUserToGroup(group, id, autoRemove?)` | Adds a client to a group, creating it if needed                      |
| `removeUserFromGroup(group, id)`         | Removes a client from a group                                        |
| `getGroupUsers(group)`                   | The session ids of the clients in a group                            |
| `emitter()`                              | The `SocketEmitter` of the service                                   |
| `expandClient(name, func)`               | See [Creating extensions](extensions.md)                             |

See the type definitions for the details of each member.
