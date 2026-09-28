import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import type { Request } from "@enonic-types/core";
import type { WebSocketExports } from "/lib/wsutil";
import { calls, loadService, socketEvent } from "./helpers.mts";

const webSocketRequest = { webSocket: true } as Request;
const plainRequest = { webSocket: false } as Request;

describe("service", () => {
  it("answers a websocket request with an empty websocket response by default", async () => {
    const { service } = await loadService();

    assert.deepEqual(service.get(webSocketRequest), { webSocket: {} });
  });

  it("answers a websocket request with the configured websocket response", async () => {
    const webSocketResponse = { subProtocols: ["json"], terminateOnSessionExit: false };
    const { service } = await loadService({ webSocketResponse });

    assert.equal(service.get(webSocketRequest).webSocket, webSocketResponse);
  });

  it("answers a plain request with status 400, pointing to the client asset", async () => {
    const { service } = await loadService();

    const response = service.get(plainRequest);

    assert.equal(response.status, 400);
    assert.match(String(response.body), /wsutil\/xp-websocket\.js/);
  });

  it("sets get and webSocketEvent with openWebsockets", async () => {
    const { service } = await loadService();
    const exp: WebSocketExports = {};

    service.openWebsockets(exp);

    assert.equal(exp.webSocketEvent, service.webSocketEvent);
    assert.ok(exp.get?.(webSocketRequest).webSocket);
  });

  it("works when its handlers are destructured", async () => {
    const { service, websocket } = await loadService();
    const { get, webSocketEvent, send } = service;

    assert.ok(get(webSocketRequest).webSocket);
    assert.doesNotThrow(() => webSocketEvent(socketEvent("open", "s1")));
    send("s1", { hi: 1 });
    assert.deepEqual(calls(websocket.send), [["s1", '{"hi":1}']]);
  });

  describe("rpc", () => {
    const call = (id: number, method: string, ...args: unknown[]) => JSON.stringify({ rpc: { id, method, args } });

    it("returns the methods as given, for typeof", async () => {
      const { service } = await loadService();
      const methods = { greet: (name: string) => `Hello ${name}` };

      assert.equal(service.rpc(methods), methods);
    });

    it("answers a call with the result of the method", async () => {
      const { service, websocket } = await loadService();
      service.rpc({ greet: (name: string) => `Hello ${name}` });

      service.webSocketEvent(socketEvent("message", "s1", call(7, "greet", "Tom")));

      assert.deepEqual(calls(websocket.send), [["s1", JSON.stringify({ rpc: { id: 7, result: "Hello Tom" } })]]);
    });

    it("gives the method the session of the caller as this", async () => {
      const { service, websocket } = await loadService();
      service.rpc({
        whoami() {
          return this.session.id;
        },
      });

      service.webSocketEvent(socketEvent("message", "s1", call(1, "whoami")));

      assert.deepEqual(calls(websocket.send), [["s1", JSON.stringify({ rpc: { id: 1, result: "s1" } })]]);
    });

    it("answers a method that throws with its error, and logs it", async (t) => {
      const error = t.mock.method(console, "error", () => undefined);
      const { service, websocket } = await loadService();
      service.rpc({
        fail() {
          throw new Error("It broke");
        },
      });

      service.webSocketEvent(socketEvent("message", "s1", call(1, "fail")));

      assert.deepEqual(calls(websocket.send), [["s1", JSON.stringify({ rpc: { id: 1, error: "It broke" } })]]);
      assert.match(String(calls(error)[0][0]), /"fail".*It broke/);
    });

    it("answers a method whose result cannot be serialized with an error, and logs it", async (t) => {
      const error = t.mock.method(console, "error", () => undefined);
      const { service, websocket } = await loadService();
      service.rpc({
        cyclic() {
          const result: { self?: unknown } = {};
          result.self = result;
          return result;
        },
      });

      service.webSocketEvent(socketEvent("message", "s1", call(1, "cyclic")));

      const [id, body] = calls(websocket.send)[0] as [string, string];
      const response = JSON.parse(body);
      assert.equal(id, "s1");
      assert.equal(response.rpc.id, 1);
      assert.match(response.rpc.error, /circular/i);
      assert.equal("result" in response.rpc, false);
      assert.equal(error.mock.callCount(), 1);
    });

    it("answers a call of an unknown method with an error", async () => {
      const { service, websocket } = await loadService();
      service.rpc({});

      service.webSocketEvent(socketEvent("message", "s1", call(1, "nope")));

      assert.deepEqual(calls(websocket.send), [
        ["s1", JSON.stringify({ rpc: { id: 1, error: 'Unknown rpc method "nope"' } })],
      ]);
    });

    it("does not pass rpc calls to the message handlers, and passes everything else", async () => {
      const { service } = await loadService();
      const main = mock.fn();
      const additional = mock.fn();
      service.setEventHandler("message", main);
      service.addHandler("message", additional);
      service.rpc({ greet: () => "hi" });

      service.webSocketEvent(socketEvent("message", "s1", call(1, "greet")));
      service.webSocketEvent(socketEvent("message", "s1", '{"hello":"server"}'));

      assert.deepEqual(
        calls(main).map(([message]) => message),
        [{ hello: "server" }],
      );
      assert.equal(additional.mock.callCount(), 1);
    });

    it("keeps the methods of two services apart", async () => {
      const { ws, websocket } = await loadService();
      const chat = ws.createWebSocketService();
      const news = ws.createWebSocketService();
      chat.rpc({ greet: () => "chat" });
      news.rpc({ greet: () => "news" });

      chat.webSocketEvent(socketEvent("message", "s1", call(1, "greet")));
      news.webSocketEvent(socketEvent("message", "s2", call(2, "greet")));

      assert.deepEqual(calls(websocket.send), [
        ["s1", JSON.stringify({ rpc: { id: 1, result: "chat" } })],
        ["s2", JSON.stringify({ rpc: { id: 2, result: "news" } })],
      ]);
    });
  });
});
