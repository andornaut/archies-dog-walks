import { keysOf } from "@andornaut/game-kit/runtime/records";
import { describe, expect, it } from "vitest";

import manifest from "../../public/art/manifest.json" with { type: "json" };
import { DOM_ART_KEYS } from "../assets/domArt.ts";
import { gameData } from "../data/index.ts";
import { modifiersOf } from "../rules/modifiers.ts";
import { activeModifier, testState } from "../testing/runState.ts";
import {
  effectIconKey,
  type EffectItem,
  effectItems,
  hudEffectIconKey,
  spareTreatWell,
  walkBarIconKey,
  walkerEffectItems,
} from "./effectIcons.ts";

describe("effectItems", () => {
  it("lists the perk, the Pocket's gear, the found gear, then the upgrades in pick order", () => {
    const run = testState(
      { kilo: 5 },
      {
        foundGear: "whistle",
        gear: "luckyCollar",
        immunities: [{ encounter: "puddle", source: { kind: "upgrade", upgrade: "raincoats" } }],
        modifiers: [
          activeModifier(
            { kind: "upgrade", upgrade: "bigTipper" },
            { by: "bigTipperTipBonus", operation: "add", stat: "tipValue" },
          ),
        ],
        upgradesPicked: ["raincoats", "bellyRubs", "bigTipper"],
        walker: "trista",
      },
    );
    expect(effectItems(gameData, run)).toEqual([
      { kind: "perk", perk: gameData.walkers.trista.perk },
      { gear: "luckyCollar", kind: "gear" },
      { found: true, gear: "whistle", kind: "gear" },
      { kind: "upgrade", upgrade: "raincoats" },
      { kind: "upgrade", upgrade: "bigTipper" },
    ]);
  });

  it("drops an upgrade once its effects expire, and never shows one applied at once", () => {
    const run = testState({ kilo: 5 }, { upgradesPicked: ["bigTipper", "bellyRubs"] });
    expect(effectItems(gameData, run)).toEqual(walkerEffectItems(gameData, run.walker));
  });
});

describe("effectIconKey", () => {
  it("names an icon for every upgrade, gear item and perk, and the manifest has the upgrades' and gear's", () => {
    const keys = new Set(manifest.images.map((image) => image.key));
    const shipped: EffectItem[] = [
      ...keysOf(gameData.upgrades).map((upgrade): EffectItem => ({
        kind: "upgrade",
        upgrade,
      })),
      ...keysOf(gameData.shopGear).map((gear): EffectItem => ({
        gear,
        kind: "gear",
      })),
    ];
    expect(shipped.map(effectIconKey).filter((key) => !keys.has(key))).toEqual([]);
    const perks = keysOf(gameData.walkerPerks).map((perk) => effectIconKey({ kind: "perk", perk }));
    expect(new Set(perks).size).toBe(perks.length);
  });
});

describe("spareTreatWell", () => {
  const fanny = modifiersOf(gameData.shopGear.fannyPack.effects);
  // The Fanny pack in the Pocket or found, the Lucky collar in the other place, holding held.
  const holding = (found: boolean, held: number) => {
    const source = found
      ? ({ found: true, gear: "fannyPack", kind: "gear" } as const)
      : ({ gear: "fannyPack", kind: "gear" } as const);
    return testState(
      { kilo: 5 },
      {
        foundGear: found ? "fannyPack" : "luckyCollar",
        gear: found ? "luckyCollar" : "fannyPack",
        modifiers: fanny.map((modifier) => activeModifier(source, modifier)),
        spareTreats: { held, spent: 0, stored: held },
      },
    );
  };
  // The walk's wells: the perk's, the Pocket's, then the found item's.
  it.each([
    { expected: 1, found: false, held: 1, name: "the Pocket's Fanny pack's well, holding one" },
    { expected: 2, found: true, held: 1, name: "the found Fanny pack's well, holding one" },
    { expected: -1, found: false, held: 0, name: "no well, holding none" },
  ])("shows $name", ({ expected, found, held }) => {
    const run = holding(found, held);
    expect(spareTreatWell(effectItems(gameData, run), run)).toBe(expected);
  });
});

it("registers the dedicated native HUD icon family without changing world icon identities", () => {
  const items: EffectItem[] = [
    ...keysOf(gameData.shopGear).map((gear): EffectItem => ({ gear, kind: "gear" })),
    ...keysOf(gameData.walkerPerks).map((perk): EffectItem => ({ kind: "perk", perk })),
    ...keysOf(gameData.upgrades).map((upgrade): EffectItem => ({ kind: "upgrade", upgrade })),
  ];
  const keys = items.map(hudEffectIconKey);
  expect(keys.slice().sort()).toEqual([
    "icon-hud-effect-gear-fanny-pack",
    "icon-hud-effect-gear-hall-pass",
    "icon-hud-effect-gear-lucky-collar",
    "icon-hud-effect-gear-running-shoes",
    "icon-hud-effect-gear-whistle",
    "icon-hud-effect-perk-keen-eye",
    "icon-hud-effect-perk-long-reach",
    "icon-hud-effect-perk-quick-recovery",
    "icon-hud-effect-perk-second-chance",
    "icon-hud-effect-upgrade-belly-rubs",
    "icon-hud-effect-upgrade-big-tipper",
    "icon-hud-effect-upgrade-charmer",
    "icon-hud-effect-upgrade-good-leash",
    "icon-hud-effect-upgrade-raincoats",
    "icon-hud-effect-upgrade-rush-hour",
  ]);
  expect([...keys, "ui-hud-effect-well"].filter((key) => !DOM_ART_KEYS.has(key))).toEqual([]);
  const fanny = { gear: "fannyPack", kind: "gear" } as const;
  expect(effectIconKey(fanny)).toBe("icon-gear-fanny-pack");
  expect(walkBarIconKey(fanny)).toBe("icon-gear-fanny-pack-20");
});
