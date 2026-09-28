import { send } from "/lib/xp/websocket";
import { hasOwn } from "./shared";
import type { RpcCall, RpcMethods, RpcResponse, SocketEvent } from "./types";

/**
 * The rpc methods of one websocket service
 */
export interface Rpc {
  /**
   * Registers methods. Returns them as given, for `typeof`.
   */
  register<Api extends RpcMethods>(methods: Api): Api;

  /**
   * Answers the message if it is an rpc call. Returns whether it was one.
   */
  handle(message: unknown, event: SocketEvent): boolean;
}

function isRpcCall(message: unknown): message is RpcCall {
  const rpc = (message as RpcCall | null)?.rpc;

  return typeof rpc === "object" && rpc !== null && typeof rpc.method === "string" && Array.isArray(rpc.args);
}

export function createRpc(): Rpc {
  const methods: RpcMethods = {};

  return {
    register(api) {
      for (const name in api) {
        if (hasOwn(api, name)) {
          methods[name] = api[name];
        }
      }

      return api;
    },

    handle(message, event) {
      if (!isRpcCall(message)) {
        return false;
      }

      const { id, method, args } = message.rpc;
      const respond = (response: RpcResponse) => send(event.session.id, JSON.stringify(response));

      if (!hasOwn(methods, method)) {
        respond({ rpc: { id, error: `Unknown rpc method "${method}"` } });
        return true;
      }

      try {
        // Serialized inside the try, so a result that cannot be serialized is answered with an error as well
        respond({ rpc: { id, result: methods[method].apply({ session: event.session, event }, args) } });
      } catch (e) {
        log.error(`SOCKET-LIB: The rpc method "${method}" failed for ${event.session.id}: ${e}`);
        respond({ rpc: { id, error: e instanceof Error ? e.message : String(e) } });
      }

      return true;
    },
  };
}
