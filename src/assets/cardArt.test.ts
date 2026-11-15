import { describe, expect, it } from "vitest";

import manifest from "../../public/art/manifest.json" with { type: "json" };
import { gameData } from "../data/index.ts";
import { choiceCardAssets, remapCardGrey, SKIP_CARD_ART } from "./cardArt.ts";

const images = new Set(manifest.images.map(({ key }) => key));

describe("card art", () => {
  it("finds every card option's, upgrade's, instant popup's and the Skip card's art", () => {
    const { encounters, upgrades } = gameData;
    const keys = [
      SKIP_CARD_ART,
      ...Object.values(encounters).flatMap(({ resolution }) =>
        resolution.kind === "instant"
          ? [resolution.art]
          : resolution.kind === "card"
            ? resolution.options.map((option) => option.art)
            : [],
      ),
      ...Object.values(upgrades).map((upgrade) => upgrade.art),
    ];
    expect(keys.filter((key) => !images.has(key))).toEqual([]);
  });
});

it("registers every native choice surface and preserves the card-specific zero-step neutral policy", () => {
  const assets = choiceCardAssets(gameData);
  const sheets = new Set(manifest.sprites.map(({ key }) => key));
  expect(assets.images.filter((key) => !images.has(key))).toEqual([]);
  expect(assets.sheets.filter((key) => !sheets.has(key))).toEqual([]);
  const neutral = [0xffffff, 0x000000];
  const lightest = neutral[0]!;
  const rgba = new Uint8ClampedArray([
    (lightest >> 16) & 255,
    (lightest >> 8) & 255,
    lightest & 255,
    173,
  ]);
  const before = rgba.slice();
  remapCardGrey(neutral, rgba);
  expect(rgba).toEqual(before);
});
