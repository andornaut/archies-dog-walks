import { describe, expect, it, vi } from "vitest";

import { gameData } from "../../data/index.ts";
import { SCREEN_LAYOUT } from "../../data/screen.ts";
import { FakeDocument } from "../../testing/fakeDom.ts";
import { gameFont } from "../../testing/fontInk.ts";
import type { UiLayer } from "../../ui/dom/uiLayer.ts";
import { domScale } from "../../ui/domScale.ts";
import { inPill } from "../../ui/namePills.ts";
import { PAUSE_MENU_ITEMS, pauseMenuLayout } from "../pauseMenu.ts";
import {
  modalCardView,
  panelButton,
  type PanelMeasure,
  questionPanelView,
} from "../questionPanelView.ts";
import { showZoneCelebration } from "./celebration.ts";
import { showDetailCard } from "./detailCard.ts";
import { showQuestionPanel } from "./questionPanel.ts";

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
    closeLabel: gameData.menuText.common.close,
    fonts: { body: gameFont("font-body"), title: gameFont("font-title") },
    numberKeys: true,
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
      gameData.menuText.common.close,
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

  it("dimmed under another's shade, shows but takes no number keys and no focus", () => {
    const { dialog, doc, presses, shown } = menu();
    shown.setShown(false);
    shown.setInert(true);
    shown.setShown(true);
    expect(dialog.className).toContain("adw-inert");
    expect(doc.activeElement).toBeUndefined();
    doc.defaultView.fire("keydown", { key: "1", repeat: false });
    expect(presses[0]).not.toHaveBeenCalled();
    shown.setInert(false);
    doc.defaultView.fire("keydown", { key: "1", repeat: false });
    expect(presses[0]).toHaveBeenCalledOnce();
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

describe("an HTML modal card", () => {
  it("wears the detail card's frame with no rim, and its number keys press nothing", () => {
    const doc = new FakeDocument();
    const element = doc.createElement("div");
    const layer = {
      element,
      onScale: () => () => undefined,
      ready: () => true,
      scale: () => domScale(2, { height: 560, width: 360, x: 0, y: 0 }),
      update: () => undefined,
    } as unknown as UiLayer;
    const card = { height: 104, width: 280, x: 40, y: 200 };
    const update = vi.fn();
    const words = gameData.homeText.update;
    showQuestionPanel(layer, {
      close: vi.fn(),
      closeLabel: gameData.menuText.common.close,
      fonts: { body: gameFont("font-body"), title: gameFont("font-title") },
      numberKeys: false,
      presses: [update],
      toGame: (point) => point,
      view: modalCardView(MEASURE, card, words.title, [
        { label: words.button, primary: true, rect: { height: 44, width: 200, x: 80, y: 252 } },
      ]),
    });
    const parts = element.all().map(({ className }) => className);
    expect(parts).toContain("adw-card");
    expect(parts).not.toContain("adw-rim");
    doc.defaultView.fire("keydown", { key: "1", repeat: false });
    expect(update).not.toHaveBeenCalled();
    element
      .all()
      .find((node) => node.getAttribute("aria-label") === words.button)
      ?.fire("click");
    expect(update).toHaveBeenCalledOnce();
  });
});

describe("an HTML detail card that takes no presses", () => {
  it("lets every press through, shows its close control as a picture and its art once loaded", async () => {
    const doc = new FakeDocument();
    const element = doc.createElement("div");
    const layer = {
      element,
      onScale: () => () => undefined,
      ready: () => true,
      scale: () => domScale(2, { height: 560, width: 360, x: 0, y: 0 }),
      update: () => undefined,
    } as unknown as UiLayer;
    const card = { height: 120, width: 280, x: 40, y: 200 };
    const sheet = {
      frames: {
        a: { frame: { h: 32, w: 32, x: 0, y: 0 } },
        b: { frame: { h: 32, w: 32, x: 32, y: 0 } },
      },
      meta: { frameTags: [{ from: 1, name: "neutral" }], size: { h: 32, w: 64 } },
    };
    const line = `${inPill(0, "Keen eye")} Spots more`;
    showDetailCard(layer, {
      artUrl: (path) => `/art/${path}`,
      close: undefined,
      closeLabel: gameData.menuText.common.close,
      fonts: { body: gameFont("font-body"), title: gameFont("font-title") },
      loadSheet: () => Promise.resolve(sheet),
      pillColours: () => ({ name: 0x112233, pill: 0x445566 }),
      toGame: (point) => point,
      view: {
        art: [
          {
            key: "face",
            scale: 1,
            sheet: { tag: "neutral" },
            size: { height: 32, width: 32 },
            x: 60,
            y: 240,
          },
        ],
        card: modalCardView(MEASURE, card, "Casey", []),
        framed: [],
        texts: [{ capTop: 280, colour: 0, lines: [line], x: 52 }],
        title: "Casey",
      },
    });
    const [dialog] = element.children;
    const nodes = dialog?.all() ?? [];
    expect(dialog?.className).toContain("adw-passive");
    expect(dialog?.listeners.has("mousedown")).toBe(false);
    expect(nodes.some((node) => node.tagName === "button")).toBe(false);
    const close = nodes.find((node) => node.className === "adw-close");
    expect([close?.tagName, close?.getAttribute("aria-hidden")]).toEqual(["span", "true"]);
    dialog?.fire("keydown", { key: "Tab", preventDefault: () => undefined, shiftKey: false });
    expect(doc.activeElement).toBe(dialog);
    const described = nodes.find((node) => node.id === dialog?.getAttribute("aria-describedby"));
    const spoken = described?.all().find((node) => node.className === "adw-spoken");
    expect(spoken?.textContent).toBe("Keen eye Spots more ");
    const art = nodes.find((node) => node.className === "adw-art");
    expect(art?.style.visibility).toBe("hidden");
    await Promise.resolve();
    await Promise.resolve();
    expect(art?.style.visibility).toBe("");
    // An art pixel is 2 device pixels at DPR 2, and the tag's frame starts 32 art pixels in.
    expect(art?.style.backgroundPosition).toBe("-64px 0px");
  });
});

describe("an HTML panel's part controls", () => {
  it("come first in Tab's order and tell the scene where focus moves, which it can move", () => {
    const doc = new FakeDocument();
    const element = doc.createElement("div");
    const layer = {
      element,
      onScale: () => () => undefined,
      ready: () => true,
      scale: () => domScale(2, { height: 560, width: 360, x: 0, y: 0 }),
      update: () => undefined,
    } as unknown as UiLayer;
    const rows = [doc.createElement("div"), doc.createElement("div")];
    const focused: (number | undefined)[] = [];
    const shown = showQuestionPanel(layer, {
      close: vi.fn(),
      closeLabel: gameData.menuText.common.close,
      fonts: { body: gameFont("font-body"), title: gameFont("font-title") },
      numberKeys: false,
      onFocus: (index) => focused.push(index),
      parts: [
        {
          controls: rows as unknown as HTMLElement[],
          element: doc.createElement("div") as unknown as HTMLElement,
          place: () => undefined,
        },
      ],
      presses: [],
      toGame: (point) => point,
      view: modalCardView(MEASURE, { height: 120, width: 280, x: 40, y: 200 }, "Settings", []),
    });
    const [dialog] = element.children;
    const tab = () =>
      dialog?.fire("keydown", { key: "Tab", preventDefault: () => undefined, shiftKey: false });
    tab();
    expect(doc.activeElement).toBe(rows[0]);
    // Enter on a part's control goes through to the scene, which presses what its focus is on.
    const stopPropagation = vi.fn();
    dialog?.fire("keydown", { key: "Enter", stopPropagation, target: rows[0] });
    expect(stopPropagation).not.toHaveBeenCalled();
    shown.focusControl(1);
    expect(doc.activeElement).toBe(rows[1]);
    dialog?.fire("focusin", { target: rows[1] });
    dialog?.fire("focusin", { target: dialog });
    expect(focused).toEqual([1, undefined]);
  });
});

describe("an HTML zone celebration", () => {
  it("draws its plate, its line's runs once each in their colours, and its button, with no close control", () => {
    const doc = new FakeDocument();
    const element = doc.createElement("div");
    const layer = {
      element,
      onScale: () => () => undefined,
      ready: () => true,
      scale: () => domScale(2, { height: 560, width: 360, x: 0, y: 0 }),
      update: () => undefined,
    } as unknown as UiLayer;
    const press = vi.fn();
    const plate = { height: 26, width: 160, x: 100, y: 300 };
    const rect = { height: 44, width: 120, x: 120, y: 334 };
    const button = panelButton(MEASURE, rect, true, "Onward!");
    showZoneCelebration(layer, {
      artUrl: (path) => `/art/${path}`,
      closeLabel: gameData.menuText.common.close,
      fonts: { body: gameFont("font-body"), title: gameFont("font-title") },
      label: "Well walked! High Park",
      loadSheet: () => Promise.reject(new Error("no sheets")),
      pillColours: () => undefined,
      press,
      toGame: (point) => point,
      view: {
        art: [],
        button: { ...button, key: { ...button.text, text: "1" } },
        frame: { key: "ui-panel", rect: plate },
        rows: [],
        rule: undefined,
        texts: [
          {
            align: "centre",
            capTop: 308,
            colour: 0x3e2731,
            lines: ["+$12 pay"],
            spans: [
              { colour: 0x265c42, text: "+$12" },
              { colour: 0x3e2731, text: " pay" },
            ],
            x: 180,
          },
        ],
      },
    });
    const [dialog] = element.children;
    const nodes = dialog?.all() ?? [];
    expect(nodes.some((node) => node.className === "adw-close")).toBe(false);
    expect(nodes.some((node) => node.className === "adw-plate-frame")).toBe(true);
    const title = nodes.find((node) => node.id === dialog?.getAttribute("aria-labelledby"));
    expect(title?.getAttribute("aria-label")).toBe("Well walked! High Park");
    const control = nodes.find((node) => node.tagName === "button");
    expect(control?.all().filter((node) => node.className.includes("adw-text"))).toHaveLength(2);
    const earnings = nodes.find((node) => node.tagName === "p");
    expect(
      earnings?.children
        .filter((node) => node.className.includes("adw-text"))
        .map((node) => [node.textContent, node.style.color]),
    ).toEqual([
      ["+$12", "#265c42"],
      [" pay", "#3e2731"],
    ]);
    expect(dialog?.listeners.has("mousedown")).toBe(true);
    control?.fire("click");
    expect(press).toHaveBeenCalledOnce();
    doc.defaultView.fire("keydown", { key: "1", repeat: false });
    expect(press).toHaveBeenCalledOnce();
  });
});
