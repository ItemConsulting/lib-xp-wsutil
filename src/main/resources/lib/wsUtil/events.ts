import type { WebSocketEventType } from "@enonic-types/core";
import type { EventHandlers, SocketEvent } from "./types";
import { parseMessage } from "./util";

const EVENT_TYPES: readonly WebSocketEventType[] = ["open", "close", "error", "message"];

/**
 * The event handlers of one websocket service
 */
export interface Events {
  setEventHandler<K extends WebSocketEventType>(event: K, handler: EventHandlers[K]): void;
  setEventHandlers(handlers: Partial<EventHandlers>): void;
  addHandler<K extends WebSocketEventType>(event: K, handler: EventHandlers[K]): void;

  /**
   * Calls the main handler of the event, and then the additional handlers
   */
  handle(event: SocketEvent): void;
}

function logEvent(event: SocketEvent): void {
  log.debug(JSON.stringify(event));
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

    handle(event) {
      if (event.type === "message") {
        const message = parseMessage(event.message);
        mainHandlers.message(message, event);

        for (const handler of additionalHandlers.message) {
          handler(message, event);
        }
      } else {
        const type = event.type;
        mainHandlers[type](event);

        for (const handler of additionalHandlers[type]) {
          handler(event);
        }
      }
    },
  };

  return events;
}
