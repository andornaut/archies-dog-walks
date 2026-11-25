import { wrapWords } from "@andornaut/game-kit/runtime/lines";
import { fontMetrics } from "@andornaut/game-kit/runtime/text/bitmapFont";
import { describe, expect, it, vi } from "vitest";

import { gameData } from "../../data/index.ts";
import { HELP_LAYOUT } from "../../help/helpLayout.ts";
import { helpView } from "../../help/helpView.ts";
import { bodyTextWidth } from "../../testing/bodyFont.ts";
import { FakeDocument, fakeLayer, layerViews } from "../../testing/fakeDom.ts";
import { gameFont } from "../../testing/fontInk.ts";
import type { NativeGesture } from "../../ui/dom/modalLifecycle.ts";
import { domScale } from "../../ui/domScale.ts";
import { modalTitleInk } from "../../ui/modal/titleRole.ts";
import { showHelpScreen } from "./helpScreen.ts";

const fonts = { body: gameFont("font-body"), title: gameFont("font-title") };
const MEASURE = {
  body: fontMetrics(fonts.body),
  inkWidth: () => 40,
  title: fontMetrics(fonts.title),
  titleInk: (line: string) => modalTitleInk(gameFont("font-title"), line),
  titleInkBottom: () => fontMetrics(fonts.title).inkBottom,
  wrapBody: (_scale: number, _width: number, text: string) => [text],
  wrapNote: (_width: number, text: string) => [text],
};

function helpScreen(
  page: number,
  pressed: "close" | "next" | "previous" | undefined,
  gesture?: NativeGesture,
) {
  const doc = new FakeDocument();
  const { element, layer } = fakeLayer(doc, domScale(2, { height: 560, width: 360, x: 0, y: 0 }));
  const presses = [vi.fn(), vi.fn()];
  const close = vi.fn();
  const shown = showHelpScreen(layer, {
    fonts,
    footerPress: close,
    ...(gesture === undefined ? {} : { gesture }),
    presses,
    toGame: (point) => point,
    view: helpView(
      gameData,
      {
        ...MEASURE,
        wrapBody: (scale, width, text) =>
          wrapWords((line) => bodyTextWidth(scale, line), width, text),
      },
      page,
      pressed,
    ),
  });
  const [dialog] = layerViews(element);
  return { close, dialog, doc, nodes: dialog?.all() ?? [], presses, shown };
}

describe("the HTML help screen", () => {
  it("exposes native page controls with the authored dialog name and keyboard focus", async () => {
    const { dialog, doc, nodes, presses, shown } = helpScreen(0, undefined);
    await vi.waitFor(() => expect(shown.accepts()).toBe(true));
    expect(dialog?.className).not.toContain("adw-passive");
    const title = nodes.find((node) => node.id === dialog?.getAttribute("aria-labelledby"));
    expect(title?.getAttribute("aria-label")).toBe(gameData.menuText.help.heading);
    const controls = nodes.filter((node) => node.tagName === "button");
    expect(controls).toHaveLength(3);
    dialog?.fire("keydown", { code: "Tab", preventDefault: () => undefined, shiftKey: false });
    expect(doc.activeElement?.className).toContain("adw-help-body");
    dialog?.fire("keydown", { code: "Tab", preventDefault: () => undefined, shiftKey: false });
    expect(doc.activeElement).toBe(controls[1]);
    expect(controls[0]!.tabIndex).toBe(-1);
    expect(controls[0]!.getAttribute("aria-describedby")).toBeNull();
    expect(controls[0]!.getAttribute("aria-description")).toBeNull();
    controls[0]?.fire("click", { detail: 0 });
    expect(presses[0]).not.toHaveBeenCalled();
    controls[0]?.fire("click", { detail: 1 });
    expect(presses[0]).toHaveBeenCalledOnce();
    controls[1]?.fire("click", { detail: 0 });
    expect(presses[1]).toHaveBeenCalledOnce();
    const page = nodes.find((node) => node.id === dialog?.getAttribute("aria-describedby"));
    const spoken = page?.all().filter((node) => node.className === "visually-hidden");
    expect(spoken?.map(({ textContent }) => textContent)[0]).toBe(gameData.help[0]?.title);
  });

  it.each([
    ["previous", 0, []],
    ["previous", 1, [gameData.menuText.help.previous]],
    ["next", 0, [gameData.menuText.help.next]],
    ["close", 0, []],
  ] as const)("shows %s pressed on page %d only where it is available", (pressed, page, shown) => {
    const { nodes } = helpScreen(page, pressed);
    expect(
      nodes
        .filter((node) => node.tagName === "button" && node.attributes.has("data-ui-pressed"))
        .map((node) => node.getAttribute("aria-label")),
    ).toEqual(shown);
    expect(nodes.some((node) => node.className === "adw-close")).toBe(false);
    const previous = nodes.find(
      (node) =>
        node.tagName === "button" &&
        node.getAttribute("aria-label") === gameData.menuText.help.previous,
    )!;
    expect(previous).toBeDefined();
    expect(previous.classList.contains("adw-disabled")).toBe(page === 0);
    expect(previous.getAttribute("aria-disabled") === "true").toBe(page === 0);
  });
});

