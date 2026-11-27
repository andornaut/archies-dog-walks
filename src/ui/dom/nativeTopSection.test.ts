import { fontMetrics } from "@andornaut/game-kit/runtime/text/bitmapFont";
import { PENDING_ATTRIBUTE } from "@andornaut/game-kit/runtime/web/ui/dom/imageReady";
import { describe, expect, it, vi } from "vitest";

import { gameData } from "../../data/index.ts";
import {
  FakeDocument,
  type FakeElement,
  fakeLayer,
  type FakeTarget,
} from "../../testing/fakeDom.ts";
import { fontInk, fontInkRows, gameFont } from "../../testing/fontInk.ts";
import { ownArtFrames } from "../../testing/ownArtFrames.ts";
import { BUTTON_SIZE } from "../buttonGeometry.ts";
import { domScale, fontPixel, gridRect } from "../domScale.ts";
import { PALETTE } from "../palette.ts";
import { TOP_BAR_FACE, TOP_BAR_TRIM, TOP_BAR_WELL } from "../topBarTrim.ts";
import { topSectionLayout } from "../topSection.ts";
import { type ControlGlyph, createControlGlyph } from "./controlGlyph.ts";
import { createNativeTopSection, type NativeTopSection } from "./nativeTopSection.ts";
import { followModalUnderlay } from "./rampDim.ts";
const labels = {
  exit: gameData.homeText.quit.quit,
  menu: gameData.menuText.menu.title,
  mute: gameData.menuText.settings.sound,
  pause: gameData.menuText.pause.title,
};

function currencyTexts(view: NativeTopSection): FakeElement[] {
  const underlay = view.underlayElement as unknown as FakeElement;
  return underlay.all().filter((node) => node.classList.contains("adw-text"));
}

