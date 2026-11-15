import { readFileSync } from "node:fs";

import { fontMetrics } from "@andornaut/game-kit/text/bitmapFont";
import { describe, expect, it, vi } from "vitest";

import { gameData } from "../../data/index.ts";
import { END_LAYOUT } from "../../home/endLayout.ts";
import { endScreenView, QUIP_TAIL_KEY } from "../../home/endScreenView.ts";
import { FakeDocument, fakeLayer } from "../../testing/fakeDom.ts";
import { gameFont } from "../../testing/fontInk.ts";
import { dimColour } from "../../ui/dimArt.ts";
import { shownText } from "../../ui/dom/pixelLine.ts";
import { artPixel, domScale, exactDeviceY, frameRect } from "../../ui/domScale.ts";
import { PALETTE } from "../../ui/palette.ts";
import { showEndScreen } from "./endScreen.ts";

const fonts = { body: gameFont("font-body"), title: gameFont("font-title") };
const ART = { [QUIP_TAIL_KEY]: { height: 8, width: 10 } } as Record<
  string,
  { height: number; width: number }
>;
const MEASURE = {
  art: (key: string) => ART[key],
  body: fontMetrics(fonts.body),
  bodyWidth: () => 40,
  fitQuip: (_style: unknown, text: string) => ({ lines: [text], scale: 2 }),
  hasTag: () => false,
  inkWidth: () => 40,
  span: () => ({ left: 0, right: 40, width: 41 }),
  title: fontMetrics(fonts.title),
  wrapBody: (_width: number, text: string) => [text],
  wrapNote: (_width: number, text: string) => [text],
};
const VIEW = endScreenView(gameData, MEASURE, {
  closing: [{ dog: "archie", fired: false, text: "Look at him go! Lovely." }],
  earned: [],
  lines: [],
  stripNames: () => [],
  walk: {
    dogs: ["archie"],
    earnedCents: 900,
    firings: [],
    outcome: "wentHome",
    route: [],
    zonesFinished: 1,
  } as never,
});

function endScreen(width: number, display: typeof fonts.title | null = fonts.title) {
  const doc = new FakeDocument();
  const scale = domScale(3, { height: (width * 560) / 360, width, x: 0, y: 0 });
  const { element, layer } = fakeLayer(doc, scale);
  const frames: (() => void)[] = [];
  Object.assign(doc.defaultView, {
    cancelAnimationFrame: () => undefined,
    requestAnimationFrame: (paint: () => void) => {
      frames.push(paint);
      return frames.length;
    },
  });
  const home = vi.fn();
  const shown = showEndScreen(layer, {
    artUrl: (path) => path,
    badges: [],
    closeLabel: gameData.menuText.common.close,
    display: display ?? undefined,
    everyFrame: () => () => undefined,
    fonts,
    gesture: {},
    home,
    loadSheet: (path) =>
      Promise.resolve(JSON.parse(readFileSync(`public/art/${path}`, "utf8")) as unknown),
    now: () => 0,
    openBadge: vi.fn(),
    pillColours: () => undefined,
    reduced: true,
    ribbon: undefined,
    toGame: (point) => point,
    view: VIEW,
  });
  const nodes = element.children[0]?.all() ?? [];
  return { frames, home, layer, nodes, scale, shown };
}

