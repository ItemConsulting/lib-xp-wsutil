// /lib/wsutil: server side websocket utility library for Enonic XP.
// The other modules in this folder are bundled into this file, see tsdown.config.mts.

import type { Request, Response } from "@enonic-types/core";
import { send, sendToGroup } from "/lib/xp/websocket";
import { createSocketEmitter } from "./emitter";
import { createEvents } from "./events";
import { createGroups } from "./groups";
import { createRpc } from "./rpc";
import { parseMessage, stringify } from "./shared";
import type { AnyEvents, EventMap, SocketEmitter, WebSocketService, WebSocketServiceOptions } from "./types";

export type * from "./types";

/**
 * The path of the client side library, as an asset of the app: `assetUrl({ path: CLIENT_ASSET_PATH })` with
 * lib-asset gives the URL to load it from.
 */
export const CLIENT_ASSET_PATH = "wsutil/xp-websocket.js";

/**
 * Creates a websocket service. Export its `GET` and `webSocketEvent` from the service controller that serves
 * the web sockets, and use the rest to work with the connections of that service. Every service created has
 * its own handlers, groups, emitter and rpc methods.
 *
 * The type parameters are the event maps of the emitter, see `EventMap`: the events the clients emit, and the
 * events the server emits. Without them, any event with any payload goes.
 *
 * @example
 * // services/websocket/websocket.ts
 * import { createWebSocketService } from "/lib/wsutil";
 *
 * const socket = createWebSocketService();
 * export const { GET, webSocketEvent } = socket;
 *
 * socket.setEventHandler("open", (event) => log.info(`Connected: ${event.session.id}`));
 *
 * @see [Server API](https://github.com/ItemConsulting/lib-xp-wsutil/blob/main/docs/server.md)
 */
export function createWebSocketService<
  ClientEvents extends EventMap = AnyEvents,
  ServerEvents extends EventMap = AnyEvents,
>(options: WebSocketServiceOptions = {}): WebSocketService<ClientEvents, ServerEvents> {
  const events = createEvents();
  const groups = createGroups(events);
  const rpc = createRpc();
  // Created with the service, so that it sees every client that connects, also before emitter() is first called.
  // The emitter sends and receives whatever the app gives it: the event maps are a compile time contract.
  const emitter = createSocketEmitter(events) as SocketEmitter<ClientEvents, ServerEvents>;
  const webSocketResponse = options.webSocketResponse ?? {};

  const get = (req: Request): Response =>
    req.webSocket
      ? { webSocket: webSocketResponse }
      : {
          status: 400,
          contentType: "text/plain",
          body:
            "This service accepts WebSocket connections. The client library is an asset of the app: " +
            `assetUrl({ path: "${CLIENT_ASSET_PATH}" })`,
        };

  const service: WebSocketService<ClientEvents, ServerEvents> = {
    // XP looks for the uppercase handler first, and then the lowercase one. The same function under both names,
    // so a service controller can export whichever matches the rest of the app.
    GET: get,
    get,

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
      exp.GET = service.get;
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
