// /lib/wsutil: server side websocket utility library for Enonic XP.
// The other modules in this folder are bundled into this file, see tsdown.config.mts.

import { send, sendToGroup } from "/lib/xp/websocket";
import { createSocketEmitter } from "./emitter";
import { createEvents } from "./events";
import { createGroups } from "./groups";
import { createRpc } from "./rpc";
import { parseMessage, stringify } from "./shared";
import type { WebSocketService, WebSocketServiceOptions } from "./types";

export type * from "./types";

/**
 * Creates a websocket service. Export its `get` and `webSocketEvent` from the service controller that serves
 * the web sockets, and use the rest to work with the connections of that service. Every service created has
 * its own handlers, groups, emitter and rpc methods.
 *
 * @example
 * // services/websocket/websocket.ts
 * import { createWebSocketService } from "/lib/wsutil";
 *
 * const socket = createWebSocketService();
 * export const { get, webSocketEvent } = socket;
 *
 * socket.setEventHandler("open", (event) => log.info(`Connected: ${event.session.id}`));
 *
 * @see [Server API](https://github.com/ItemConsulting/lib-xp-wsutil/blob/main/docs/server.md)
 */
export function createWebSocketService(options: WebSocketServiceOptions = {}): WebSocketService {
  const events = createEvents();
  const groups = createGroups(events);
  const rpc = createRpc();
  // Created with the service, so that it sees every client that connects, also before emitter() is first called
  const emitter = createSocketEmitter(events);
  const webSocketResponse = options.webSocketResponse ?? {};

  const service: WebSocketService = {
    get: (req) =>
      req.webSocket
        ? { webSocket: webSocketResponse }
        : {
            status: 400,
            contentType: "text/plain",
            body:
              "This service accepts WebSocket connections. The client library is an asset of the app: " +
              'assetUrl({ path: "wsutil/xp-websocket.js" })',
          },

    webSocketEvent(event) {
      if (event.type === "message") {
        const message = parseMessage(event.message);

        // An rpc call is answered by its method, and is not a message to the app
        if (!rpc.handle(message, event)) {
          events.handleMessage(message, event);
        }
      } else {
        events.handleEvent(event.type, event);
      }
    },

    openWebsockets(exp) {
      exp.get = service.get;
      exp.webSocketEvent = service.webSocketEvent;
    },

    setEventHandler: events.setEventHandler,
    setEventHandlers: events.setEventHandlers,
    addHandler: events.addHandler,

    send: (id, message) => send(id, stringify(message)),
    sendToGroup: (group, message) => sendToGroup(group, stringify(message)),

    createGroup: groups.createGroup,
    addUserToGroup: groups.addUserToGroup,
    removeUserFromGroup: groups.removeUserFromGroup,
    getGroupUsers: groups.getGroupUsers,

    rpc: rpc.register,

    emitter: () => emitter,
  };

  return service;
}