function fixture(
  effects = 0,
  exit = false,
  scale = domScale(1, { height: 560, width: 360, x: 0, y: 0 }),
  clock = false,
  pause = false,
) {
  const doc = new FakeDocument();
  if (clock) {
    Object.assign(doc.defaultView, {
      clearTimeout: globalThis.clearTimeout,
      performance: globalThis.performance,
      setTimeout: globalThis.setTimeout,
    });
  }
  const { element, layer } = fakeLayer(doc, scale);
  let pendingRoot: HTMLElement | undefined;
  let resolveReveal: (ready: boolean) => void = () => undefined;
  const revealed = new Promise<boolean>((resolve) => {
    resolveReveal = resolve;
  });
  const reveal = (ready: boolean) => {
    if (ready) {
      pendingRoot?.removeAttribute(PENDING_ATTRIBUTE);
    }
    resolveReveal(ready);
  };
  const cancel = vi.fn(() => reveal(false));
  Object.assign(layer, {
    onReady: () => () => undefined,
    reveal: (_urls: unknown, root: HTMLElement) => {
      pendingRoot = root;
      root.setAttribute(PENDING_ATTRIBUTE, "");
      return { cancel, revealed };
    },
  });
  const press = vi.fn();
  const view = createNativeTopSection(
    layer,
    {
      artUrl: (path) => path,
      loadSheet: async (path) => ownArtFrames(path),
    },
    gameFont("font-title"),
    {
      accepts: () => true,
      buttons: exit ? ["mute", "menu", "exit"] : ["mute", pause ? "pause" : "menu"],
      currency: true,
      effects,
      labels,
      press,
    },
  );
  const buttons = element.all().filter((node) => node.tagName === "button");
  for (const button of buttons) {
    Object.assign(button, {
      getBoundingClientRect: () => ({
        height: Number.parseFloat(button.style.height!) / scale.dpr,
        left: scale.origin.x + Number.parseFloat(button.style.left!) / scale.dpr,
        top: scale.origin.y + Number.parseFloat(button.style.top!) / scale.dpr,
        width: Number.parseFloat(button.style.width!) / scale.dpr,
      }),
    });
  }
  const root = view.element as unknown as FakeTarget;
  const click = () => {
    const fields = { detail: 0, target: buttons[0] };
    if (!dispatch(root, "click", fields)) {
      dispatch(buttons[0]!, "click", fields);
    }
  };
  return { buttons, cancel, click, doc, element, layer, press, reveal, root, view };
}
function dispatch(target: FakeTarget, type: string, fields: Record<string, unknown>) {
  let stopped = false;
  let button = fields.target as FakeElement | undefined;
  while (button !== undefined && button.tagName !== "button") {
    button = button.parent ?? undefined;
  }
  const rect = (
    button as
      | (FakeElement & {
          getBoundingClientRect(): { left: number; top: number; width: number; height: number };
        })
      | undefined
  )?.getBoundingClientRect();
  const event = Object.assign(
    {
      button: 0,
      buttons: 0,
      clientX: rect === undefined ? 10 : rect.left + rect.width / 2,
      clientY: rect === undefined ? 10 : rect.top + rect.height / 2,
      detail: 0,
      isPrimary: true,
      pointerId: 1,
      preventDefault: () => undefined,
      stopImmediatePropagation: () => {
        stopped = true;
      },
      stopPropagation: () => undefined,
      timeStamp: 0,
      type,
    },
    fields,
  );
  for (const listener of target.listeners.get(type) ?? []) {
    listener(event);
    if (stopped) {
      break;
    }
  }
  return stopped;
}
describe("native top section integration", () => {
  it("keeps the shared control order and art geometry while gating native actions on reveal", async () => {
    const { buttons, click, press, reveal, view } = fixture();
    expect(buttons.map((button) => button.getAttribute("aria-label"))).toEqual([
      labels.mute,
      labels.menu,
    ]);
    const shared = topSectionLayout(["mute", "menu"]);
    // Each button covers the part of its hit it owns, so neighbours meet without overlapping.
    expect(buttons.map((button) => [button.style.left, button.style.width])).toEqual(
      shared.controls.map(([, { owned }]) => [`${owned.x}px`, `${owned.width}px`]),
    );
    view.setInputBottom(40);
    expect(buttons.map((button) => button.style.height)).toEqual(["40px", "40px"]);
    view.setInputBottom(undefined);
    expect(buttons.map((button) => button.style.height)).toEqual(["48px", "48px"]);
    click();
    expect(press).not.toHaveBeenCalled();
    reveal(true);
    await Promise.resolve();
    click();
    expect(press).toHaveBeenCalledExactlyOnceWith("mute", {
      completedAt: 0,
      startedAt: undefined,
      via: "keyboard",
    });
  });
  it("dims the whole bar under a modal, its buttons included, and takes no press there", async () => {
    const { buttons, click, layer, press, reveal, view } = fixture(6);
    const root = view.element as unknown as FakeElement;
    view.setAmount("123", "123");
    view.setEffectCount(2);
    reveal(true);
    await Promise.resolve();
    expect(buttons.every((button) => root.contains(button))).toBe(true);
    const stop = followModalUnderlay(layer.input, view.element);
    const modal = layer.input.open();
    expect(root.style.filter).toBe("brightness(0.28)");
    expect(root.inert).toBe(true);
    expect(root.getAttribute("aria-hidden")).toBe("true");
    click();
    expect(press).not.toHaveBeenCalled();
    const nested = layer.input.open();
    expect(root.style.filter).toBe("brightness(0.28)");
    nested.close();
    expect(root.style.filter).toBe("brightness(0.28)");
    modal.close();
    expect(root.style.filter ?? "").toBe("");
    expect(root.inert).toBe(false);
    click();
    expect(press).toHaveBeenCalledTimes(1);
    stop();
    view.dispose();
  });
  it("keeps a hidden or covered section inactive and disposes its pending reveal", async () => {
    const { buttons, cancel, click, doc, element, layer, press, reveal, root, view } = fixture();
    reveal(true);
    await Promise.resolve();
    view.setInert(true);
    click();
    view.setInert(false);
    view.setShown(false);
    click();
    expect(press).not.toHaveBeenCalled();
    view.setShown(true);
    click();
    expect(press).toHaveBeenCalledTimes(1);
    const button = buttons[0]!;
    dispatch(root, "pointerdown", { buttons: 1, pointerId: 1, target: button });
    const covered = layer.input.open();
    covered.close();
    dispatch(doc, "pointerup", { pointerId: 1, target: button });
    const clickFields = { detail: 1, target: button };
    if (!dispatch(root, "click", clickFields)) {
      dispatch(button, "click", clickFields);
    }
    expect(press).toHaveBeenCalledTimes(1);
    view.dispose();
    view.dispose();
    click();
    expect(press).toHaveBeenCalledTimes(1);
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(element.children).toEqual([]);
  });
  it("admits only one pointer across separate bar controls", async () => {
    const { buttons, doc, layer, press, reveal, root } = fixture();
    reveal(true);
    await Promise.resolve();
    const elsewhere = layer.press.claim();
    dispatch(root, "pointerdown", { buttons: 1, pointerId: 0, target: buttons[0] });
    expect(press).not.toHaveBeenCalled();
    elsewhere?.release();
    dispatch(root, "pointerdown", { buttons: 1, pointerId: 1, target: buttons[0] });
    dispatch(root, "pointerdown", { buttons: 1, pointerId: 2, target: buttons[1] });
    expect(press).not.toHaveBeenCalled();
    dispatch(doc, "pointerup", { pointerId: 1, target: buttons[0] });
    const click = { detail: 1, target: buttons[0] };
    if (!dispatch(root, "click", click)) {
      dispatch(buttons[0]!, "click", click);
    }
    expect(press).toHaveBeenCalledTimes(1);
    dispatch(doc, "pointerup", { pointerId: 2, target: buttons[1] });
    dispatch(root, "pointerdown", { buttons: 1, pointerId: 3, target: buttons[1] });
    expect(press).toHaveBeenCalledTimes(1);
    dispatch(doc, "pointerup", { pointerId: 3, target: buttons[1] });
    const second = { detail: 1, target: buttons[1] };
    if (!dispatch(root, "click", second)) {
      dispatch(buttons[1]!, "click", second);
    }
    expect(press).toHaveBeenLastCalledWith("menu", {
      completedAt: 0,
      startedAt: 0,
      via: "pointer",
    });
    expect(press).toHaveBeenCalledTimes(2);
  });
  it("centres visible effects inside their reserved region and reuses native art nodes", () => {
    const { element, view } = fixture(6);
    const wells = element
      .all()
      .filter((node) => node.style.backgroundImage?.includes("ui-hud-effect-well"));
    expect(wells).toHaveLength(6);
    expect(wells.every((node) => node.hidden)).toBe(true);
    view.setEffectCount(2);
    expect(
      wells
        .filter((node) => !node.hidden)
        .map((node) => [node.style.left, node.style.top, node.style.width]),
    ).toEqual([
      ["157px", "5px", "26px"],
      ["183px", "5px", "26px"],
    ]);
    view.setEffectCount(6);
    expect(wells.filter((node) => !node.hidden).map((node) => node.style.left)).toEqual([
      "105px",
      "131px",
      "157px",
      "183px",
      "209px",
      "235px",
    ]);
    view.setEffectCount(0);
    expect(wells.every((node) => node.hidden)).toBe(true);
    expect(() => view.setEffectCount(7)).toThrow("configured top section");
  });
  it("dips a pressed effect well and fills it forest inside its frame, as a pressed button", () => {
    const { element, view } = fixture(6);
    const wells = element
      .all()
      .filter((node) => node.style.backgroundImage?.includes("ui-hud-effect-well"));
    const [press] = element
      .all()
      .filter((node) => node.className.includes("adw-top-section-well-press"));
    const shown = () => [
      wells.filter((node) => !node.hidden).map((node) => node.style.top),
      press!.hidden
        ? []
        : [press!.style.left, press!.style.top, press!.style.width, press!.style.height],
    ];
    view.setEffectCount(2);
    expect(shown()).toEqual([["5px", "5px"], []]);
    view.setEffectPressed(0);
    expect(press!.style.backgroundColor).toBe(`#${PALETTE.forest.toString(16)}`);
    expect(shown()).toEqual([
      ["7px", "5px"],
      ["158px", "8px", "24px", "24px"],
    ]);
    view.setEffectPressed(undefined);
    expect(shown()).toEqual([["5px", "5px"], []]);
  });
  it("fits approved five-character currency labels in one fixed well with unchanged controls", () => {
    const { element, view } = fixture(6);
    const money = currencyTexts(view);
    for (const text of ["999", "9.9k", "999m"]) {
      view.setAmount(text, text);
      expect(money.map((node) => node.textContent)).toEqual(["$", text]);
      expect(money.map((node) => node.style.fontSize)).toEqual(["24px", "24px"]);
    }
    const backings = element
      .all()
      .filter((node) => node.style.width === "29px" && node.style.height === "29px");
    // The bar's faces sit straight on its plum, with no square backing behind them.
    expect(backings.map((node) => [node.style.left, node.style.top])).toEqual([]);
  });
  it("uses the existing short currency form inside the fixed walk well", () => {
    const { view } = fixture(6);
    view.setAmount("1,234", "1.2k");
    const texts = currencyTexts(view).map((node) => node.textContent);
    expect(texts).toContain("1.2k");
    expect(texts).not.toContain("1,234");
  });
  it("updates currency and mute state without replacing controls", () => {
    const { buttons, element, view } = fixture();
    view.setAmount("9".repeat(16), "999K");
    expect(currencyTexts(view).map((node) => node.textContent)).toContain("999K");
    const root = view.element as unknown as FakeElement;
    const captions = () => root.children.filter((node) => node.classList.contains("adw-text"));
    expect(captions()).toEqual([]);
    expect(buttons[0]?.getAttribute("aria-pressed")).toBe("true");
    view.setMuted(true);
    expect(captions()).toEqual([]);
    expect(buttons[0]?.getAttribute("aria-pressed")).toBe("false");
    expect(element.all().filter((node) => node.tagName === "button")).toEqual(buttons);
  });
});

