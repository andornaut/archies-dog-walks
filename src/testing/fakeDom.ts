import type { UiLayer } from "../ui/dom/uiLayer.ts";
import type { DomScale } from "../ui/domScale.ts";

// A fake of the few DOM members the HTML interface's panels use, for tests without a browser.

type Listener = (event: FakeEvent) => void;

export interface FakeEvent {
  buttons?: number;
  clientX?: number;
  clientY?: number;
  key?: string;
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
  };
  hidden = false;
  id = "";
  parent: FakeElement | undefined;
  readonly style = Object.assign(Object.create(null) as Record<string, string>, {
    setProperty: () => undefined,
  });
  textContent = "";
  type = "";
  readonly ownerDocument: FakeDocument;
  readonly tagName: string;

  constructor(ownerDocument: FakeDocument, tagName: string) {
    super();
    this.ownerDocument = ownerDocument;
    this.tagName = tagName;
  }

  append(...nodes: FakeElement[]): void {
    for (const node of nodes) {
      node.parent = this;
      this.children.push(node);
    }
  }

  blur(): void {
    if (this.ownerDocument.activeElement === this) {
      this.ownerDocument.activeElement = undefined;
    }
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
    }
  }

  removeAttribute(name: string): void {
    this.attributes.delete(name);
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  // Every element under this one, depth first.
  all(): FakeElement[] {
    return this.children.flatMap((child) => [child, ...child.all()]);
  }
}

export class FakeDocument {
  activeElement: FakeElement | undefined;
  // Timers never fire: a test sees what a timer would undo still in place.
  readonly defaultView = Object.assign(new FakeTarget(), { setTimeout: () => 0 });

  createElement(tagName: string): FakeElement {
    return new FakeElement(this, tagName);
  }
}

// A layer over doc's fake element at scale.
export function fakeLayer(
  doc: FakeDocument,
  scale: DomScale,
): { element: FakeElement; layer: UiLayer } {
  const element = doc.createElement("div");
  const layer = {
    element,
    onScale: () => () => undefined,
    ready: () => true,
    scale: () => scale,
    update: () => undefined,
  } as unknown as UiLayer;
  return { element, layer };
}
