# Enonic XP websocket utility library

Make WebSocket integration with Enonic XP easy and more dynamic.

WebSockets are a powerful tool for real time communication between client and server, but both the server side
and the client side need some code to get started. This library reduces that code to a few lines, and adds
features on top of XP's own `/lib/xp/websocket`.

Some use-cases for WebSockets:

- Real time chat
- IoT data flow
- WebRTC peer-to-peer signaling
- Real time server notifications
- Search suggestions while typing

## Features

- Send objects, not only strings. They are serialized to JSON, and parsed on the other side.
- The client picks `wss://` or `ws://` from the context of the page.
- A main handler and any number of additional handlers for each WebSocket event.
- [`SocketEmitter`](server.md#socketemitter) and [`Io()`](client.md#io): named events between server and client,
  inspired by [socket.io](https://socket.io/).
- Groups with automatic creation, a user list, and automatic removal when a user disconnects.
- [Extensions](extensions.md) to reuse functionality on both the server and the client.
- Several independent websocket services in one app, each with its own handlers, groups and emitter.

## How it works

A WebSocket connection in Enonic XP is handled by a *service*. `createWebSocketService()` gives a service
controller two things:

1. **The WebSocket endpoint.** WebSocket events (`open`, `message`, `close`, `error`) are passed to the handlers you
   register on the server.
2. **The client library.** A plain `GET` request to the same service returns the client side library as a
   JavaScript module, already configured with the URL of the service.

```mermaid
sequenceDiagram
    participant Browser
    participant Service as services/websocket<br>(Enonic XP)

    Browser->>Service: GET (import { WebSocketClient } from "#lt;url#gt;")
    Service-->>Browser: the client library, as a JavaScript module

    Browser->>Service: new WebSocketClient().connect()
    Note over Browser,Service: WebSocket events (open, message, close, error)<br>are passed to webSocketEvent, which calls your handlers
    Browser<<->>Service: send(), Io()
```

## Contents

- [Installation](../README.md#installation) and [a minimal example](../README.md#hello-sockets)
- [Server API](server.md): `createWebSocketService()` from `/lib/wsUtil`, used in your service controller
- [Client API](client.md): the `WebSocketClient` module, used in the browser
- [Creating extensions](extensions.md): reusable functionality for the server and the client
- [Tutorial](tutorial.md): build a chat application, step by step
- [Migrating from 2.x to 3.0](migrating-to-3.md): every change that affects an app built on 2.x

The full type definitions, with documentation for every function, are published to npm as
[`@item-enonic-types/lib-wsutil`](https://www.npmjs.com/package/@item-enonic-types/lib-wsutil), so your editor shows
them as you type.
