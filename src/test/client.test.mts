import assert from "node:assert/strict";
import { beforeEach, describe, it, mock } from "node:test";
import { FakeWebSocket } from "./stubs/dom.mts";

// Imported after the DOM stubs are installed: the module extends HTMLElement and registers the element on load
const { WebSocketClient, XpWebSocketElement, RECONNECT_DELAY, RECONNECT_MAX_DELAY } = await import(
  "/assets/wsutil/xp-websocket"
);
type XpWebSocketElement = InstanceType<typeof XpWebSocketElement>;

// The default handler of the client logs every event
mock.method(console, "debug", () => undefined);

const URL = "ws://localhost:8080/_/service/com.example.app/websocket";
const lastSocket = () => FakeWebSocket.instances[FakeWebSocket.instances.length - 1];

/**
 * Settles the promises that are ready, so the test can look at the outcome of an rpc call
 */
const tick = () => new Promise((resolve) => setImmediate(resolve));

/**
 * What the parser does when the element is in the page: adds it, and calls the lifecycle callbacks
 */
function addToPage(element: XpWebSocketElement): void {
  (element as { isConnected: boolean }).isConnected = true;
  element.connectedCallback();
}

function removeFromPage(element: XpWebSocketElement): void {
  (element as { isConnected: boolean }).isConnected = false;
  element.disconnectedCallback();
}

