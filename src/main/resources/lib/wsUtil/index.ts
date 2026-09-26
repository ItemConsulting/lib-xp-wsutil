import { serviceUrl } from "/lib/xp/portal";
import { send, sendToGroup } from "/lib/xp/websocket";
import { createClientScript } from "./client";
import { createSocketEmitter } from "./emitter";
import { createEvents } from "./events";
import { createGroups } from "./groups";
import type { SocketEmitter, WebSocketService, WebSocketServiceOptions } from "./types";
import { stringify } from "./util";

export type * from "./types";

/**
 * Creates a websocket service. Export its `get` and `webSocketEvent` from the service controller that serves
 * the web sockets, and use the rest to work with the connections of that service. Every service created has
 * its own handlers, groups, emitter and client expansions.
 *
 * @example
 * // services/websocket/websocket.ts
 * import { createWebSocketService } from "/lib/wsUtil";
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
  const client = createClientScript();
  const webSocketResponse = options.webSocketResponse ?? {};
  let emitter: SocketEmitter | undefined;

  // serviceUrl() needs a request, so the host is resolved when the client library is served
  const host = () => options.host ?? serviceUrl({ service: options.service ?? "websocket" });

  const service: WebSocketService = {
    get: (req) => (req.webSocket ? { webSocket: webSocketResponse } : client.response(host())),
    webSocketEvent: events.handle,

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

    expandClient: client.expandClient,

    emitter: () => {
      const created = emitter ?? createSocketEmitter(events);
      emitter = created;
      return created;
    },
  };

  return service;
}
