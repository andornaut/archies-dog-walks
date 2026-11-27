import { fillNames } from "@andornaut/game-kit/runtime/lines";
import { keysOf } from "@andornaut/game-kit/runtime/records";
import { PENDING_ATTRIBUTE } from "@andornaut/game-kit/runtime/web/ui/dom/imageReady";
import { describe, expect, it, vi } from "vitest";

import { gameData } from "../../data/index.ts";
import { SCREEN_LAYOUT } from "../../layout/screen.ts";
import { FakeDocument, fakeLayer, layerViews } from "../../testing/fakeDom.ts";
import { gameFont } from "../../testing/fontInk.ts";
import { artPixel, domScale, gridRect } from "../../ui/domScale.ts";
import { dismissFooter } from "../../ui/modal/dismissFooter.ts";
import { modalTitleInk } from "../../ui/modal/titleRole.ts";
import type { PanelMeasure } from "../../ui/modal/types.ts";
import { modalCardView, panelButton } from "../../ui/modal/view.ts";
import { inPill } from "../../ui/namePills.ts";
import {
  type MenuContext,
  menuItemLabel,
  menuItems,
  PAUSE_MENU_ITEMS,
  pauseMenuItemLabel,
} from "../../ui/navigationMenu.ts";
import { questionPanelView } from "../questionPanelView.ts";
import { showZoneCelebration } from "./celebration.ts";
import { showDetailCard } from "./detailCard.ts";
import { showQuestionPanel } from "./questionPanel.ts";

const MEASURE: PanelMeasure = {
  body: { capHeight: 6, capTop: 2, inkBottom: 9, letterTop: 1, lineHeight: 10 },
  inkWidth: (_font, line) => line.length * 12,
  title: { capHeight: 5, capTop: 4, inkBottom: 10, letterTop: 2, lineHeight: 12 },
  titleInk: (line: string) => modalTitleInk(gameFont("font-title"), line),
  wrapNote: (_width, text) => [text],
};

function menuContext() {
  const doc = new FakeDocument();
  return { doc, ...fakeLayer(doc, domScale(2, { height: 560, width: 360, x: 0, y: 0 })) };
}

