// The types of /lib/wsutil. The first ones are shared with the client side library (assets/wsutil/).
// Type-only: this file is not built into the jar (see tsdown.config.mts), so it must not contain runtime code.

import type { Request, Response, WebSocketEvent, WebSocketEventType, WebSocketResponse } from "@enonic-types/core";

export type { WebSocketEventType } from "@enonic-types/core";

/**
 * The message sent over the web socket by `SocketEmitter` on the server and by `Io()` on the client
 */
export interface EmitterMessage {
  /**
   * The name of the emitted event
   */
  event: string;

  /**
   * The content of the event
   */
  object?: unknown;
}

/**
 * Takes an event and a message object and sends it to the other side of the connection
 */
export type EmitInterface = (event: string, message?: unknown) => void;

/**
 * Binds a handler to an event emitted by the other side of the connection. The type parameter is the type of
 * the payload of the event, which the handler receives.
 */
export type OnInterface = <T = unknown>(event: string, handler: (message: T) => void) => void;

/**
 * The interface for the emitted events communications, on the client
 */
export interface IoInterface {
  /**
   * Listens for provided server side emitted events
   *
   * @throws If the handler is not a function
   */
  on: OnInterface;

  /**
   * Emits an event to the server with provided message
   */
  emit: EmitInterface;
}

// ─── Rpc: methods on the server that the client calls ───────────────────────────────────────────

/**
 * The message the client sends to call an rpc method
 */
export interface RpcCall {
  rpc: {
    /**
     * Identifies the call, so the response can be matched to it
     */
    id: number;
    method: string;
    args: unknown[];
  };
}

/**
 * The message the server answers an rpc call with: the return value of the method, or the error it threw
 */
export interface RpcResponse {
  rpc: { id: number; result?: unknown; error?: string };
}

/**
 * What an rpc method sees as `this`: the websocket event of the call, and its session
 */
export interface RpcContext {
  /**
   * The session of the calling client. `session.id` works with `send()`, the group functions and `emitTo()`
   */
  session: SocketEvent["session"];
  event: SocketEvent;
}

/**
 * The methods `socket.rpc()` takes. They run on the server, with the context of the call as `this`.
 */
// biome-ignore lint/suspicious/noExplicitAny: the arguments are whatever the method declares
export type RpcMethods = Record<string, (this: RpcContext, ...args: any[]) => unknown>;

/**
 * The client side proxy of the rpc methods of a service: every method returns a promise of what the method
 * returns on the server
 */
export type RpcClient<Api extends RpcMethods> = {
  [K in keyof Api]: (...args: Parameters<Api[K]>) => Promise<Awaited<ReturnType<Api[K]>>>;
};

// ─── Server side only ───────────────────────────────────────────────────────────────────────────

export type SocketEvent = WebSocketEvent<Record<string, string>>;

/**
 * The handlers of the socket events. The "message" handler receives the message, JSON-parsed (or the raw string,
 * if it is not JSON), and the event. The other handlers receive the event.
 */
export interface EventHandlers {
  open: (event: SocketEvent) => void;
  close: (event: SocketEvent) => void;
  error: (event: SocketEvent) => void;
  message: (message: unknown, event: SocketEvent) => void;
}

/**
 * The exports object of a service controller that is assigned to handle websocket events
 */
export interface WebSocketExports {
  get?: (req: Request) => Response;
  webSocketEvent?: (event: SocketEvent) => void;
}

/**
 * The options of `createWebSocketService()`
 */
export interface WebSocketServiceOptions {
  /**
   * The response a websocket request is answered with. Defaults to `{}`.
   */
  webSocketResponse?: WebSocketResponse;
}

/**
 * A websocket service: the handlers to export from the service controller, and the functions to work with
 * the connections of that service. Created by `createWebSocketService()`.
 */
export interface WebSocketService {
  /**
   * The `get` handler of the service controller: accepts a websocket connection. A request that is not a
   * websocket request is answered with status 400.
   */
  get(req: Request): Response;

  /**
   * The `webSocketEvent` handler of the service controller: answers rpc calls, and passes every other event to
   * the main handler of the event, and then the additional handlers
   */
  webSocketEvent(event: SocketEvent): void;

  /**
   * Sets `get` and `webSocketEvent` on the exports object of the service controller
   *
   * @param exp The `exports` object of the service controller
   */
  openWebsockets(exp: WebSocketExports): void;

  /**
   * Sets the main handler of a socket event
   */
  setEventHandler<K extends WebSocketEventType>(event: K, handler: EventHandlers[K]): void;

  /**
   * Sets the main handlers of several socket events. The handlers of the events left out are kept.
   */
  setEventHandlers(handlers: Partial<EventHandlers>): void;

  /**
   * Adds an additional handler to a socket event. Additional handlers are called after the main handler, with the
   * same arguments, and there can be any number of them.
   */
  addHandler<K extends WebSocketEventType>(event: K, handler: EventHandlers[K]): void;

  /**
   * Sends a message to a client. Objects are serialized to JSON.
   *
   * @param id The session id of the client
   */
  send(id: string, message: unknown): void;

  /**
   * Sends a message to every client in a group. Objects are serialized to JSON.
   */
  sendToGroup(group: string, message: unknown): void;

  /**
   * Creates a group. Does nothing if the group exists.
   *
   * @param autoRemove Remove users from the group when they close their connection
   */
  createGroup(group: string, autoRemove?: boolean): void;

  /**
   * Adds a user to a group. The group is created if it doesn't exist.
   *
   * @param id The session id of the user
   * @param autoRemove Remove users from the group when they close their connection. Only used if the group is created
   */
  addUserToGroup(group: string, id: string, autoRemove?: boolean): void;

  /**
   * Removes a user from a group. The group is removed when its last user is removed.
   */
  removeUserFromGroup(group: string, id: string): void;

  /**
   * The session ids of the users of a group, or undefined if there is no such group
   */
  getGroupUsers(group: string): string[] | undefined;

  /**
   * Registers methods the client calls with `rpc()`. They run on the server with the context of the call as
   * `this`, and what they return (or throw) is sent back to the caller. Rpc calls are not passed to the `message`
   * handlers.
   *
   * Returns the methods as given, so their type can be exported for the client:
   * `export const api = socket.rpc({ ... })` on the server, and `import type { api }` in the client code.
   */
  rpc<Api extends RpcMethods>(methods: Api): Api;

  /**
   * The `SocketEmitter` of this service, for named events to and from the clients
   */
  emitter(): SocketEmitter;
}

/**
 * Sends and receives named events with a payload, together with `Io()` on the client
 */
export interface SocketEmitter {
  /**
   * Sets the callback that is called with the socket of every client that connects
   */
  connect(callback: ConnectionCallback): void;

  /**
   * Emits an event to every connected client
   *
   * @param options `except`: the session id of a client to leave out, typically the sender
   */
  broadcast(event: string, object?: unknown, options?: { except?: string }): void;

  /**
   * Emits an event to one client
   *
   * @param id The session id of the client
   */
  emitTo(id: string, event: string, object?: unknown): void;
}

/**
 * A connected client, as seen by the SocketEmitter
 */
export interface EmitterUser {
  /**
   * The session id of the client
   */
  id: string;

  /**
   * Binds a handler to an event emitted by this client
   */
  on: OnInterface;

  /**
   * Emits an event to this client
   */
  emit: EmitInterface;

  /**
   * Sets the callback that is called when this client closes the connection
   */
  onDisconnect(callback: () => void): void;
}

/**
 * Callback function for connected users, this is being called with the connected user interface
 */
export type ConnectionCallback = (socket: EmitterUser) => void;
