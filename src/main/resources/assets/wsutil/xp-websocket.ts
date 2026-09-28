// The client side library of /lib/wsutil: the <xp-websocket> element, built on the WebSocketClient in client.ts,
// which is bundled into this file. Built to assets/wsutil/xp-websocket.js, which a page loads with
// <script type="module" src="..."> from assetUrl({ path: "wsutil/xp-websocket.js" }).

import type { IoInterface, RpcClient, RpcMethods, WebSocketEventType } from "../../lib/wsutil/types";
import { WebSocketClient } from "./client";

export type { IoInterface, RpcClient, RpcContext, RpcMethods, WebSocketEventType } from "../../lib/wsutil/types";
export type { ClientEventHandler } from "./client";
export { WebSocketClient };

/**
 * The events `<xp-websocket>` dispatches, and what they carry in `detail`
 */
export interface XpWebSocketEventMap {
  "ws:open": CustomEvent<Event>;
  /**
   * The message, parsed as JSON. A message that is not JSON is passed on as a string
   */
  "ws:message": CustomEvent<unknown>;
  "ws:close": CustomEvent<CloseEvent>;
  "ws:error": CustomEvent<Event>;
}

/**
 * `<xp-websocket src="...">`: a connection to the websocket service at `src`, the `ws://` or `wss://` url from
 * `serviceUrl({ service, type: "websocket" })`. It connects when it is added to the page, and closes the
 * connection when it is removed, like `<turbo-stream-source>`.
 *
 * The events of the connection are dispatched on the element as `ws:open`, `ws:message`, `ws:close` and
 * `ws:error`, and bubble. `ws:message` carries the message, JSON-parsed, in `event.detail`; the others carry the
 * event of the WebSocket.
 *
 * @example
 * <script type="module" src="[assetUrl({ path: 'wsutil/xp-websocket.js' })]"></script>
 * <xp-websocket src="[serviceUrl({ service: 'websocket', type: 'websocket' })]"></xp-websocket>
 *
 * <script type="module">
 *   const socket = document.querySelector("xp-websocket");
 *   socket.addEventListener("ws:message", (event) => console.log(event.detail));
 *   socket.send({ hello: "server" });
 * </script>
 */
export class XpWebSocketElement extends HTMLElement {
  static readonly observedAttributes = ["src"];

  /**
   * The `WebSocketClient` behind the element
   */
  readonly client = new WebSocketClient();

  // The url the element has connected to, so that the upgrade of an element in the page, which runs
  // attributeChangedCallback and then connectedCallback, connects once
  private activeSrc: string | undefined;

  constructor() {
    super();

    const dispatch = (type: WebSocketEventType, detail: unknown) =>
      this.dispatchEvent(new CustomEvent(`ws:${type}`, { detail, bubbles: true }));

    this.client.setEventHandlers({
      open: (event) => dispatch("open", event),
      close: (event) => dispatch("close", event),
      error: (event) => dispatch("error", event),
      message: (message) => dispatch("message", message),
    });
  }

  /**
   * The url of the websocket service. Changing it while the element is in the page reconnects.
   */
  get src(): string {
    return this.getAttribute("src") ?? "";
  }

  set src(url: string) {
    this.setAttribute("src", url);
  }

  /**
   * `true` while the connection is open. (`isConnected` is the DOM's: whether the element is in the page.)
   */
  get connected(): boolean {
    return this.client.isConnected;
  }

  /**
   * Named events to and from the server's `SocketEmitter`
   */
  get io(): IoInterface {
    return this.client.Io();
  }

  /**
   * Sends a message to the server. Objects are serialized to JSON.
   */
  send(message: unknown): void {
    this.client.send(message);
  }

  /**
   * The methods registered with `socket.rpc()` on the server, as async functions: `rpc<typeof api>()`
   */
  rpc<Api extends RpcMethods>(): RpcClient<Api> {
    return this.client.rpc<Api>();
  }

  /**
   * Opens the connection to `src`, closing an open one first. Called when the element is added to the page.
   */
  connect(): void {
    this.activeSrc = this.src;
    this.client.setUrl(this.src, true);
  }

  /**
   * Closes the connection. Called when the element is removed from the page.
   */
  close(): void {
    this.activeSrc = undefined;
    this.client.close();
  }

  connectedCallback(): void {
    if (this.src && this.src !== this.activeSrc) this.connect();
  }

  disconnectedCallback(): void {
    this.close();
  }

  attributeChangedCallback(name: string, _oldValue: string | null, newValue: string | null): void {
    if (name === "src" && this.isConnected && newValue && newValue !== this.activeSrc) {
      this.connect();
    }
  }
}

if (!customElements.get("xp-websocket")) {
  customElements.define("xp-websocket", XpWebSocketElement);
}
