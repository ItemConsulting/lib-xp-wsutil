// The types of the client library, for client code that names them:
//
//   import type { XpWebSocketElement } from "@item-enonic-types/lib-wsutil/client";
//
// They are emitted to dist/ by "prepublishOnly" from src/main/resources/assets/wsutil/xp-websocket.ts. For the
// global declarations (the element in querySelector(), the "ws:" events), see global.d.ts.

export * from "./dist/assets/wsutil/xp-websocket";
