import { fontMetrics } from "@andornaut/game-kit/runtime/text/bitmapFont";
import { afterEach, describe, expect, it, vi } from "vitest";

import { gameData } from "../../data/index.ts";
import type { AchievementId } from "../../data/types.ts";
import { type BadgeView, earnedBadges } from "../../home/badgesView.ts";
import { END_LAYOUT } from "../../home/endLayout.ts";
import { endScreenView, QUIP_TAIL_KEY } from "../../home/endScreenView.ts";
import { ownerNameWrap } from "../../presentation/ownerName.ts";
import { FakeDocument, type FakeElement, fakeLayer } from "../../testing/fakeDom.ts";
import { fontInk, fontInkRows, gameFont } from "../../testing/fontInk.ts";
import { ownArtFrames } from "../../testing/ownArtFrames.ts";
import { shownText } from "../../ui/dom/pixelLine.ts";
import { SETTINGS_STYLE } from "../../ui/dom/settingsStyle.ts";
import { artPixel, domScale, exactDeviceY, frameRect, gridRect } from "../../ui/domScale.ts";
import { modalTitleInk } from "../../ui/modal/titleRole.ts";
import { PALETTE } from "../../ui/palette.ts";
import { TEXT_SCALE } from "../../ui/textFit.ts";
import { cents } from "../../units.ts";
import { type DomEndScreenInput, showEndScreen } from "./endScreen.ts";

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
  ownerName: (room: number, name: string) => ownerNameWrap(fonts.body, room, name),
  span: () => ({ left: 0, right: 40, width: 41 }),
  title: fontMetrics(fonts.title),
  titleInk: (line: string) => modalTitleInk(gameFont("font-title"), line),
  wrapBody: (_width: number, text: string) => [text],
  wrapNote: (_width: number, text: string) => [text],
};
const endView = (earned: readonly AchievementId[] = []) =>
  endScreenView(gameData, MEASURE, {
    closing: [{ dog: "archie", fired: false, text: "Look at him go! Lovely." }],
    earned,
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

const VIEW = endView();

afterEach(() => vi.useRealTimers());

function endScreen(
  width: number,
  display: typeof fonts.title | null = fonts.title,
  view = VIEW,
  gesture: DomEndScreenInput["gesture"] = {},
  badges: readonly BadgeView[] = [],
) {
  const doc = new FakeDocument();
  const scale = domScale(3, { height: (width * 560) / 360, width, x: 0, y: 0 });
  const { element, layer } = fakeLayer(doc, scale);
  const frames: (() => void)[] = [];
  Object.assign(doc.defaultView, {
    cancelAnimationFrame: () => undefined,
    clearTimeout: globalThis.clearTimeout,
    performance: { now: () => Date.now() },
    requestAnimationFrame: (paint: () => void) => {
      frames.push(paint);
      return frames.length;
    },
    setTimeout: globalThis.setTimeout,
  });
  const home = vi.fn();
  const openBadge = vi.fn();
  const shown = showEndScreen(layer, {
    artUrl: (path) => path,
    badges,
    closeLabel: gameData.menuText.common.close,
    display: display ?? undefined,
    everyFrame: () => () => undefined,
    fonts,
    gesture,
    home,
    loadSheet: (path) => Promise.resolve(ownArtFrames(path)),
    now: () => 0,
    openBadge,
    pillColours: () => undefined,
    reduced: true,
    ribbon: undefined,
    toGame: (point) => point,
    view,
  });
  const nodes = element.children[0]?.all() ?? [];
  return { doc, frames, home, layer, nodes, openBadge, scale, shown };
}

describe("the HTML End screen", () => {
  it("shows its native Back to title pressed or bobbing whole art pixels as told", () => {
    const { nodes, scale, shown } = endScreen(393);
    expect(nodes.filter((node) => node.tagName === "button")).toHaveLength(1);
    const button = nodes.find((node) => node.classList.contains("adw-go"));
    const hit = gridRect(scale, VIEW.button.hit);
    expect(button?.style.width).toBe(`${hit.width}px`);
    expect(button?.style.left).toBe(`${hit.left}px`);
    expect(button?.style.top).toBe(`${hit.top}px`);
    shown.setButton(false, -1);
    expect(button?.style.transform).toBe(`translateY(${-artPixel(scale)}px)`);
    shown.setButton(true, 0);
    expect(button?.attributes.has("data-ui-pressed")).toBe(true);
    expect(button?.style.transform).toBe("");
  });

  it("admits keyboard Back only after paint, blocks it under a modal, and drops it on destroy", async () => {
    const { frames, home, layer, nodes, shown } = endScreen(393);
    const button = nodes.find((node) => node.classList.contains("adw-go"));
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

  it("combines scene and modal coverage into one brightness filter without recolouring content", () => {
    const { layer, nodes, shown } = endScreen(393);
    const painted = nodes.find((node) => /^#[0-9a-f]{6}$/i.test(node.style.backgroundColor ?? ""));
    expect(painted).toBeDefined();
    const original = painted!.style.backgroundColor;
    const modal = layer.input.open();
    shown.setDimmed(true);
    const covered = nodes.filter((node) => node.style.filter === "brightness(0.28)");
    expect(covered).toHaveLength(1);
    expect(covered[0]!.contains(painted)).toBe(true);
    expect(painted!.style.backgroundColor).toBe(original);
    modal.close();
    expect(covered[0]!.style.filter).toBe("brightness(0.28)");
    shown.setDimmed(false);
    expect(covered[0]!.style.filter ?? "").toBe("");
    shown.setDimmed(true);
    shown.destroy();
    expect(covered[0]!.style.filter ?? "").toBe("");
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
    expect(nodes.some((node) => node.classList.contains("adw-go"))).toBe(true);
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

it.each(Object.entries(gameData.dogs))(
  "fits %s's full-size owner name in the results column",
  (dog, data) => {
    const view = endScreenView(gameData, MEASURE, {
      closing: [
        {
          dog: dog as keyof typeof gameData.dogs,
          fired: false,
          text: gameData.menuText.end.titles.wentHome,
        },
      ],
      earned: [],
      lines: [],
      stripNames: () => [],
      walk: {
        dogs: [dog],
        earnedCents: 0,
        firings: [],
        outcome: "wentHome",
        route: [],
        zonesFinished: 1,
      } as never,
    });
    const names = view.results.names;
    const measured = ownerNameWrap(fonts.body, END_LAYOUT.quips.name.room, data.owner.name);
    expect(names.map((line) => line.text).join(" ")).toBe(data.owner.name);
    expect(names.map((line) => line.text)).toEqual(measured.map((line) => line.text));
    const { name, well } = END_LAYOUT.quips;
    const bubble = view.results.bubbles[0]!;
    names.forEach((line, index) => {
      expect(line.scale).toBe(TEXT_SCALE);
      expect(line.centre).toBe("ink");
      const columns = fontInk("font-body", { scale: line.scale }, line.text);
      const width = columns.right - columns.left;
      const ink = fontInkRows("font-body", { scale: line.scale }, line.text);
      expect(line.capTop + ink.top).toBeGreaterThanOrEqual(
        view.results.wells[0]!.y + END_LAYOUT.quips.well.size,
      );
      if (width <= name.room) {
        expect(line.centreX).toBe(name.centreX);
        expect(line.centreX - width / 2).toBeGreaterThanOrEqual(286);
        expect(line.centreX + width / 2).toBeLessThanOrEqual(328);
      } else {
        // A word wider than the column ends on the well's right edge, clear under the bubble.
        expect(line.centreX + width / 2).toBe(well.x + well.size);
        expect(line.capTop + ink.top).toBeGreaterThanOrEqual(
          bubble.y + bubble.height + name.wideGap,
        );
      }
      expect(line.capTop + ink.bottom).toBeLessThanOrEqual(
        view.results.panel.y + view.results.panel.height,
      );
      if (index > 0) {
        expect(line.capTop - names[index - 1]!.capTop).toBe(END_LAYOUT.quips.name.linePitch);
      }
    });
  },
);

it("scrolls all owner art, names and quotes together while results chrome and Back stay fixed", async () => {
  const view = endScreenView(gameData, MEASURE, {
    closing: (["kilo", "penny", "sequoia"] as const).map((dog) => ({
      dog,
      fired: true,
      text: gameData.menuText.end.titles.wentHome,
    })),
    earned: [gameData.achievements[0].id],
    lines: (["fees", "tips", "luckyFinds", "cardCosts", "cashLost"] as const).map((kind) => ({
      amount: cents(0),
      kind,
      label: gameData.menuText.end.earnings[kind],
    })),
    stripNames: () => [],
    walk: {
      dogs: ["kilo", "penny", "sequoia"],
      earnedCents: 0,
      firings: [],
      outcome: "wentHome",
      route: [],
      zonesFinished: 1,
    } as never,
  });
  const { frames, nodes, scale, shown } = endScreen(360, fonts.title, view);
  await vi.waitFor(() => expect(frames).toHaveLength(1));
  frames.shift()?.();
  const viewport = nodes.find((node) => node.className.includes("adw-scroll-viewport"))!;
  const content = viewport.children[0]!;
  const ownerNames = [gameData.dogs.kilo, gameData.dogs.penny, gameData.dogs.sequoia].map(
    (dog) => dog.owner.name,
  );
  expect(view.results.ownerNames).toEqual(ownerNames);
  expect(view.results.names.map((line) => line.text)).toEqual(
    ownerNames.flatMap((name) =>
      ownerNameWrap(fonts.body, END_LAYOUT.quips.name.room, name).map((line) => line.text),
    ),
  );
  const spoken = nodes
    .filter((node) => node.className === "adw-spoken")
    .map((node) => node.textContent);
  expect(spoken.filter((text) => ownerNames.includes(text as (typeof ownerNames)[number]))).toEqual(
    ownerNames,
  );
  expect(spoken).not.toContain(view.results.names.map((line) => line.text).join(" "));
  expect((viewport as unknown as HTMLElement).tabIndex).toBe(0);
  expect(view.results.ownerRows.contentHeight - view.results.ownerRows.viewport.height).toBe(45);
  const button = nodes.find((node) => node.classList.contains("adw-go"))!;
  expect(viewport.contains(button)).toBe(false);
  const fixedTop = button.style.top;
  (viewport as unknown as HTMLElement).scrollTop = 45 * scale.unit * scale.dpr;
  for (const name of view.results.names) {
    const label = nodes.find((node) => node.textContent === shownText("body", name.text))!;
    expect(viewport.contains(label)).toBe(true);
    expect(label.getAttribute("aria-hidden")).toBe("true");
  }
  const tail = nodes.find((node) => node.style.backgroundImage?.includes(QUIP_TAIL_KEY))!;
  expect(viewport.contains(tail)).toBe(true);
  const face = nodes.find((node) =>
    node.style.backgroundImage?.includes(view.results.faces[0]!.key),
  )!;
  expect(viewport.contains(face)).toBe(true);
  shown.setFace(0, undefined, -1);
  expect(viewport.contains(face)).toBe(true);
  expect(button.style.top).toBe(fixedTop);
  expect(
    Number.parseFloat(content.style.height!) + Number.parseFloat(content.style.top!),
  ).toBeCloseTo(view.results.ownerRows.contentHeight * scale.unit * scale.dpr);
  const stop = vi.fn();
  const prevent = vi.fn();
  viewport.fire("keydown", { code: "PageDown", preventDefault: prevent, stopPropagation: stop });
  expect(stop).toHaveBeenCalledOnce();
  expect(prevent).not.toHaveBeenCalled();
  const policy = SETTINGS_STYLE.match(/\.adw-settings-rows,\.adw-scroll-viewport\{([^}]+)\}/)?.[1];
  expect(policy).toContain("overflow-x:hidden;overflow-y:auto;overscroll-behavior:contain;");
  expect(policy).toContain("pointer-events:auto;");
  shown.destroy();
});

it("fills End owner wells at a fractional viewport and keeps live frames in the same allocation", async () => {
  const { nodes, scale, shown } = endScreen(393);
  const face = VIEW.results.faces[0]!;
  const portrait = nodes.find((node) => node.style.backgroundImage?.includes(face.key))!;
  await vi.waitFor(() => expect(portrait.style.visibility).toBe(""));
  const expected = gridRect(scale, { height: 32, width: 32, x: face.x, y: face.y });
  expect(portrait.style).toMatchObject({
    height: `${expected.height}px`,

    width: `${expected.width}px`,
  });
  shown.setFace(0, undefined, 1);
  expect(portrait.style.top).toBe(
    `${gridRect(scale, { height: 32, width: 32, x: face.x, y: face.y + VIEW.offsetY + 1 }).top}px`,
  );
});

it.each(["tap", "hold"] as const)(
  "uses one Kit Back action on %s without the legacy release route",
  async (mode) => {
    vi.useFakeTimers();
    const gesture = { down: vi.fn(), up: vi.fn(() => true) };
    const current = endScreen(393, fonts.title, VIEW, gesture);
    await vi.waitFor(() => expect(current.frames).toHaveLength(1));
    current.frames.shift()?.();
    const root = current.shown.element as unknown as FakeElement;
    const button = current.nodes.find((node) => node.classList.contains("adw-go"))!;
    expect(button.classList.contains("ui-standard-button")).toBe(true);
    expect(button.getAttribute("data-ui-button-role")).toBe("primary");
    const pointer = (type: string) => ({
      button: 0,
      buttons: type === "pointerdown" ? 1 : 0,
      clientX: 180,
      clientY: 520,
      detail: 1,
      isPrimary: true,
      pointerId: 7,
      preventDefault: vi.fn(),
      stopImmediatePropagation: vi.fn(),
      stopPropagation: vi.fn(),
      target: button,
      timeStamp: Date.now(),
      type,
    });
    root.fire("pointerdown", pointer("pointerdown"));
    button.fire("pointerdown", pointer("pointerdown"));
    current.shown.setButton(false, -1);
    expect(button.style.transform).toBe("");
    vi.advanceTimersByTime(mode === "tap" ? 499 : 500);
    expect(current.home).toHaveBeenCalledTimes(mode === "tap" ? 0 : 1);
    current.doc.fire("pointerup", pointer("pointerup"));
    const click = pointer("click");
    root.fire("click", click);
    if (click.stopImmediatePropagation.mock.calls.length === 0) {
      button.fire("click", click);
    }
    expect(current.home).toHaveBeenCalledOnce();
    expect(gesture.down).not.toHaveBeenCalled();
    expect(gesture.up).not.toHaveBeenCalled();
    current.shown.destroy();
  },
);

it.each(["tap", "hold"] as const)(
  "uses one Kit authored badge action on %s without the legacy release route",
  async (mode) => {
    vi.useFakeTimers();
    const gesture = { down: vi.fn(), up: vi.fn(() => true) };
    const earned = [gameData.achievements[0]!.id];
    const current = endScreen(
      393,
      fonts.title,
      endView(earned),
      gesture,
      earnedBadges(gameData, earned),
    );
    await vi.waitFor(() => expect(current.frames).toHaveLength(1));
    current.frames.shift()?.();
    const root = current.shown.element as unknown as FakeElement;
    const button = current.nodes.find(
      (node) =>
        node.tagName === "button" &&
        node.getAttribute("aria-label") === gameData.achievements[0]!.name,
    )!;
    expect(button.classList.contains("ui-standard-button")).toBe(true);
    expect(button.classList.contains("adw-standard-button")).toBe(false);
    const face = button.all().find((node) => node.classList.contains("ui-button-face"));
    expect(face?.style.getPropertyValue("--ui-button-focus-fill")).toBe(
      `#${PALETTE.cyan.toString(16)}66`,
    );
    const pointer = (type: string) => ({
      button: 0,
      buttons: type === "pointerdown" ? 1 : 0,
      clientX: 180,
      clientY: 520,
      detail: 1,
      isPrimary: true,
      pointerId: 7,
      preventDefault: vi.fn(),
      stopImmediatePropagation: vi.fn(),
      stopPropagation: vi.fn(),
      target: button,
      timeStamp: Date.now(),
      type,
    });
    root.fire("pointerdown", pointer("pointerdown"));
    button.fire("pointerdown", pointer("pointerdown"));
    vi.advanceTimersByTime(mode === "tap" ? 499 : 500);
    expect(current.openBadge).toHaveBeenCalledTimes(mode === "tap" ? 0 : 1);
    current.doc.fire("pointerup", pointer("pointerup"));
    const click = pointer("click");
    root.fire("click", click);
    if (click.stopImmediatePropagation.mock.calls.length === 0) {
      button.fire("click", click);
    }
    expect(current.openBadge).toHaveBeenCalledExactlyOnceWith(0);
    expect(gesture.down).not.toHaveBeenCalled();
    expect(gesture.up).not.toHaveBeenCalled();
    current.shown.destroy();
  },
);
