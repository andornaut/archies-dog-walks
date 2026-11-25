import { pixels } from "@andornaut/game-kit/runtime/units";
import { expect, it, vi } from "vitest";

import { gameData } from "../../data/index.ts";
import { BUTTON_SIZE, DEBUFF_BAR, ZONE_PILL_SIZES } from "../../data/layout.ts";
import { SCREEN_LAYOUT } from "../../data/screen.ts";
import type { ZoneId } from "../../data/types.ts";
import { modifiersOf } from "../../rules/modifiers.ts";
import { currentZone } from "../../rules/route.ts";
import { FakeDocument } from "../../testing/fakeDom.ts";
import { fontInk, fontInkRows, gameFont } from "../../testing/fontInk.ts";
import { liveSwitchRuns } from "../../testing/liveSwitch.ts";
import { activeModifier, testState } from "../../testing/runState.ts";
import { PALETTE } from "../../ui/palette.ts";
import { TEXT_SCALE } from "../../ui/textFit.ts";
import { effectItems, hudEffectIconKey, spareTreatWell } from "../effectIcons.ts";
import {
  debuffBarFill,
  spareTreatPipAt,
  WALK_BAR,
  walkBarLayout,
  zoneProgressLayout,
  zoneProgressText,
  zoneShare,
} from "../walkHud.ts";
import { createHudChrome } from "./hudChrome.ts";
import type { HudMoment, HudMomentPainter } from "./hudMoments.ts";
function fixture(hasArt: (key: string) => boolean = () => true) {
  const doc = new FakeDocument();
  const views: HudMoment[] = [];
  const painter = {
    fonts: { body: gameFont("font-body") },
    group: vi.fn(() => {
      const view = {
        art: vi.fn(),
        dispose: vi.fn(),
        element: doc.createElement("div"),
        panel: vi.fn(),
        text: vi.fn(),
      } as unknown as HudMoment;
      views.push(view);
      return view;
    }),
    hasArt,
  } as unknown as HudMomentPainter;
  const colours = {
    muddy: { face: PALETTE.brown, fill: PALETTE.tan, name: PALETTE.ink, shade: PALETTE.darkBrown },
    spotlight: {
      face: PALETTE.blue,
      fill: PALETTE.yellow,
      name: PALETTE.white,
      shade: PALETTE.navy,
    },
    stinky: { face: PALETTE.mauve, fill: PALETTE.pink, name: PALETTE.white, shade: PALETTE.purple },
    zoomies: {
      face: PALETTE.green,
      fill: PALETTE.yellow,
      name: PALETTE.ink,
      shade: PALETTE.forest,
    },
  };
  return { chrome: createHudChrome(painter, painter, colours), views };
}

it("retains unchanged native chrome and repaints only changed debuff and progress groups", () => {
  const { chrome, views } = fixture();
  const run = testState({ archie: 3 });
  chrome.update(undefined, run);
  const count = views.length;
  chrome.update(undefined, run);
  expect(views).toHaveLength(count);
  const debuffed = {
    ...run,
    debuffs: [{ debuff: "muddy" as const, secondsLeft: 1, untilZone: run.zoneIndex }],
    zoneDistance: pixels(100),
  };
  chrome.update(undefined, debuffed);
  expect(chrome.bars()).toEqual([{ debuff: "muddy", rect: expect.objectContaining({ x: 0 }) }]);
  expect(views.flatMap((view) => vi.mocked(view.art).mock.calls).map(([art]) => art.key)).toContain(
    "icon-muddy",
  );
  const progress = zoneProgressLayout(SCREEN_LAYOUT.zoneProgress, zoneShare(gameData, debuffed));
  expect(
    views
      .flatMap((view) => vi.mocked(view.panel).mock.calls)
      .some(([rect]) => rect.width === progress.fills[0]?.width && rect.y === progress.fills[0]?.y),
  ).toBe(true);
  chrome.dispose();
  expect(views.filter((view) => !vi.mocked(view.dispose).mock.calls.length)).toEqual([]);
});