function glyphPaths(glyph: FakeElement) {
  return glyph.children.map((part) => part.getAttribute("d"));
}

function expectedPaths(doc: FakeDocument, name: ControlGlyph) {
  return glyphPaths(createControlGlyph(doc as unknown as Document, name) as unknown as FakeElement);
}

it("renders a decorative SVG Exit to the right of Menu through the shared control", async () => {
  const { buttons, doc, element, press, reveal, root, view } = fixture(0, true);
  expect(buttons.map((button) => button.getAttribute("aria-label"))).toEqual([
    labels.mute,
    labels.menu,
    labels.exit,
  ]);
  expect(buttons.map((button) => button.style.left)).toEqual(["224px", "270px", "314px"]);
  const glyphs = buttons.map((button) => button.all().find((node) => node.tagName === "svg")!);
  const expected: ControlGlyph[] = ["sound-on", "menu", "exit"];
  expect(glyphs.map(glyphPaths)).toEqual(expected.map((glyph) => expectedPaths(doc, glyph)));
  for (const glyph of glyphs) {
    expect(glyph.namespaceURI).toBe("http://www.w3.org/2000/svg");
    expect(glyph.getAttribute("aria-hidden")).toBe("true");
    expect(glyph.getAttribute("focusable")).toBe("false");
  }
  expect(
    element
      .all()
      .some((node) =>
        /(?:images\/icon-(exit|menu|pause)|sprites\/icon-sound)\.png/.test(
          node.style.backgroundImage ?? "",
        ),
      ),
  ).toBe(false);
  reveal(true);
  await Promise.resolve();
  const event = { detail: 0, target: buttons[2] };
  if (!dispatch(root, "click", event)) {
    dispatch(buttons[2]!, "click", event);
  }
  expect(press).toHaveBeenCalledExactlyOnceWith("exit", {
    completedAt: 0,
    startedAt: undefined,
    via: "keyboard",
  });
  view.dispose();
});

