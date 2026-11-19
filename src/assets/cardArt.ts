import { keysOf } from "@andornaut/game-kit/runtime/records";

import type { GameData } from "../data/types.ts";
import { remapToGrey } from "./greyRamp.ts";
import { gearSmallIconKey, perkIconKey, upgradeIconKey } from "./iconKeys.ts";
import { CARD_FRAME_KEY, cardZoneKey, DIFFICULTY_KEY } from "./spriteKeys.ts";

// The Skip card's illustration, which no option in the data names.
export const SKIP_CARD_ART = "card-skip";

export interface ChoiceCardAssets {
  readonly images: readonly string[];
  readonly sheets: readonly string[];
  readonly grey: ReadonlySet<string>;
}

// Native choice cards retain their existing illustration, frame and neutral-zero disabled art.
export function choiceCardAssets(
  data: Pick<GameData, "encounters" | "shopGear" | "upgrades" | "walkerPerks" | "world">,
): ChoiceCardAssets {
  const illustrations = [
    SKIP_CARD_ART,
    ...Object.values(data.encounters).flatMap(({ resolution }) =>
      resolution.kind === "card" ? resolution.options.map(({ art }) => art) : [],
    ),
    ...Object.values(data.upgrades).map(({ art }) => art),
    ...data.world.zones.map(cardZoneKey),
  ];
  return {
    grey: new Set([CARD_FRAME_KEY, "card-cost", "ui-fires", ...illustrations]),
    images: [
      ...new Set([
        "card-cost",
        "ui-effect-well",
        "ui-strip-well",
        ...illustrations,
        ...keysOf(data.shopGear).map((id) => `${gearSmallIconKey(id)}-20`),
        ...keysOf(data.upgrades).map((id) => `${upgradeIconKey(id)}-20`),
        ...keysOf(data.walkerPerks).map((id) => `${perkIconKey(id)}-20`),
      ]),
    ].sort(),
    sheets: [CARD_FRAME_KEY, "card-frame-large", DIFFICULTY_KEY, "ui-fires"].sort(),
  };
}

export function remapCardGrey(neutralRamp: readonly number[], pixels: Uint8ClampedArray): void {
  remapToGrey(neutralRamp, 0, pixels);
}

// A disabled choice card's neutral grey copy's logical path, by its art's (domArtPath).
export function cardGreyPath(path: string): string {
  return path.replace(/\.png$/, "-grey.png");
}
