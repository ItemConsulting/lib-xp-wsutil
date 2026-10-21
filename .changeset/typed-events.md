---
"@item-enonic-types/lib-wsutil": minor
---

Typed events: `createWebSocketService<ClientEvents, ServerEvents>()` takes the event maps of both directions, and `on()`, `emit()`, `broadcast()` and `emitTo()` on the server and `io` on the client only accept the events of their direction, with the right payload.