it("swaps the Sound and Pause glyphs in their existing buttons as state changes", () => {
  const { buttons, doc, view } = fixture(0, false, undefined, false, true);
  const [sound, pause] = buttons as [FakeElement, FakeElement];
  const glyph = (button: FakeElement) => button.all().find((node) => node.tagName === "svg")!;
  const soundOn = glyph(sound);
  const pauseGlyph = glyph(pause);
  expect(glyphPaths(soundOn)).toEqual(expectedPaths(doc, "sound-on"));
  expect(pause.getAttribute("aria-label")).toBe(labels.pause);
  expect(glyphPaths(pauseGlyph)).toEqual(expectedPaths(doc, "pause"));
  view.setMuted(true);
  view.setPaused(true);
  expect(sound.getAttribute("aria-pressed")).toBe("false");
  expect(glyphPaths(glyph(sound))).toEqual(expectedPaths(doc, "sound-off"));
  expect(pause.getAttribute("aria-label")).toBe(labels.menu);
  expect(glyphPaths(glyph(pause))).toEqual(expectedPaths(doc, "menu"));
  view.setMuted(false);
  view.setPaused(false);
  expect(sound.getAttribute("aria-pressed")).toBe("true");
  expect(glyphPaths(glyph(sound))).toEqual(expectedPaths(doc, "sound-on"));
  expect(pause.getAttribute("aria-label")).toBe(labels.pause);
  expect(glyphPaths(glyph(pause))).toEqual(expectedPaths(doc, "pause"));
  view.dispose();
});

