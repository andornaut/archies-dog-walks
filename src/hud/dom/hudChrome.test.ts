import { pixels } from "@andornaut/game-kit/runtime/units";
import { expect, it, vi } from "vitest";

import { gameData } from "../../data/index.ts";
import { SCREEN_LAYOUT } from "../../data/screen.ts";
import { modifiersOf } from "../../rules/modifiers.ts";
import { FakeDocument } from "../../testing/fakeDom.ts";
import { gameFont } from "../../testing/fontInk.ts";
import { activeModifier, testState } from "../../testing/runState.ts";
import { PALETTE } from "../../ui/palette.ts";
import { effectItems, hudEffectIconKey, spareTreatWell } from "../effectIcons.ts";
import {
  spareTreatPipAt,
  WALK_BAR,
  walkBarLayout,
  zoneProgressLayout,
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
    muddy: { face: PALETTE.brown, fill: PALETTE.tan, name: PALETTE.ink },
    spotlight: { face: PALETTE.blue, fill: PALETTE.yellow, name: PALETTE.white },
    stinky: { face: PALETTE.mauve, fill: PALETTE.pink, name: PALETTE.white },
    zoomies: { face: PALETTE.green, fill: PALETTE.yellow, name: PALETTE.ink },
  };
  return { chrome: createHudChrome(painter, painter, colours), views };
}

it("retains unchanged native chrome and repaints only changed debuff and progress groups", () => {
  const { chrome, views } = fixture();
  const run = testState({ archie: 3 });
  chrome.update(run);
  const count = views.length;
  chrome.update(run);
  expect(views).toHaveLength(count);
  const debuffed = {
    ...run,
    debuffs: [{ debuff: "muddy" as const, secondsLeft: 1, untilZone: run.zoneIndex }],
    zoneDistance: pixels(100),
  };
  chrome.update(debuffed);
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
  chrome.update(few);
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
  chrome.update(full);
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

it("centres a missing optional HUD icon's glyph in the authored well without drawing a legacy icon", () => {
  const { chrome, views } = fixture((key) => !key.startsWith("icon-hud-effect-"));
  chrome.update(testState({ archie: 3 }));
  const effect = views.at(-1)!;
  const well = walkBarLayout(SCREEN_LAYOUT.topBar, 1).effectWells[0]!;
  expect(effect.art).not.toHaveBeenCalled();
  expect(effect.text).toHaveBeenCalledWith(
    expect.objectContaining({ anchor: "centre", backing: well, x: well.x + well.width / 2 }),
  );
  chrome.dispose();
});