function menu(context = menuContext(), customNumbers = false) {
  const { doc, element, layer } = context;
  const words = gameData.menuText.pause;
  const presses = PAUSE_MENU_ITEMS.map(() => vi.fn());
  const close = vi.fn();
  const view = questionPanelView(MEASURE, SCREEN_LAYOUT.walkView, {
    labels: PAUSE_MENU_ITEMS.map((item) => pauseMenuItemLabel(gameData, item)),
    note: [{ colour: 0, text: "Ending now keeps $5 of $9." }],
    primary: "last",
    sentenceLines: true,
    title: words.title,
  });
  const shown = showQuestionPanel(layer, {
    close,
    closeLabel: gameData.menuText.common,
    fonts: { body: gameFont("font-body"), title: gameFont("font-title") },
    numberKeys: true,
    ...(customNumbers
      ? { numberPresses: [presses[4]!, presses[1]!, presses[2]!, presses[3]!, presses[0]!] }
      : {}),
    presses,
    toGame: (point) => point,
    view,
  });
  const [dialog] = layerViews(element);
  if (dialog === undefined) {
    throw new Error("The menu added no dialog");
  }
  const buttons = dialog.all().filter((node) => node.tagName === "button");
  return { buttons, close, dialog, doc, presses, shown, view, words };
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
    const { buttons } = menu();
    expect(buttons.map((button) => button.getAttribute("aria-label"))).toEqual([
      ...PAUSE_MENU_ITEMS.map((item) => pauseMenuItemLabel(gameData, item)),
      gameData.menuText.common.close,
    ]);
    expect(buttons.slice(0, -1).map((button) => button.getAttribute("aria-keyshortcuts"))).toEqual([
      "1",
      "2",
      "3",
      "4",
      "5",
    ]);
  });

  it("presses a button on a click or its number key, never on a held key's repeat or while hidden", () => {
    const { buttons, close, doc, presses, shown } = menu();
    buttons[1]?.fire("click");
    expect(presses[1]).toHaveBeenCalledOnce();
    buttons.at(-1)?.fire("click");
    expect(close).toHaveBeenCalledOnce();
    doc.defaultView.fire("keydown", { code: "Digit3", repeat: false });
    expect(presses[2]).toHaveBeenCalledOnce();
    doc.defaultView.fire("keydown", { code: "Digit4", repeat: true });
    shown.setShown(false);
    doc.defaultView.fire("keydown", { code: "Digit4", repeat: false });
    expect(presses[3]).not.toHaveBeenCalled();
    shown.destroy();
    buttons[0]?.fire("click");
    doc.defaultView.fire("keydown", { code: "Digit1", repeat: false });
    expect(presses[0]).not.toHaveBeenCalled();
  });

  it("keeps a hidden native action omitted until it is explicitly shown again", () => {
    const { buttons, presses, shown } = menu();
    shown.setActionShown(0, false);
    buttons[0]?.fire("click");
    expect(buttons[0]?.hidden).toBe(true);
    expect(presses[0]).not.toHaveBeenCalled();
    shown.setActionShown(0, true);
    buttons[0]?.fire("click");
    expect(buttons[0]?.hidden).toBe(false);
    expect(presses[0]).toHaveBeenCalledOnce();
    shown.destroy();
  });

  it("keeps digit bindings independent of visual action order", () => {
    const { buttons, doc, presses } = menu(undefined, true);
    expect(buttons.slice(0, -1).map((button) => button.getAttribute("aria-keyshortcuts"))).toEqual([
      "5",
      "2",
      "3",
      "4",
      "1",
    ]);
    doc.defaultView.fire("keydown", { code: "Digit1", repeat: false });
    expect(presses[4]).toHaveBeenCalledOnce();
    expect(presses[0]).not.toHaveBeenCalled();
  });

  it("dimmed under another's shade, shows but takes no number keys and no focus", () => {
    const { dialog, doc, presses, shown } = menu();
    shown.setShown(false);
    shown.setInert(true);
    shown.setShown(true);
    expect(dialog.className).toContain("adw-inert");
    expect(doc.activeElement).toBeNull();
    doc.defaultView.fire("keydown", { code: "Digit1", repeat: false });
    expect(presses[0]).not.toHaveBeenCalled();
    shown.setInert(false);
    doc.defaultView.fire("keydown", { code: "Digit1", repeat: false });
    expect(presses[0]).toHaveBeenCalledOnce();
  });

  it("focuses itself, so no button shows a ring until Tab, then keeps Tab among its controls", () => {
    const { buttons, dialog, doc, shown } = menu();
    expect(doc.activeElement).toBe(dialog);
    const tab = (shiftKey: boolean) =>
      dialog.fire("keydown", { code: "Tab", preventDefault: () => undefined, shiftKey });
    tab(false);
    expect(doc.activeElement).toBe(buttons[0]);
    tab(true);
    expect(doc.activeElement).toBe(buttons.at(-1));
    tab(false);
    expect(doc.activeElement).toBe(buttons[0]);
    shown.setShown(false);
    expect(doc.activeElement).toBeNull();
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
    expect(button?.getAttribute("data-ui-pressed")).toBe("");
    button?.fire("pointerleave");
    expect(button?.getAttribute("data-ui-pressed")).toBeNull();
  });
});

it("only activates the top native dialog and restores the original one when it closes", () => {
  const context = menuContext();
  const lower = menu(context);
  const upper = menu(context);
  expect(lower.dialog.inert).toBe(true);
  expect(lower.dialog.getAttribute("aria-hidden")).toBe("true");
  lower.buttons[0]?.fire("click");
  context.doc.defaultView.fire("keydown", { code: "Digit1", repeat: false });
  expect(lower.presses[0]).not.toHaveBeenCalled();
  expect(upper.presses[0]).toHaveBeenCalledOnce();
  upper.shown.destroy();
  expect(lower.dialog.inert).toBe(false);
  lower.buttons[0]?.fire("click");
  expect(lower.presses[0]).toHaveBeenCalledOnce();
  lower.shown.destroy();
});

describe("an HTML modal card", () => {
  it("wears the detail card's frame with no rim, and its number keys press nothing", () => {
    const doc = new FakeDocument();
    const { element, layer } = fakeLayer(doc, domScale(2, { height: 560, width: 360, x: 0, y: 0 }));
    const card = { height: 104, width: 280, x: 40, y: 200 };
    const update = vi.fn();
    const words = gameData.homeText.update;
    showQuestionPanel(layer, {
      close: vi.fn(),
      closeLabel: gameData.menuText.common,
      fonts: { body: gameFont("font-body"), title: gameFont("font-title") },
      numberKeys: false,
      presses: [update],
      toGame: (point) => point,
      view: modalCardView(MEASURE, card, words.title, [
        { label: words.button, primary: true, rect: { height: 44, width: 200, x: 80, y: 252 } },
      ]),
    });
    const parts = element.all();
    const skins = parts.filter((node) => node.classList.contains("adw-card"));
    expect(skins).toHaveLength(1);
    expect(skins[0]?.classList.contains("ui-modal-skin")).toBe(true);
    expect(parts.some((node) => node.classList.contains("adw-rim"))).toBe(false);
    expect(parts.filter((node) => node.getAttribute("role") === "dialog")).toHaveLength(1);
    doc.defaultView.fire("keydown", { code: "Digit1", repeat: false });
    expect(update).not.toHaveBeenCalled();
    element
      .all()
      .find((node) => node.getAttribute("aria-label") === words.button)
      ?.fire("click");
    expect(update).toHaveBeenCalledOnce();
  });
});