describe("WebSocketClient", () => {
  beforeEach(() => {
    FakeWebSocket.instances = [];
  });

  it("connects right away to a given url", () => {
    new WebSocketClient(URL);

    assert.equal(lastSocket().url, URL);
  });

  it("connects on connect() to the url given with setUrl", () => {
    const cws = new WebSocketClient();
    cws.setUrl(URL);
    assert.equal(FakeWebSocket.instances.length, 0);

    cws.connect();

    assert.equal(lastSocket().url, URL);
  });

  it("refuses to connect without a url", () => {
    const cws = new WebSocketClient();

    assert.throws(() => cws.connect(), /url/);
  });

  it("closes the open connection when connecting again, and ignores its events", () => {
    const cws = new WebSocketClient(URL);
    const close = mock.fn();
    cws.setEventHandler("close", close);
    const first = lastSocket();
    first.open();

    cws.setUrl("wss://example.com/other", true);

    assert.equal(first.closed, true);
    assert.equal(FakeWebSocket.instances.length, 2);
    assert.equal(close.mock.callCount(), 0);
    assert.equal(cws.isConnected, false);
    lastSocket().open();
    assert.equal(cws.isConnected, true);
  });

  it("knows whether it is connected", () => {
    const cws = new WebSocketClient(URL);
    assert.equal(cws.isConnected, false);

    lastSocket().open();
    assert.equal(cws.isConnected, true);

    lastSocket().close();
    assert.equal(cws.isConnected, false);
  });

  it("closes the connection with close(), and dispatches the close event", () => {
    const cws = new WebSocketClient(URL);
    const close = mock.fn();
    cws.setEventHandler("close", close);
    lastSocket().open();

    cws.close();

    assert.equal(lastSocket().closed, true);
    assert.equal(close.mock.callCount(), 1);
    assert.equal(cws.isConnected, false);
    assert.throws(() => cws.send("hello"), /connect\(\)/);
  });

  it("sends objects as JSON and everything else as text", () => {
    const cws = new WebSocketClient(URL);
    lastSocket().open();

    cws.send({ hello: "server" });
    cws.send("plain");

    assert.deepEqual(lastSocket().sent, ['{"hello":"server"}', "plain"]);
  });

  it("refuses to send before connect", () => {
    const cws = new WebSocketClient();

    assert.throws(() => cws.send("hello"), /connect\(\)/);
  });

  it("sends what is sent while the connection opens once it is open, in order", () => {
    const cws = new WebSocketClient(URL);

    cws.send({ early: 1 });
    cws.Io().emit("ping", 1);
    assert.deepEqual(lastSocket().sent, []);

    lastSocket().open();

    assert.deepEqual(lastSocket().sent, ['{"early":1}', JSON.stringify({ event: "ping", object: 1 })]);
  });

  it("drops what was queued on a connection that is replaced before it opens", () => {
    const cws = new WebSocketClient(URL);
    cws.send({ early: 1 });

    cws.connect();
    lastSocket().open();

    assert.deepEqual(lastSocket().sent, []);
  });

  it("passes the parsed message to the message handler, and the event to the additional handlers", () => {
    const cws = new WebSocketClient();
    const messages: unknown[] = [];
    const events: unknown[] = [];
    cws.setEventHandler("message", (message) => messages.push(message));
    cws.addHandler("message", (event) => events.push(event));
    cws.setUrl(URL, true);

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
    cws.setUrl(URL, true);

    lastSocket().open();
    lastSocket().close();

    assert.equal(open.mock.callCount(), 1);
    assert.equal(fallback.mock.callCount(), 1);
  });

  it("logs errors with console.error and other events at debug level by default", (t) => {
    const error = t.mock.method(console, "error", () => undefined);
    const debug = t.mock.method(console, "debug", () => undefined);
    new WebSocketClient(URL);

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
    cws.setUrl(URL);
    const io = cws.Io(); // Connects
    lastSocket().open();
    const pongs: unknown[] = [];
    io.on("pong", (message) => pongs.push(message));

    io.emit("ping", { n: 1 });
    lastSocket().receive(JSON.stringify({ event: "pong", object: { n: 2 } }));
    lastSocket().receive(JSON.stringify({ event: "other", object: {} }));
    lastSocket().receive("not an emitter message");

    assert.deepEqual(lastSocket().sent, [JSON.stringify({ event: "ping", object: { n: 1 } })]);
    assert.deepEqual(pongs, [{ n: 2 }]);
  });

  it("parses each message once, also when Io is used", (t) => {
    const cws = new WebSocketClient(URL);
    const io = cws.Io();
    const pongs: unknown[] = [];
    io.on("pong", (message) => pongs.push(message));
    lastSocket().open();
    const parse = t.mock.method(JSON, "parse");

    lastSocket().receive(JSON.stringify({ event: "pong", object: 1 }));

    assert.equal(parse.mock.callCount(), 1);
    assert.deepEqual(pongs, [1]);
  });

  it("returns the same Io every time, and does not reconnect while connecting", () => {
    const cws = new WebSocketClient(URL);

    assert.equal(cws.Io(), cws.Io());
    assert.equal(FakeWebSocket.instances.length, 1);
  });

  describe("rpc", () => {
    // The methods on the server, as the client sees their type
    type Api = {
      greet(name: string): string;
      fail(): never;
    };

    it("sends a call and resolves with the result", async () => {
      const cws = new WebSocketClient(URL);
      lastSocket().open();

      const greeting = cws.rpc<Api>().greet("Tom");
      assert.deepEqual(lastSocket().sent, [JSON.stringify({ rpc: { id: 1, method: "greet", args: ["Tom"] } })]);

      lastSocket().receive(JSON.stringify({ rpc: { id: 1, result: "Hello Tom" } }));
      assert.equal(await greeting, "Hello Tom");
    });

    it("rejects with the error of the method", async () => {
      const cws = new WebSocketClient(URL);
      lastSocket().open();

      const failing = cws.rpc<Api>().fail();
      lastSocket().receive(JSON.stringify({ rpc: { id: 1, error: "It broke" } }));

      await assert.rejects(failing, { message: "It broke" });
    });

    it("matches responses to calls by id", async () => {
      const cws = new WebSocketClient(URL);
      lastSocket().open();
      const rpc = cws.rpc<Api>();

      const first = rpc.greet("A");
      const second = rpc.greet("B");
      lastSocket().receive(JSON.stringify({ rpc: { id: 2, result: "Hello B" } }));
      lastSocket().receive(JSON.stringify({ rpc: { id: 1, result: "Hello A" } }));

      assert.deepEqual(await Promise.all([first, second]), ["Hello A", "Hello B"]);
    });

    it("opens the connection if needed, and sends calls made while it opens once it is open", async () => {
      const cws = new WebSocketClient();
      cws.setUrl(URL);

      const greeting = cws.rpc<Api>().greet("Tom");
      assert.equal(lastSocket().sent.length, 0);

      lastSocket().open();
      assert.equal(lastSocket().sent.length, 1);
      lastSocket().receive(JSON.stringify({ rpc: { id: 1, result: "Hello Tom" } }));
      assert.equal(await greeting, "Hello Tom");
    });

    it("rejects a call without a url to connect to", async () => {
      const cws = new WebSocketClient();

      await assert.rejects(cws.rpc<Api>().greet("Tom"), /url/);
    });

    it("rejects pending calls when the connection closes", async () => {
      const cws = new WebSocketClient(URL);
      lastSocket().open();

      const greeting = cws.rpc<Api>().greet("Tom");
      lastSocket().close();

      await assert.rejects(greeting, /closed/);
    });

    it("does not pass rpc responses to the message handlers", async () => {
      const cws = new WebSocketClient(URL);
      const message = mock.fn();
      cws.setEventHandler("message", message);
      lastSocket().open();
      const greeting = cws.rpc<Api>().greet("Tom");

      lastSocket().receive(JSON.stringify({ rpc: { id: 1, result: "Hello Tom" } }));
      lastSocket().receive(JSON.stringify({ hello: "client" }));
      await greeting;

      assert.deepEqual(
        message.mock.calls.map((call) => call.arguments),
        [[{ hello: "client" }]],
      );
    });
  });
});

