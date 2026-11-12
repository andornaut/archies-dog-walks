import { describe, expect, it, vi } from "vitest";

import { FakeDocument, type FakeElement, fakeLayer } from "../testing/fakeDom.ts";
import { gameFont } from "../testing/fontInk.ts";
import { domScale } from "../ui/domScale.ts";
import { addHtmlMirror } from "./htmlMirror.ts";

const EVENTS = vi.hoisted(() => ({ preRender: "prerender", shutdown: "shutdown" }));
const place = vi.hoisted(() => ({ value: undefined as unknown }));

vi.mock("phaser", () => ({
  Core: { Events: { PRE_RENDER: EVENTS.preRender } },
  Scenes: { Events: { SHUTDOWN: EVENTS.shutdown } },
}));
vi.mock("../assets/artFiles.ts", () => ({ artUrl: (path: string) => path }));
vi.mock("../ui/phaser/displayText.ts", () => ({ displayBitmapFont: () => undefined }));
vi.mock("./questionPanel.ts", () => ({ htmlPanelPlace: () => place.value }));

type Listener = () => void;

// Phaser's event emitters as far as the mirror uses them.
function emitter() {
  const listeners = new Map<string, Set<Listener>>();
  const off = (type: string, listener: Listener) => listeners.get(type)?.delete(listener);
  const on = (type: string, listener: Listener) => {
    listeners.set(type, (listeners.get(type) ?? new Set()).add(listener));
  };
  return {
    emit: (type: string) => [...(listeners.get(type) ?? [])].forEach((listener) => listener()),
    off,
    on,
    once: (type: string, listener: Listener) => {
      const once = () => {
        off(type, once);
        listener();
      };
      on(type, once);
    },
  };
}

// A filled rectangle as the mirror reads one.
function rectangle(x: number) {
  return {
    active: true,
    alpha: 1,
    cameraFilter: 0,
    data: null,
    displayOriginX: 0,
    displayOriginY: 0,
    fillAlpha: 1,
    fillColor: 0x112233,
    height: 4,
    isFilled: true,
    type: "Rectangle",
    visible: true,
    width: 4,
    x,
    y: 0,
  };
}

function mirrored(roots: () => readonly unknown[] = () => []) {
  const doc = new FakeDocument();
  const { element, layer } = fakeLayer(doc, domScale(2, { height: 560, width: 360, x: 0, y: 0 }));
  place.value = { fonts: { body: gameFont("font-body"), title: gameFont("font-title") }, layer };
  const state = { active: true, pageOver: false };
  const events = emitter();
  const game = emitter();
  const scene = {
    cache: { json: { get: () => undefined } },
    cameras: { main: { ignore: () => undefined } },
    events,
    game: { events: game },
    sys: { isActive: () => state.active, isVisible: () => true },
  };
  const mirror = addHtmlMirror(scene as never, roots as never, () => state.pageOver);
  const dialogs = () => element.children.filter((child: FakeElement) => child.className !== "");
  return { dialogs, doc, events, game, mirror, state };
}

describe("the HTML mirror", () => {
  it("draws a dialog that takes no presses, focus or screen reader while its scene runs", () => {
    const { dialogs, game } = mirrored();
    game.emit(EVENTS.preRender);
    const [dialog] = dialogs();
    expect(dialog?.className).toBe("adw-dialog adw-passive adw-mirror");
    expect(dialog?.getAttribute("aria-hidden")).toBe("true");
    expect(dialog?.getAttribute("tabindex")).toBeNull();
    expect(dialog?.hidden).toBe(false);
  });

  it.each([
    ["its scene is paused under another page", { active: false, pageOver: false }],
    ["a page over its running scene needs the canvas", { active: true, pageOver: true }],
  ])("hides while %s", (_, over) => {
    const { dialogs, game, state } = mirrored();
    Object.assign(state, over);
    game.emit(EVENTS.preRender);
    expect(dialogs()[0]?.hidden).toBe(true);
  });

  it("leaves a part's element alone while nothing it is drawn from changes", () => {
    const part = rectangle(2);
    const { dialogs, doc, game } = mirrored(() => [part]);
    game.emit(EVENTS.preRender);
    const element = dialogs()[0]?.children[0];
    if (element === undefined) {
      throw new Error("The part was not drawn");
    }
    element.style.left = "untouched";
    doc.moves = 0;
    game.emit(EVENTS.preRender);
    expect([element.style.left, doc.moves]).toEqual(["untouched", 0]);
    part.x = 3;
    game.emit(EVENTS.preRender);
    expect(element.style.left).toBe("6px");
  });

  it("moves only the parts out of place when the display order changes", () => {
    const parts = [rectangle(0), rectangle(2), rectangle(4)];
    const { dialogs, doc, game } = mirrored(() => parts);
    game.emit(EVENTS.preRender);
    const [first, second, third] = dialogs()[0]?.children ?? [];
    parts.reverse();
    doc.moves = 0;
    game.emit(EVENTS.preRender);
    expect([dialogs()[0]?.children, doc.moves]).toEqual([[third, second, first], 2]);
  });

  // Starting a walk shuts the start screen down.
  it("leaves nothing in the HTML layer once its scene shuts down", () => {
    const { dialogs, events, game } = mirrored();
    events.emit(EVENTS.shutdown);
    expect(dialogs()).toEqual([]);
    game.emit(EVENTS.preRender);
    expect(dialogs()).toEqual([]);
  });
});
