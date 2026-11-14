import { type Random, randomPick } from "@andornaut/game-kit/random";

import { zoneSkins } from "../content/obstacleLooks.ts";
import type { GameData, MinorObstacleId, SkinId } from "../data/types.ts";

type LookData = Pick<GameData, "minorObstacles">;

// The skin a spawn of an obstacle wears in a zone: one of the zone's skins, evenly, drawn from
// random only when the zone has more than one. An obstacle with one look wears none.
export function pickSkin(
  data: LookData,
  random: Random,
  zone: string,
  obstacle: MinorObstacleId,
): SkinId | undefined {
  if (!("skins" in data.minorObstacles[obstacle])) {
    return undefined;
  }
  const skins = zoneSkins(data, zone, obstacle);
  const [only] = skins;
  if (only === undefined) {
    throw new Error(`${obstacle} has no skin in ${zone}`);
  }
  return skins.length === 1 ? only : randomPick(random, skins);
}
