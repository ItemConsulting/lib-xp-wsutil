import type { SocketEvent, WebSocketEventType, WebSocketServiceOptions } from "/lib/wsutil";

let loads = 0;

/**
 * Loads a fresh /lib/wsutil and fresh stubs of the Enonic XP libraries, so the calls recorded by the stubs
 * do not leak between tests. See loader.mjs for how the query does that.
 */
export async function load() {
  const fresh = `?fresh=${++loads}`;

  return {
    ws: (await import(`/lib/wsutil${fresh}`)) as typeof import("/lib/wsutil"),
    websocket: (await import(`/lib/xp/websocket${fresh}`)) as typeof import("/lib/xp/websocket"),
  };
}

/**
 * A fresh library and a websocket service created with it
 */
export async function loadService(options?: WebSocketServiceOptions) {
  const loaded = await load();
  return { ...loaded, service: loaded.ws.createWebSocketService(options) };
}

/**
 * A websocket event as Enonic XP sends it to the `webSocketEvent` handler
 */
export function socketEvent(type: WebSocketEventType, sessionId: string, message?: string): SocketEvent {
  return {
    type,
    message,
    data: {},
    session: {
      id: sessionId,
      params: {},
      path: "/_/service/com.example.app/websocket",
    },
  } as unknown as SocketEvent;
}

/**
 * The arguments of every call of a node:test mock function, in order
 */
export function calls(fn: { mock: { calls: readonly { arguments: unknown[] }[] } }): unknown[][] {
  return fn.mock.calls.map((call) => call.arguments);
}
