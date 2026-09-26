import assert from "node:assert/strict";
import { beforeEach, describe, it, mock } from "node:test";
import { ExpWS, WebSocketClient } from "/assets/clientws";

/**
 * A WebSocket that records what is sent, and lets the test fire the events
 */
class FakeWebSocket {
  static instances: FakeWebSocket[] = [];

  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  readonly sent: string[] = [];
  readonly url: string;
  closed = false;

  constructor(url: string) {
    this.url = url;
    FakeWebSocket.instances.push(this);
  }

  send(message: string): void {
    this.sent.push(message);
  }

  open(): void {
    this.onopen?.(new Event("open"));
  }

  receive(data: string): void {
    this.onmessage?.(new MessageEvent("message", { data }));
  }

  fail(): void {
    this.onerror?.(new Event("error"));
  }

  close(): void {
    this.closed = true;
    this.onclose?.(new CloseEvent("close"));
  }
}

// The browser globals the client library uses, which Node does not have
const location = { protocol: "http:", host: "localhost:8080" };
Object.defineProperty(globalThis, "WebSocket", { value: FakeWebSocket, writable: true, configurable: true });
Object.defineProperty(globalThis, "location", { value: location, writable: true, configurable: true });

// The default handler of the client logs every event
mock.method(console, "debug", () => undefined);

const lastSocket = () => FakeWebSocket.instances[FakeWebSocket.instances.length - 1];

describe("WebSocketClient", () => {
  beforeEach(() => {
    FakeWebSocket.instances = [];
    location.protocol = "http:";
  });

  it("is also exported as ExpWS", () => {
    assert.equal(ExpWS, WebSocketClient);
  });

  it("connects to the service it was served from, with the protocol of the page", () => {
    const cws = new WebSocketClient();
    assert.equal(FakeWebSocket.instances.length, 0);

    cws.connect();

    // The server replaces &HOST& with the url of the service before serving the script
    assert.equal(lastSocket().url, "ws://localhost:8080&HOST&");
  });

  it("uses wss on a page served over https", () => {
    location.protocol = "https:";

    new WebSocketClient().connect();

    assert.equal(lastSocket().url, "wss://localhost:8080&HOST&");
  });

  it("connects right away to a given url", () => {
    new WebSocketClient("wss://example.com/socket");

    assert.equal(lastSocket().url, "wss://example.com/socket");
  });

  it("changes the url with setHost", () => {
    const cws = new WebSocketClient();

    cws.setHost("wss://example.com/other", true);

    assert.equal(lastSocket().url, "wss://example.com/other");
  });

  it("closes the open connection when connecting again", () => {
    const cws = new WebSocketClient();
    cws.connect();
    const first = lastSocket();
    first.open();

    cws.setHost("wss://example.com/other", true);

    assert.equal(first.closed, true);
    assert.equal(FakeWebSocket.instances.length, 2);
    assert.equal(cws.isConnected, false);
    lastSocket().open();
    assert.equal(cws.isConnected, true);
  });

  it("knows whether it is connected", () => {
    const cws = new WebSocketClient();
    cws.connect();
    assert.equal(cws.isConnected, false);

    lastSocket().open();
    assert.equal(cws.isConnected, true);

    lastSocket().close();
    assert.equal(cws.isConnected, false);
  });

  it("sends objects as JSON and everything else as text", () => {
    const cws = new WebSocketClient();
    cws.connect();

    cws.send({ hello: "server" });
    cws.send("plain");

    assert.deepEqual(lastSocket().sent, ['{"hello":"server"}', "plain"]);
  });

  it("refuses to send before connect", () => {
    const cws = new WebSocketClient();

    assert.throws(() => cws.send("hello"), /connect\(\)/);
  });

  it("passes the parsed message to the message handler, and the event to the additional handlers", () => {
    const cws = new WebSocketClient();
    const messages: unknown[] = [];
    const events: unknown[] = [];
    cws.setEventHandler("message", (message) => messages.push(message));
    cws.addHandler("message", (event) => events.push(event));
    cws.connect();

    lastSocket().receive('{"hello":"client"}');
    lastSocket().receive("plain");

    assert.deepEqual(messages, [{ hello: "client" }, "plain"]);
    assert.equal(events.length, 2);
    assert.ok(events[0] instanceof MessageEvent);
  });

  it("calls the default handler for events without a handler of their own", () => {
    const cws = new WebSocketClient();
    const fallback = mock.fn();
    const open = mock.fn();
    cws.setDefaultHandler(fallback);
    cws.setEventHandlers({ open });
    cws.connect();

    lastSocket().open();
    lastSocket().close();

    assert.equal(open.mock.callCount(), 1);
    assert.equal(fallback.mock.callCount(), 1);
  });

  it("logs errors with console.error and other events at debug level by default", (t) => {
    const error = t.mock.method(console, "error", () => undefined);
    const debug = t.mock.method(console, "debug", () => undefined);
    const cws = new WebSocketClient();
    cws.connect();

    lastSocket().open();
    lastSocket().fail();

    assert.equal(debug.mock.callCount(), 1);
    assert.equal(error.mock.callCount(), 1);
  });

  it("rejects unknown events and handlers that are not functions, with a TypeError", () => {
    const cws = new WebSocketClient();

    // @ts-expect-error not a WebSocketEventType: what a JavaScript caller can do
    assert.throws(() => cws.setEventHandler("nope", () => undefined), TypeError);
    // @ts-expect-error not a function
    assert.throws(() => cws.setEventHandler("open", "nope"), TypeError);
    // @ts-expect-error not a WebSocketEventType
    assert.throws(() => cws.addHandler("nope", () => undefined), TypeError);
    // @ts-expect-error not a WebSocketEventType
    assert.throws(() => cws.setEventHandlers({ nope: () => undefined }), TypeError);
  });

  it("emits and receives named events with Io", () => {
    const cws = new WebSocketClient();
    const io = cws.Io(); // Connects
    const pongs: unknown[] = [];
    io.on("pong", (message) => pongs.push(message));

    io.emit("ping", { n: 1 });
    lastSocket().receive(JSON.stringify({ event: "pong", object: { n: 2 } }));
    lastSocket().receive(JSON.stringify({ event: "other", object: {} }));
    lastSocket().receive("not an emitter message");

    assert.deepEqual(lastSocket().sent, [JSON.stringify({ event: "ping", object: { n: 1 } })]);
    assert.deepEqual(pongs, [{ n: 2 }]);
  });

  it("returns the same Io every time", () => {
    const cws = new WebSocketClient();

    assert.equal(cws.Io(), cws.Io());
    assert.equal(FakeWebSocket.instances.length, 1);
  });
});
