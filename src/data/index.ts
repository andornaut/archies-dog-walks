import { orderByTier } from "@andornaut/game-kit/achievements";

import { ACHIEVEMENTS } from "./achievements.ts";
import { AMBIENT } from "./ambient.ts";
import { DEBUFFS } from "./debuffs.ts";
import { DOGS } from "./dogs.ts";
import { DOG_SLOTS } from "./dogSlots.ts";
import { ENCOUNTERS } from "./encounters.ts";
import { HELP_PAGES } from "./help.ts";
import { HINTS } from "./hints.ts";
import { HOME_TEXT } from "./homeText.ts";
import { MENU_TEXT } from "./menuText.ts";
import { MINOR_OBSTACLES } from "./minorObstacles.ts";
import { MOVEMENT_ASSIGNMENTS, MOVEMENT_PROFILES } from "./movementProfiles.ts";
import { QUIPS } from "./quips.ts";
import { RUN_TEXT } from "./runText.ts";
import { SHOP_GEAR } from "./shop.ts";
import { TUNING } from "./tuning.ts";
import type { AchievementTier, GameData } from "./types.ts";
import { UPGRADES } from "./upgrades.ts";
import { DEFAULT_WALKER, WALKER_PERKS, WALKERS } from "./walkers.ts";
import { WORLD } from "./world.ts";

// The badge wall's order, easiest first.
const ACHIEVEMENT_TIERS: readonly AchievementTier[] = ["easy", "medium", "hard"];

// The catalogue in the badge wall's order, set once for every reader.
function wallOrder(achievements: GameData["achievements"]): GameData["achievements"] {
  const [first, ...rest] = orderByTier(ACHIEVEMENT_TIERS, achievements);
  if (first === undefined) {
    throw new Error("The game data needs a badge");
  }
  return [first, ...rest];
}

function toGameData(values: ValueExports): GameData {
  return {
    achievements: wallOrder(values.ACHIEVEMENTS),
    ambient: values.AMBIENT,
    debuffs: values.DEBUFFS,
    defaultWalker: values.DEFAULT_WALKER,
    dogSlots: values.DOG_SLOTS,
    dogs: values.DOGS,
    encounters: values.ENCOUNTERS,
    help: values.HELP_PAGES,
    hints: values.HINTS,
    homeText: values.HOME_TEXT,
    menuText: values.MENU_TEXT,
    minorObstacles: values.MINOR_OBSTACLES,
    movementAssignments: values.MOVEMENT_ASSIGNMENTS,
    movementProfiles: values.MOVEMENT_PROFILES,
    quips: values.QUIPS,
    runText: values.RUN_TEXT,
    shopGear: values.SHOP_GEAR,
    tuning: values.TUNING,
    upgrades: values.UPGRADES,
    walkerPerks: values.WALKER_PERKS,
    walkers: values.WALKERS,
    world: values.WORLD,
  };
}

const INITIAL_VALUES = {
  ACHIEVEMENTS,
  AMBIENT,
  DEBUFFS,
  DEFAULT_WALKER,
  DOGS,
  DOG_SLOTS,
  ENCOUNTERS,
  HELP_PAGES,
  HINTS,
  HOME_TEXT,
  MENU_TEXT,
  MINOR_OBSTACLES,
  MOVEMENT_ASSIGNMENTS,
  MOVEMENT_PROFILES,
  QUIPS,
  RUN_TEXT,
  SHOP_GEAR,
  TUNING,
  UPGRADES,
  WALKERS,
  WALKER_PERKS,
  WORLD,
} as const;
type ValueExports = typeof INITIAL_VALUES;

let values: ValueExports = INITIAL_VALUES;
const live: { -readonly [K in keyof GameData]: GameData[K] } = toGameData(values);

// The one live copy of the game data. Read it at the time of use, never cache a value from
// it: in development, editing a value file replaces its group here without a page reload.
export const gameData: GameData = live;

const changeListeners = new Set<() => void>();

// Called after an edited value file is swapped in, so a view can redraw what it derived.
export function onGameDataChange(listener: () => void): void {
  changeListeners.add(listener);
}

if (import.meta.hot) {
  import.meta.hot.accept(
    [
      "./achievements.ts",
      "./ambient.ts",
      "./debuffs.ts",
      "./dogSlots.ts",
      "./dogs.ts",
      "./encounters.ts",
      "./help.ts",
      "./hints.ts",
      "./homeText.ts",
      "./menuText.ts",
      "./minorObstacles.ts",
      "./movementProfiles.ts",
      "./quips.ts",
      "./runText.ts",
      "./shop.ts",
      "./tuning.ts",
      "./upgrades.ts",
      "./walkers.ts",
      "./world.ts",
    ],
    (modules) => {
      // Only the edited modules are defined; the others keep their current values.
      values = Object.assign({}, values, ...modules.filter((module) => module !== undefined));
      Object.assign(live, toGameData(values));
      changeListeners.forEach((listener) => listener());
    },
  );
}
