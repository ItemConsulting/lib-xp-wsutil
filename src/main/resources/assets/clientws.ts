// This is built into a JavaScript module that is served by the `get` handler of a websocket service created
// with /lib/wsUtil, which replaces the "&HOST&" and "&CLIENTEXPANSIONS&" placeholders before sending it. It
// is loaded from a service URL, so it can only import types: a runtime import would not resolve in the browser.

import type {
  ClientEventHandler,
  EmitterMessage,
  IoInterface,
  WebSocketClientApi,
  WebSocketEventType,
} from "../lib/wsUtil/types";

export type { ClientEventHandler, IoInterface } from "../lib/wsUtil/types";

/**
 * @deprecated Use `ClientEventHandler`
 */
export type ClientWSEventHandler = ClientEventHandler;

const EVENT_TYPES: readonly WebSocketEventType[] = ["open", "close", "error", "message"];

function assertEventType(event: string): asserts event is WebSocketEventType {
  if (EVENT_TYPES.indexOf(event as WebSocketEventType) === -1) {
    throw new TypeError(`Unknown event "${event}", must be one of: ${EVENT_TYPES.join(", ")}`);
  }
}

function assertHandler(handler: unknown, what: string): asserts handler is ClientEventHandler {
  if (typeof handler !== "function") {
    throw new TypeError(`${what} must be a function, got ${typeof handler}`);
  }
}

/**
 * The default handler of the events: errors with console.error, everything else at debug level
 */
function logEvent(event: unknown): void {
  if (event instanceof Event && event.type === "error") {
    console.error(event);
  } else {
    console.debug(event);
  }
}

/**
 * The client of a websocket service created with /lib/wsUtil. Connects to the service it was served from,
 * with `wss://` on a page served over https, and `ws://` otherwise.
 *
 * @see [Client API](https://github.com/ItemConsulting/lib-xp-wsutil/blob/main/docs/client.md)
 */
export class WebSocketClient implements WebSocketClientApi {
  private host: string;
  private ws: WebSocket | undefined;
  private connected = false;
  private defaultHandler: ClientEventHandler = logEvent;
  private readonly handlers: Partial<Record<WebSocketEventType, ClientEventHandler>> = {};
  private readonly additionalHandlers: Record<WebSocketEventType, ClientEventHandler[]> = {
    open: [],
    close: [],
    message: [],
    error: [],
  };
  private io: IoInterface | undefined;

  /**
   * Functions added on the server with `expandClient()`
   */
  // biome-ignore lint/suspicious/noExplicitAny: expansions are added on the server, and are unknown here
  [expansion: string]: any;

  /**
   * @param host The url of the web socket. Given, the connection is opened right away. Not given, the client
   *   connects to the service it was served from, when `connect()` is called.
   */
  constructor(host?: string) {
    const protocol = location.protocol === "https:" ? "wss://" : "ws://";
    this.host = host ?? `${protocol}${location.host}&HOST&`;

    // Replaced by the server with an object literal holding the client expansions
    const expansions: unknown = "&CLIENTEXPANSIONS&";
    if (typeof expansions === "object" && expansions !== null) {
      Object.assign(this, expansions);
    }

    if (host) this.connect();
  }

  /**
   * `true` while the connection is open
   */
  get isConnected(): boolean {
    return this.connected;
  }

  /**
   * Sets the url of the web socket
   *
   * @param host The url to connect to
   * @param autoConnect Connect right away
   */
  setHost(host: string, autoConnect?: boolean): void {
    this.host = host;
    if (autoConnect) this.connect();
  }

  /**
   * Opens the connection. An open connection is closed first.
   */
  connect(): void {
    this.ws?.close();

    const ws = new WebSocket(this.host);
    this.ws = ws;

    // The events of a connection that has been replaced by a newer one are ignored
    ws.onopen = (event) => {
      if (this.ws !== ws) return;
      this.connected = true;
      this.dispatch("open", event, event);
    };
    ws.onmessage = (event) => {
      if (this.ws !== ws) return;
      let message: unknown;
      try {
        message = JSON.parse(event.data);
      } catch (_e) {
        message = event.data;
      }
      this.dispatch("message", message, event);
    };
    ws.onerror = (event) => {
      if (this.ws !== ws) return;
      this.dispatch("error", event, event);
    };
    ws.onclose = (event) => {
      if (this.ws !== ws) return;
      this.connected = false;
      this.dispatch("close", event, event);
    };
  }

