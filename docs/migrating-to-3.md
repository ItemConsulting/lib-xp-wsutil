# Migrating from 2.x to 3.0

Version 3.0 is the Enonic XP 8 release of the library. It is rewritten in TypeScript, published to a new repository
with type definitions on npm, and takes the opportunity to fix the parts of the API that were inconsistent. This
guide lists every change that can affect an app built on 2.x, with what to do about it.

Version 2.x keeps working on Enonic XP 7; 3.0 requires XP 8.

## Contents

- [Installation](#installation)
- [The client library is a JavaScript module](#the-client-library-is-a-javascript-module)
- [The library is a service you create](#the-library-is-a-service-you-create)
- [Event handlers](#event-handlers)
- [Groups](#groups)
- [`extend()` is removed](#extend-is-removed)
- [Client expansions](#client-expansions)
- [`SocketEmitter`](#socketemitter)
- [The client](#the-client)
- [Smaller changes](#smaller-changes)
- [Checklist](#checklist)

## Installation

The jar moved from JitPack to `repo.itemtest.no`, and the XP libraries it uses now come with it, so your app no
longer includes them itself:

```diff
 repositories {
-  maven { url 'https://jitpack.io' }
+  maven { url "https://repo.itemtest.no/releases" }
 }

 dependencies {
-  include "com.enonic.xp:lib-portal:${xpVersion}"
-  include "com.enonic.xp:lib-io:${xpVersion}"
-  include "com.enonic.xp:lib-websocket:${xpVersion}"
-  include "no.item:lib-xp-wsutil:2.0.0"
+  include "no.item:lib-xp-wsutil:3.0.0"
 }
```

Type definitions are published as [`@item-enonic-types/lib-wsutil`](https://www.npmjs.com/package/@item-enonic-types/lib-wsutil).
See [TypeScript](../README.md#typescript) in the README for the `tsconfig.json` mapping.

## The client library is a JavaScript module

The websocket service still serves the client library, but as a JavaScript module that exports the client class. It
no longer sets the global `window.ExpWS`, so a plain `<script src>` fails on the `export` statement.

```diff
-<script src="/mysite/_/service/com.my.app/websocket"></script>
-<script>
-  var clientWs = new ExpWS();
-  clientWs.connect();
-</script>
+<script type="module">
+  import { WebSocketClient } from "/mysite/_/service/com.my.app/websocket";
+
+  const clientWs = new WebSocketClient();
+  clientWs.connect();
+</script>
```

The class is also exported under its old name, `ExpWS`. Client code that lives in a bundled asset of your app imports
it dynamically, since the URL of the service is only known when the page is rendered. See
[Loading the library](client.md#loading-the-library).

The unused copy of the client library at `lib/clientws.js` is gone; the served file is the only one.

## The library is a service you create

In 2.x, `/lib/wsUtil` was a bag of functions with shared state, which meant an app could only have one websocket
service. In 3.0 you create a service with `createWebSocketService()`, and everything is a method of it. Every
service has its own handlers, groups, emitter and client expansions.

```diff
-var ws = require("/lib/wsUtil");
-
-ws.openWebsockets(exports);
-ws.setEventHandler("open", openHandler);
+const { createWebSocketService } = require("/lib/wsUtil");
+
+const socket = createWebSocketService();
+socket.openWebsockets(exports);
+socket.setEventHandler("open", openHandler);
```

In TypeScript, export the two handlers from the service controller:

```typescript
import { createWebSocketService } from "/lib/wsUtil";

const socket = createWebSocketService();
export const { get, webSocketEvent } = socket;
```

The functions of 2.x map to the service like this:

| 2.x                                            | 3.0                                                                 |
| ---------------------------------------------- | ------------------------------------------------------------------- |
| `openWebsockets(exports, host?)`               | `createWebSocketService({ host }).openWebsockets(exports)`          |
| `sendSocketResponse(req, host?)`               | `socket.get(req)`, with `host` as an option of the service          |
| `getWsEvents(event)`                           | `socket.webSocketEvent(event)`                                      |
| `setSocketRequestResponse({ webSocket: r })`   | `createWebSocketService({ webSocketResponse: r })`                  |
| `returnScript(host?)`                          | `socket.get(req)` with a request that is not a websocket request    |
| `setEventHandler`, `setEventHandlers`          | The same, as methods of `socket`                                    |
| `addHandlers(event, handler)`                  | `socket.addHandler(event, handler)`                                 |
| `send`, `sendToGroup`                          | The same, as methods of `socket`                                    |
| `createGroup`, `removeUserFromGroup`, ...      | The same, as methods of `socket` (see [Groups](#groups))            |
| `new SocketEmitter()`                          | `socket.emitter()`, the same instance every time                    |
| `expandClient(name, func)`                     | `socket.expandClient(name, func)`                                   |
| `extend(extension)`                            | Removed, see [below](#extend-is-removed)                            |

The `host` of 2.x is now the `host` option, or better the `service` option: the name of the service controller,
when it isn't `websocket`. The default websocket response is now `{}`; 2.x answered with
`{ data: { user: "test" }, subProtocols: ["text"] }`, which came from a sample. Pass `webSocketResponse` if you need
the sub-protocol.

## Event handlers

**The `message` handlers get the event too.** In 2.x the main `message` handler received only the parsed message.
It now receives the message and the event, so the handler knows who sent it without a separate `open` bookkeeping:

```diff
-setEventHandler("message", (message) => {
-  // The sender is not available here
+socket.setEventHandler("message", (message, event) => {
+  socket.send(event.session.id, { echo: message });
 });
```

**Additional handlers get the same arguments as the main handler.** In 2.x an additional `message` handler received
the raw event and had to parse `event.message` itself. It now receives the parsed message and the event, like the
main handler:

```diff
-addHandlers("message", (event) => {
-  const message = JSON.parse(event.message);
+socket.addHandler("message", (message, event) => {
   log.info(`${event.session.id} sent ${JSON.stringify(message)}`);
 });
```

**`setEventHandlers()` merges.** In 2.x it replaced the whole handler object, so an event left out lost its handler.
It now takes a partial object and keeps the handlers of the events left out. If you relied on the old behaviour to
silence the default logging of an event, note that the default handlers now log at debug level (see below), so that
is no longer needed.

**Handlers are typed.** Event names are checked at compile time, and the arguments are typed: `event` is a
`SocketEvent`, and `message` is `unknown`, so narrow it before use.

## Groups

**The group comes first, and `addUserToGroup()` creates the group.** The `autoCreate` flag is gone: the group is
created when it doesn't exist. The third argument is now `autoRemove`, which is used when the call creates the
group, and means the same as in `createGroup()`.

```diff
-createGroup("global", true);
-addUserToGroup(event.session.id, "global");
+socket.addUserToGroup("global", event.session.id, true);

-addUserToGroup(event.session.id, "global", true); // autoCreate
+socket.addUserToGroup("global", event.session.id, true); // autoRemove, if the group is created
```

`removeUserFromGroup(group, id)`, `createGroup(group, autoRemove?)` and `getGroupUsers(group)` already took the
group first and are otherwise unchanged.

**`getGroupUsers()` returns a copy.** Changing the returned array no longer changes the group. A user added to a
group twice is now listed once.

**`autoRemove` works for every group.** In 2.x only the first group created with `autoRemove` actually removed users
on disconnect; the others kept stale session ids. If you worked around that with your own `close` handler, it can go.

## `extend()` is removed

`extend()` copied functions onto the CommonJS `exports` object of `/lib/wsUtil`, so that every `require` of the
library saw them. Now that the library is a service you create, an extension is a function that takes the service,
or one that creates it:

```diff
-var ws = require("/lib/wsUtil");
-
-ws.extend({ logger: logger });
-exports.logger = ws;
+import type { WebSocketService } from "/lib/wsUtil";
+
+export function logger(socket: WebSocketService): void {
+  // ...
+}
```

See [Server extensions](extensions.md#server-extensions).

## Client expansions

`expandClient()` is now a method of the service, and the expansions become **methods of the client**. They are still
sent to the browser as source code, but the client is now a class, so the inner variables of the 2.x client
(`send`, `ws`, `host`, ...) are no longer in scope. Use `this` instead, which TypeScript types as the client:

```diff
-expandClient("hello", function () {
-  send("Hello");
-});
+socket.expandClient("hello", function () {
+  this.send("Hello");
+});
```

Use a `function` expression or a method, not an arrow function: an arrow function has no `this` of its own, so
`expandClient()` now rejects it with a `TypeError`.

## `SocketEmitter`

The emitter is created by the service: `socket.emitter()` replaces `new SocketEmitter()`, and returns the same
instance every time. Its API changed in four places:

- **`client.onDisconnect(callback)` replaces `client.on("disconnect", …)`.** In 2.x the emitter called the
  handler of the event named `disconnect` when the client closed the connection, which collided with a client
  emitting an event by that name. Now it is a callback of its own, and `"disconnect"` is an ordinary event.
- **`emitter.emitTo(id, event, message)` replaces `client.sendTo(id, event, message)`.** Sending to another client
  is not about the client at hand, so it moved to the emitter.
- **`emitter.broadcast(event, message, { except: id })`** leaves one client out, typically the sender. Without the
  option, `broadcast()` reaches every client including the sender, as in 2.x.
- **`on()` is generic.** `client.on<{ to: string }>("private", (message) => …)` types the payload; without the
  type parameter `message` is `unknown`, so narrow it before use.

```diff
 emitter.connect((client) => {
-  client.on("private-message", (message) => {
-    client.sendTo(users[message.to], "private-message", message.content);
+  client.on<{ to: string; content: string }>("private-message", (message) => {
+    emitter.emitTo(users[message.to], "private-message", message.content);
   });
-  client.on("disconnect", () => { ... });
+  client.onDisconnect(() => { ... });
 });
```

## The client

- **`new` is required.** `ExpWS` is now the class `WebSocketClient` (exported under both names), so `ExpWS(url)`
  without `new` throws. Write `new WebSocketClient(url)`.
- **The protocol follows the page.** The client uses `wss://` on a page served over `https://`, and `ws://`
  otherwise. 2.x forced `ws://` on `localhost`, which browsers block on an `https://localhost` page.
- **`connect()` reconnects.** Calling it on an open connection closes that connection first. 2.x left it open.
- **`send()` before `connect()` throws** a clear error, instead of failing on an undefined socket.
- **Errors are `TypeError`s.** Unknown event names and handlers that are not functions throw `TypeError`s instead
  of strings, so they have a stack trace.
- **Default logging is quieter.** The default handler logs `error` events with `console.error`, and the others with
  `console.debug`, which the browser console shows at its *verbose* level. 2.x logged every event with
  `console.log`.
- **`Io()` returns the same instance** every time, instead of registering another message listener per call.
- **`addHandlers()` is `addHandler()`**, as on the server.

## Smaller changes

- **The client's `isConnected` is live.** In 2.x it was copied once at creation and stayed `false`. It now reflects
  the state of the connection.
- **The client's `setDefaultHandler()` applies.** In 2.x the default handler was replaced after the event handlers
  had already been bound to it, so it never ran. It is now called for every event without a handler of its own.
- **Logging.** The library logs at debug level, through Enonic XP's log level configuration for your app. The
  `no.item.wsUtil.printLog` setting of 2.x is gone; remove it from your config file. (The 2.x README spelled it
  `wsUtils`, which never had any effect.)
- **`lib/virtual.js` is gone.** It only held JSDoc comments. The type definitions on npm replace it, and the
  documentation moved to the [`docs/`](index.md) folder in the repository.

## Checklist

1. Update `build.gradle`: the repository and the dependency, and drop the three `com.enonic.xp:lib-*` includes.
2. Change the pages that load the client library to `<script type="module">` with `import { WebSocketClient }`,
   and add `new` where `ExpWS` was called without it.
3. In each service controller, create the service with `createWebSocketService()` and call everything as methods
   of it; TypeScript users get a compile error for each old import.
4. Move `host` and the websocket response into the options of `createWebSocketService()`.
5. Add the `event` parameter to `message` handlers that need the sender, and update additional `message` handlers
   to take `(message, event)`.
6. Swap the arguments of `addUserToGroup()`, and remove `createGroup()` calls that only existed for `autoCreate`.
7. Replace `extend()` with a function that takes the service.
8. Change client expansions to use `this` instead of the inner variables of the client.
9. In `SocketEmitter` code, replace `client.on("disconnect", …)` with `client.onDisconnect(…)` and
   `client.sendTo(…)` with `emitter.emitTo(…)`.
10. Check that `setEventHandlers()` calls don't rely on clearing the handlers of the events left out.