describe("reconnecting", () => {
  type Api = { greet(name: string): string };

  beforeEach(() => {
    FakeWebSocket.instances = [];
  });

  /**
   * A client with reconnect on, whose connection has opened and then dropped
   */
  function dropped(t: { mock: { timers: { enable(options: { apis: "setTimeout"[] }): void } } }) {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const cws = new WebSocketClient(URL);
    cws.reconnect = true;
    lastSocket().open();
    lastSocket().close();
    return cws;
  }

  it("is off by default: a dropped connection stays closed", (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const cws = new WebSocketClient(URL);
    lastSocket().open();

    lastSocket().close();
    t.mock.timers.tick(RECONNECT_MAX_DELAY);

    assert.equal(cws.reconnect, false);
    assert.equal(FakeWebSocket.instances.length, 1);
    assert.throws(() => cws.send("hello"), /connect\(\)/);
  });

  it("reconnects a dropped connection after the delay, and dispatches open again", (t) => {
    const cws = dropped(t);
    const open = mock.fn();
    cws.setEventHandler("open", open);

    t.mock.timers.tick(RECONNECT_DELAY - 1);
    assert.equal(FakeWebSocket.instances.length, 1);
    t.mock.timers.tick(1);
    assert.equal(FakeWebSocket.instances.length, 2);
    assert.equal(lastSocket().url, URL);

    lastSocket().open();
    assert.equal(cws.isConnected, true);
    assert.equal(open.mock.callCount(), 1);
  });

  it("doubles the delay for every failed attempt, up to the maximum, and starts over once connected", (t) => {
    dropped(t);
    let delay = RECONNECT_DELAY;

    // 1s, 2s, 4s, 8s, 16s, 30s, 30s
    for (let attempt = 2; attempt <= 8; attempt++) {
      t.mock.timers.tick(delay - 1);
      assert.equal(FakeWebSocket.instances.length, attempt - 1, `attempt ${attempt} came before ${delay} ms`);
      t.mock.timers.tick(1);
      assert.equal(FakeWebSocket.instances.length, attempt, `attempt ${attempt} did not come after ${delay} ms`);
      lastSocket().close(); // The server is still down
      delay = Math.min(delay * 2, RECONNECT_MAX_DELAY);
    }

    t.mock.timers.tick(RECONNECT_MAX_DELAY);
    lastSocket().open(); // The server is back
    lastSocket().close(); // And gone again: the delay starts over
    t.mock.timers.tick(RECONNECT_DELAY);
    assert.equal(FakeWebSocket.instances.length, 10);
  });

  it("does not reconnect a connection closed with close(), and cancels a pending reconnect", (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const cws = new WebSocketClient(URL);
    cws.reconnect = true;
    lastSocket().open();

    cws.close();
    t.mock.timers.tick(RECONNECT_MAX_DELAY);
    assert.equal(FakeWebSocket.instances.length, 1);

    cws.connect();
    lastSocket().open();
    lastSocket().close();
    cws.close(); // While waiting to reconnect
    t.mock.timers.tick(RECONNECT_MAX_DELAY);
    assert.equal(FakeWebSocket.instances.length, 2);
  });

  it("stops when reconnect is turned off while waiting", (t) => {
    const cws = dropped(t);

    cws.reconnect = false;
    t.mock.timers.tick(RECONNECT_MAX_DELAY);

    assert.equal(FakeWebSocket.instances.length, 1);
  });

  it("queues what is sent while waiting to reconnect, across failed attempts, and sends it once connected", (t) => {
    const cws = dropped(t);

    cws.send({ while: "down" });
    cws.Io().emit("ping", 1);
    t.mock.timers.tick(RECONNECT_DELAY);
    lastSocket().close(); // The first attempt fails
    t.mock.timers.tick(RECONNECT_DELAY * 2);
    lastSocket().open();

    assert.deepEqual(lastSocket().sent, ['{"while":"down"}', JSON.stringify({ event: "ping", object: 1 })]);
  });

  it("drops the queue when the connection is closed for good", (t) => {
    const cws = dropped(t);
    cws.send({ while: "down" });

    cws.close();
    cws.connect();
    lastSocket().open();

    assert.deepEqual(lastSocket().sent, []);
  });

  it("rejects the pending rpc calls when the connection drops, and connects right away for a new call", async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const cws = new WebSocketClient(URL);
    cws.reconnect = true;
    lastSocket().open();
    const greeting = cws.rpc<Api>().greet("Tom");

    lastSocket().close();
    await assert.rejects(greeting, /closed/);

    const again = cws.rpc<Api>().greet("Tom");
    assert.equal(FakeWebSocket.instances.length, 2); // Without waiting for the timer
    lastSocket().open();
    lastSocket().receive(JSON.stringify({ rpc: { id: 2, result: "Hello Tom" } }));
    assert.equal(await again, "Hello Tom");
    t.mock.timers.tick(RECONNECT_MAX_DELAY);
    assert.equal(FakeWebSocket.instances.length, 2); // The timer was cancelled
  });
});

