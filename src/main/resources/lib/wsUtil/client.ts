// Serves the client side library (assets/clientws.ts), and the expansions of it

import type { Response } from "@enonic-types/core";
import { getResource, readText } from "/lib/xp/io";
import type { ClientExpansion, ClientExpansionFunction, WebSocketClientApi, WebSocketService } from "./types";
import { hasOwn } from "./util";

export interface ClientScript {
  expandClient: WebSocketService["expandClient"];

  /**
   * The response that serves the client side library, set up to connect to `host`
   */
  response(host: string): Response;
}

/**
 * The client side library of one websocket service, with the expansions added to it
 */
/**
 * The source code of an expansion function, as the value of a property in an object literal. A `function`
 * expression is used as it is, and a method (`{ hello() { ... } }`) becomes one. An arrow function has no `this`
 * of its own, and would not get the client as `this` in the browser, so it is rejected.
 */
function serializeFunction(name: string, func: ClientExpansionFunction): string {
  const source = func.toString();

  if (/^(async\s+)?function\b/.test(source)) {
    return source;
  }
  if (/^class\b/.test(source) || /^(async\s*)?(\([^)]*\)|[\w$]+)\s*=>/.test(source)) {
    throw new TypeError(
      `The client expansion "${name}" must be a function expression or a method, not an arrow function or a class, ` +
        "so it gets the client as `this` in the browser",
    );
  }
  // A method: `hello(a) { ... }` or `async hello(a) { ... }`
  return source.replace(/^(async\s+)?[\w$]+\s*\(/, "$1function (");
}

export function createClientScript(): ClientScript {
  // The serialized expansions, by name
  const expansions: Record<string, string> = {};

  function add(name: string, value: ClientExpansion): void {
    // `object` in ClientExpansion includes functions, hence the cast
    expansions[name] =
      typeof value === "function" ? serializeFunction(name, value as ClientExpansionFunction) : JSON.stringify(value);
  }

  /**
   * The client expansions as the source code of an object literal
   */
  function serializeExpansions(): string {
    const properties = Object.keys(expansions).map((name) => `${JSON.stringify(name)}: ${expansions[name]}`);

    return `{${properties.join(", ")}}`;
  }

  return {
    expandClient(
      name: string | (Record<string, ClientExpansion> & ThisType<WebSocketClientApi>),
      func?: ClientExpansion,
    ): void {
      if (typeof name === "string") {
        add(name, func ?? null);
      } else {
        for (const n in name) {
          if (hasOwn(name, n)) {
            add(n, name[n]);
          }
        }
      }
    },

    response(host) {
      // The path is relative to the built lib/wsUtil/index.js, which this module is bundled into
      const file = readText(getResource(resolve("../../assets/clientws.js")).getStream())
        .replace("&HOST&", () => host)
        .replace(/(["'])&CLIENTEXPANSIONS&\1/, () => serializeExpansions());

      return {
        body: file,
        contentType: "application/javascript",
      };
    },
  };
}