it("projects the six native wells onto the same logical grid as the HUD icons at phone DPRs", () => {
  for (const dpr of [1, 2.625]) {
    const scale = domScale(dpr, { height: 844, width: 390, x: 0, y: 0 });
    const { element, view } = fixture(6, false, scale);
    view.setEffectCount(6);
    const wells = element
      .all()
      .filter((node) => node.style.backgroundImage?.includes("ui-hud-effect-well"));
    const rects = topSectionLayout(["mute", "menu"], { effects: 6 }).effectWells;
    rects.forEach((rect, index) => {
      const expected = gridRect(scale, rect);
      expect(wells[index]!.style).toMatchObject({
        height: `${expected.height}px`,
        left: `${expected.left}px`,
        top: `${expected.top}px`,
        width: `${expected.width}px`,
      });
    });
    view.dispose();
  }
});

it.each([
  { dpr: 1, width: 575 },
  { dpr: 2.625, width: 390 },
])(
  "fits native faces, glyphs and cash to their logical wells at $width CSS pixels and DPR $dpr",
  async ({ dpr, width }) => {
    const scale = domScale(dpr, { height: 844, width, x: 0, y: 0 });
    const { buttons, element, view } = fixture(0, true, scale);
    await Promise.resolve();
    const layout = topSectionLayout(["mute", "menu", "exit"], { currency: true });
    layout.controls.forEach(([, { face, owned }], index) => {
      const hitBox = gridRect(scale, owned);
      const faceBox = gridRect(scale, {
        ...face,
        height: TOP_BAR_FACE.size,
        width: TOP_BAR_FACE.size,
      });
      const button = buttons[index]!;
      const focusFace = button.all().find((node) => node.classList.contains("ui-button-face"))!;
      expect(focusFace.style).toMatchObject({
        height: `${faceBox.height}px`,
        left: `${faceBox.left - hitBox.left}px`,
        top: `${faceBox.top - hitBox.top}px`,
        width: `${faceBox.width}px`,
      });
      const normal = button
        .all()
        .find((node) => node.style.backgroundImage?.includes("ui-icon-button-normal"))!;
      expect(normal.style).toMatchObject({
        height: `${faceBox.height}px`,
        left: "0px",
        top: "0px",
        width: `${faceBox.width}px`,
      });
      const glyphBox = gridRect(scale, { height: 16, width: 16, x: face.x + 2, y: face.y + 1 });
      const glyph = button.all().find((node) => node.classList.contains("adw-top-section-glyph"))!;
      expect(glyph.style).toMatchObject({
        height: `${glyphBox.height}px`,
        left: `${glyphBox.left - faceBox.left}px`,
        top: `${glyphBox.top - faceBox.top}px`,
        width: `${glyphBox.width}px`,
      });
      expect(glyph.children[0]!.getAttribute("preserveAspectRatio")).toBe("none");
      view.buttons.get(layout.controls[index]![0])!.setPressed(true);
      const pressedBox = gridRect(scale, {
        height: 16,
        width: 16,
        x: face.x + 2,
        y: face.y + 1 + BUTTON_SIZE.press,
      });
      expect(glyph.style.top).toBe(`${pressedBox.top - faceBox.top}px`);
    });
    const well = layout.currency!;
    const wellBox = gridRect(scale, well);
    const font = gameFont("font-title");
    const pixel = fontPixel(scale, 3);
    for (const text of ["0", "9.9k", "999m"]) {
      view.setAmount(text, text);
      const segments = element
        .all()
        .filter((node) => node.style.backgroundImage?.includes("ui-home-cash-well"));
      // The three-slice's box is the well's, its parts placed from its corner.
      const slice = segments[0]!.parentElement!;
      expect(slice.style).toMatchObject({
        left: `${wellBox.left}px`,
        top: `${wellBox.top}px`,
        width: `${wellBox.width}px`,
      });
      expect(segments[0]!.style.left).toBe("0px");
      expect(
        Number.parseFloat(segments[2]!.style.left ?? "") +
          Number.parseFloat(segments[2]!.style.width ?? ""),
      ).toBe(wellBox.width);
      for (let i = 0; i < segments.length; i += 1) {
        expect(segments[i]!.style.height).toBe(`${wellBox.height}px`);
        if (i > 0) {
          expect(
            Number.parseFloat(segments[i - 1]!.style.left ?? "") +
              Number.parseFloat(segments[i - 1]!.style.width ?? ""),
          ).toBe(Number.parseFloat(segments[i]!.style.left ?? ""));
        }
      }
      const texts = currencyTexts(view);
      const bounds = texts.map((node) => {
        const ink = fontInk("font-title", { scale: pixel }, node.textContent);
        const rows = fontInkRows("font-title", { scale: pixel }, node.textContent);
        return {
          bottom:
            Number.parseFloat(node.style.top ?? "") +
            fontMetrics(font).capTop * pixel +
            rows.bottom,
          left: Number.parseFloat(node.style.left ?? "") + ink.left,
          right: Number.parseFloat(node.style.left ?? "") + ink.right,
          top:
            Number.parseFloat(node.style.top ?? "") + fontMetrics(font).capTop * pixel + rows.top,
        };
      });
      const interior = gridRect(scale, { ...well, height: well.height - TOP_BAR_WELL.lip });
      expect(
        Math.abs(
          (Math.min(...bounds.map((b) => b.left)) + Math.max(...bounds.map((b) => b.right))) / 2 -
            (interior.left + interior.width / 2),
        ),
      ).toBeLessThanOrEqual(0.5);
      expect(
        Math.abs(
          (Math.min(...bounds.map((b) => b.top)) + Math.max(...bounds.map((b) => b.bottom))) / 2 -
            (interior.top + interior.height / 2),
        ),
      ).toBeLessThanOrEqual(0.5);
    }
    const line = gridRect(scale, { ...layout.bar, height: 1, y: TOP_BAR_TRIM.line.row });
    expect(
      element
        .all()
        .filter(
          (node) =>
            node.className === "adw-framed" &&
            node.style.width === `${line.width}px` &&
            node.style.top === `${line.top}px`,
        ),
    ).toHaveLength(0);
    view.dispose();
  },
);

