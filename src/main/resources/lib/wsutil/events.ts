import type { WebSocketEventType } from "@enonic-types/core";
import { EVENT_TYPES } from "./shared";
import type { EventHandlers, SocketEvent } from "./types";

type PlainEventType = Exclude<WebSocketEventType, "message">;

/**
 * The event handlers of one websocket service
 */
export interface Events {
  setEventHandler<K extends WebSocketEventType>(event: K, handler: EventHandlers[K]): void;
  setEventHandlers(handlers: Partial<EventHandlers>): void;
  addHandler<K extends WebSocketEventType>(event: K, handler: EventHandlers[K]): void;

  /**
   * Calls the main handler of an `open`, `close` or `error` event, and then the additional handlers
   */
  handleEvent(type: PlainEventType, event: SocketEvent): void;

  /**
   * Calls the main `message` handler, and then the additional ones, with the parsed message. The service parses
   * the message itself, as it answers rpc calls before they get here.
   */
  handleMessage(message: unknown, event: SocketEvent): void;
}

function logEvent(event: SocketEvent): void {
  log.debug(JSON.stringify(event));
}

/**
 * Calls a handler, and logs an error if it throws, so that the other handlers of the event still run: the
 * library's own bookkeeping (the emitter's users, the groups) is done by additional handlers.
 */
function guarded(type: WebSocketEventType, event: SocketEvent, call: () => void): void {
  try {
    call();
  } catch (e) {
    log.error(`SOCKET-LIB: A handler of the "${type}" event failed for ${event.session.id}: ${e}`);
  }
}

export function createEvents(): Events {
  // The main handler of each event. One per event, replaced by setEventHandler()
  const mainHandlers: EventHandlers = {
    open: logEvent,
    close: logEvent,
    error: logEvent,
    message: (_message, event) => logEvent(event),
  };

  // The additional handlers of each event, called after the main handler
  const additionalHandlers: { [K in WebSocketEventType]: EventHandlers[K][] } = {
    open: [],
    close: [],
    error: [],
    message: [],
  };

  const events: Events = {
    setEventHandler(event, handler) {
      mainHandlers[event] = handler;
    },

    setEventHandlers(handlers) {
      for (const event of EVENT_TYPES) {
        const handler = handlers[event];

        if (handler) {
          events.setEventHandler(event, handler);
        }
      }
    },

    addHandler(event, handler) {
      additionalHandlers[event].push(handler);
    },

    handleEvent(type, event) {
      guarded(type, event, () => mainHandlers[type](event));

      for (const handler of additionalHandlers[type]) {
        guarded(type, event, () => handler(event));
      }
    },

    handleMessage(message, event) {
      guarded("message", event, () => mainHandlers.message(message, event));

      for (const handler of additionalHandlers.message) {
        guarded("message", event, () => handler(message, event));
      }
    },
  };

  return events;
}