describe("<xp-websocket>", () => {
  beforeEach(() => {
    FakeWebSocket.instances = [];
  });

  it("turns reconnecting on with the reconnect attribute, and off when it is removed", () => {
    const element = new XpWebSocketElement();
    element.setAttribute("src", URL);
    element.setAttribute("reconnect", "");
    addToPage(element);

    assert.equal(element.reconnect, true);
    assert.equal(element.client.reconnect, true);

    element.reconnect = false;
    assert.equal(element.hasAttribute("reconnect"), false);
    assert.equal(element.client.reconnect, false);
  });

  it("reconnects a dropped connection while in the page, and not after it is removed", (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const element = new XpWebSocketElement();
    element.setAttribute("src", URL);
    element.setAttribute("reconnect", "");
    addToPage(element);
    lastSocket().open();

    lastSocket().close();
    t.mock.timers.tick(RECONNECT_DELAY);
    assert.equal(FakeWebSocket.instances.length, 2);
    lastSocket().open();

    removeFromPage(element);
    t.mock.timers.tick(RECONNECT_MAX_DELAY);
    assert.equal(FakeWebSocket.instances.length, 2);
  });

  it("is registered as a custom element", () => {
    assert.equal(customElements.get("xp-websocket"), XpWebSocketElement);
  });

  it("connects to src when added to the page", () => {
    const element = new XpWebSocketElement();
    element.setAttribute("src", URL);
    assert.equal(FakeWebSocket.instances.length, 0);

    addToPage(element);

    assert.equal(lastSocket().url, URL);
    assert.equal(element.src, URL);
  });

  it("does not connect without src", () => {
    const element = new XpWebSocketElement();

    addToPage(element);

    assert.equal(FakeWebSocket.instances.length, 0);
  });

  it("closes the connection when removed from the page", () => {
    const element = new XpWebSocketElement();
    element.setAttribute("src", URL);
    addToPage(element);
    lastSocket().open();

    removeFromPage(element);

    assert.equal(lastSocket().closed, true);
    assert.equal(element.connected, false);
  });

  it("reconnects when src changes while in the page, and not before", () => {
    const element = new XpWebSocketElement();
    element.setAttribute("src", URL);
    assert.equal(FakeWebSocket.instances.length, 0);
    addToPage(element);
    const first = lastSocket();

    element.src = "wss://example.com/other";

    assert.equal(first.closed, true);
    assert.equal(lastSocket().url, "wss://example.com/other");
  });

  it("connects once when upgraded in the page, where the attribute callback runs before connectedCallback", () => {
    const element = new XpWebSocketElement();
    element.setAttribute("src", URL); // Not in the page yet, so no connection
    (element as { isConnected: boolean }).isConnected = true;

    // The upgrade replays the initial attribute, and then calls connectedCallback
    element.attributeChangedCallback("src", null, URL);
    element.connectedCallback();

    assert.equal(FakeWebSocket.instances.length, 1);
  });

  it("reconnects after the connection was closed by the element when added to the page again", () => {
    const element = new XpWebSocketElement();
    element.setAttribute("src", URL);
    addToPage(element);
    removeFromPage(element);

    addToPage(element);

    assert.equal(FakeWebSocket.instances.length, 2);
  });

  it("dispatches the events of the connection as bubbling ws: events", () => {
    const element = new XpWebSocketElement();
    element.setAttribute("src", URL);
    const seen: [string, unknown, boolean][] = [];
    // The event types come from the global declarations (global.ts): the listener gets a CustomEvent
    const record = (event: CustomEvent) => seen.push([event.type, event.detail, event.bubbles]);
    element.addEventListener("ws:open", record);
    element.addEventListener("ws:message", record);
    element.addEventListener("ws:error", record);
    element.addEventListener("ws:close", record);
    addToPage(element);

    lastSocket().open();
    lastSocket().receive('{"hello":"client"}');
    lastSocket().fail();
    lastSocket().close();

    assert.deepEqual(
      seen.map(([type, , bubbles]) => [type, bubbles]),
      [
        ["ws:open", true],
        ["ws:message", true],
        ["ws:error", true],
        ["ws:close", true],
      ],
    );
    assert.deepEqual(seen[1][1], { hello: "client" }); // The message, parsed
    assert.ok(seen[0][1] instanceof Event); // The others carry the event of the WebSocket
  });

  it("knows whether the connection is open", () => {
    const element = new XpWebSocketElement();
    element.setAttribute("src", URL);
    addToPage(element);
    assert.equal(element.connected, false);

    lastSocket().open();

    assert.equal(element.connected, true);
  });

  it("sends, and gives access to Io and the rpc methods", async () => {
    const element = new XpWebSocketElement();
    element.setAttribute("src", URL);
    addToPage(element);
    lastSocket().open();

    element.send({ hello: "server" });
    element.io.emit("ping", 1);
    const greeting = element.rpc<{ greet(name: string): string }>().greet("Tom");
    lastSocket().receive(JSON.stringify({ rpc: { id: 1, result: "Hello Tom" } }));

    assert.deepEqual(lastSocket().sent, [
      '{"hello":"server"}',
      JSON.stringify({ event: "ping", object: 1 }),
      JSON.stringify({ rpc: { id: 1, method: "greet", args: ["Tom"] } }),
    ]);
    assert.equal(await greeting, "Hello Tom");
    assert.equal(element.io, element.io);
    await tick();
  });
});

