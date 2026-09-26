// Internal helpers, not exported from /lib/wsUtil

export function hasOwn(object: object, key: PropertyKey): boolean {
  // Object.hasOwn() is ES2022, and not available in Nashorn
  // biome-ignore lint/suspicious/noPrototypeBuiltins: see above
  return Object.prototype.hasOwnProperty.call(object, key);
}

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
