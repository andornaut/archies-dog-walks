import type { Upgrade } from "./types.ts";

// Run-only boosts offered between zones. A picked card leaves the pool for the rest of the run.
// Its effects share one duration, which its plaque shows: now (an effect without one), the next
// zone, or the whole run. cardEffect is the effect in a few words, the line under the name on a path card;
// effect says it in full where there is room. Either may use {hearts}, the signed hearts its
// hearts effects give, {spawns}, what its tipSpawns modifiers multiply tips by, as "×2", and
// {tip}, what its tipValue modifiers add to a tip, signed.
// art is a key into the art manifest's images.
export const UPGRADES = {
  bellyRubs: {
    art: "card-belly-rubs",
    cardEffect: "{hearts} each",
    effect: "{hearts} each",
    effects: [{ amount: 1, kind: "hearts", target: { kind: "all" } }],
    kind: "boost",
    name: "Belly rubs",
  },
  bigTipper: {
    art: "card-big-tipper",
    cardEffect: "{tip} per tip",
    effect: "{tip} per tip",
    effects: [
      {
        by: "bigTipperTipBonus",
        duration: "nextZone",
        kind: "modifier",
        operation: "add",
        stat: "tipValue",
      },
    ],
    kind: "boost",
    name: "Big tipper",
  },
  charmer: {
    art: "card-charmer",
    cardEffect: "Free $ card",
    effect: "First card: cash options free",
    effects: [
      {
        by: "charmerFreeCards",
        duration: "run",
        kind: "modifier",
        operation: "add",
        stat: "freeCards",
      },
    ],
    kind: "boost",
    name: "Charmer",
  },
  goodLeash: {
    art: "card-good-leash",
    cardEffect: "No pulls",
    effect: "No pulls",
    effects: [
      {
        by: "goodLeashSquirrelPull",
        duration: "run",
        kind: "modifier",
        operation: "multiply",
        stat: "squirrelPulls",
      },
    ],
    kind: "boost",
    name: "Good leash",
  },
  raincoats: {
    art: "card-raincoats",
    cardEffect: "Puddle-safe",
    effect: "No Muddy from puddles or potholes",
    effects: [
      { duration: "run", encounter: "puddle", kind: "immune" },
      { duration: "run", encounter: "pothole", kind: "immune" },
    ],
    kind: "boost",
    name: "Raincoats",
  },
  rushHour: {
    art: "card-rush-hour",
    cardEffect: "More of all",
    effect: "Tips, treats {spawns}, more obstacles",
    effects: [
      {
        by: "rushHourPickups",
        duration: "nextZone",
        kind: "modifier",
        operation: "multiply",
        stat: "tipSpawns",
      },
      {
        by: "rushHourObstacles",
        duration: "nextZone",
        kind: "modifier",
        operation: "multiply",
        stat: "obstacleSpawns",
      },
      {
        by: "rushHourPickups",
        duration: "nextZone",
        kind: "modifier",
        operation: "multiply",
        stat: "treatSpawns",
      },
    ],
    kind: "tradeOff",
    name: "Rush hour",
  },
} as const satisfies Record<string, Upgrade>;

// The pool the forks draw upgrades from, in order: a seed's draws pick by position here, so
// reordering it changes which upgrades every seed offers. It lists every upgrade once, and the
// data page and the game data export list the upgrades in this order too.
export const UPGRADE_DRAW_ORDER = [
  "bellyRubs",
  "bigTipper",
  "goodLeash",
  "raincoats",
  "rushHour",
  "charmer",
] as const satisfies readonly (keyof typeof UPGRADES)[];
