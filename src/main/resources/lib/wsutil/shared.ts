// Helpers shared by the server side library and the client side library (assets/wsutil/), bundled into each of
// them by tsdown. Not exported from /lib/wsutil. Must work in Nashorn (lowered to ES5) as well as in browsers.

import type { WebSocketEventType } from "@enonic-types/core";

export const EVENT_TYPES: readonly WebSocketEventType[] = ["open", "close", "error", "message"];

export function hasOwn(object: object, key: PropertyKey): boolean {
  // Object.hasOwn() is ES2022, and not available in Nashorn
  // biome-ignore lint/suspicious/noPrototypeBuiltins: see above
  return Object.prototype.hasOwnProperty.call(object, key);
}

/**
 * A message as it is sent over the web socket: objects as JSON, everything else as a string
 */
export function stringify(message: unknown): string {
  return typeof message === "object" ? JSON.stringify(message) : String(message);
}

/**
 * Parses a message received over the web socket as JSON. A message that is not JSON is returned as it is.
 */
export function parseMessage(message: string | undefined): unknown {
  try {
    return JSON.parse(message ?? "");
  } catch (_e) {
    return message;
  }
}