describe("an HTML detail card that takes no presses", () => {
  it("lets every press through, draws no close control and shows its art once loaded", async () => {
    const doc = new FakeDocument();
    const { element, layer } = fakeLayer(doc, domScale(2, { height: 560, width: 360, x: 0, y: 0 }));
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
      closeLabel: gameData.menuText.common,
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
    const [dialog] = layerViews(element);
    const nodes = dialog?.all() ?? [];
    expect(dialog?.className).toContain("adw-passive");
    expect(dialog?.listeners.has("mousedown")).toBe(false);
    expect(nodes.some((node) => node.tagName === "button")).toBe(false);
    expect(nodes.some((node) => node.className.includes("adw-close"))).toBe(false);
    dialog?.fire("keydown", { code: "Tab", preventDefault: () => undefined, shiftKey: false });
    expect(doc.activeElement).toBe(dialog);
    const described = nodes.find((node) => node.id === dialog?.getAttribute("aria-describedby"));
    const spoken = described?.all().find((node) => node.className === "visually-hidden");
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
    const { element, layer } = fakeLayer(doc, domScale(2, { height: 560, width: 360, x: 0, y: 0 }));
    const rows = [doc.createElement("div"), doc.createElement("div")];
    const focused: (number | undefined)[] = [];
    const shown = showQuestionPanel(layer, {
      close: vi.fn(),
      closeLabel: gameData.menuText.common,
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
    const [dialog] = layerViews(element);
    const tab = () =>
      dialog?.fire("keydown", { code: "Tab", preventDefault: () => undefined, shiftKey: false });
    tab();
    expect(doc.activeElement).toBe(rows[0]);
    // Enter on a part's control goes through to the scene, which presses what its focus is on.
    const stopPropagation = vi.fn();
    dialog?.fire("keydown", { code: "Enter", stopPropagation, target: rows[0] });
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
    const { element, layer } = fakeLayer(doc, domScale(2, { height: 560, width: 360, x: 0, y: 0 }));
    const press = vi.fn();
    const plate = { height: 26, width: 160, x: 100, y: 300 };
    const rect = { height: 44, width: 120, x: 120, y: 334 };
    const button = panelButton(MEASURE, rect, true, "Onward!");
    showZoneCelebration(layer, {
      artUrl: (path) => `/art/${path}`,
      closeLabel: gameData.menuText.common,
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
    const [dialog] = layerViews(element);
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
    doc.defaultView.fire("keydown", { code: "Digit1", repeat: false });
    expect(press).toHaveBeenCalledOnce();
  });

  // 393 CSS px wide over the 360-wide game: at DPR 3 a game pixel is 3.275 device pixels, an art
  // pixel 3, and the screen's middle column 590 device pixels in, off the art-pixel grid.
  it.each([1, 2, 3])(
    "puts an info line's icons on the art-pixel grid at a fractional fit, DPR %d",
    (dpr) => {
      const doc = new FakeDocument();
      const scale = domScale(dpr, { height: 659, width: 393, x: 0, y: 0 });
      const { element, layer } = fakeLayer(doc, scale);
      const plate = { height: 80, width: 300, x: 30, y: 300 };
      const icon = (key: string, x: number) => ({
        art: { key, scale: 1, size: { height: 16, width: 16 }, x, y: 340 },
        gap: 4,
      });
      const text = (line: string, x: number) => ({
        gap: 4,
        text: { capTop: 344, colour: 0x3e2731, lines: [line], x },
      });
      showZoneCelebration(layer, {
        artUrl: (path) => `/art/${path}`,
        closeLabel: gameData.menuText.common,
        fonts: { body: gameFont("font-body"), title: gameFont("font-title") },
        label: "New walker!",
        // Each icon's one frame on its sheet.
        loadSheet: () =>
          Promise.resolve({
            frames: { "0": { frame: { h: 16, w: 16, x: 0, y: 0 } } },
            meta: { size: { h: 16, w: 16 } },
          }),
        pillColours: () => undefined,
        press: () => undefined,
        toGame: (point) => point,
        view: {
          art: [],
          button: panelButton(
            MEASURE,
            { height: 44, width: 120, x: 120, y: 390 },
            true,
            "Welcome!",
          ),
          frame: { key: "ui-quip", rect: plate },
          rows: [
            {
              centreX: 180,
              items: [
                { ...icon("icon-perk-quick-recovery", 120), gap: 0 },
                text("Quick recovery", 140),
              ],
            },
            {
              centreX: 180,
              items: [{ ...text("+40% lane change", 110), gap: 0 }, icon("icon-agility", 230)],
            },
          ],
          rule: undefined,
          texts: [],
        },
      });
      const [dialog] = layerViews(element);
      const icons = (dialog?.all() ?? []).filter((node) => node.className === "adw-art");
      expect(icons).toHaveLength(2);
      const pixel = artPixel(scale);
      for (const node of icons) {
        expect(Number.parseFloat(node.style.left ?? "") % pixel).toBe(0);
      }
    },
  );
});

it("dismisses a native detail region only while its modal owns input", () => {
  const { doc, element, layer } = menuContext();
  const dismiss = vi.fn();
  const shown = showQuestionPanel(layer, {
    close: null,
    closeLabel: gameData.menuText.common,
    dismiss,
    fonts: { body: gameFont("font-body"), title: gameFont("font-title") },
    numberKeys: false,
    presses: [],
    toGame: (point) => point,
    view: modalCardView(MEASURE, { height: 100, width: 280, x: 40, y: 100 }, "Detail", []),
  });
  const dialog = layerViews(element)[0]!;
  expect(dialog.className).not.toContain("adw-passive");
  const tap = () => ({
    detail: 0,
    preventDefault: vi.fn(),
    stopImmediatePropagation: vi.fn(),
    stopPropagation: vi.fn(),
    target: dialog,
  });
  dialog.fire("click", tap());
  expect(dismiss).toHaveBeenCalledOnce();
  const cover = layer.input.open();
  dialog.fire("click", tap());
  expect(dismiss).toHaveBeenCalledOnce();
  cover.close();
  shown.destroy();
  expect(doc.activeElement).not.toBe(dialog);
});

it("keeps a base page with custom native controls interactive without a modal scope", () => {
  const { doc, element, layer } = menuContext();
  const button = doc.createElement("button");
  const shown = showQuestionPanel(layer, {
    close: null,
    closeLabel: gameData.menuText.common,
    fonts: { body: gameFont("font-body"), title: gameFont("font-title") },
    modal: false,
    numberKeys: false,
    parts: [
      {
        controls: [button as unknown as HTMLElement],
        element: button as unknown as HTMLElement,
        place: () => undefined,
      },
    ],
    presses: [],
    toGame: (point) => point,
    view: modalCardView(MEASURE, { height: 100, width: 280, x: 40, y: 100 }, "Results", []),
  });
  expect(layerViews(element)[0]?.className).not.toContain("adw-passive");
  expect(layer.input.accepts()).toBe(true);
  const key = {
    code: "Enter",
    preventDefault: vi.fn(),
    repeat: false,
    stopPropagation: vi.fn(),
    target: button,
  };
  layerViews(element)[0]?.fire("keydown", key);
  expect(key.stopPropagation).toHaveBeenCalledOnce();
  expect(key.preventDefault).not.toHaveBeenCalled();
  const repeat = { ...key, preventDefault: vi.fn(), repeat: true, stopPropagation: vi.fn() };
  layerViews(element)[0]?.fire("keydown", repeat);
  expect(repeat.preventDefault).toHaveBeenCalledOnce();
  expect(repeat.stopPropagation).toHaveBeenCalledOnce();
  const arrow = {
    ...repeat,
    code: "ArrowRight",
    preventDefault: vi.fn(),
    stopImmediatePropagation: vi.fn(),
    stopPropagation: vi.fn(),
  };
  layerViews(element)[0]?.fire("keydown", arrow);
  expect(arrow.preventDefault).toHaveBeenCalledOnce();
  expect(arrow.stopImmediatePropagation).toHaveBeenCalledOnce();
  expect(doc.activeElement).toBe(button);
  expect(arrow.stopPropagation).not.toHaveBeenCalled();
  shown.destroy();
});

it("keeps a native panel inert until its part JSON readiness and image barrier settle", async () => {
  const { doc, layer } = menuContext();
  let resolvePart: (urls: readonly string[]) => void = () => undefined;
  const ready = new Promise<readonly string[]>((resolve) => {
    resolvePart = resolve;
  });
  let revealed: Promise<boolean> = Promise.resolve(false);
  let requested: readonly string[] = [];
  layer.reveal = (urls, root) => {
    root.setAttribute(PENDING_ATTRIBUTE, "");
    revealed = Promise.resolve(urls).then((all) => {
      requested = all;
      root.removeAttribute(PENDING_ATTRIBUTE);
      return true;
    });
    return { cancel: () => undefined, revealed };
  };
  const onPaint = vi.fn();
  const shown = showQuestionPanel(layer, {
    close: vi.fn(),
    closeLabel: gameData.menuText.common,
    fonts: { body: gameFont("font-body"), title: gameFont("font-title") },
    numberKeys: false,
    onPaint,
    parts: [
      {
        element: doc.createElement("span") as unknown as HTMLElement,
        place: () => undefined,
        ready,
      },
    ],
    presses: [],
    toGame: (point) => point,
    view: modalCardView(MEASURE, { height: 100, width: 280, x: 40, y: 100 }, "Detail", []),
  });
  expect(shown.accepts()).toBe(false);
  expect(onPaint).not.toHaveBeenCalled();
  resolvePart(["/art/late-frame.png"]);
  await revealed;
  expect(requested).toContain("/art/late-frame.png");
  expect(shown.accepts()).toBe(true);
  expect(onPaint).toHaveBeenCalledOnce();
  shown.destroy();
});

it("routes an explicit footer to dismissal without changing semantic actions or number shortcuts", () => {
  const { doc, element, layer } = menuContext();
  const close = vi.fn();
  const buy = vi.fn();
  const rect = { height: 260, width: 280, x: 40, y: 120 };
  const card = modalCardView(MEASURE, rect, gameData.homeText.shop.title, [
    {
      label: gameData.homeText.shop.confirmBuy,
      primary: true,
      rect: { height: 48, width: 120, x: 120, y: 250 },
    },
  ]);
  const shown = showQuestionPanel(layer, {
    close,
    closeLabel: gameData.menuText.common,
    fonts: { body: gameFont("font-body"), title: gameFont("font-title") },
    numberKeys: true,
    presses: [buy],
    toGame: (point) => point,
    view: {
      ...card,
      footer: dismissFooter(
        MEASURE,
        { label: gameData.menuText.common.close, primary: false },
        rect,
      ),
    },
  });
  const root = layerViews(element)[0]!;
  const buttons = root.all().filter((node) => node.tagName === "button");
  const footer = buttons.find((node) => node.className.includes("adw-secondary"))!;
  expect(footer.getAttribute("aria-keyshortcuts")).toBeNull();
  footer.fire("click", { detail: 0 });
  expect(close).toHaveBeenCalledOnce();
  expect(buy).not.toHaveBeenCalled();
  doc.defaultView.fire("keydown", { code: "Digit1", repeat: false });
  expect(buy).toHaveBeenCalledOnce();
  doc.defaultView.fire("keydown", { code: "Digit2", repeat: false });
  expect(close).toHaveBeenCalledOnce();
  shown.setInert(true);
  footer.fire("click", { detail: 0 });
  expect(close).toHaveBeenCalledOnce();
  shown.destroy();
});

it("keeps a footer-only overlay dismissible without introducing a corner close control", () => {
  const { element, layer } = menuContext();
  const close = vi.fn();
  const rect = { height: 240, width: 280, x: 40, y: 120 };
  const view = modalCardView(MEASURE, rect, gameData.menuText.menu.title, []);
  const shown = showQuestionPanel(layer, {
    close: null,
    closeLabel: gameData.menuText.common,
    fonts: { body: gameFont("font-body"), title: gameFont("font-title") },
    footerPress: close,
    numberKeys: false,
    presses: [],
    toGame: (point) => point,
    view: {
      ...view,
      footer: dismissFooter(
        MEASURE,
        { label: gameData.menuText.common.close, primary: true },
        rect,
      ),
    },
  });
  const buttons = layerViews(element)[0]!
    .all()
    .filter((node) => node.tagName === "button");
  expect(buttons).toHaveLength(1);
  expect(buttons[0]!.className).toContain("adw-go");
  buttons[0]!.fire("click", { detail: 0 });
  expect(close).toHaveBeenCalledOnce();
  shown.destroy();
});

// Every modal with a corner X and another button named Close: the Menus' Close items and the
// install steps' footer Close (the detail card, badge card and badge celebration have their own).
// The X's name is the titled close filled with the modal's title; with no other Close it is Close.
describe("a modal's corner X", () => {
  const { close, closeTitled } = gameData.menuText.common;
  const rect = { height: 240, width: 280, x: 40, y: 120 };
  const contexts: readonly MenuContext[] = ["cheats", "end", "help", "home", "page", "settings"];
  const menus = contexts.map((context) => ({
    name: `the ${context} Menu`,
    title: gameData.menuText.menu.title,
    view: questionPanelView(MEASURE, SCREEN_LAYOUT.walkView, {
      labels: menuItems(context).map((item) => menuItemLabel(gameData, item)),
      note: [],
      primary: "last",
      sentenceLines: false,
      showKeyNumbers: false,
      title: gameData.menuText.menu.title,
    }),
  }));
  const steps = keysOf(gameData.menuText.settings.installSteps).map((kind) => {
    const { title } = gameData.menuText.settings.installSteps[kind];
    return {
      name: `the ${kind} install steps`,
      title,
      view: {
        ...modalCardView(MEASURE, rect, title, []),
        footer: dismissFooter(MEASURE, { label: close, primary: true }, rect),
      },
    };
  });
  const names = (view: Parameters<typeof showQuestionPanel>[1]["view"]) => {
    const { element, layer } = menuContext();
    showQuestionPanel(layer, {
      close: vi.fn(),
      closeLabel: gameData.menuText.common,
      fonts: { body: gameFont("font-body"), title: gameFont("font-title") },
      numberKeys: false,
      presses: view.buttons.map(() => vi.fn()),
      toGame: (point) => point,
      view,
    });
    const buttons = layerViews(element)[0]!
      .all()
      .filter((node) => node.tagName === "button");
    return buttons.map((node) => node.getAttribute("aria-label"));
  };

  it.each([...menus, ...steps])("says which modal it closes beside a Close: $name", (modal) => {
    const spoken = names(modal.view);
    const x = fillNames(closeTitled, { title: modal.title });
    expect(spoken.at(-1)).toBe(x);
    expect(spoken.filter((name) => name === close)).toHaveLength(1);
    expect(x).not.toBe(close);
  });

  it("is Close with no other Close, as on the pause menu", () => {
    expect(menu().buttons.at(-1)?.getAttribute("aria-label")).toBe(close);
  });
});

it("reads a detail card's title first, then its body, then its actions", () => {
  const { element, layer } = menuContext();
  const rect = { height: 240, width: 280, x: 40, y: 120 };
  const close = { label: gameData.menuText.common.close, primary: true };
  showDetailCard(layer, {
    artUrl: (path) => path,
    closeLabel: gameData.menuText.common,
    dismiss: vi.fn(),
    fonts: { body: gameFont("font-body"), title: gameFont("font-title") },
    loadSheet: () => Promise.resolve({}),
    pillColours: () => undefined,
    toGame: (point) => point,
    view: {
      art: [],
      card: {
        ...modalCardView(MEASURE, rect, "Casey", []),
        footer: dismissFooter(MEASURE, close, rect),
      },
      framed: [],
      texts: [{ capTop: 200, colour: 0, lines: ["Spots more"], x: 56 }],
      title: "Casey",
    },
  });
  const dialog = layerViews(element)[0]!;
  const readingOrder = dialog.all();
  const at = (found: (node: (typeof readingOrder)[number]) => boolean) =>
    readingOrder.findIndex(found);
  const title = at((node) => node.id === dialog.getAttribute("aria-labelledby"));
  const body = at((node) => node.id === dialog.getAttribute("aria-describedby"));
  const action = at((node) => node.tagName === "button");
  expect(title).toBeGreaterThanOrEqual(0);
  expect([title < body, body < action]).toEqual([true, true]);
});

it("uses a detail card's existing any-tap dismissal for its native X and footer", () => {
  const { element, layer } = menuContext();
  const dismiss = vi.fn();
  const rect = { height: 240, width: 280, x: 40, y: 120 };
  const card = modalCardView(MEASURE, rect, gameData.menuText.menu.title, []);
  const shared = {
    artUrl: (path: string) => path,
    closeLabel: gameData.menuText.common,
    fonts: { body: gameFont("font-body"), title: gameFont("font-title") },
    loadSheet: () => Promise.resolve({}),
    pillColours: () => undefined,
    toGame: (point: { x: number; y: number }) => point,
  };
  const shown = showDetailCard(layer, {
    ...shared,
    dismiss,
    view: {
      art: [],
      card: {
        ...card,
        footer: dismissFooter(
          MEASURE,
          { label: gameData.menuText.common.close, primary: true },
          rect,
        ),
      },
      framed: [],
      texts: [],
      title: gameData.menuText.menu.title,
    },
  });
  const buttons = layerViews(element)[0]!
    .all()
    .filter((node) => node.tagName === "button");
  // The footer keeps its Close; the corner X says which modal it closes.
  expect(buttons.map((node) => node.getAttribute("aria-label"))).toEqual([
    gameData.menuText.common.close,
    fillNames(gameData.menuText.common.closeTitled, { title: gameData.menuText.menu.title }),
  ]);
  for (const button of buttons) {
    button.fire("click", { detail: 0 });
  }
  expect(dismiss).toHaveBeenCalledTimes(2);
  shown.destroy();
  const passive = showDetailCard(layer, {
    ...shared,
    view: { art: [], card, framed: [], texts: [], title: gameData.menuText.menu.title },
  });
  expect(
    (passive.element as unknown as { all(): { tagName: string; className: string }[] })
      .all()
      .filter((node) => node.tagName === "button" || node.className === "adw-close"),
  ).toEqual([]);
  passive.destroy();
});

it("keeps action identity while DOM order follows the button and footer positions", () => {
  const { layer } = menuContext();
  const original = questionPanelView(MEASURE, SCREEN_LAYOUT.walkView, {
    labels: [gameData.menuText.pause.resume, gameData.menuText.pause.help],
    note: [],
    sentenceLines: true,
    title: gameData.menuText.pause.title,
  });
  const [upper, lower] = original.buttons;
  const first = vi.fn();
  const second = vi.fn();
  const close = vi.fn();
  const footer = dismissFooter(
    MEASURE,
    { label: gameData.menuText.common.close, primary: false },
    original.panel,
  );
  const middle = (upper!.rect.y + lower!.rect.y) / 2;
  const shown = showQuestionPanel(layer, {
    close: null,
    closeLabel: gameData.menuText.common,
    fonts: { body: gameFont("font-body"), title: gameFont("font-title") },
    footerPress: close,
    numberKeys: true,
    presses: [first, second],
    toGame: (point) => point,
    view: {
      ...original,
      buttons: [
        { ...upper!, actionIndex: 0, hit: lower!.hit, rect: lower!.rect },
        { ...lower!, actionIndex: 1, hit: upper!.hit, rect: upper!.rect },
      ],
      footer: { ...footer, hit: { ...footer.hit, y: middle }, rect: { ...footer.rect, y: middle } },
    },
  });
  const buttons = (shown.element as unknown as ReturnType<FakeDocument["createElement"]>)
    .all()
    .filter((node) => node.tagName === "button");
  expect(buttons.map((button) => button.getAttribute("aria-keyshortcuts"))).toEqual([
    "2",
    null,
    "1",
  ]);
  buttons[0]!.fire("click", { detail: 0 });
  buttons[1]!.fire("click", { detail: 0 });
  buttons[2]!.fire("click", { detail: 0 });
  expect(first).toHaveBeenCalledOnce();
  expect(second).toHaveBeenCalledOnce();
  expect(close).toHaveBeenCalledOnce();
  shown.setActionShown(0, false);
  expect(buttons.map((button) => button.hidden)).toEqual([false, false, true]);
  shown.refuse(1, true);
  expect(buttons[0]!.classList.contains("adw-refusing-still")).toBe(true);
  expect(buttons[2]!.classList.contains("adw-refusing-still")).toBe(false);
  shown.destroy();
});

it.each([
  { dpr: 1, inset: 6, width: 360 },
  { dpr: 1, inset: 10, width: 575 },
  { dpr: 2.625, inset: 24, width: 575 },
])("projects equal painted X gaps at width $width DPR $dpr", ({ dpr, inset, width }) => {
  for (const frame of ["card", "panel"] as const) {
    const doc = new FakeDocument();
    const scale = domScale(dpr, { height: 894, width, x: 0.25, y: 0.375 });
    const { element, layer } = fakeLayer(doc, scale);
    const panel = {
      height: 333,
      width: frame === "card" ? 328 : 264,
      x: frame === "card" ? 16 : 48,
      y: 73,
    };
    const view = { ...modalCardView(MEASURE, panel, gameData.menuText.settings.title, []), frame };
    const shown = showQuestionPanel(layer, {
      close: vi.fn(),
      closeLabel: gameData.menuText.common,
      fonts: { body: gameFont("font-body"), title: gameFont("font-title") },
      numberKeys: false,
      presses: [],
      toGame: (point) => point,
      view,
    });
    const dialog = layerViews(element)[0]!;
    const painted = dialog
      .all()
      .find((node) => node.classList.contains(frame === "card" ? "adw-card" : "adw-rim"))!;
    const close = dialog
      .all()
      .find((node) => node.tagName === "button" && node.classList.contains("adw-close"))!;
    const face = close.all().find((node) => node.classList.contains("adw-close-face"))!;
    const glyph = close.all().find((node) => node.classList.contains("adw-close-glyph"))!;
    const n = (node: typeof painted, key: string) => Number.parseFloat(node.style[key]!);
    // Card skin fills the kit card, whose projected bounds are the painted frame.
    const top = frame === "card" ? n(painted.parent!, "--ui-modal-card-y") : n(painted, "top");
    const left = frame === "card" ? n(painted.parent!, "--ui-modal-card-x") : n(painted, "left");
    const paintedWidth =
      frame === "card" ? n(painted.parent!, "--ui-modal-card-width") : n(painted, "width");
    const hit =
      frame === "card"
        ? {
            height: n(close, "--ui-modal-close-height"),
            left: left + n(close, "--ui-modal-close-x"),
            top: top + n(close, "--ui-modal-close-y"),
            width: n(close, "--ui-modal-close-width"),
          }
        : {
            height: n(close, "height"),
            left: n(close, "left"),
            top: n(close, "top"),
            width: n(close, "width"),
          };
    const faceX = hit.left + n(face, "left");
    const faceY = hit.top + n(face, "top");
    if (frame === "card") {
      expect(close.parent).toBe(painted.parent);
      expect(painted.parent?.children.at(-1)).toBe(close);
      for (const side of ["top", "right", "bottom", "left"]) {
        expect(n(close, `--ui-modal-close-outset-${side}`)).toBe(0);
      }
    }
    expect(faceY - top).toBe(inset);
    expect(left + paintedWidth - faceX - n(face, "width")).toBe(inset);
    const border = artPixel(scale);
    expect(border + n(glyph, "left") + n(glyph, "width") / 2).toBe(n(face, "width") / 2);
    expect(border + n(glyph, "top") + n(glyph, "height") / 2).toBe(n(face, "height") / 2);
    expect(glyph.children).toHaveLength(1);
    expect(glyph.children[0]!.tagName).toBe("svg");
    expect(view.close.hit).toMatchObject({ height: 48, width: 48 });
    expect(hit).toEqual(gridRect(scale, view.close.hit));
    shown.destroy();
  }
});

it("captures the exact admitted source control without relying on native focus or visual indices", () => {
  const { doc, element, layer } = menuContext();
  const onInvoke = vi.fn();
  const press = vi.fn(() => expect(onInvoke).toHaveBeenCalled());
  const view = questionPanelView(MEASURE, SCREEN_LAYOUT.walkView, {
    labels: [
      gameData.menuText.cheats.open,
      gameData.menuText.pause.help,
      gameData.menuText.pause.settings,
    ],
    note: [],
    primary: "last",
    sentenceLines: false,
    title: gameData.menuText.menu.title,
  });
  const sourceOrder = [2, 0, 1];
  const shown = showQuestionPanel(layer, {
    close: vi.fn(),
    closeLabel: gameData.menuText.common,
    fonts: { body: gameFont("font-body"), title: gameFont("font-title") },
    numberKeys: true,
    numberPresses: [press],
    onInvoke,
    presses: [vi.fn(), vi.fn(), press],
    toGame: (point) => point,
    view: {
      ...view,
      buttons: view.buttons.map((button, index) => ({
        ...button,
        actionIndex: sourceOrder[index]!,
      })),
    },
  });
  shown.setActionShown(0, false);
  const invoker = layerViews(element)[0]!
    .all()
    .find((node) => node.getAttribute("aria-label") === gameData.menuText.cheats.open)!;
  doc.body.focus();
  invoker.fire("click", { detail: 0 });
  expect(onInvoke).toHaveBeenCalledExactlyOnceWith(2, invoker);
  expect(press).toHaveBeenCalledOnce();
  expect(doc.activeElement).toBe(doc.body);
  doc.defaultView.fire("keydown", { code: "Digit1", repeat: false });
  expect(onInvoke).toHaveBeenLastCalledWith(2, invoker);
  expect(onInvoke).toHaveBeenCalledTimes(2);
  expect(press).toHaveBeenCalledTimes(2);
  shown.setInert(true);
  invoker.fire("click", { detail: 0 });
  expect(onInvoke).toHaveBeenCalledTimes(2);
  expect(press).toHaveBeenCalledTimes(2);
  shown.destroy();
});

it("uses the top modal's X action once for a letterbox backdrop tap", async () => {
  const context = menuContext();
  const lower = menu(context);
  const upper = menu(context);
  upper.close.mockImplementation(() => upper.shown.destroy());
  await Promise.resolve();
  await Promise.resolve();
  const backdrop = context.element
    .all()
    .findLast((part) => part.className === "adw-modal-backdrop")!;
  const pointer = {
    clientX: -40,
    clientY: 200,
    detail: 1,
    pointerId: 1,
    stopPropagation: vi.fn(),
    target: backdrop,
    timeStamp: 10,
  };
  backdrop.fire("pointerdown", pointer);
  context.doc.fire("pointerup", pointer);
  backdrop.fire("click", pointer);
  expect(upper.close).toHaveBeenCalledOnce();
  expect(lower.close).not.toHaveBeenCalled();
  expect(lower.shown.accepts()).toBe(true);
  expect(pointer.stopPropagation).toHaveBeenCalledOnce();
  lower.shown.destroy();
});