it("lets the Kit dispatch taps and holds once while preserving pointer timing and keyboard origin", async () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
  try {
    const { buttons, doc, press, reveal, root, view } = fixture(0, false, undefined, true);
    reveal(true);
    await Promise.resolve();
    const button = buttons[0]!;
    expect(button.classList.contains("ui-standard-button")).toBe(true);
    expect(button.tabIndex).toBe(0);
    const down = (id: number) =>
      dispatch(root, "pointerdown", {
        buttons: 1,
        pointerId: id,
        target: button,
        timeStamp: performance.now(),
      });
    const up = (id: number) =>
      dispatch(doc, "pointerup", {
        pointerId: id,
        target: button,
        timeStamp: performance.now(),
      });
    const click = (detail: number) => {
      const event = { detail, target: button, timeStamp: performance.now() };
      if (!dispatch(root, "click", event)) {
        dispatch(button, "click", event);
      }
    };
    down(1);
    expect(press).not.toHaveBeenCalled();
    vi.advanceTimersByTime(25);
    up(1);
    click(1);
    expect(press).toHaveBeenCalledExactlyOnceWith("mute", {
      completedAt: 25,
      startedAt: 0,
      via: "pointer",
    });
    down(2);
    const startedAt = performance.now();
    vi.advanceTimersByTime(gameData.tuning.seconds.holdSeconds * 1000);
    expect(press).toHaveBeenCalledTimes(2);
    expect(press).toHaveBeenLastCalledWith("mute", {
      completedAt: performance.now(),
      startedAt,
      via: "pointer",
    });
    up(2);
    click(1);
    expect(press).toHaveBeenCalledTimes(2);
    down(3);
    dispatch(doc, "pointercancel", { pointerId: 3, target: button });
    click(1);
    expect(press).toHaveBeenCalledTimes(2);
    click(0);
    expect(press).toHaveBeenCalledTimes(3);
    expect(press).toHaveBeenLastCalledWith("mute", {
      completedAt: performance.now(),
      startedAt: undefined,
      via: "keyboard",
    });
    view.dispose();
  } finally {
    vi.useRealTimers();
  }
});

