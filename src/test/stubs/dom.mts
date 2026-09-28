// The browser globals the client library uses at module load, which Node does not have. Imported before the
// client library, so that `class XpWebSocketElement extends HTMLElement` and `customElements.define()` work.

/**
 * A WebSocket that records what is sent, and lets the test fire the events
 */
export class FakeWebSocket {
  static instances: FakeWebSocket[] = [];

  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  readonly sent: string[] = [];
  readonly url: string;
  opened = false;
  closed = false;

  constructor(url: string) {
    this.url = url;
    FakeWebSocket.instances.push(this);
  }

  send(message: string): void {
    // Like a browser's WebSocket, which throws an InvalidStateError while it is still connecting
    if (!this.opened) throw new Error("InvalidStateError: the connection has not been opened");
    this.sent.push(message);
  }

  open(): void {
    this.opened = true;
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

/**
 * Just enough of HTMLElement for a custom element: attributes, and whether it is in the page. The test drives the
 * lifecycle callbacks itself, see `addToPage()` and `removeFromPage()` in client.test.mts.
 */
export class FakeHTMLElement extends EventTarget {
  isConnected = false;
  private readonly attributes = new Map<string, string>();

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  setAttribute(name: string, value: string): void {
    const oldValue = this.getAttribute(name);
    this.attributes.set(name, String(value));
    (
      this as { attributeChangedCallback?: (n: string, o: string | null, v: string | null) => void }
    ).attributeChangedCallback?.(name, oldValue, String(value));
  }
}

const registry = new Map<string, CustomElementConstructor>();

Object.defineProperty(globalThis, "WebSocket", { value: FakeWebSocket, writable: true, configurable: true });
Object.defineProperty(globalThis, "HTMLElement", { value: FakeHTMLElement, writable: true, configurable: true });
Object.defineProperty(globalThis, "customElements", {
  value: {
    define: (name: string, ctor: CustomElementConstructor) => registry.set(name, ctor),
    get: (name: string) => registry.get(name),
  },
  writable: true,
  configurable: true,
});
