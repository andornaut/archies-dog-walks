import { createModalInputGate } from "@andornaut/game-kit/runtime/input/modalInput";
import { createModalLayer } from "@andornaut/game-kit/runtime/web/ui/dom/modalLayer";

import { createPressAdmission } from "../pressAdmission.ts";
import type { UiLayer } from "../ui/dom/uiLayer.ts";
import type { DomScale } from "../ui/domScale.ts";

// A fake of the few DOM members the HTML interface's panels use, for tests without a browser.

type Listener = (event: FakeEvent) => void;

export interface FakeEvent {
  buttons?: number;
  cancelBubble?: boolean;
  key?: string;
  type?: string;
  button?: number;
  isPrimary?: boolean;
  relatedTarget?: unknown;
  stopImmediatePropagation?: () => void;
  clientX?: number;
  clientY?: number;
  detail?: number;
  timeStamp?: number;
  code?: string;
  pointerId?: number;
  repeat?: boolean;
  shiftKey?: boolean;
  target?: unknown;
  preventDefault?: () => void;
  stopPropagation?: () => void;
}

export class FakeTarget {
  readonly listeners = new Map<string, Listener[]>();

  addEventListener(type: string, listener: Listener): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  removeEventListener(type: string, listener: Listener): void {
    this.listeners.set(
      type,
      (this.listeners.get(type) ?? []).filter((each) => each !== listener),
    );
  }

  fire(type: string, event: FakeEvent = {}): void {
    event.preventDefault ??= () => undefined;
    event.stopImmediatePropagation ??= () => undefined;
    event.stopPropagation ??= () => undefined;
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }
}

// The few DOM members the menu uses.
export class FakeElement extends FakeTarget {
  readonly attributes = new Map<string, string>();
  children: FakeElement[] = [];
  className = "";
  readonly classList = {
    add: (...names: string[]) => {
      this.className = [...new Set([...this.className.split(" ").filter(Boolean), ...names])].join(
        " ",
      );
    },
    contains: (name: string) => this.className.split(" ").includes(name),
    remove: (...names: string[]) => {
      this.className = this.className
        .split(" ")
        .filter((name) => name !== "" && !names.includes(name))
        .join(" ");
    },
    toggle: (name: string, on: boolean) => {
      if (on) {
        this.classList.add(name);
      } else {
        this.classList.remove(name);
      }
    },
  };
  disabled = false;
  inert = false;
  hidden = false;
  id = "";
  namespaceURI: string | null = null;
  parent: FakeElement | undefined;
  readonly style = (() => {
    const priorities = new Map<string, string>();
    const property = (name: string) =>
      name.startsWith("--")
        ? name
        : name.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
    const values = Object.create(null) as Record<string, string>;
    return Object.assign(values, {
      getPropertyPriority: (name: string) => priorities.get(name) ?? "",
      getPropertyValue: (name: string) => values[property(name)] ?? "",
      removeProperty: (name: string) => {
        const previous = values[property(name)] ?? "";
        delete values[property(name)];
        priorities.delete(name);
        return previous;
      },
      setProperty: (name: string, value: string, priority = "") => {
        values[property(name)] = value;
        priorities.set(name, priority);
      },
    });
  })();
  textContent = "";
  type = "";
  readonly ownerDocument: FakeDocument;
  readonly tagName: string;
  tabIndex: number;

  constructor(ownerDocument: FakeDocument, tagName: string) {
    super();
    this.ownerDocument = ownerDocument;
    this.tagName = tagName;
    this.tabIndex = tagName.toLowerCase() === "button" ? 0 : -1;
  }

  append(...nodes: FakeElement[]): void {
    for (const node of nodes) {
      node.remove();
      node.parent = this;
      this.children.push(node);
    }
  }

  replaceChildren(...nodes: FakeElement[]): void {
    for (const child of [...this.children]) {
      child.remove();
    }
    for (const node of nodes) {
      node.remove();
      this.append(node);
    }
  }

  get firstElementChild(): FakeElement | null {
    return this.children[0] ?? null;
  }

  get nextElementSibling(): FakeElement | null {
    const siblings = this.parent?.children ?? [];
    return siblings[siblings.indexOf(this) + 1] ?? null;
  }

  // Moves node before ref, or to the end with none, counting the move on the document.
  insertBefore(node: FakeElement, ref: FakeElement | null): void {
    node.remove();
    node.parent = this;
    const at = ref === null ? -1 : this.children.indexOf(ref);
    this.children.splice(at < 0 ? this.children.length : at, 0, node);
    this.ownerDocument.moves += 1;
  }

  blur(): void {
    if (this.ownerDocument.activeElement === this) {
      this.ownerDocument.activeElement = null;
    }
  }

  get isConnected(): boolean {
    return this === this.ownerDocument.body || this.parent?.isConnected === true;
  }

