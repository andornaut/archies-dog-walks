// The data contracts as authored tables import them. Keep type implementation modules private.

import type {
  DebuffId,
  DogId,
  EncounterId,
  GearId,
  HintId,
  MinorObstacleId,
  MovementProfileId,
  UpgradeId,
  WalkerId,
  WalkerPerkId,
  ZoneId,
} from "./ids.ts";
import type { Achievement } from "./types/achievement.ts";
import type {
  Debuff,
  Dog,
  DogSlot,
  Encounter,
  Gear,
  MinorObstacle,
  MovementAssignment,
  SignatureProfile,
  Upgrade,
  Walker,
  WalkerPerk,
} from "./types/content.ts";
import type { HelpPage, Hint, HomeText, MenuText, Quips, RunText } from "./types/text.ts";
import type { LiveTuning } from "./types/tuning.ts";
import type { AmbientMover, World } from "./types/world.ts";

export type {
  AchievementId,
  DebuffId,
  DogId,
  EncounterId,
  GearId,
  HintId,
  LuckyEncounterId,
  MinorObstacleId,
  MovementProfileId,
  ObstacleEncounterId,
  SkinId,
  UpgradeId,
  WalkerId,
  WalkerPerkId,
  ZoneId,
} from "./ids.ts";
export type {
  Achievement,
  AchievementCondition,
  AchievementTier,
  Threshold,
} from "./types/achievement.ts";
export type {
  CardOption,
  CardOptions,
  CardSource,
  ConfiguredMovement,
  Debuff,
  DebuffDriftMovement,
  DodgeEffect,
  Dog,
  DogSlot,
  Duration,
  Effect,
  Encounter,
  Gear,
  HeartsEffect,
  MinorLookId,
  MinorObstacle,
  Modifier,
  ModifierEffect,
  MoneyEffect,
  MoveCount,
  Movement,
  MovementAssignment,
  MovementKind,
  NeighbourhoodId,
  OptionPicks,
  SharedHeartsEffect,
  SignatureProfile,
  Stat,
  StopLanes,
  TallyId,
  Target,
  Unlock,
  Upgrade,
  UpgradeDuration,
  Walker,
  WalkerPerk,
} from "./types/content.ts";
export type {
  CharmEffect,
  HelpPage,
  HelpPictureId,
  Hint,
  HintTrigger,
  HomeText,
  MenuText,
  QuipMoment,
  Quips,
  RunText,
} from "./types/text.ts";
export type {
  DistractionPattern,
  LiveTuning,
  MoneyKey,
  MultiplierKey,
  NumberKeys,
  PackSize,
  PriceKey,
  ProbabilityKey,
  SecondsKey,
  Size,
  Tuning,
  UnitGroup,
} from "./types/tuning.ts";
export type {
  AmbientGait,
  AmbientMover,
  Difficulty,
  SpawnSlotCounts,
  SpawnSlotRole,
  World,
  Zone,
  ZoneWeights,
} from "./types/world.ts";

export interface GameData {
  // In tier order, easy first, keeping authored order within each tier.
  readonly achievements: readonly [Achievement, ...Achievement[]];
  // Each zone's ambient movers.
  readonly ambient: Readonly<Record<ZoneId, readonly AmbientMover[]>>;
  readonly debuffs: Readonly<Record<DebuffId, Debuff>>;
  // The walker a new player starts with.
  readonly defaultWalker: WalkerId;
  readonly dogSlots: readonly [DogSlot, ...DogSlot[]];
  readonly dogs: Readonly<Record<DogId, Dog>>;
  readonly encounters: Readonly<Record<EncounterId, Encounter>>;
  readonly help: readonly [HelpPage, ...HelpPage[]];
  readonly hints: Readonly<Record<HintId, Hint>>;
  readonly homeText: HomeText;
  readonly menuText: MenuText;
  readonly minorObstacles: Readonly<Record<MinorObstacleId, MinorObstacle>>;
  readonly movementAssignments: Readonly<
    Partial<Record<EncounterId | MinorObstacleId, MovementAssignment>>
  >;
  readonly movementProfiles: Readonly<Partial<Record<MovementProfileId, SignatureProfile>>>;
  readonly quips: Readonly<Record<DogId, Quips>>;
  readonly runText: RunText;
  readonly shopGear: Readonly<Record<GearId, Gear>>;
  readonly tuning: LiveTuning;
  // Every upgrade once, in the order the forks draw from (UPGRADE_DRAW_ORDER).
  readonly upgradeDrawOrder: readonly UpgradeId[];
  readonly upgrades: Readonly<Record<UpgradeId, Upgrade>>;
  readonly walkerPerks: Readonly<Record<WalkerPerkId, WalkerPerk>>;
  readonly walkers: Readonly<Record<WalkerId, Walker>>;
  readonly world: World;
}
