# @item-enonic-types/lib-wsutil

## 3.0.0

### Major Changes

- c8b69f1: The library is a service you create: `createWebSocketService()` returns the `GET` and `webSocketEvent` handlers to export from the service controller, with everything else as methods, so an app can run several independent websocket services.
- c8b69f1: `SocketEmitter`: `client.onDisconnect(callback)` replaces the magic `"disconnect"` event, `emitter.emitTo(id, event, message)` replaces `client.sendTo()`, and `broadcast()` takes `{ except }` to leave out a client.
- c8b69f1: The library is written in TypeScript, and its types are published to npm as `@item-enonic-types/lib-wsutil`, with the client types at `@item-enonic-types/lib-wsutil/client` and the global declarations at `@item-enonic-types/lib-wsutil/global`.
- c8b69f1: The client library is an asset of the app, `assetUrl({ path: CLIENT_ASSET_PATH })`, and the connection is the `<xp-websocket src="…">` element, which dispatches the WebSocket events as bubbling `ws:` DOM events.
- c8b69f1: Support Enonic XP 8, and drop support for XP 7.

### Minor Changes

- c8b69f1: `<xp-websocket reconnect>` opens a dropped connection again, with a growing delay between the attempts, and dispatches `ws:open` for every connection it opens.
- c8b69f1: Rpc: methods registered with `socket.rpc()` on the server are called from the client as typed async functions, `socket.rpc<typeof api>().greet("Tom")`.
- c8b69f1: Typed events: `createWebSocketService<ClientEvents, ServerEvents>()` takes the event maps of both directions, and `on()`, `emit()`, `broadcast()` and `emitTo()` on the server and `io` on the client only accept the events of their direction, with the right payload.

## 2.0.0

### Major Changes

- Upgraded to build on XP 7.5.0.
- Compatibility Enonic XP 7.5.0.

### Minor Changes

- Turn off logging by setting `no.item.wsUtil.printLog` to `false` in the config file for the project using this lib.

## 1.1.1

### Patch Changes

- Added `getWsEvents` method to improve reusability

## 1.0.0

### Major Changes

- Initial release

  Compatibility Enonic XP 6.4.0