describe("typed events", () => {
  // The event maps, as the service controller would declare them
  type ClientEvents = { join: string; ping: undefined };
  type ServerEvents = { joined: { users: string[] } };

  beforeEach(() => {
    FakeWebSocket.instances = [];
  });

  it("types io by the event maps of the client", () => {
    const cws = new WebSocketClient<ClientEvents, ServerEvents>(URL);
    const io = cws.Io();
    lastSocket().open();
    const seen: string[][] = [];
    io.on("joined", (message) => seen.push(message.users));

    io.emit("join", "Tom");
    io.emit("ping");
    lastSocket().receive(JSON.stringify({ event: "joined", object: { users: ["Tom"] } }));

    assert.deepEqual(lastSocket().sent, [
      JSON.stringify({ event: "join", object: "Tom" }),
      JSON.stringify({ event: "ping" }),
    ]);
    assert.deepEqual(seen, [["Tom"]]);
  });

  it("types io of the element by its type parameters", () => {
    const element = new XpWebSocketElement<ClientEvents, ServerEvents>();
    element.setAttribute("src", URL);
    addToPage(element);
    lastSocket().open();

    element.io.emit("join", "Tom");

    assert.deepEqual(lastSocket().sent, [JSON.stringify({ event: "join", object: "Tom" })]);
  });
});
