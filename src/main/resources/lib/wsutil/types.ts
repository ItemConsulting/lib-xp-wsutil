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

// ─── Named events: SocketEmitter on the server, Io() on the client ─────────────────────────────

/**
 * An event map: the names of the events one side emits, and the type of the payload of each. Declare one for each
 * direction in the service controller, and the events are typed on both sides:
 *
 * @example
 * // services/chat/chat.ts
 * export type ClientEvents = { join: string; message: string };
 * export type ServerEvents = { joined: { users: string[] }; message: { from: string; text: string } };
 *
 * const socket = createWebSocketService<ClientEvents, ServerEvents>();
 *
 * The constraint is `object`, so both `type` aliases and `interface`s work. Without event maps, any event with
 * any payload can be emitted and handled, see `AnyEvents`.
 */
export type EventMap = object;

/**
 * The event map used when none is given: any event name, and the payload is `any`
 */
// biome-ignore lint/suspicious/noExplicitAny: without an event map, a payload is whatever the other side sent
export type AnyEvents = Record<string, any>;

/**
 * The names of the events of an event map
 */
export type EventName<Events extends EventMap> = keyof Events & string;

/**
 * The payload of an event of an event map
 */
export type EventPayload<Events extends EventMap, K extends EventName<Events>> = Events[K];

/**
 * The interface for the emitted events communications, on the client. The type parameters are the event maps of
 * the two directions, in the same order as on the server: the events the client emits, and the events the server
 * emits.
 */
export interface IoInterface<ClientEvents extends EventMap = AnyEvents, ServerEvents extends EventMap = AnyEvents> {
  /**
   * Binds a handler to an event emitted by the server. The handler receives the payload of the event.
   *
   * @throws If the handler is not a function
   */
  on<K extends EventName<ServerEvents>>(event: K, handler: (message: EventPayload<ServerEvents, K>) => void): void;

  /**
   * Emits an event to the server, with a payload
   */
  emit<K extends EventName<ClientEvents>>(event: K, message?: EventPayload<ClientEvents, K>): void;
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
  GET?: (req: Request) => Response;
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
 *
 * The type parameters are the event maps of the `SocketEmitter`: the events the clients emit, and the events the
 * server emits. See `EventMap`.
 */
export interface WebSocketService<
  ClientEvents extends EventMap = AnyEvents,
  ServerEvents extends EventMap = AnyEvents,
> {
  /**
   * The `GET` handler of the service controller: accepts a websocket connection. A request that is not a
   * websocket request is answered with status 400.
   */
  GET(req: Request): Response;

  /**
   * The same handler as `GET`, under the lowercase name XP also accepts
   */
  get(req: Request): Response;

  /**
   * The `webSocketEvent` handler of the service controller: answers rpc calls, and passes every other event to
   * the main handler of the event, and then the additional handlers
   */
  webSocketEvent(event: SocketEvent): void;

  /**
   * Sets `GET`, `get` and `webSocketEvent` on the exports object of the service controller
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
  emitter(): SocketEmitter<ClientEvents, ServerEvents>;
}

/**
 * The options of `SocketEmitter.broadcast()`
 */
export interface BroadcastOptions {
  /**
   * The session id of a client to leave out, typically the sender
   */
  except?: string;
}

/**
 * Sends and receives named events with a payload, together with `Io()` on the client. The type parameters are
 * the event maps of the two directions: the events the clients emit, and the events the server emits.
 */
export interface SocketEmitter<ClientEvents extends EventMap = AnyEvents, ServerEvents extends EventMap = AnyEvents> {
  /**
   * Sets the callback that is called with every client that connects
   */
  connect(callback: ConnectionCallback<ClientEvents, ServerEvents>): void;

  /**
   * Emits an event to every connected client
   */
  broadcast<K extends EventName<ServerEvents>>(
    event: K,
    message?: EventPayload<ServerEvents, K>,
    options?: BroadcastOptions,
  ): void;

  /**
   * Emits an event to one client
   *
   * @param id The session id of the client
   */
  emitTo<K extends EventName<ServerEvents>>(id: string, event: K, message?: EventPayload<ServerEvents, K>): void;
}

/**
 * A connected client, as seen by the SocketEmitter
 */
export interface EmitterUser<ClientEvents extends EventMap = AnyEvents, ServerEvents extends EventMap = AnyEvents> {
  /**
   * The session id of the client
   */
  id: string;

  /**
   * Binds a handler to an event emitted by this client. The handler receives the payload of the event.
   */
  on<K extends EventName<ClientEvents>>(event: K, handler: (message: EventPayload<ClientEvents, K>) => void): void;

  /**
   * Emits an event to this client
   */
  emit<K extends EventName<ServerEvents>>(event: K, message?: EventPayload<ServerEvents, K>): void;

  /**
   * Sets the callback that is called when this client closes the connection
   */
  onDisconnect(callback: () => void): void;
}

/**
 * The callback of `SocketEmitter.connect()`: called with every client that connects
 */
export type ConnectionCallback<ClientEvents extends EventMap = AnyEvents, ServerEvents extends EventMap = AnyEvents> = (
  client: EmitterUser<ClientEvents, ServerEvents>,
) => void;
