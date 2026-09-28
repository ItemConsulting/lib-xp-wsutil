// The global type declarations of the client library: `<xp-websocket>` in the tag name map, so that
// document.querySelector("xp-websocket") is an XpWebSocketElement, and the ws: events in the event map, so that
// addEventListener("ws:message", ...) gets a typed event. Apps get them with
// "types": ["@item-enonic-types/lib-wsutil/global"] in tsconfig.json, see global.d.ts in the package root.
// Type-only: not built into the jar (see tsdown.config.mts), so it must not contain runtime code.

import type { XpWebSocketElement, XpWebSocketEventMap } from "./xp-websocket";

declare global {
  interface HTMLElementTagNameMap {
    "xp-websocket": XpWebSocketElement;
  }

  // The events bubble, so they can be listened for on any element, the document and the window
  interface GlobalEventHandlersEventMap extends XpWebSocketEventMap {}
}
