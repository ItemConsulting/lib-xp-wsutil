import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import type { EmitterUser } from "/lib/wsutil";
import { calls, loadService, socketEvent } from "./helpers.mts";

/**
 * Creates a service and its emitter, and connects a client. Returns the socket the connect callback got.
 */
async function connect(sessionId = "s1") {
  const loaded = await loadService();
  const emitter = loaded.service.emitter();
  let socket: EmitterUser | undefined;
  emitter.connect((connected) => {
    socket = connected;
  });
  loaded.service.webSocketEvent(socketEvent("open", sessionId));

  if (!socket) throw new Error("The connect callback was not called");
  return { ...loaded, emitter, socket };
}

describe("SocketEmitter", () => {
  it("calls the connect callback with the socket of a user that connects", async () => {
    const { socket } = await connect("s1");

    assert.equal(socket.id, "s1");
  });

  it("is created once per service", async () => {
    const { service } = await loadService();

    assert.equal(service.emitter(), service.emitter());
  });

  it("knows the users that connected before emitter() was first called", async () => {
    const { service, websocket } = await loadService();
    service.webSocketEvent(socketEvent("open", "s1"));

    service.emitter().broadcast("news", 1);

    assert.deepEqual(calls(websocket.send), [["s1", JSON.stringify({ event: "news", object: 1 })]]);
  });

  it("emits events to the user as JSON", async () => {
    const { socket, websocket } = await connect("s1");

    socket.emit("hello", { to: "you" });

    assert.deepEqual(calls(websocket.send), [["s1", JSON.stringify({ event: "hello", object: { to: "you" } })]]);
  });

  it("emits events to any user with emitTo", async () => {
    const { emitter, websocket } = await connect("s1");

    emitter.emitTo("s2", "private", "psst");

    assert.deepEqual(calls(websocket.send), [["s2", JSON.stringify({ event: "private", object: "psst" })]]);
  });

  it("broadcasts events to every connected user", async () => {
    const { service, emitter, websocket } = await connect("s1");
    service.webSocketEvent(socketEvent("open", "s2"));

    emitter.broadcast("news", 42);

    const message = JSON.stringify({ event: "news", object: 42 });
    assert.deepEqual(calls(websocket.send), [
      ["s1", message],
      ["s2", message],
    ]);
  });

  it("leaves one user out of a broadcast with except", async () => {
    const { service, emitter, websocket } = await connect("s1");
    service.webSocketEvent(socketEvent("open", "s2"));

    emitter.broadcast("news", 42, { except: "s1" });

    assert.deepEqual(calls(websocket.send), [["s2", JSON.stringify({ event: "news", object: 42 })]]);
  });

  it("calls the handler of an event emitted by the user, with its payload", async () => {
    const { service, socket } = await connect("s1");
    const seen: number[] = [];
    socket.on<{ n: number }>("ping", (message) => {
      seen.push(message.n);
    });

    service.webSocketEvent(socketEvent("message", "s1", JSON.stringify({ event: "ping", object: { n: 1 } })));

    assert.deepEqual(seen, [1]);
  });

  it("only calls the handlers of the user that sent the event", async () => {
    const { service, socket: first } = await connect("s1");
    service.webSocketEvent(socketEvent("open", "s2"));
    const firstPing = mock.fn();
    first.on("ping", firstPing);

    service.webSocketEvent(socketEvent("message", "s2", JSON.stringify({ event: "ping" })));

    assert.equal(firstPing.mock.callCount(), 0);
  });

  it("does not call the built-in properties of an object as handlers", async (t) => {
    const { service } = await connect("s1");
    const error = t.mock.method(console, "error", () => undefined);
    const debug = t.mock.method(log, "debug", () => undefined);

    service.webSocketEvent(socketEvent("message", "s1", JSON.stringify({ event: "hasOwnProperty" })));
    service.webSocketEvent(socketEvent("message", "s1", JSON.stringify({ event: "constructor", object: 1 })));

    assert.equal(error.mock.callCount(), 0);
    assert.ok(calls(debug).some(([line]) => /Unhandled event: hasOwnProperty/.test(String(line))));
  });

  it("ignores messages that are not emitter messages", async () => {
    const { service, socket } = await connect("s1");
    const ping = mock.fn();
    socket.on("ping", ping);

    service.webSocketEvent(socketEvent("message", "s1", "not json"));
    service.webSocketEvent(socketEvent("message", "s1", '{"no":"event"}'));

    assert.equal(ping.mock.callCount(), 0);
  });

  it("logs an error and carries on when a handler throws", async (t) => {
    const { service, socket } = await connect("s1");
    const error = t.mock.method(console, "error", () => undefined);
    socket.on("boom", () => {
      throw new Error("kaboom");
    });

    assert.doesNotThrow(() => {
      service.webSocketEvent(socketEvent("message", "s1", JSON.stringify({ event: "boom" })));
    });
    assert.equal(error.mock.callCount(), 1);
    assert.match(String(calls(error)[0][0]), /"boom".*s1.*kaboom/);
  });

  it("calls the disconnect callback when the user closes the connection", async () => {
    const { service, emitter, socket, websocket } = await connect("s1");
    const disconnect = mock.fn();
    socket.onDisconnect(disconnect);

    service.webSocketEvent(socketEvent("close", "s1"));

    assert.equal(disconnect.mock.callCount(), 1);

    // The user is gone, so a broadcast no longer reaches it
    emitter.broadcast("news");
    assert.equal(websocket.send.mock.callCount(), 0);
  });

  it("treats an event named disconnect from the client as an ordinary event", async () => {
    const { service, socket } = await connect("s1");
    const disconnect = mock.fn();
    const disconnectEvent = mock.fn();
    socket.onDisconnect(disconnect);
    socket.on("disconnect", disconnectEvent);

    service.webSocketEvent(socketEvent("message", "s1", JSON.stringify({ event: "disconnect" })));

    assert.equal(disconnect.mock.callCount(), 0);
    assert.equal(disconnectEvent.mock.callCount(), 1);
  });
});
