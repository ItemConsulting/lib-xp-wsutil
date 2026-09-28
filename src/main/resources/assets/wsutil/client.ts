// The WebSocketClient class: the connection the <xp-websocket> element (xp-websocket.ts) is built on. Bundled into
// assets/wsutil/xp-websocket.js, see tsdown.config.mts. It can only import types from the server side: a runtime
// import would not resolve in the browser.

import { EVENT_TYPES, parseMessage, stringify } from "../../lib/wsutil/shared";
import type {
  EmitterMessage,
  IoInterface,
  RpcCall,
  RpcClient,
  RpcMethods,
  RpcResponse,
  WebSocketEventType,
} from "../../lib/wsutil/types";

export type { IoInterface, RpcClient, RpcContext, RpcMethods, WebSocketEventType } from "../../lib/wsutil/types";

// biome-ignore lint/suspicious/noExplicitAny: the argument depends on the event, see WebSocketClient.setEventHandler
export type ClientEventHandler = (event: any) => void;

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

function isRpcResponse(message: unknown): message is RpcResponse {
  const rpc = (message as RpcResponse | null)?.rpc;

  return typeof rpc === "object" && rpc !== null && typeof rpc.id === "number" && !("method" in rpc);
}

interface PendingCall {
  resolve(value: unknown): void;
  reject(reason: Error): void;
}

/**
 * A connection to a websocket service created with /lib/wsutil. The `<xp-websocket>` element is built on it, and
 * is the usual way to use it in a page; the class is for scripts that want a connection without an element.
 *
 * @see [Client API](https://github.com/ItemConsulting/lib-xp-wsutil/blob/main/docs/client.md)
 */
export class WebSocketClient {
  private url: string | undefined;
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

  // Io's handlers of the events emitted by the server, by event name. Set when Io() is first used.
  // biome-ignore lint/suspicious/noExplicitAny: the message is whatever the server emitted
  private ioHandlers: Record<string, (message: any) => void> | undefined;

  // The rpc calls waiting for their response, by call id
  private readonly pendingCalls = new Map<number, PendingCall>();
  private lastCallId = 0;

  // What to send once the connection is open, for messages sent while it is being opened
  private whenOpen: (() => void)[] = [];

  /**
   * @param url The `ws://` or `wss://` url of the websocket service, as returned by
   *   `serviceUrl({ service, type: "websocket" })` on the server. Given, the connection is opened right away.
   */
  constructor(url?: string) {
    this.url = url;
    if (url) this.connect();
  }

  /**
   * `true` while the connection is open
   */
  get isConnected(): boolean {
    return this.connected;
  }

  /**
   * Sets the url of the websocket service
   *
   * @param autoConnect Connect right away
   */
  setUrl(url: string, autoConnect?: boolean): void {
    this.url = url;
    if (autoConnect) this.connect();
  }

  /**
   * Opens the connection. An open connection is closed first, and its events are ignored.
   *
   * @throws If no url has been given
   */
  connect(): void {
    if (!this.url) {
      throw new Error("No url to connect to: give it to the constructor or setUrl()");
    }

    const replaced = this.ws;
    this.connected = false;
    this.rejectPendingCalls("The connection was replaced");

    const ws = new WebSocket(this.url);
    this.ws = ws;
    // Closed after it is replaced, so that its close event is ignored like its other events
    replaced?.close();

    // The events of a connection that has been replaced by a newer one are ignored
    ws.onopen = (event) => {
      if (this.ws !== ws) return;
      this.connected = true;
      this.dispatch("open", event, event);

      const waiting = this.whenOpen;
      this.whenOpen = [];
      for (const callback of waiting) callback();
    };
    ws.onmessage = (event) => {
      if (this.ws !== ws) return;
      const message = parseMessage(event.data);

      // The response to an rpc call settles the call, and is not a message to the app
      if (isRpcResponse(message)) {
        this.settleCall(message);
      } else {
        this.dispatch("message", message, event);
        this.dispatchIoEvent(message);
      }
    };
    ws.onerror = (event) => {
      if (this.ws !== ws) return;
      this.dispatch("error", event, event);
    };
    ws.onclose = (event) => {
      if (this.ws !== ws) return;
      this.ws = undefined;
      this.connected = false;
      this.rejectPendingCalls("The connection was closed");
      this.dispatch("close", event, event);
    };
  }

  /**
   * Closes the connection. The `close` event is dispatched when it has closed.
   */
  close(): void {
    this.ws?.close();
  }

  /**
   * Sends a message to the server. Objects are serialized to JSON. A message sent while the connection is being
   * opened is sent once it is open.
   *
   * @throws If there is no connection: before `connect()`, or after the connection closed
   */
  send(message: unknown): void {
    if (!this.ws) {
      throw new Error("Not connected: call connect() before send()");
    }
    const data = stringify(message);

    if (this.connected) {
      this.ws.send(data);
    } else {
      // A WebSocket that is still connecting throws on send()
      this.whenOpen.push(() => this.ws?.send(data));
    }
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

  /**
   * The methods registered with `socket.rpc()` on the server, as async functions. Calling one sends the arguments
   * to the server, and the promise settles with what the method returns or throws there. Opens the connection if
   * it isn't open, and calls made while it opens are sent once it is.
   *
   * The type parameter is the type of the methods on the server: `rpc<typeof api>()`.
   */
  rpc<Api extends RpcMethods>(): RpcClient<Api> {
    return new Proxy({} as RpcClient<Api>, {
      get: (_target, method) =>
        typeof method === "string" ? (...args: unknown[]) => this.call(method, args) : undefined,
    });
  }

  private call(method: string, args: unknown[]): Promise<unknown> {
    if (!this.ws) {
      if (!this.url) {
        return Promise.reject(new Error("Not connected: give the client a url before calling rpc methods"));
      }
      this.connect();
    }

    return new Promise((resolve, reject) => {
      const id = ++this.lastCallId;
      this.pendingCalls.set(id, { resolve, reject });
      this.send({ rpc: { id, method, args } } satisfies RpcCall);
    });
  }

  private settleCall(response: RpcResponse): void {
    const { id, result, error } = response.rpc;
    const call = this.pendingCalls.get(id);
    if (!call) return;

    this.pendingCalls.delete(id);
    if (error === undefined) {
      call.resolve(result);
    } else {
      call.reject(new Error(error));
    }
  }

  private rejectPendingCalls(reason: string): void {
    const calls = Array.from(this.pendingCalls.values());
    this.pendingCalls.clear();
    this.whenOpen = [];
    for (const call of calls) call.reject(new Error(reason));
  }

  private dispatch(type: WebSocketEventType, handlerArg: unknown, event: Event): void {
    (this.handlers[type] ?? this.defaultHandler)(handlerArg);
    for (const handler of this.additionalHandlers[type]) {
      handler(event);
    }
  }

  /**
   * Calls Io's handler of an event emitted by the server, if the message is an emitter message
   */
  private dispatchIoEvent(message: unknown): void {
    if (!this.ioHandlers || typeof message !== "object" || message === null) return;

    const { event: name, object } = message as EmitterMessage;
    if (typeof name === "string" && Object.hasOwn(this.ioHandlers, name)) {
      this.ioHandlers[name](object);
    }
  }

  private createIo(): IoInterface {
    const ioHandlers: NonNullable<typeof this.ioHandlers> = {};
    this.ioHandlers = ioHandlers;

    if (!this.ws && this.url) this.connect();

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
