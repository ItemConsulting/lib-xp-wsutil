import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import { calls, loadService, socketEvent } from "./helpers.mts";

describe("events", () => {
  it("passes the event to the main handler of open, close and error", async () => {
    const { service } = await loadService();
    const open = mock.fn();
    const close = mock.fn();
    service.setEventHandler("open", open);
    service.setEventHandler("close", close);

    const event = socketEvent("open", "s1");
    service.webSocketEvent(event);

    assert.deepEqual(calls(open), [[event]]);
    assert.equal(close.mock.callCount(), 0);
  });

  it("passes the parsed message and the event to the message handler", async () => {
    const { service } = await loadService();
    const message = mock.fn();
    service.setEventHandler("message", message);

    const event = socketEvent("message", "s1", '{"hello":"world"}');
    service.webSocketEvent(event);

    assert.deepEqual(calls(message), [[{ hello: "world" }, event]]);
  });

  it("passes a message that is not JSON on as a string", async () => {
    const { service } = await loadService();
    const message = mock.fn();
    service.setEventHandler("message", message);

    service.webSocketEvent(socketEvent("message", "s1", "plain text"));

    assert.equal(calls(message)[0][0], "plain text");
  });

  it("calls the additional handlers after the main handler, with the same arguments", async () => {
    const { service } = await loadService();
    const called: string[] = [];
    service.setEventHandler("message", (message) => {
      called.push(`main:${message}`);
    });
    service.addHandler("message", (message) => {
      called.push(`first:${message}`);
    });
    service.addHandler("message", (message) => {
      called.push(`second:${message}`);
    });

    service.webSocketEvent(socketEvent("message", "s1", '"hi"'));

    assert.deepEqual(called, ["main:hi", "first:hi", "second:hi"]);
  });

  it("runs the additional handlers when the main handler throws, and logs the error", async (t) => {
    const { service } = await loadService();
    const error = t.mock.method(console, "error", () => undefined);
    const additional = mock.fn();
    service.setEventHandler("close", () => {
      throw new Error("kaboom");
    });
    service.addHandler("close", additional);

    assert.doesNotThrow(() => service.webSocketEvent(socketEvent("close", "s1")));

    assert.equal(additional.mock.callCount(), 1);
    assert.match(String(calls(error)[0][0]), /"close".*s1.*kaboom/);
  });

  it("still removes a disconnected user from the emitter and the groups when the app's close handler throws", async (t) => {
    const { service, websocket } = await loadService();
    t.mock.method(console, "error", () => undefined);
    service.setEventHandler("close", () => {
      throw new Error("kaboom");
    });
    service.webSocketEvent(socketEvent("open", "s1"));
    service.addUserToGroup("auto", "s1", true);

    service.webSocketEvent(socketEvent("close", "s1"));

    assert.equal(service.getGroupUsers("auto"), undefined);
    service.emitter().broadcast("news");
    assert.equal(websocket.send.mock.callCount(), 0);
  });

  it("keeps the handlers of the events left out of setEventHandlers", async () => {
    const { service } = await loadService();
    const open = mock.fn();
    const close = mock.fn();
    service.setEventHandler("open", open);
    service.setEventHandlers({ close });

    service.webSocketEvent(socketEvent("open", "s1"));
    service.webSocketEvent(socketEvent("close", "s1"));

    assert.equal(open.mock.callCount(), 1);
    assert.equal(close.mock.callCount(), 1);
  });

  it("logs every event at debug level by default", async (t) => {
    const { service } = await loadService();
    const debug = t.mock.method(log, "debug", () => undefined);

    const event = socketEvent("open", "s1");
    service.webSocketEvent(event);

    assert.deepEqual(calls(debug), [[JSON.stringify(event)]]);
  });

  it("keeps the handlers of two services apart", async () => {
    const { ws } = await loadService();
    const chat = ws.createWebSocketService();
    const news = ws.createWebSocketService();
    const chatOpen = mock.fn();
    const newsOpen = mock.fn();
    chat.setEventHandler("open", chatOpen);
    news.setEventHandler("open", newsOpen);

    chat.webSocketEvent(socketEvent("open", "s1"));

    assert.equal(chatOpen.mock.callCount(), 1);
    assert.equal(newsOpen.mock.callCount(), 0);
  });
});
