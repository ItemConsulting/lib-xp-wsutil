# Server API

The server side library is imported from `/lib/wsutil`. It has one function, `createWebSocketService()`, which
creates a *websocket service*: the two handlers to export from the service controller that serves the web sockets,
and the functions to work with the connections of that service.

## Creating the service

```typescript
// src/main/resources/services/websocket/websocket.ts
import { createWebSocketService } from "/lib/wsutil";

const socket = createWebSocketService();
export const { get, webSocketEvent } = socket;

// Your server websocket logic goes here, using `socket`
```

`get` accepts WebSocket connections. `webSocketEvent` passes the WebSocket events on to your handlers, and answers
[rpc](#rpc) calls. The [client library](client.md) is an asset of your app, not served by the service: a request to
the service that is not a WebSocket request is answered with status 400.

In JavaScript, `openWebsockets(exports)` sets both of them on the `exports` object of the service:

```javascript
const { createWebSocketService } = require("/lib/wsutil");

const socket = createWebSocketService();
socket.openWebsockets(exports);
```

Every service created has its own handlers, groups, emitter and rpc methods, so an app can run several
independent websocket services, each from its own service controller. The client connects to the one whose URL is
in the `src` of its [`<xp-websocket>`](client.md) element.

### Options

```typescript
const socket = createWebSocketService({
  // The response a websocket request is answered with. Defaults to {}
  webSocketResponse: {
    subProtocols: ["text"],
    terminateOnSessionExit: false,
  },
});
```

`webSocketResponse` takes the options Enonic XP supports for a WebSocket response.

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
- A handler that throws is logged as an error, and the other handlers of the event still run.
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

## Rpc

`socket.rpc()` registers methods that the client calls as async functions, with [`rpc()`](client.md#rpc) on the
element. The methods run on the server, and what they return, or throw, is sent back to the caller:

```typescript
// The session ids of the registered users, by name
const users: Record<string, string> = {};

export const api = socket.rpc({
  greet(name: string) {
    return `Hello ${name}`;
  },

  register(name: string) {
    if (users[name]) {
      throw new Error("That name is taken"); // Rejects the promise on the client
    }
    users[name] = this.session.id; // `this` is the context of the call
  },
});
```

- `this` is the context of the call: `this.session` is the session of the caller, with `this.session.id` for
  `send()`, the group functions and `emitTo()`, and `this.event` is the WebSocket event.
- The arguments and the return value travel as JSON, so they must be serializable. A result that cannot be
  serialized rejects the call, like an error thrown by the method. A method that returns nothing resolves the promise
  with `undefined`.
- An error thrown by a method rejects the promise on the client with the message of the error, and is logged on
  the server. A call of a method that isn't registered is rejected too.
- Rpc calls are not passed to the `message` handlers.
- `socket.rpc()` returns the methods as given, so `export const api = socket.rpc({ ... })` lets the client code
  import their type: `import type { api } from "../../services/websocket/websocket"`. See [Rpc](client.md#rpc) in
  the Client API.

## SocketEmitter

The emitter of a service sends and receives *named events* with a payload, together with [`io`](client.md#io)
on the client. It is inspired by [socket.io](https://socket.io/). `socket.emitter()` returns the same instance every
time.

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
| `get(req)`                               | The `get` handler: accepts a WebSocket connection                    |
| `webSocketEvent(event)`                  | The `webSocketEvent` handler: your handlers, and rpc calls           |
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
| `rpc(methods)`                           | Registers methods the client calls, see [Rpc](#rpc)                  |
| `emitter()`                              | The `SocketEmitter` of the service                                   |

See the type definitions for the details of each member.