it("uses actual visible wells for one or six HUD icons and the spare treat pip", () => {
  const { chrome, views } = fixture();
  const few = testState({ archie: 3 });
  chrome.update(undefined, few);
  const oneWell = walkBarLayout(SCREEN_LAYOUT.topBar, 1).effectWells[0]!;
  expect(vi.mocked(views.at(-1)!.art).mock.calls.map(([art]) => art)).toEqual([
    {
      at: { x: oneWell.x + WALK_BAR.effects.icon, y: oneWell.y + WALK_BAR.effects.icon },
      image: { height: 24, width: 24 },
      key: hudEffectIconKey(effectItems(gameData, few)[0]!),
      projection: "layout",
    },
  ]);
  const full = testState(
    { archie: 3 },
    {
      foundGear: "luckyCollar",
      gear: "fannyPack",
      immunities: [{ encounter: "puddle", source: { kind: "upgrade", upgrade: "raincoats" } }],
      modifiers: [
        ...modifiersOf(gameData.shopGear.fannyPack.effects).map((modifier) =>
          activeModifier({ gear: "fannyPack", kind: "gear" }, modifier),
        ),
        ...modifiersOf(gameData.upgrades.bigTipper.effects).map((modifier) =>
          activeModifier({ kind: "upgrade", upgrade: "bigTipper" }, modifier),
        ),
        ...modifiersOf(gameData.upgrades.goodLeash.effects).map((modifier) =>
          activeModifier({ kind: "upgrade", upgrade: "goodLeash" }, modifier),
        ),
      ],
      spareTreats: { held: 1, spent: 0, stored: 1 },
      upgradesPicked: ["bigTipper", "raincoats", "goodLeash"],
    },
  );
  const items = effectItems(gameData, full);
  expect(items).toHaveLength(6);
  chrome.update(undefined, full);
  const wells = walkBarLayout(SCREEN_LAYOUT.topBar, items.length).effectWells;
  const calls = vi.mocked(views.at(-1)!.art).mock.calls.map(([art]) => art);
  expect(calls.slice(0, items.length)).toEqual(
    items.map((item, index) => ({
      at: {
        x: wells[index]!.x + WALK_BAR.effects.icon,
        y: wells[index]!.y + WALK_BAR.effects.icon,
      },
      image: { height: 24, width: 24 },
      key: hudEffectIconKey(item),
      projection: "layout",
    })),
  );
  expect(calls.at(-1)).toMatchObject({
    at: spareTreatPipAt(wells[spareTreatWell(items, full)]!),
    key: "treat@50",
  });
  chrome.dispose();
});

it("dips the pressed effect well's icon with its well", () => {
  const { chrome, views } = fixture();
  const run = testState({ archie: 3 });
  const well = walkBarLayout(SCREEN_LAYOUT.topBar, 1).effectWells[0]!;
  const inset = WALK_BAR.effects.icon;
  const iconAt = () => vi.mocked(views.at(-1)!.art).mock.calls.at(-1)![0].at;
  chrome.update(undefined, run);
  expect(iconAt()).toEqual({ x: well.x + inset, y: well.y + inset });
  chrome.update(0, run);
  expect(iconAt()).toEqual({ x: well.x + inset, y: well.y + inset + BUTTON_SIZE.press });
  chrome.dispose();
});

it("centres a missing optional HUD icon's glyph in the authored well without drawing a legacy icon", () => {
  const { chrome, views } = fixture((key) => !key.startsWith("icon-hud-effect-"));
  chrome.update(undefined, testState({ archie: 3 }));
  const effect = views.at(-1)!;
  const well = walkBarLayout(SCREEN_LAYOUT.topBar, 1).effectWells[0]!;
  expect(effect.art).not.toHaveBeenCalled();
  expect(effect.text).toHaveBeenCalledWith(
    expect.objectContaining({ anchor: "centre", backing: well, x: well.x + well.width / 2 }),
  );
  chrome.dispose();
});

it("reserves every current full-size effect name and centres actual body ink above the bar rim", () => {
  const { chrome, views } = fixture();
  const run = testState({ archie: 3 });
  const names = Object.values(gameData.debuffs).map(({ name }) => name);
  const widest = Math.max(
    ...names.map((name) => {
      const ink = fontInk("font-body", { scale: TEXT_SCALE }, name);
      return ink.right - ink.left;
    }),
  );
  chrome.update(undefined, {
    ...run,
    debuffs: [{ debuff: "muddy", secondsLeft: 1, untilZone: run.zoneIndex }],
  });
  const only = chrome.bars()[0]!;
  const fill = debuffBarFill(widest, only.rect);
  expect(views.flatMap((view) => vi.mocked(view.panel).mock.calls)).toContainEqual([
    fill,
    undefined,
    { border: PALETTE.darkBrown, fill: PALETTE.darkBrown },
  ]);
  expect(
    views
      .flatMap((view) => vi.mocked(view.art).mock.calls)
      .some(([art]) => art.key === "ui-debuff-bar"),
  ).toBe(false);
  const before = views.length;
  const debuffs = (Object.keys(gameData.debuffs) as (keyof typeof gameData.debuffs)[]).map(
    (debuff) => ({ debuff, secondsLeft: 1, untilZone: run.zoneIndex }),
  );
  chrome.update(undefined, { ...run, debuffs });
  const texts = views
    .slice(before)
    .flatMap((view) => vi.mocked(view.text).mock.calls)
    .map(([text]) => text)
    .filter((text) => names.includes(text.lines[0]!));
  expect(texts).toHaveLength(debuffs.length);
  for (const { debuff, rect } of chrome.bars()) {
    const text = texts.find((text) => text.lines[0] === gameData.debuffs[debuff].name)!;
    const ink = fontInkRows("font-body", { scale: TEXT_SCALE }, text.lines[0]!);
    const width = fontInk("font-body", { scale: TEXT_SCALE }, text.lines[0]!);
    const top = text.capTop + ink.top;
    const bottom = text.capTop + ink.bottom;
    expect(text.font).toBe("body");
    expect(text.scale).toBe(TEXT_SCALE);
    expect(top - rect.y).toBe((DEBUFF_BAR.faceHeight - (bottom - top)) / 2);
    expect(bottom).toBeLessThanOrEqual(rect.y + DEBUFF_BAR.faceHeight);
    const track = debuffBarFill(widest, rect);
    expect(text.x + width.right - width.left + DEBUFF_BAR.name.gap).toBeLessThanOrEqual(track.x);
    expect(track.x + track.width).toBe(rect.x + rect.width - DEBUFF_BAR.fill.right);
  }
  const last = chrome.bars().at(-1)!.rect;
  expect(last.y + last.height).toBeLessThan(SCREEN_LAYOUT.road.y);
});

