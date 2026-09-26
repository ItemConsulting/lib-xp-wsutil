import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Request } from "@enonic-types/core";
import type { WebSocketExports, WebSocketServiceOptions } from "/lib/wsUtil";
import { calls, loadService } from "./helpers.mts";

// A stand-in for the built assets/clientws.js, with the placeholders the library fills in
const CLIENT_SCRIPT = 'const host = "&HOST&";\nconst expansions = "&CLIENTEXPANSIONS&";\n';

const webSocketRequest = { webSocket: true } as Request;
const plainRequest = { webSocket: false } as Request;

/**
 * A service with the stand-in client script in place
 */
async function loadWithScript(options?: WebSocketServiceOptions) {
  const loaded = await loadService(options);
  loaded.io.readText.mock.mockImplementation(() => CLIENT_SCRIPT);
  return loaded;
}

describe("service", () => {
  it("answers a websocket request with an empty websocket response by default", async () => {
    const { service } = await loadWithScript();

    assert.deepEqual(service.get(webSocketRequest), { webSocket: {} });
  });

  it("answers a websocket request with the configured websocket response", async () => {
    const webSocketResponse = { subProtocols: ["json"], terminateOnSessionExit: false };
    const { service } = await loadWithScript({ webSocketResponse });

    assert.equal(service.get(webSocketRequest).webSocket, webSocketResponse);
  });

  it("serves the client library to a plain request, connecting to the websocket service", async () => {
    const { service, io } = await loadWithScript();

    const response = service.get(plainRequest);

    assert.equal(response.contentType, "application/javascript");
    assert.match(String(response.body), /const host = "\/_\/service\/com\.example\.app\/websocket";/);
    assert.deepEqual(calls(io.getResource), [["../../assets/clientws.js"]]);
  });

  it("connects the client library to the named service", async () => {
    const { service } = await loadWithScript({ service: "chat" });

    assert.match(String(service.get(plainRequest).body), /const host = "\/_\/service\/com\.example\.app\/chat";/);
  });

  it("connects the client library to the given host instead", async () => {
    const { service } = await loadWithScript({ service: "chat", host: "wss://example.com/socket" });

    assert.match(String(service.get(plainRequest).body), /const host = "wss:\/\/example\.com\/socket";/);
  });

  it("inlines the client expansions as source code", async () => {
    const { service } = await loadWithScript();
    service.expandClient("hello", function hello() {
      return "hi";
    });
    service.expandClient({ answer: 42, name: "x" });

    const body = String(service.get(plainRequest).body);
    const expansions = body.match(/const expansions = ([\s\S]*);\n$/)?.[1] ?? "";

    // The point is that the serialized expansions are valid source code, so evaluate them
    const evaluated = new Function(`return (${expansions});`)();
    assert.equal(evaluated.hello(), "hi");
    assert.equal(evaluated.answer, 42);
    assert.equal(evaluated.name, "x");
  });

  it("serializes methods so that they work as expansions", async () => {
    const { service } = await loadWithScript();
    service.expandClient({
      hello() {
        return "hi";
      },
      async later() {
        return "later";
      },
    });

    const body = String(service.get(plainRequest).body);
    const expansions = body.match(/const expansions = ([\s\S]*);\n$/)?.[1] ?? "";

    const evaluated = new Function(`return (${expansions});`)();
    assert.equal(evaluated.hello(), "hi");
    assert.equal(evaluated.later.constructor.name, "AsyncFunction");
  });

  it("rejects arrow functions and classes as expansions, which would not get the client as this", async () => {
    const { service } = await loadWithScript();

    assert.throws(() => service.expandClient("hello", () => "hi"), { name: "TypeError", message: /"hello".*this/ });
    assert.throws(() => service.expandClient({ Thing: class {} }), TypeError);
  });

  it("keeps the client expansions of two services apart", async () => {
    const { ws } = await loadWithScript();
    const chat = ws.createWebSocketService({ service: "chat" });
    const news = ws.createWebSocketService({ service: "news" });
    chat.expandClient({ chatOnly: 1 });

    assert.match(String(chat.get(plainRequest).body), /chatOnly/);
    assert.doesNotMatch(String(news.get(plainRequest).body), /chatOnly/);
  });

  it("sets get and webSocketEvent with openWebsockets", async () => {
    const { service } = await loadWithScript({ service: "chat" });
    const exp: WebSocketExports = {};

    service.openWebsockets(exp);

    assert.equal(exp.webSocketEvent, service.webSocketEvent);
    assert.match(String(exp.get?.(plainRequest).body), /const host = "\/_\/service\/com\.example\.app\/chat";/);
    assert.ok(exp.get?.(webSocketRequest).webSocket);
  });

  it("works when its handlers are destructured", async () => {
    const { service, websocket } = await loadWithScript();
    const { get, webSocketEvent, send } = service;

    assert.ok(get(webSocketRequest).webSocket);
    assert.doesNotThrow(() => webSocketEvent({ type: "open", session: { id: "s1" } } as never));
    send("s1", { hi: 1 });
    assert.deepEqual(calls(websocket.send), [["s1", '{"hi":1}']]);
  });
});