it("rejects releases outside the original control even if implicit capture retains its child target", async () => {
  const { buttons, doc, press, reveal, root, view } = fixture();
  reveal(true);
  await Promise.resolve();
  const original = buttons[0]!;
  const child = original.all().find((node) => node.style.backgroundImage !== undefined)!;
  const releaseCapture = vi.fn();
  Object.assign(child, { hasPointerCapture: () => true, releasePointerCapture: releaseCapture });
  const click = () => {
    const fields = { detail: 1, target: child };
    if (!dispatch(root, "click", fields)) {
      dispatch(original, "click", fields);
    }
  };
  for (const point of [
    { clientX: -5, clientY: -5 },
    { clientX: Number.parseFloat(buttons[1]!.style.left!) + 2, clientY: 2 },
  ]) {
    dispatch(root, "pointerdown", { buttons: 1, pointerId: 1, target: child });
    expect(releaseCapture).toHaveBeenLastCalledWith(1);
    dispatch(doc, "pointerup", { ...point, pointerId: 1, target: child });
    click();
    expect(press).not.toHaveBeenCalled();
  }
  dispatch(root, "pointerdown", { buttons: 1, pointerId: 2, target: child });
  dispatch(doc, "pointerup", { pointerId: 2, target: child });
  click();
  expect(press).toHaveBeenCalledOnce();
  view.dispose();
});

it("renders the top-bar glyph slots without the legacy close ring", () => {
  const { buttons, element, view } = fixture();
  expect(buttons.every((button) => button.classList.contains("adw-top-section-button"))).toBe(true);
  expect(buttons.some((button) => button.classList.contains("adw-close"))).toBe(false);
  expect(element.all().some((node) => node.tagName === "style")).toBe(false);
  view.dispose();
});

it("contains a control click even when its Kit action disposes the input root", async () => {
  const { buttons, press, reveal, root, view } = fixture();
  reveal(true);
  await Promise.resolve();
  const button = buttons[0]!;
  const contained = vi.fn();
  const fields = { detail: 0, stopPropagation: contained, target: button };
  press.mockImplementationOnce(() => view.dispose());
  expect(dispatch(root, "click", fields)).toBe(false);
  expect(contained).not.toHaveBeenCalled();
  dispatch(button, "click", fields);
  expect(press).toHaveBeenCalledOnce();
  expect(contained).toHaveBeenCalledOnce();
  const background = vi.fn();
  root.fire("click", { detail: 0, stopPropagation: background, target: view.element });
  expect(background).not.toHaveBeenCalled();
});
