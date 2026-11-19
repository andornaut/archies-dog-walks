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
import { TOP_BAR_FACE, TOP_BAR_TRIM, TOP_BAR_WELL } from "../topBarTrim.ts";
import { topSectionLayout } from "../topSection.ts";
import { createNativeTopSection } from "./nativeTopSection.ts";
import { followModalUnderlay } from "./rampDim.ts";
const labels = {
  exit: gameData.homeText.quit.quit,
  menu: gameData.menuText.menu.title,
  mute: gameData.menuText.settings.sound,
  pause: gameData.menuText.pause.title,
};
function fixture(
  activation: "click" | "down" = "click",
  effects = 0,
  exit = false,
  scale = domScale(1, { height: 560, width: 360, x: 0, y: 0 }),
) {
  const doc = new FakeDocument();
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
      activation,
      buttons: exit ? ["mute", "menu", "exit"] : ["mute", "menu"],
      currency: true,
      effects,
      labels,
      press,
    },
  );
  const buttons = element.all().filter((node) => node.tagName === "button");
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
  const event = Object.assign(
    {
      buttons: 0,
      detail: 0,
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
    expect(buttons.map((button) => button.style.width)).toEqual(
      shared.controls.map(([, control]) => `${control.hit.width}px`),
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
    const { buttons, click, layer, press, reveal, view } = fixture("click", 6);
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
    const { buttons, doc, layer, press, reveal, root } = fixture("down");
    reveal(true);
    await Promise.resolve();
    const elsewhere = layer.press.claim();
    dispatch(root, "pointerdown", { buttons: 1, pointerId: 0, target: buttons[0] });
    expect(press).not.toHaveBeenCalled();
    elsewhere?.release();
    dispatch(root, "pointerdown", { buttons: 1, pointerId: 1, target: buttons[0] });
    dispatch(root, "pointerdown", { buttons: 1, pointerId: 2, target: buttons[1] });
    expect(press).toHaveBeenCalledTimes(1);
    dispatch(doc, "pointerup", { pointerId: 1, target: buttons[0] });
    dispatch(doc, "pointerup", { pointerId: 2, target: buttons[1] });
    dispatch(root, "pointerdown", { buttons: 1, pointerId: 3, target: buttons[1] });
    expect(press).toHaveBeenLastCalledWith("menu", {
      completedAt: 0,
      startedAt: 0,
      via: "pointer",
    });
    expect(press).toHaveBeenCalledTimes(2);
  });
  it("centres visible effects inside their reserved region and reuses native art nodes", () => {
    const { element, view } = fixture("click", 6);
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
  it("fits approved five-character currency labels in one fixed well with unchanged controls", () => {
    const { element, view } = fixture("click", 6);
    const money = element.all().filter((node) => node.className.includes("adw-text"));
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
    const { element, view } = fixture("click", 6);
    view.setAmount("1,234", "1.2k");
    const texts = element
      .all()
      .filter((node) => node.className.includes("adw-text"))
      .map((node) => node.textContent);
    expect(texts).toContain("1.2k");
    expect(texts).not.toContain("1,234");
  });
  it("updates currency and mute state without replacing controls", () => {
    const { buttons, element, view } = fixture();
    view.setAmount("9".repeat(16), "999K");
    expect(
      element
        .all()
        .filter((node) => node.className.includes("adw-text"))
        .map((node) => node.textContent),
    ).toContain("999K");
    view.setMuted(true);
    expect(buttons[0]?.getAttribute("aria-pressed")).toBe("false");
    expect(element.all().filter((node) => node.tagName === "button")).toEqual(buttons);
  });
});

it("renders the existing Exit glyph and label to the right of Menu through the shared control", async () => {
  const { buttons, element, press, reveal, root, view } = fixture("click", 0, true);
  expect(buttons.map((button) => button.getAttribute("aria-label"))).toEqual([
    labels.mute,
    labels.menu,
    labels.exit,
  ]);
  expect(buttons.map((button) => button.style.left)).toEqual(["216px", "264px", "312px"]);
  expect(
    element.all().some((node) => node.style.backgroundImage?.includes("images/icon-exit.png")),
  ).toBe(true);
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

it("projects the six native wells onto the same logical grid as the HUD icons at phone DPRs", () => {
  for (const dpr of [1, 2.625]) {
    const scale = domScale(dpr, { height: 844, width: 390, x: 0, y: 0 });
    const { element, view } = fixture("click", 6, false, scale);
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
    const { buttons, element, view } = fixture("click", 0, true, scale);
    await Promise.resolve();
    const layout = topSectionLayout(["mute", "menu", "exit"], { currency: true });
    layout.controls.forEach(([, { face, hit }], index) => {
      const hitBox = gridRect(scale, hit);
      const faceBox = gridRect(scale, {
        ...face,
        height: TOP_BAR_FACE.size,
        width: TOP_BAR_FACE.size,
      });
      const button = buttons[index]!;
      const normal = button.children.find((node) =>
        node.style.backgroundImage?.includes("ui-icon-button-normal"),
      )!;
      expect(normal.style).toMatchObject({
        height: `${faceBox.height}px`,
        left: `${faceBox.left - hitBox.left}px`,
        top: `${faceBox.top - hitBox.top}px`,
        width: `${faceBox.width}px`,
      });
      const glyphBox = gridRect(scale, { height: 16, width: 16, x: face.x + 2, y: face.y + 1 });
      const glyph = button.children.at(-1)!;
      expect(glyph.style).toMatchObject({
        height: `${glyphBox.height}px`,
        left: `${glyphBox.left - hitBox.left}px`,
        top: `${glyphBox.top - hitBox.top}px`,
        width: `${glyphBox.width}px`,
      });
      expect(glyph.children[0]!.style).toMatchObject({
        height: `${glyphBox.height}px`,
        left: "0px",
        top: "0px",
        width: `${glyphBox.width}px`,
      });
      view.buttons.get(layout.controls[index]![0])!.setPressed(true);
      const pressedBox = gridRect(scale, {
        height: 16,
        width: 16,
        x: face.x + 2,
        y: face.y + 1 + BUTTON_SIZE.press,
      });
      expect(glyph.style.top).toBe(`${pressedBox.top - hitBox.top}px`);
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
      expect(segments[0]!.style.left).toBe(`${wellBox.left}px`);
      expect(
        Number.parseFloat(segments[2]!.style.left ?? "") +
          Number.parseFloat(segments[2]!.style.width ?? ""),
      ).toBe(wellBox.left + wellBox.width);
      for (let i = 0; i < segments.length; i += 1) {
        expect(segments[i]!.style.height).toBe(`${wellBox.height}px`);
        if (i > 0) {
          expect(
            Number.parseFloat(segments[i - 1]!.style.left ?? "") +
              Number.parseFloat(segments[i - 1]!.style.width ?? ""),
          ).toBe(Number.parseFloat(segments[i]!.style.left ?? ""));
        }
      }
      const texts = element.all().filter((node) => node.className.includes("adw-text"));
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
