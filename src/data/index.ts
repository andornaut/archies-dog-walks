import { orderByTier } from "@andornaut/game-kit/runtime/achievements";

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
import { UPGRADE_DRAW_ORDER, UPGRADES } from "./upgrades.ts";
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
    upgradeDrawOrder: values.UPGRADE_DRAW_ORDER,
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
  UPGRADE_DRAW_ORDER,
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

// The public entry of src/data/ also carries its Tech-owned modules' surface; modules outside it
// import the authored data files directly.
export {
  AFFORD_OUTSET,
  BADGE_NAME_PAD,
  BADGE_STRIP,
  BAR_TITLE_INSET,
  BODY_PITCH,
  BUFF_POP_PLACE,
  BUTTON_FACE_EDGE,
  BUTTON_LIP_PX,
  BUTTON_SIZE,
  CARD_HEADER,
  CELEBRATIONS,
  CHANGE_CHIP,
  CHARM,
  CHECK_SIZE,
  CHOICE_CARDS,
  DEBUFF_BAR,
  DOG_CARD_PARTS,
  END_SCREEN,
  FACE_SIZE,
  FIRED_LINE,
  FLY_REACH_ICON_GAP,
  GEAR_ICON,
  HELP_SCREEN,
  HOME_SCREEN,
  HUD_LANES,
  ICON_LABEL_GAP,
  INLINE_FACE,
  LABEL_HELP_GAP,
  LABEL_ICON,
  LABEL_VALUE_GAP,
  LOADING_WALKER_START,
  LOGBOOK_PAGE,
  LOW_CHIP,
  MARK_OFFSET,
  MENU_BUTTON_KEY_GAP,
  MESSAGE_STRIP,
  MIN_PRESS,
  MODAL_SPACING,
  MODAL_WIDTHS,
  MOMENT_PARTS,
  MONEY_LABEL_PLACE,
  OWNER_CARD_FACE,
  OWNER_LEAD,
  OWNER_TAB,
  PAGE,
  PAUSE_PANEL,
  PILL,
  PILL_IMAGE_GAP,
  PLATE_PAD,
  PROGRESS_BORDER,
  ROWS_PAGE,
  SELECT_OUTSET,
  SETTINGS_CARD,
  SHOP_PAGE,
  SLICES,
  SPARE_TREAT_PIP,
  TOP_BAR_HEIGHT,
  TOP_BAR_SIZES,
  UI_FUNCTION_ICON_SIZE,
  UI_PICTURE_SIZE,
  WALK_BAR_PARTS,
  WIDE_BUTTON_X,
  ZONE_BANNER,
  ZONE_PILL_SIZES,
} from "./layout.ts";
export { LANE_COUNT, ROAD_FAR_SCALE, SCREEN_CONFIG, type ScreenConfig } from "./screen.ts";
export type {
  Achievement,
  AchievementCondition,
  AchievementTier,
  AmbientGait,
  AmbientMover,
  CardOption,
  CardSource,
  CharmEffect,
  Debuff,
  DebuffDriftMovement,
  Difficulty,
  DistractionPattern,
  DodgeEffect,
  Dog,
  Duration,
  Effect,
  Encounter,
  GameData,
  HeartsEffect,
  HelpPage,
  HelpPictureId,
  HintTrigger,
  HomeText,
  LiveTuning,
  MenuText,
  MinorLookId,
  Modifier,
  ModifierEffect,
  MoneyEffect,
  MoveCount,
  Movement,
  MovementKind,
  MultiplierKey,
  NeighbourhoodId,
  NumberKeys,
  OptionPicks,
  PackSize,
  PriceKey,
  ProbabilityKey,
  QuipMoment,
  SecondsKey,
  SharedHeartsEffect,
  SignatureProfile,
  Size,
  SpawnSlotCounts,
  SpawnSlotRole,
  Stat,
  StopLanes,
  TallyId,
  Target,
  Threshold,
  UnitGroup,
  Unlock,
  Upgrade,
  UpgradeDuration,
  Walker,
  WalkerPerk,
  World,
  Zone,
  ZoneWeights,
} from "./types.ts";
