import { send } from "/lib/xp/websocket";
import type { Events } from "./events";
import type { ConnectionCallback, EmitterMessage, EmitterUser, SocketEmitter } from "./types";
import { hasOwn } from "./util";

function isEmitterMessage(message: unknown): message is EmitterMessage {
  return typeof message === "object" && message !== null && typeof (message as EmitterMessage).event === "string";
}

/**
 * The SocketEmitter of one websocket service: named events to and from the clients of that service, together
 * with `Io()` on the client.
 */
export function createSocketEmitter(events: Events): SocketEmitter {
  // The connected users, by session id
  const users: Record<string, EmitterUser> = {};

  // The handlers of the events emitted by each user, by session id and event name
  // biome-ignore lint/suspicious/noExplicitAny: the message is whatever the client emitted
  const handlers: Record<string, Record<string, (message?: any) => void>> = {};

  // The disconnect callbacks, by session id
  const disconnectHandlers: Record<string, () => void> = {};

  // The callback to call when a user connects
  let onConnect: ConnectionCallback | undefined;

  const emitter: SocketEmitter = {
    connect(callback) {
      onConnect = callback;
    },

    emitTo(id, event, object) {
      send(id, JSON.stringify({ event, object } satisfies EmitterMessage));
    },

    broadcast(event, object, options) {
      const msg = JSON.stringify({ event, object } satisfies EmitterMessage);

      for (const id in users) {
        if (hasOwn(users, id) && id !== options?.except) {
          send(id, msg);
        }
      }
    },
  };

  // When a new user connects, create a new user object with on and emit functionalities,
  // store it, and call the connect callback
  events.addHandler("open", (event) => {
    const id = event.session.id;
    handlers[id] = handlers[id] ?? {};

    const user: EmitterUser = {
      id,
      on: (name, handler) => {
        handlers[id][name] = handler;
      },
      emit: (name, object) => emitter.emitTo(id, name, object),
      onDisconnect: (callback) => {
        disconnectHandlers[id] = callback;
      },
    };

    users[id] = user;
    onConnect?.(user);
  });

  // When a user closes the connection, call its disconnect callback, and forget the user and its handlers
  events.addHandler("close", (event) => {
    const id = event.session.id;
    disconnectHandlers[id]?.();
    delete users[id];
    delete handlers[id];
    delete disconnectHandlers[id];
  });

  // When a message arrives, call the user's handler for the event. A message that is not an
  // emitter message was not sent by the client library's Io(), and is logged.
  events.addHandler("message", (message, event) => {
    if (!isEmitterMessage(message)) {
      log.debug("SOCKET-LIB: Wrong JSON format for client emit object");
      log.debug(JSON.stringify(event));
      return;
    }

    const handler = handlers[event.session.id]?.[message.event];

    if (handler) {
      try {
        handler(message.object);
      } catch (e) {
        log.error(`SOCKET-LIB: The handler of event "${message.event}" failed for ${event.session.id}: ${e}`);
      }
    } else {
      log.debug(`SOCKET-LIB: Unhandled event: ${message.event}`);
      log.debug(JSON.stringify(event));
    }
  });

  return emitter;
}