it("renders the neighbourhood pill at the shared body role with measured ink and padding", () => {
  const { chrome, views } = fixture();
  const run = testState({ archie: 3 });
  chrome.update(undefined, run);
  const zone = views.find((view) =>
    vi.mocked(view.panel).mock.calls.some(([, art]) => art?.key === "ui-zone-pill"),
  )!;
  const [pill] = vi.mocked(zone.panel).mock.calls[0]!;
  const texts = vi.mocked(zone.text).mock.calls.map(([text]) => text);
  expect(texts.map((text) => text.lines[0])).toEqual([
    currentZone(gameData, run).name,
    zoneProgressText(gameData, run.zoneIndex),
  ]);
  for (const text of texts) {
    expect(text.scale).toBe(TEXT_SCALE);
    expect(text.backing).toMatchObject({ height: pill.height, y: pill.y });
    const ink = fontInkRows("font-body", { scale: TEXT_SCALE }, text.lines[0]!);
    expect(
      Math.abs(text.capTop + (ink.top + ink.bottom) / 2 - pill.y - pill.height / 2),
    ).toBeLessThanOrEqual(0.5);
    expect(text.capTop + ink.top).toBeGreaterThanOrEqual(pill.y + ZONE_PILL_SIZES.padY);
    expect(text.capTop + ink.bottom).toBeLessThanOrEqual(
      pill.y + pill.height - ZONE_PILL_SIZES.padY,
    );
  }
});

// A live switch keeps the walk's slot, so the pill names the chosen neighbourhood there, then the
// next zone's, and a resumed walk's pill names the chosen one again.
it.each([
  { next: "cabbagetown", route: ["highPark"], zone: "theBeaches" },
  { next: "kensingtonMarket", route: ["highPark", "cabbagetown"], zone: "yongeStreet" },
] satisfies { next: ZoneId; route: ZoneId[]; zone: ZoneId }[])(
  "names $zone in slot $route.length on the pill after a switch from $route, then $next",
  ({ next, route, zone }) => {
    const runs = liveSwitchRuns(route, zone, next);
    const zoneName = (id: ZoneId) => gameData.world.zones.find((each) => each.id === id)!.name;
    const pillTexts = (views: readonly HudMoment[]) => {
      const pill = views.findLast((view) =>
        vi.mocked(view.panel).mock.calls.some(([, art]) => art?.key === "ui-zone-pill"),
      )!;
      return vi.mocked(pill.text).mock.calls.map(([text]) => text.lines[0]);
    };
    const { chrome, views } = fixture();
    chrome.update(undefined, { ...runs.switched, route });
    expect(pillTexts(views)).toEqual([
      zoneName(route.at(-1)!),
      zoneProgressText(gameData, route.length - 1),
    ]);
    chrome.update(undefined, runs.switched);
    expect(pillTexts(views)).toEqual([
      zoneName(zone),
      zoneProgressText(gameData, route.length - 1),
    ]);
    chrome.update(undefined, runs.next);
    expect(pillTexts(views)).toEqual([zoneName(next), zoneProgressText(gameData, route.length)]);
    const resumed = fixture();
    resumed.chrome.update(undefined, runs.resumed);
    expect(pillTexts(resumed.views)).toEqual([
      zoneName(zone),
      zoneProgressText(gameData, route.length - 1),
    ]);
  },
);
