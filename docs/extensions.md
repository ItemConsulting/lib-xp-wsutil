# Creating extensions

Extensions package reusable WebSocket functionality: on the server as functions that work on a websocket service,
and on the client with `expandClient()`. If you create something others could use, share it.

## Server extensions

A server extension is a function that takes the service and sets it up. Say we want to log every connection. In
`src/main/resources/lib/wsLogger.ts`:

```typescript
import type { WebSocketService } from "/lib/wsUtil";

export function logConnections(socket: WebSocketService): void {
  socket.addHandler("open", (event) => log.info(`Connected: ${event.session.id}`));
  socket.addHandler("close", (event) => log.info(`Disconnected: ${event.session.id}`));
}
```

Use it in the service controller:

```typescript
import { logConnections } from "/lib/wsLogger";
import { createWebSocketService } from "/lib/wsUtil";

const socket = createWebSocketService();
export const { get, webSocketEvent } = socket;

logConnections(socket);
```

An extension can also create the service, to bundle its setup with options of its own:

```typescript
import type { WebSocketService, WebSocketServiceOptions } from "/lib/wsUtil";
import { createWebSocketService } from "/lib/wsUtil";

export function createLoggedWebSocketService(options?: WebSocketServiceOptions): WebSocketService {
  const socket = createWebSocketService(options);
  socket.addHandler("open", (event) => log.info(`Connected: ${event.session.id}`));
  socket.addHandler("close", (event) => log.info(`Disconnected: ${event.session.id}`));
  return socket;
}
```

```typescript
import { createLoggedWebSocketService } from "/lib/wsLogger";

export const { get, webSocketEvent } = createLoggedWebSocketService({ service: "chat" });
```

## Client expansions

`expandClient()` adds methods to the [client](client.md) of every client served by the service. Call it on the
service:

```typescript
import { createWebSocketService } from "/lib/wsUtil";

const socket = createWebSocketService();
export const { get, webSocketEvent } = socket;

socket.expandClient("hello", function () {
  this.send("Hello"); // `this` is the client, typed as WebSocketClientApi
});

// Or several at once
socket.expandClient({
  hello() {
    this.send("Hello");
  },
  greeting: "Hi there",
});
```

Use them on the client:

```javascript
const cws = new WebSocketClient();
cws.connect();
cws.hello();
console.log(cws.greeting);
```

The functions are sent to the browser as **source code**, so they run there and not on the server:

- They can only use `this` (the client), their arguments and browser globals. Variables and imports from the code
  around them do not exist in the browser.
- Use a `function` expression or a method, not an arrow function: an arrow function has no `this` of its own, so
  `expandClient()` rejects it with a `TypeError`.
- Values that are not functions are sent as JSON.