it("keeps all Help copy scrollable without page gestures and binds every page's Back independently", async () => {
  await Promise.all(
    [0, gameData.help.length - 1].map(async (page) => {
      const down = vi.fn(),
        up = vi.fn(),
        cancel = vi.fn();
      const { close, dialog, doc, nodes, presses, shown } = helpScreen(page, undefined, {
        cancel,
        down,
        up,
      });
      await vi.waitFor(() => expect(shown.accepts()).toBe(true));
      const body = nodes.find((node) => node.className.includes("adw-help-body"))!;
      expect(body.style.overflowY).toBe("auto");
      expect(body.style.touchAction).toBe("pan-y");
      expect(body.style.overscrollBehavior).toBe("contain");
      expect(Number.parseFloat(body.children[0]!.style.height!)).toBeGreaterThan(
        Number.parseFloat(body.style.height!),
      );
      expect(Number.parseFloat(body.style.height!)).toBe(HELP_LAYOUT.body.viewport.height * 2);
      // Whole lines only: the native scrollbar gives way to the house one, and a scroll rests on
      // a line's slot.
      expect(body.style.scrollbarWidth).toBe("none");
      expect(body.style.scrollSnapType).toBe("y mandatory");
      const slots = body.children[0]!.children.filter(
        (child) => child.style.scrollSnapAlign === "start",
      );
      expect(slots.length).toBeGreaterThan(HELP_LAYOUT.body.viewport.height / 18);
      const track = nodes.find((node) => node.className === "adw-scroll-track");
      expect(track?.parent?.hidden).toBe(false);
      const stop = vi.fn();
      for (const code of ["ArrowDown", "PageDown", "Space"]) {
        body.fire("keydown", { code, stopPropagation: stop });
      }
      expect(stop).toHaveBeenCalledTimes(3);
      const event = {
        pointerId: 9,
        preventDefault: vi.fn(),
        stopImmediatePropagation: vi.fn(),
        stopPropagation: vi.fn(),
        target: body,
      };
      const press = { ...event, type: "pointerdown" };
      const release = { ...event, type: "pointerup" };
      dialog?.fire("pointerdown", press);
      doc.fire("pointerup", release);
      expect(down).not.toHaveBeenCalled();
      expect(up).not.toHaveBeenCalled();
      expect(presses.every((press) => press.mock.calls.length === 0)).toBe(true);
      const buttons = nodes.filter((node) => node.tagName === "button");
      expect(buttons.at(-1)?.getAttribute("aria-label")).toBe(gameData.menuText.pageBack);
      buttons.at(-1)?.fire("click", { detail: 0 });
      expect(close).toHaveBeenCalledOnce();
      expect(presses.every((press) => press.mock.calls.length === 0)).toBe(true);
      shown.destroy();
    }),
  );
});

it("retains page swipes beginning on Previous or Next without also pressing the native action", async () => {
  const down = vi.fn(),
    up = vi.fn(() => true);
  const { dialog, doc, nodes, presses, shown } = helpScreen(0, undefined, { down, up });
  await vi.waitFor(() => expect(shown.accepts()).toBe(true));
  const target = nodes.filter((node) => node.tagName === "button")[1]!;
  const base = {
    pointerId: 7,
    preventDefault: vi.fn(),
    stopImmediatePropagation: vi.fn(),
    stopPropagation: vi.fn(),
    target,
  };
  dialog?.fire("pointerdown", { ...base, type: "pointerdown" } as never);
  doc.fire("pointerup", { ...base, type: "pointerup" } as never);
  expect(down).toHaveBeenCalledOnce();
  expect(up).toHaveBeenCalledOnce();
  const click = { ...base, detail: 1, type: "click" };
  dialog?.fire("click", click);
  expect(click.stopImmediatePropagation).toHaveBeenCalledOnce();
  expect(presses[1]).not.toHaveBeenCalled();
  shown.destroy();
});

it("hides the scrollbar while the body fits its viewport", () => {
  const doc = new FakeDocument();
  const { element, layer } = fakeLayer(doc, domScale(2, { height: 560, width: 360, x: 0, y: 0 }));
  const shown = showHelpScreen(layer, {
    fonts,
    footerPress: vi.fn(),
    presses: [vi.fn(), vi.fn()],
    toGame: (point) => point,
    view: helpView(gameData, MEASURE, 0, undefined),
  });
  const nodes = layerViews(element)[0]?.all() ?? [];
  const track = nodes.find((node) => node.className === "adw-scroll-track");
  expect(track?.parent?.hidden).toBe(true);
  shown.destroy();
});
