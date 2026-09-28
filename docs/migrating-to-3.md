# Migrating from 2.x to 3.0

Version 3.0 is the Enonic XP 8 release of the library. It is rewritten in TypeScript, published to a new repository
with type definitions on npm, and takes the opportunity to fix the parts of the API that were inconsistent. This
guide lists every change that can affect an app built on 2.x, with what to do about it.

Version 2.x keeps working on Enonic XP 7; 3.0 requires XP 8.

## Contents

- [Finding what to change](#finding-what-to-change)
- [Installation](#installation)
- [The client is the `<xp-websocket>` element](#the-client-is-the-xp-websocket-element)
- [The library is a service you create](#the-library-is-a-service-you-create)
- [Event handlers](#event-handlers)
- [Groups](#groups)
- [`extend()` is removed](#extend-is-removed)
- [Client expansions](#client-expansions)
- [`SocketEmitter`](#socketemitter)
- [The client](#the-client)
- [Smaller changes](#smaller-changes)
- [Checklist](#checklist)
- [Verifying the migration](#verifying-the-migration)

## Finding what to change

Every use of 2.x is found by searching the app for these. Each points to a section below.

| Search for                                         | Section                                                              |
| -------------------------------------------------- | -------------------------------------------------------------------- |
| `lib-xp-wsutil`, `jitpack`, `lib-websocket`        | [Installation](#installation)                                        |
| `require("/lib/wsUtil")`, `from "/lib/wsUtil"`     | [The library is a service you create](#the-library-is-a-service-you-create) |
| `<script src=` with the URL of the websocket service, `serviceUrl({ service: "websocket" })` | [The client is the `<xp-websocket>` element](#the-client-is-the-xp-websocket-element) |
| `ExpWS`, `setHost(`, `addHandlers(`, `.Io()`, `isConnected` | [The client](#the-client)                                    |
| `openWebsockets(exports,` with a second argument, `returnScript`, `sendSocketResponse`, `setSocketRequestResponse` | [The library is a service you create](#the-library-is-a-service-you-create) |
| `setEventHandler("message"`, `addHandlers("message"`, `setEventHandlers(` | [Event handlers](#event-handlers)                 |
| `addUserToGroup(`, `createGroup(`, `getGroupUsers(` | [Groups](#groups)                                                   |
| `extend(`                                          | [`extend()` is removed](#extend-is-removed)                          |
| `expandClient(`                                    | [Client expansions](#client-expansions)                              |
| `new SocketEmitter`, `sendTo(`, `on("disconnect"`  | [`SocketEmitter`](#socketemitter)                                    |
| `printLog`, `virtual.js`                           | [Smaller changes](#smaller-changes)                                  |

## Installation

The jar moved from JitPack to `repo.itemtest.no`, and `lib-websocket` now comes with it. The library no longer uses
`lib-portal` and `lib-io`; keep them if your own code does. The pages that load the client library use `assetUrl()`
from [lib-asset](https://developer.enonic.com/docs/lib-asset/stable), which the XP 8 starters include; an app
upgraded from XP 7 adds it:

```diff
 repositories {
-  maven { url 'https://jitpack.io' }
+  maven { url "https://repo.itemtest.no/releases" }
 }

 dependencies {
   include "com.enonic.xp:lib-portal:${xpVersion}"
   include "com.enonic.xp:lib-io:${xpVersion}"
-  include "com.enonic.xp:lib-websocket:${xpVersion}"
-  include "no.item:lib-xp-wsutil:2.0.0"
+  include "no.item:lib-xp-wsutil:3.0.0"
+  include "com.enonic.lib:lib-asset:${libVersion}"
 }
```

Type definitions are published as [`@item-enonic-types/lib-wsutil`](https://www.npmjs.com/package/@item-enonic-types/lib-wsutil):

```bash
npm i -D @item-enonic-types/lib-wsutil
```

The server side is typed through the `/lib/*` path mapping described under [TypeScript](../README.md#typescript) in
the README. The client side is typed by adding the global declarations of the package to the `tsconfig.json` of your
client code, which types `document.querySelector("xp-websocket")` and the `ws:` events:

```diff
{
  "compilerOptions": {
+   "types": ["@item-enonic-types/lib-wsutil/global"]
  }
}
```

## The client is the `<xp-websocket>` element

In 2.x the websocket service served the client library, rewritten per request with the URL of the service and the
client expansions, and the page created an `ExpWS`. In 3.0 the client library is an **asset of your app**,
`assets/wsutil/xp-websocket.js`, and the connection is the custom element `<xp-websocket>`, which connects to the URL in
its `src` when it is added to the page.

Your page or part controller gives the view two URLs instead of one:

```diff
-const model = { websocketUrl: serviceUrl({ service: "websocket" }) };
+const model = {
+  clientUrl: assetUrl({ path: "wsutil/xp-websocket.js" }),
+  socketUrl: serviceUrl({ service: "websocket", type: "websocket" }),
+};
```

```diff
-<script src="${websocketUrl}"></script>
-<script>
-  var clientWs = new ExpWS();
-  clientWs.connect();
-</script>
+<script type="module" src="${clientUrl}"></script>
+<xp-websocket src="${socketUrl}"></xp-websocket>
```

The client code gets the element from the page, instead of creating a client:

```diff
-var clientWs = new ExpWS();
-clientWs.connect();
-clientWs.setEventHandler("message", function (message) { ... });
-clientWs.send({ hello: "server" });
+const socket = document.querySelector("xp-websocket");
+socket.addEventListener("ws:message", (event) => { ... /* event.detail is the message */ });
+socket.send({ hello: "server" });
```

`ExpWS` is gone. The class behind the element is exported as `WebSocketClient` from the asset, for scripts that want
a connection without an element; it takes the URL as its argument. See [Client API](client.md).

The service no longer serves a script: a request to it that is not a WebSocket request is answered with **status
400**. A page that still loads `<script src>` from the URL of the service fails with that status, which is the first
symptom of a page that was not migrated.

The unused copy of the client library at `lib/clientws.js` is gone too.

## The library is a service you create

In 2.x, `/lib/wsUtil` was a bag of functions with shared state, which meant an app could only have one websocket
service. In 3.0 you create a service with `createWebSocketService()`, and everything is a method of it. Every
service has its own handlers, groups, emitter and rpc methods.

```diff
-var ws = require("/lib/wsUtil");
-
-ws.openWebsockets(exports);
-ws.setEventHandler("open", openHandler);
+const { createWebSocketService } = require("/lib/wsutil");
+
+const socket = createWebSocketService();
+socket.openWebsockets(exports);
+socket.setEventHandler("open", openHandler);
```

The module is renamed `/lib/wsutil`, all lowercase, so it maps to the npm types package with the same `/lib/*`
path rule as other libraries. In TypeScript, export the two handlers from the service controller:

```typescript
import { createWebSocketService } from "/lib/wsutil";

const socket = createWebSocketService();
export const { get, webSocketEvent } = socket;
```

The functions of 2.x map to the service like this:

| 2.x                                            | 3.0                                                                 |
| ---------------------------------------------- | ------------------------------------------------------------------- |
| `openWebsockets(exports, host?)`               | `socket.openWebsockets(exports)`; the URL is the `src` of the element |
| `sendSocketResponse(req, host?)`               | `socket.get(req)`                                                   |
| `getWsEvents(event)`                           | `socket.webSocketEvent(event)`                                      |
| `setSocketRequestResponse({ webSocket: r })`   | `createWebSocketService({ webSocketResponse: r })`                  |
| `returnScript(host?)`                          | Removed: the client library is an asset, `assetUrl({ path: "wsutil/xp-websocket.js" })` |
| `setEventHandler`, `setEventHandlers`          | The same, as methods of `socket`                                    |
| `addHandlers(event, handler)`                  | `socket.addHandler(event, handler)`                                 |
| `send`, `sendToGroup`                          | The same, as methods of `socket`                                    |
| `createGroup`, `removeUserFromGroup`, ...      | The same, as methods of `socket` (see [Groups](#groups))            |
| `new SocketEmitter()`                          | `socket.emitter()`, the same instance every time                    |
| `expandClient(name, func)`                     | Removed, see [Client expansions](#client-expansions)                |
| `extend(extension)`                            | Removed, see [below](#extend-is-removed)                            |

The `host` of 2.x is gone from the server: the URL the client connects to is the `src` of the `<xp-websocket>`
element, from `serviceUrl({ service, type: "websocket" })`. The default websocket response is now `{}`; 2.x answered
with `{ data: { user: "test" }, subProtocols: ["text"] }`, which came from a sample. Pass `webSocketResponse` if you
need the sub-protocol.

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

**A handler that throws no longer stops the others.** In 2.x an exception in a handler propagated out of
`getWsEvents()`, and the handlers after it did not run. Now it is logged as an error, and the other handlers of the
event run as usual. A handler that threw on purpose to abort the processing of an event needs another way to do
that.

**Messages of the shape `{ rpc: { id, method, args } }` are reserved.** The service answers them as
[rpc](server.md#rpc) calls, and does not pass them to the `message` handlers. A 2.x app whose clients happen to
send objects with an `rpc` key of that shape needs to rename it.

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
+import type { WebSocketService } from "/lib/wsutil";
+
+export function logger(socket: WebSocketService): void {
+  // ...
+}
```

See [Server extensions](extensions.md#server-extensions).

## Client expansions

`expandClient()` is removed. It shipped server-side functions to the browser as source code, which could not be
typed, tested or bundled. What an expansion did falls in one of two groups, each with a replacement:

**A helper on the client**, such as a function that sends a message in a fixed shape, is client code. Move it to a
script of your app, as a function that takes the element:

```diff
-expandClient("hello", function () {
-  send("Hello");
-});
+// In a script of your app
+export function hello(socket) {
+  socket.send("Hello");
+}
```

**A request to the server**, such as an expansion that sent a message and a `message` handler that answered it, is
an [rpc method](server.md#rpc). It runs on the server, and the client calls it as an async function:

```diff
-expandClient("register", function (name) {
-  send({ register: name });
-});
-setEventHandler("message", function (message, event) {
-  if (message.register) {
-    users[message.register] = event.session.id;
-    send(event.session.id, { registered: message.register });
-  }
-});
+export const api = socket.rpc({
+  register(name: string) {
+    users[name] = this.session.id; // `this` is the context of the call: the session of the caller, and the event
+    return name;
+  },
+});
```

```javascript
const registered = await socket.rpc().register("Tom");
```

Where a 2.x `message` handler used `event.session.id` to know the sender, an rpc method uses `this.session.id`.

Values that were expansions (`expandClient("greeting", "Hi")`) are an attribute of the element, or the return value
of an rpc method.

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

**The wire format is unchanged.** Both versions send emitter events as `{ "event": "...", "object": ... }`, so a 3.0
server keeps working with 2.x clients that are still in the field, and the other way around, for the emitter and
`Io()`. Plain `send()` messages are passed through unchanged in both versions too.

**The emitter is always active.** In 2.x its handlers were only registered by `new SocketEmitter()`. In 3.0 every
service has its emitter from the start, so it also knows the clients that connected before `socket.emitter()` was
first called. A message that is not an emitter message is ignored by it; 2.x logged "Wrong JSON format" for those.

## The client

The element is the client, see [above](#the-client-is-the-xp-websocket-element). The 2.x client maps to it like this:

| 2.x (`ExpWS`)                                | 3.0 (`<xp-websocket>`)                                                  |
| -------------------------------------------- | ----------------------------------------------------------------------- |
| `new ExpWS()`                                | `document.querySelector("xp-websocket")`                                |
| `new ExpWS(url)`, `setHost(url, true)`       | The `src` attribute; setting `socket.src` reconnects                    |
| `connect()`                                  | Automatic when the element is in the page; `socket.connect()` reconnects |
| `send(message)`                              | `socket.send(message)`                                                  |
| `setEventHandler("message", fn)`             | `socket.addEventListener("ws:message", (event) => fn(event.detail))`    |
| `setEventHandler("open" / "close" / "error", fn)` | `socket.addEventListener("ws:open" / "ws:close" / "ws:error", (event) => fn(event.detail))` |
| `setEventHandlers({ ... })`                  | One `addEventListener()` per event                                      |
| `addHandlers(event, fn)`                     | Another `addEventListener()`; there is no main handler to be additional to |
| `setDefaultHandler(fn)`                      | Removed: unhandled events are not logged. Listen for the ones you need  |
| `Io()`                                       | `socket.io`, the same instance every time                               |
| `isConnected`                                | `socket.connected` (`isConnected` on an element is the DOM's: in the page) |
| Expansions, `clientWs.hello()`               | Functions in your code, or `socket.rpc().hello()`, see [Client expansions](#client-expansions) |

For code that uses the `WebSocketClient` class behind the element:

- **`new` is required, with the URL.** `ExpWS` is gone; `new WebSocketClient(url)` connects to `url`. The class
  cannot find the service on its own any more, since it is no longer served by it.
- **The websocket URL comes from the server.** Use `serviceUrl({ service, type: "websocket" })`, which is `wss://`
  on a page served over `https://`. 2.x built the URL in the browser, and forced `ws://` on `localhost`, which
  browsers block on an `https://localhost` page.
- **`setHost()` is `setUrl()`.**
- **Events are DOM events on the element.** `setEventHandler("message", fn)` on the client is
  `addEventListener("ws:message", (event) => fn(event.detail))` on the element. The class keeps `setEventHandler()`,
  `setEventHandlers()`, `setDefaultHandler()` and `addHandler()`.
- **`connect()` reconnects.** Calling it on an open connection closes that connection first. 2.x left it open.
  `close()` is new.
- **`send()` before `connect()` throws** a clear error, instead of failing on an undefined socket. A message sent
  while the connection is being opened is queued and sent once it is open; 2.x sent it right away, which the browser
  rejects on a connecting socket.
- **Errors are `TypeError`s.** Unknown event names and handlers that are not functions throw `TypeError`s instead
  of strings, so they have a stack trace.
- **Default logging is quieter.** The default handler logs `error` events with `console.error`, and the others with
  `console.debug`, which the browser console shows at its *verbose* level. 2.x logged every event with
  `console.log`. The element dispatches events instead of logging.
- **`Io()` returns the same instance** every time, instead of registering another message listener per call. On the
  element it is the property `io`.
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

1. Update `build.gradle`: the repository and the dependency, drop the `com.enonic.xp:lib-websocket` include, and
   add `com.enonic.lib:lib-asset` if the app doesn't have it.
2. Install `@item-enonic-types/lib-wsutil`, and add `"types": ["@item-enonic-types/lib-wsutil/global"]` to the
   `tsconfig.json` of the client code.
3. In the pages that load the client library, load `assetUrl({ path: "wsutil/xp-websocket.js" })` from
   `/lib/enonic/asset` with `<script type="module" src>`, add `<xp-websocket src>` with
   `serviceUrl({ service, type: "websocket" })`, and replace `new ExpWS()` with
   `document.querySelector("xp-websocket")`. Change the client's handlers to `addEventListener("ws:...")`, see the
   [table](#the-client).
4. In each service controller, import `/lib/wsutil` (lowercase), create the service with
   `createWebSocketService()` and call everything as methods of it; TypeScript users get a compile error for each
   old import.
5. Drop `host`: the URL is the `src` of the element. Move the websocket response into the options of
   `createWebSocketService()`.
6. Add the `event` parameter to `message` handlers that need the sender, and update additional `message` handlers
   to take `(message, event)`.
7. Swap the arguments of `addUserToGroup()`, and remove `createGroup()` calls that only existed for `autoCreate`.
8. Replace `extend()` with a function that takes the service.
9. Replace client expansions with functions in your client code, or with rpc methods on the server.
10. In `SocketEmitter` code, replace `client.on("disconnect", …)` with `client.onDisconnect(…)` and
    `client.sendTo(…)` with `emitter.emitTo(…)`.
11. Check that `setEventHandlers()` calls don't rely on clearing the handlers of the events left out, and that no
    handler relies on throwing to stop the handlers after it.
12. Remove `no.item.wsUtil.printLog` from the config file.

## Verifying the migration

1. The app builds, and `tsc` passes: every remaining 2.x import or call is a compile error in TypeScript.
2. Open a page with the element. The network tab shows `wsutil/xp-websocket.js` loaded from the asset URL with
   status 200, and a WebSocket connection to the service with status 101. A 400 from the service means a page still
   loads the client library from the service URL.
3. In the browser console, `document.querySelector("xp-websocket").connected` is `true`.
4. With debug logging enabled for the app in Enonic XP, the server log shows the `open` event of the connection, and
   later the `close` event when the page is closed.
5. If the app uses groups with `autoRemove`, close a page and check `getGroupUsers()` no longer lists the session.
