# Enonic XP Web Socket Utility Library #

![Build badge](https://github.com/ItemConsulting/lib-xp-wsutil/actions/workflows/main.yml/badge.svg)
![Enonic XP8 badge](https://market.enonic.com/badges/xp8.svg)
[![](https://repo.itemtest.no/api/badge/latest/releases/no/item/lib-xp-wsutil)](https://repo.itemtest.no/#/releases/no/item/lib-xp-wsutil)
[![](https://img.shields.io/npm/types/%40item-enonic-types%2Flib-wsutil)](https://www.npmjs.com/package/@item-enonic-types/lib-wsutil)

<img src="https://github.com/ItemConsulting/lib-xp-wsutil/raw/main/docs/images/kicon.svg?sanitize=true" width="150">

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

npm package names are lowercase, so map `/lib/wsUtil` to the package explicitly in your *tsconfig.json*:

```diff
{
  "compilerOptions": {
    "paths": {
      "/lib/xp/*": ["./node_modules/@enonic-types/lib-*"],
+     "/lib/wsUtil": ["./node_modules/@item-enonic-types/lib-wsutil"],
      "/*": ["./src/main/resources/*"]
    }
  }
}
```

The client side library is a JavaScript module served from your websocket service, at a URL TypeScript can't
resolve. Import its types from the package instead:

```typescript
import type * as ClientWs from "@item-enonic-types/lib-wsutil/dist/assets/clientws";

// The URL of your websocket service, e.g. rendered into the page by a controller using serviceUrl()
const { WebSocketClient }: typeof ClientWs = await import(websocketServiceUrl);
const clientWs = new WebSocketClient();
```

## Hello sockets ##

Here is the shortest example for opening websocket communication in your project. Create a service called
`websocket`:

```typescript
// src/main/resources/services/websocket/websocket.ts
import { createWebSocketService } from "/lib/wsUtil";

export const { get, webSocketEvent } = createWebSocketService();
```

The service serves the client side library as a JavaScript module. Import it from the URL of the service, as
returned by `serviceUrl({ service: "websocket" })` in your page or part controller:

```html
<script type="module">
  import { WebSocketClient } from "/mysite/_/service/com.my.app/websocket";

  const clientWs = new WebSocketClient();
  clientWs.connect();
</script>
```

Check the console/server logs to see that your connection is alive

## Documentation ##

- [Overview](docs/index.md)
- [Server API](docs/server.md)
- [Client API](docs/client.md)
- [Creating extensions](docs/extensions.md)
- [Tutorial: a chat application](docs/tutorial.md)
- [Migrating from 2.x to 3.0](docs/migrating-to-3.md)

## License ##

This project is under the Apache 2.0 license. For more information please read [LICENSE.txt](LICENSE)

## Original author ##

**Per Arne Drevland**
