import type { World } from "./types.ts";
import { CABBAGETOWN } from "./zones/cabbagetown.ts";
import { DISTILLERY_DISTRICT } from "./zones/distilleryDistrict.ts";
import { HIGH_PARK } from "./zones/highPark.ts";
import { KENSINGTON_MARKET } from "./zones/kensingtonMarket.ts";
import { THE_BEACHES } from "./zones/theBeaches.ts";
import { YONGE_STREET } from "./zones/yongeStreet.ts";

// The first world. A walk starts on firstZone, then picks each next zone at a fork from those
// not yet walked. Zones are listed from easiest to hardest, and each is the same distance.
export const WORLD = {
  firstZone: "highPark",
  lastZone: "yongeStreet",
  name: "Toronto",
  preForkRoute: ["highPark", "distilleryDistrict", "kensingtonMarket", "yongeStreet"],
  walkLength: 4,
  zones: [
    HIGH_PARK,
    CABBAGETOWN,
    KENSINGTON_MARKET,
    THE_BEACHES,
    DISTILLERY_DISTRICT,
    YONGE_STREET,
  ],
} as const satisfies World;