describe("the HTML End screen", () => {
  it("shows its native Back to title pressed or bobbing whole art pixels as told", () => {
    const { nodes, scale, shown } = endScreen(393);
    expect(nodes.filter((node) => node.tagName === "button")).toHaveLength(1);
    const button = nodes.find((node) => node.className === "adw-button adw-go");
    shown.setButton(false, -1);
    expect(button?.style.transform).toBe(`translateY(${-artPixel(scale)}px)`);
    shown.setButton(true, 0);
    expect(button?.attributes.has("data-pressed")).toBe(true);
    expect(button?.style.transform).toBe("");
  });

  it("admits keyboard Back only after paint, blocks it under a modal, and drops it on destroy", async () => {
    const { frames, home, layer, nodes, shown } = endScreen(393);
    const button = nodes.find((node) => node.className === "adw-button adw-go");
    button?.fire("click", { detail: 0 });
    expect(home).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(frames).toHaveLength(1));
    frames.shift()?.();
    expect(shown.accepts()).toBe(true);
    button?.fire("click", { detail: 0 });
    expect(home).toHaveBeenCalledOnce();
    const modal = layer.input.open();
    button?.fire("click", { detail: 0 });
    expect(home).toHaveBeenCalledOnce();
    modal.close();
    button?.fire("click", { detail: 0 });
    expect(home).toHaveBeenCalledTimes(2);
    shown.destroy();
    button?.fire("click", { detail: 0 });
    expect(home).toHaveBeenCalledTimes(2);
  });

  it("combines scene and modal coverage into one palette pass", () => {
    const { layer, nodes, shown } = endScreen(393);
    const painted = nodes.find((node) => {
      const value = node.style.backgroundColor;
      if (!/^#[0-9a-f]{6}$/i.test(value ?? "")) {
        return false;
      }
      const colour = Number.parseInt(value!.slice(1), 16);
      return dimColour(colour) !== dimColour(dimColour(colour));
    });
    expect(painted).toBeDefined();
    const original = painted!.style.backgroundColor;
    if (original === undefined) {
      throw new Error("Expected a painted result fill");
    }
    const dimmed = `#${dimColour(Number.parseInt(original.slice(1), 16))
      .toString(16)
      .padStart(6, "0")}`;
    const modal = layer.input.open();
    shown.setDimmed(true);
    expect(painted!.style.backgroundColor).toBe(dimmed);
    modal.close();
    expect(painted!.style.backgroundColor).toBe(dimmed);
    shown.setDimmed(false);
    expect(painted!.style.backgroundColor).toBe(original);
    shown.destroy();
  });

  it("preserves the title-font fallback when display lettering is unavailable", () => {
    const { nodes } = endScreen(360, null);
    const title = nodes.find(
      (node) =>
        node.getAttribute("aria-hidden") === "true" &&
        node.textContent === shownText("title", VIEW.results.title.text),
    );
    expect(title?.className).toBe("adw-text adw-font-title");
    expect(title?.style.color).toBe(`#${PALETTE.plum.toString(16).padStart(6, "0")}`);
    expect(nodes.some((node) => node.className === "adw-button adw-go")).toBe(true);
  });

  it.each([360, 393])(
    "hangs each tail flipped off its bubble's snapped right edge at %ipx",
    (width) => {
      const { nodes, scale } = endScreen(width);
      const tail = nodes.find((node) => node.style.backgroundImage?.includes(QUIP_TAIL_KEY));
      const bubble = VIEW.results.bubbles[0];
      expect(tail?.style.transform).toBe("scaleX(-1)");
      if (bubble === undefined) {
        throw new Error("no bubble");
      }
      const frame = frameRect(scale, { ...bubble, y: bubble.y + VIEW.offsetY });
      const inFromRight = frame.left + frame.width - Number.parseFloat(tail?.style.left ?? "");
      expect(inFromRight).toBe(
        (bubble.x + bubble.width - END_LAYOUT.quips.tail.x) * artPixel(scale),
      );
      // Its middle down within half an art pixel of the canvas's, whole art pixels below the
      // bubble's snapped top.
      const size = ART[QUIP_TAIL_KEY];
      const top = Number.parseFloat(tail?.style.top ?? "");
      const middle = top + ((size?.height ?? 0) * artPixel(scale)) / 2;
      const canvas = exactDeviceY(
        scale,
        bubble.y + VIEW.offsetY + END_LAYOUT.quips.tail.y + (size?.height ?? 0) / 2,
      );
      expect(Math.abs(middle - canvas)).toBeLessThanOrEqual(artPixel(scale) / 2);
      expect((top - frame.top) % artPixel(scale)).toBe(0);
    },
  );
});
