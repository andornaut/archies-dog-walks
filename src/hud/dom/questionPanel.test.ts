import { describe, expect, it, vi } from "vitest";

import { gameData } from "../../data/index.ts";
import { SCREEN_LAYOUT } from "../../data/screen.ts";
import { gameFont } from "../../testing/fontInk.ts";
import type { UiLayer } from "../../ui/dom/uiLayer.ts";
import { domScale } from "../../ui/domScale.ts";
import { PAUSE_MENU_ITEMS, pauseMenuLayout } from "../pauseMenu.ts";
import { type PanelMeasure, questionPanelView } from "../questionPanelView.ts";
import { showQuestionPanel } from "./questionPanel.ts";

type Listener = (event: FakeEvent) => void;

interface FakeEvent {
  buttons?: number;
  clientX?: number;
  clientY?: number;
  key?: string;
  pointerId?: number;
  repeat?: boolean;
  shiftKey?: boolean;
  preventDefault?: () => void;
  stopPropagation?: () => void;
}

class FakeTarget {
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
class FakeElement extends FakeTarget {
  readonly attributes = new Map<string, string>();
  children: FakeElement[] = [];
  className = "";
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

class FakeDocument {
  activeElement: FakeElement | undefined;
  readonly defaultView = new FakeTarget();

  createElement(tagName: string): FakeElement {
    return new FakeElement(this, tagName);
  }
}

const MEASURE: PanelMeasure = {
  body: { capHeight: 6, capTop: 2, inkBottom: 9, letterTop: 1, lineHeight: 10 },
  inkWidth: (_font, line) => line.length * 12,
  title: { capHeight: 5, capTop: 4, inkBottom: 10, letterTop: 2, lineHeight: 12 },
  wrapNote: (_width, text) => [text],
};

function menu() {
  const doc = new FakeDocument();
  const element = doc.createElement("div");
  const layer = {
    element,
    onScale: () => () => undefined,
    ready: () => true,
    scale: () => domScale(2, { height: 560, width: 360, x: 0, y: 0 }),
    update: () => undefined,
  } as unknown as UiLayer;
  const words = gameData.menuText.pause;
  const presses = PAUSE_MENU_ITEMS.map(() => vi.fn());
  const close = vi.fn();
  const view = questionPanelView(MEASURE, SCREEN_LAYOUT.walkView, {
    labels: PAUSE_MENU_ITEMS.map((item) => words[item]),
    layout: pauseMenuLayout,
    note: [{ colour: 0, text: "Ending now keeps $5 of $9." }],
    sentenceLines: true,
    title: words.title,
  });
  const shown = showQuestionPanel(layer, {
    close,
    closeLabel: words.close,
    fonts: { body: gameFont("font-body"), title: gameFont("font-title") },
    presses,
    toGame: (point) => point,
    view,
  });
  const [dialog] = element.children;
  if (dialog === undefined) {
    throw new Error("The menu added no dialog");
  }
  const buttons = dialog.all().filter((node) => node.tagName === "button");
  return { buttons, close, dialog, doc, presses, shown, words };
}

describe("the HTML pause menu", () => {
  it("is a modal dialog named by its title and described by its note", () => {
    const { dialog, words } = menu();
    expect(dialog.getAttribute("role")).toBe("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    const title = dialog.all().find((node) => node.id === dialog.getAttribute("aria-labelledby"));
    expect(title?.tagName).toBe("h2");
    expect(title?.getAttribute("aria-label")).toBe(words.title);
    const note = dialog.all().find((node) => node.id === dialog.getAttribute("aria-describedby"));
    expect(note?.tagName).toBe("p");
  });

  it("names its buttons in order, with their keys, then the close control", () => {
    const { buttons, words } = menu();
    expect(buttons.map((button) => button.getAttribute("aria-label"))).toEqual([
      ...PAUSE_MENU_ITEMS.map((item) => words[item]),
      words.close,
    ]);
    expect(buttons.slice(0, -1).map((button) => button.getAttribute("aria-keyshortcuts"))).toEqual([
      "1",
      "2",
      "3",
      "4",
    ]);
  });

  it("presses a button on a click or its number key, never on a held key's repeat or while hidden", () => {
    const { buttons, close, doc, presses, shown } = menu();
    buttons[1]?.fire("click");
    expect(presses[1]).toHaveBeenCalledOnce();
    buttons.at(-1)?.fire("click");
    expect(close).toHaveBeenCalledOnce();
    doc.defaultView.fire("keydown", { key: "3", repeat: false });
    expect(presses[2]).toHaveBeenCalledOnce();
    doc.defaultView.fire("keydown", { key: "4", repeat: true });
    shown.setShown(false);
    doc.defaultView.fire("keydown", { key: "4", repeat: false });
    expect(presses[3]).not.toHaveBeenCalled();
    shown.destroy();
    doc.defaultView.fire("keydown", { key: "1", repeat: false });
    expect(presses[0]).not.toHaveBeenCalled();
  });

  it("focuses itself, so no button shows a ring until Tab, then keeps Tab among its controls", () => {
    const { buttons, dialog, doc, shown } = menu();
    expect(doc.activeElement).toBe(dialog);
    const tab = (shiftKey: boolean) =>
      dialog.fire("keydown", { key: "Tab", preventDefault: () => undefined, shiftKey });
    tab(false);
    expect(doc.activeElement).toBe(buttons[0]);
    tab(true);
    expect(doc.activeElement).toBe(buttons.at(-1));
    tab(false);
    expect(doc.activeElement).toBe(buttons[0]);
    shown.setShown(false);
    expect(doc.activeElement).toBeUndefined();
    shown.setShown(true);
    expect(doc.activeElement).toBe(dialog);
    dialog.blur();
    tab(true);
    expect(doc.activeElement).toBe(buttons.at(-1));
  });

  it("keeps a press that lands on it from Phaser, and shows a button pressed while held", () => {
    const { buttons, dialog } = menu();
    for (const type of ["mousedown", "touchstart"]) {
      const stopPropagation = vi.fn();
      dialog.fire(type, { stopPropagation });
      expect(stopPropagation, type).toHaveBeenCalledOnce();
    }
    const button = buttons[0];
    button?.fire("pointerdown", { clientX: 100, clientY: 300, pointerId: 1 });
    expect(button?.getAttribute("data-pressed")).toBe("");
    button?.fire("pointerleave");
    expect(button?.getAttribute("data-pressed")).toBeNull();
  });
});
