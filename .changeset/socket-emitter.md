---
"@item-enonic-types/lib-wsutil": major
---

`SocketEmitter`: `client.onDisconnect(callback)` replaces the magic `"disconnect"` event, `emitter.emitTo(id, event, message)` replaces `client.sendTo()`, and `broadcast()` takes `{ except }` to leave out a client.
