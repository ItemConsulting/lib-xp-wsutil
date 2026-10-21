import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { EmitterUser, IoInterface } from "/lib/wsutil";
import { calls, load, socketEvent } from "./helpers.mts";

// The event maps, as a service controller would declare and export them
type ClientEvents = { join: string; ping: undefined };
type ServerEvents = { joined: { users: string[] } };

/**
 * What the event maps rule out. Type checked by `check:types:tests`, never called: the calls would go over the
 * wire like any other.
 */
function rejectedAtCompileTime(
  client: EmitterUser<ClientEvents, ServerEvents>,
  io: IoInterface<ClientEvents, ServerEvents>,
) {
  // @ts-expect-error "joined" is an event the server emits, not one it receives
  client.on("joined", () => undefined);
  // @ts-expect-error the payload of "join" is a string
  client.on("join", (name: number) => name);
  // @ts-expect-error "join" is an event the client emits, not one it receives
  client.emit("join", "Tom");
  // @ts-expect-error the payload of "joined" is an object
  client.emit("joined", "Tom");

  // @ts-expect-error "join" is an event the client emits, not one it receives
  io.on("join", () => undefined);
  // @ts-expect-error the payload of "joined" is an object
  io.on("joined", (message: string) => message);
  // @ts-expect-error "joined" is an event the server emits, not one it receives
  io.emit("joined", { users: [] });
  // @ts-expect-error the payload of "join" is a string
  io.emit("join", 42);
  // @ts-expect-error not an event at all
  io.emit("nope");
}

describe("typed events on the server", () => {
  it("types the emitter and its clients by the event maps of the service", async () => {
    const { ws, websocket } = await load();
    const service = ws.createWebSocketService<ClientEvents, ServerEvents>();
    const emitter = service.emitter();
    const names: string[] = [];
    emitter.connect((client) => {
      client.on("join", (name) => {
        names.push(name.toUpperCase()); // name is a string
        client.emit("joined", { users: names });
      });
      client.on("ping", () => undefined);
    });

    service.webSocketEvent(socketEvent("open", "s1"));
    service.webSocketEvent(socketEvent("message", "s1", JSON.stringify({ event: "join", object: "tom" })));
    emitter.broadcast("joined", { users: names }, { except: "s1" });
    emitter.emitTo("s2", "joined", { users: names });

    assert.deepEqual(names, ["TOM"]);
    assert.deepEqual(calls(websocket.send), [
      ["s1", JSON.stringify({ event: "joined", object: { users: ["TOM"] } })],
      ["s2", JSON.stringify({ event: "joined", object: { users: ["TOM"] } })],
    ]);
  });

  it("rules the wrong events and payloads out at compile time", () => {
    assert.equal(typeof rejectedAtCompileTime, "function");
  });
});
