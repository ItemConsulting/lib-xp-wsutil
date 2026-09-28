# Creating extensions

Extensions package reusable WebSocket functionality: on the server as functions that work on a websocket service,
and on the client as functions that work on the `<xp-websocket>` element. If you create something others could use,
share it.

## Server extensions

A server extension is a function that takes the service and sets it up. Say we want to log every connection. In
`src/main/resources/lib/wsLogger.ts`:

```typescript
import type { WebSocketService } from "/lib/wsutil";

export function logConnections(socket: WebSocketService): void {
  socket.addHandler("open", (event) => log.info(`Connected: ${event.session.id}`));
  socket.addHandler("close", (event) => log.info(`Disconnected: ${event.session.id}`));
}
```

Use it in the service controller:

```typescript
import { logConnections } from "/lib/wsLogger";
import { createWebSocketService } from "/lib/wsutil";

const socket = createWebSocketService();
export const { get, webSocketEvent } = socket;

logConnections(socket);
```

An extension can also create the service, to bundle its setup with options of its own:

```typescript
import type { WebSocketService, WebSocketServiceOptions } from "/lib/wsutil";
import { createWebSocketService } from "/lib/wsutil";

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

## Client extensions

A client extension is a function that takes the [`<xp-websocket>`](client.md) element, in a script of your app.
Say we want to show the state of the connection in the page:

```typescript
// src/main/resources/assets/connection-status.ts
import type { XpWebSocketElement } from "@item-enonic-types/lib-wsutil/dist/assets/wsutil/xp-websocket";

export function showConnectionStatus(socket: XpWebSocketElement, target: HTMLElement): void {
  socket.addEventListener("ws:open", () => {
    target.textContent = "Connected";
  });
  socket.addEventListener("ws:close", () => {
    target.textContent = "Disconnected";
  });
}
```

```javascript
import { showConnectionStatus } from "./connection-status.js";

showConnectionStatus(document.querySelector("xp-websocket"), document.getElementById("status"));
```

## Extensions with both sides

An extension that needs the server too pairs a server function with a client function, and uses
[rpc](server.md#rpc) or the [emitter](server.md#socketemitter) between them. A user registry, for example:

```typescript
// src/main/resources/lib/wsUsers.ts
import type { WebSocketService } from "/lib/wsutil";

export function userRegistry(socket: WebSocketService) {
  const users: Record<string, string> = {}; // Session ids by username

  return socket.rpc({
    register(name: string) {
      if (users[name]) throw new Error(`"${name}" is taken`);
      users[name] = this.session.id;
    },
    listUsers() {
      return Object.keys(users);
    },
  });
}
```

```typescript
// src/main/resources/services/websocket/websocket.ts
import { createWebSocketService } from "/lib/wsutil";
import { userRegistry } from "/lib/wsUsers";

const socket = createWebSocketService();
export const { get, webSocketEvent } = socket;
export const users = userRegistry(socket);
```

The client side of the extension calls the methods through the element, typed by the export of the service:

```typescript
import type { users } from "../../services/websocket/websocket";
import type { XpWebSocketElement } from "@item-enonic-types/lib-wsutil/dist/assets/wsutil/xp-websocket";

export async function register(socket: XpWebSocketElement, name: string): Promise<string[]> {
  const rpc = socket.rpc<typeof users>();
  await rpc.register(name);
  return rpc.listUsers();
}
```