  /**
   * Sends a message to the server. Objects are serialized to JSON.
   *
   * @throws If the connection has not been opened with `connect()`
   */
  send(message: unknown): void {
    if (!this.ws) {
      throw new Error("Not connected: call connect() before send()");
    }
    this.ws.send(typeof message === "object" ? JSON.stringify(message) : String(message));
  }

  /**
   * Sets the main handler of an event. The `message` handler receives the message, JSON-parsed (or the raw
   * string, if it is not JSON). The other handlers receive the event.
   *
   * @throws If the event is unknown, or the handler is not a function
   */
  setEventHandler(event: WebSocketEventType, handler: ClientEventHandler): void {
    assertEventType(event);
    assertHandler(handler, `The handler of "${event}"`);
    this.handlers[event] = handler;
  }

  /**
   * Sets the main handlers of several events. The handlers of the events left out are kept.
   *
   * @throws If an event is unknown, or a handler is not a function
   */
  setEventHandlers(handlers: Partial<Record<WebSocketEventType, ClientEventHandler>>): void {
    if (typeof handlers !== "object" || handlers === null) {
      throw new TypeError(`The handlers must be an object, got ${typeof handlers}`);
    }
    for (const event of Object.keys(handlers)) {
      assertEventType(event);
      const handler = handlers[event];
      if (handler) this.setEventHandler(event, handler);
    }
  }

  /**
   * Sets the handler of the events without a main handler of their own. By default, errors are logged with
   * console.error and everything else at debug level.
   *
   * @throws If the handler is not a function
   */
  setDefaultHandler(handler: ClientEventHandler): void {
    assertHandler(handler, "The default handler");
    this.defaultHandler = handler;
  }

  /**
   * Adds an additional handler to an event. Additional handlers are called after the main handler, and receive
   * the event, also for `message`.
   *
   * @throws If the event is unknown, or the handler is not a function
   */
  addHandler(event: WebSocketEventType, handler: ClientEventHandler): void {
    assertEventType(event);
    assertHandler(handler, `The handler of "${event}"`);
    this.additionalHandlers[event].push(handler);
  }

  /**
   * Named events to and from the server's `SocketEmitter`. Opens the connection if it isn't open. The same
   * instance is returned every time.
   */
  Io(): IoInterface {
    const io = this.io ?? this.createIo();
    this.io = io;
    return io;
  }

  private dispatch(type: WebSocketEventType, handlerArg: unknown, event: Event): void {
    (this.handlers[type] ?? this.defaultHandler)(handlerArg);
    for (const handler of this.additionalHandlers[type]) {
      handler(event);
    }
  }

  private createIo(): IoInterface {
    // biome-ignore lint/suspicious/noExplicitAny: the message is whatever the server emitted
    const ioHandlers: Record<string, (message: any) => void> = {};

    if (!this.connected) this.connect();

    this.addHandler("message", (event: MessageEvent) => {
      let message: unknown;
      try {
        message = JSON.parse(event.data);
      } catch (_e) {
        return; // Not an emitter message
      }
      const { event: name, object } = message as EmitterMessage;
      if (typeof name === "string" && Object.hasOwn(ioHandlers, name)) {
        ioHandlers[name](object);
      }
    });

    return {
      on: (event, handler) => {
        assertHandler(handler, `The handler of "${event}"`);
        ioHandlers[event] = handler;
      },
      emit: (event, message) => {
        this.send({ event, object: message } satisfies EmitterMessage);
      },
    };
  }
}

/**
 * The type of the client, for typing client expansions (`function (this: ClientWS) { ... }`)
 */
export type ClientWS = WebSocketClient;

export { WebSocketClient as ExpWS };
