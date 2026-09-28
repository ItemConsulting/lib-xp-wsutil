# Enonic XP Web Socket Utility Library #

![Build badge](https://github.com/ItemConsulting/lib-xp-wsutil/actions/workflows/main.yml/badge.svg)
![Enonic XP8 badge](https://market.enonic.com/badges/xp8.svg)
[![](https://repo.itemtest.no/api/badge/latest/releases/no/item/lib-xp-wsutil)](https://repo.itemtest.no/#/releases/no/item/lib-xp-wsutil)
[![](https://img.shields.io/npm/types/%40item-enonic-types%2Flib-wsutil)](https://www.npmjs.com/package/@item-enonic-types/lib-wsutil)

<img src="https://github.com/ItemConsulting/lib-xp-wsutil/raw/main/docs/images/icon.svg?sanitize=true" width="150">

> [!NOTE]
> See also the [Turbo Streams integration with XP](https://github.com/ItemConsulting/lib-xp-turbo), which lets
> developers use Web Sockets without writing any frontend JS-code.

## Compatibility ##

| Enonic XP | This library |
| --------- | ------------ |
| 8.x       | 3.x          |
| 7.x       | 2.x          |
| 6.4+      | 1.x          |

## Installation ##

```groovy
repositories {
  maven { url "https://repo.itemtest.no/releases" }
}

dependencies {
  include "no.item:lib-xp-wsutil:3.0.0"
}
```

### TypeScript ###

Install the type definitions:

```bash
npm i -D @item-enonic-types/lib-wsutil
```

And map `/lib/*` to the `@item-enonic-types` packages in your *tsconfig.json*, if it isn't already:

```diff
{
  "compilerOptions": {
    "paths": {
      "/lib/xp/*": ["./node_modules/@enonic-types/lib-*"],
+     "/lib/*": ["./node_modules/@item-enonic-types/lib-*", "./src/main/resources/lib/*"],
      "/*": ["./src/main/resources/*"]
    }
  }
}
```

The client side library is typed too. Add its global declarations to the *tsconfig.json* of your client code, and
`document.querySelector("xp-websocket")` is an `XpWebSocketElement`, and the `ws:` events are typed:

```diff
{
  "compilerOptions": {
+   "types": ["@item-enonic-types/lib-wsutil/global"]
  }
}
```

## Hello sockets ##

Here is the shortest example for opening websocket communication in your project. Create a service called
`websocket`:

```typescript
// src/main/resources/services/websocket/websocket.ts
import { createWebSocketService } from "/lib/wsutil";

export const { get, webSocketEvent } = createWebSocketService();
```

The client side library is an asset of your app, served with
[lib-asset](https://developer.enonic.com/docs/lib-asset/stable), and the connection is an element. Your page or part
controller gives the view the two URLs. Here with [lib-xp-freemarker](https://github.com/ItemConsulting/lib-xp-freemarker):

```typescript
import { render } from "/lib/freemarker";
import { assetUrl } from "/lib/enonic/asset";
import { serviceUrl } from "/lib/xp/portal";

const view = resolve("hello.ftlh");

export function get(): Response {
  const model = {
    clientUrl: assetUrl({
      path: "wsutil/xp-websocket.js"
    }),
    socketUrl: serviceUrl({
      service: "websocket",
      type: "websocket"
    }),
  };

  return {
    body: render(view, model),
  };
}
```

And the view loads the library, and adds the element:

```ftlh
[#-- @ftlvariable name="clientUrl" type="String" --]
[#-- @ftlvariable name="socketUrl" type="String" --]
<script type="module" src="${clientUrl}"></script>
<xp-websocket src="${socketUrl}"></xp-websocket>
```

The element connects when the page loads. Check the server log to see that your connection is alive: the `open`
event is logged at debug level.

## Documentation ##

- [Overview](docs/index.md)
- [Server API](docs/server.md)
- [Client API](docs/client.md)
- [Creating extensions](docs/extensions.md)
- [Tutorial: a chat application](docs/tutorial.md)
- [Migrating from 2.x to 3.0](docs/migrating-to-3.md)

## Author ##

This library was created by **Per Arne Drevland**.
