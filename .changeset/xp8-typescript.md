---
"@item-enonic-types/lib-wsutil": major
---

Support Enonic XP 8, and drop support for XP 7. See
[Migrating from 2.x to 3.0](https://github.com/ItemConsulting/lib-xp-wsutil/blob/main/docs/migrating-to-3.md) for
every change that affects an app built on 2.x.

The library is now written in TypeScript, and its type definitions are published to npm as
`@item-enonic-types/lib-wsutil`. The jar is published to https://repo.itemtest.no instead of JitPack, and brings the
XP libraries it uses along, so apps no longer include `lib-io`, `lib-portal` and `lib-websocket` themselves.

The library is now a service you create: `createWebSocketService()` returns the `get` and `webSocketEvent` handlers
to export from the service controller, and everything else as methods. Every service has its own handlers, groups,
emitter (`socket.emitter()`) and client expansions, so an app can run several independent websocket services:

```typescript
import { createWebSocketService } from "/lib/wsUtil";

const socket = createWebSocketService();
export const { get, webSocketEvent } = socket;
```

The client side library is now a JavaScript module exporting the class `WebSocketClient` (also as `ExpWS`), and no
longer sets the global `window.ExpWS`. Load it with `<script type="module">` and import it from the URL of your
websocket service:

```html
<script type="module">
  import { WebSocketClient } from "/mysite/_/service/com.my.app/websocket";

  const clientWs = new WebSocketClient();
</script>
```

Other changes:

- The event handlers are typed per event: the `message` handlers receive the parsed message and the event, the
  others the event. Additional handlers receive the same arguments as the main handler. `setEventHandlers()` takes
  a partial object and keeps the handlers of the events left out. `addHandlers` is renamed `addHandler`, on the
  server and the client.
- The group functions take the group first: `addUserToGroup(group, id, autoRemove?)` creates the group if needed,
  and `removeUserFromGroup(group, id)`. `getGroupUsers()` returns a copy of the list. `createGroup(name, true)` now
  removes users on disconnect from every group created with `autoRemove`, not only the first one.
- `SocketEmitter`: `client.onDisconnect(callback)` replaces the magic `"disconnect"` event, `emitter.emitTo()`
  replaces `client.sendTo()`, `broadcast()` takes `{ except }` to leave out a client, and `on<T>()` types the
  payload of an event. A handler that throws is logged as an error.
- `extend()` has been removed. An extension is a function that takes the service.
- Client expansions become methods of the client, and use `this` instead of the client's inner variables. Arrow
  functions and classes are rejected, as they would not get the client as `this`, and methods are serialized
  correctly.
- The client requires `new`, uses `wss://` on https pages, closes an open connection when `connect()` is called
  again, throws on `send()` before `connect()`, throws `TypeError`s instead of strings, returns the same `Io()`
  every time, and logs at debug level by default (errors with `console.error`). `isConnected` now reflects the
  state of the connection, and `setDefaultHandler()` now applies to every event without a handler of its own.
- The library logs at debug level, so the `no.item.wsUtil.printLog` setting is gone.
- The default websocket response is `{}` instead of `{ data: { user: "test" }, subProtocols: ["text"] }`. Pass the
  `webSocketResponse` option to set one.
- `lib/clientws.js`, an unused copy of `assets/clientws.js`, has been removed.