  get parentElement(): FakeElement | null {
    return this.parent ?? null;
  }

  matches(selector: string): boolean {
    return selector.split(",").some((entry) => {
      const part = entry.trim();
      if (part === "button:not([disabled])") {
        return this.tagName.toLowerCase() === "button" && !this.disabled;
      }
      if (part === "[tabindex]") {
        return this.tabIndex >= 0;
      }
      if (part === ":disabled") {
        return this.disabled || this.attributes.has("disabled");
      }
      if (part === "[inert]") {
        return this.inert || this.attributes.has("inert");
      }
      if (part === "[hidden]") {
        return this.hidden || this.attributes.has("hidden");
      }
      if (part.startsWith(".")) {
        return this.classList.contains(part.slice(1));
      }
      return part === this.tagName.toLowerCase();
    });
  }

  closest(selector: string): FakeElement | null {
    if (this.matches(selector)) {
      return this;
    }
    return this.parentElement?.closest(selector) ?? null;
  }

  hasAttribute(name: string): boolean {
    return (
      this.attributes.has(name) ||
      (name === "inert" && this.inert) ||
      (name === "hidden" && this.hidden)
    );
  }

  querySelectorAll(selector: string): FakeElement[] {
    return this.all().filter((element) => element.matches(selector));
  }

  contains(node: unknown): boolean {
    return node === this || this.children.some((child) => child.contains(node));
  }

  focus(): void {
    this.ownerDocument.activeElement = this;
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  hasPointerCapture(): boolean {
    return false;
  }

  remove(): void {
    if (this.parent !== undefined) {
      this.parent.children = this.parent.children.filter((child) => child !== this);
      this.parent = undefined;
    }
  }

  removeAttribute(name: string): void {
    this.attributes.delete(name);
    if (name === "inert") {
      this.inert = false;
    }
  }

  toggleAttribute(name: string, force?: boolean): boolean {
    const present = force ?? !this.hasAttribute(name);
    if (present) {
      this.setAttribute(name, "");
    } else {
      this.removeAttribute(name);
    }
    return present;
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
    if (name === "inert") {
      this.inert = true;
    }
  }

  // Every element under this one, depth first.
  all(): FakeElement[] {
    return this.children.flatMap((child) => [child, ...child.all()]);
  }
}

// Listens as a document does, for the kit's input-modality tracking.
export class FakeDocument extends FakeTarget {
  // As a document with nothing focused may report, null rather than undefined.
  activeElement: FakeElement | null = null;
  // How many times an element was moved by insertBefore.
  moves = 0;
  // Timers never fire: a test sees what a timer would undo still in place.
  readonly body = this.createElement("body");
  hidden = false;
  readonly defaultView = Object.assign(new FakeTarget(), {
    HTMLElement: FakeElement,
    MutationObserver: class {
      observe(): void {}
      disconnect(): void {}
    },
    Node: FakeElement,
    clearTimeout: (timer?: number) => {
      void timer;
    },
    performance: { now: () => 0 },
    setTimeout: (callback: () => void, delay?: number) => {
      void callback;
      void delay;
      return 0;
    },
  });

  createElement(tagName: string): FakeElement {
    return new FakeElement(this, tagName);
  }

  createElementNS(namespace: string | null, tagName: string): FakeElement {
    const element = this.createElement(tagName);
    element.namespaceURI = namespace;
    return element;
  }
}

// The views mounted in a layer element, in order: a modal view in place of the host that holds
// its backdrop and companions.
export function layerViews(element: FakeElement): FakeElement[] {
  return element.children.flatMap((child) =>
    child.className === "adw-modal-host"
      ? (child.children[1]?.children.slice(0, 1) ?? [])
      : [child],
  );
}

// A layer over doc's fake element at scale.
export function fakeLayer(
  doc: FakeDocument,
  scale: DomScale,
): { element: FakeElement; layer: UiLayer } {
  const element = doc.createElement("div");
  doc.body.append(element);
  const layer = {
    assetStatus: () => "ready",
    buttonSkin: { apply: () => Promise.resolve([]), frames: Promise.resolve(new Map()) },
    dispose: () => undefined,
    element,
    failedAssets: () => [],
    fontStatus: () => "ready",
    input: createModalInputGate(),
    modal: createModalLayer(element as unknown as HTMLElement),
    onReady: () => () => undefined,
    onScale: () => () => undefined,
    press: createPressAdmission(() => false),
    ready: () => true,
    requireAssets: () => undefined,
    retryAssets: () => undefined,
    retryFonts: () => undefined,
    reveal: () => ({ cancel: () => undefined, revealed: Promise.resolve(true) }),
    scale: () => scale,
    update: () => undefined,
  } as unknown as UiLayer;
  return { element, layer };
}
