import type { InputEvent } from "../cheats/index.ts";
import type { AchievementId, DebuffId, DogId, GearId, WalkerId, ZoneId } from "../data/ids.ts";
import type { GameData } from "../data/index.ts";
import type { ChoiceData, RunFacts } from "../rules/index.ts";
import type { WalkData, WalkItemKind, ZonePlanObservation } from "../runner/index.ts";
import type { PackDogs, RunState } from "../state/index.ts";
import type { Cents } from "../units.ts";
import type { ZoneDelivery } from "./delivery.ts";
import type { PolicyId, RoutePolicyId } from "./policies.ts";
import type { BotSight } from "./sight.ts";
import type { Skill } from "./skills.ts";
import type { PlanningFailure, ZoneWalkEvents } from "./walkEvents.ts";

export type SimData = ChoiceData &
  WalkData &
  Pick<
    GameData,
    | "achievements"
    | "defaultWalker"
    | "dogSlots"
    | "runText"
    | "upgradeDrawOrder"
    | "upgrades"
    | "walkerPerks"
  >;

// Who plays the walk: a steering bot of a skill, reading movers by sight or by foresight, plays
// the real walk loop, and what it hits and collects is measured.
export interface SimPlayer {
  readonly kind: "skill";
  readonly sight: BotSight;
  readonly skill: Skill;
}

export interface SimConfig {
  // Optional diagnostic sink; ordinary runs retain no full plans or snapshots.
  readonly observeSpawnPlan?: (observation: ZonePlanObservation, run: RunState) => void;
  readonly gear: GearId | null;
  readonly pack: PackDogs;
  readonly player: SimPlayer;
  readonly policy: PolicyId;
  readonly route: RoutePolicyId;
  readonly walker: WalkerId;
}

// One encounter card: what the option the policy took cost, and whether the policy fell back
// from its own rule to take it (null for a policy with no fallback).
export interface ChoiceRecord {
  readonly cost: Cents;
  readonly fellBack: boolean | null;
}

export interface FiringRecord {
  readonly dog: DogId;
  readonly zoneIndex: number;
}

export interface ZoneRecord {
  readonly fees: readonly { readonly amount: Cents; readonly dog: DogId }[];
  readonly zoneIndex: number;
}

// Of the items of a kind that reached the pack, met counts them all and touched those that
// touched it: an obstacle hit, or a pickup or lucky encounter collected. An obstacle passed
// during the grace after a hit counts as met, not touched.
export interface ItemCount {
  met: number;
  touched: number;
}

// Items by kind, and movers by the kind they meet the pack as.
export type ItemCounts = Partial<Record<WalkItemKind, ItemCount>>;

// Obstacle hits, minor ones and movers included, and those of them that came while a pull's move,
// AFTER_PULL_REACTION_SECONDS and a lane move back had not yet passed, from something not in the
// lane the pull moved the pack out of: hits the pull left the player no time to avoid.
export interface HitCounts {
  afterPull: number;
  all: number;
}
// What a debuff cost a run on the road: bumpsWhile, the landed bumps while it lasted, and
// centsLost, the cash it took, as the walk's own changes name it: its share of each tip's pay,
// such as Stinky's, and the cash bumps cost while it made them cost cash, such as Spotlight's.
// A bump in the step a debuff starts in is not counted toward it.
interface DebuffCost {
  bumpsWhile: number;
  centsLost: number;
}

export type DebuffCosts = Record<DebuffId, DebuffCost>;

// A run's walking in one zone, by the debuffs on the pack: clear holds the landed bumps and
// walking seconds with no debuff on it, and debuffs, for each debuff, the landed bumps while it
// lasted, the times the pack got it in the zone and the walking seconds it lasted, so a debuff's
// bumps per period compare against the zone's bump rate without one. A step counts toward a
// debuff when the run held it before and after the step, and toward clear when it held none.
interface ZoneDebuffs {
  readonly clear: { bumps: number; seconds: number };
  readonly debuffs: Partial<
    Record<DebuffId, { bumpsWhile: number; periods: number; seconds: number }>
  >;
}

export type DebuffsByZone = Partial<Record<ZoneId, ZoneDebuffs>>;

export interface RunResult {
  readonly planningFailure?: PlanningFailure;
  readonly spawnEvents: readonly ZoneWalkEvents[];
  // The achievements the run earns on its own facts, whatever the profile holds.
  readonly badges: readonly AchievementId[];
  // Encounter cards; forks are not counted.
  readonly cardsSeen: number;
  readonly choices: readonly ChoiceRecord[];
  // Each zone planned, in order: what its plan asked for and what it placed.
  readonly deliveries: readonly ZoneDelivery[];
  readonly debuffCosts: Readonly<Record<DebuffId, Readonly<DebuffCost>>>;
  readonly debuffsByZone: DebuffsByZone;
  // The cash the run carried and lost by ending early (walkEarnings).
  readonly cashLost: Cents;
  // The money banked at the end of the run.
  readonly earnings: Cents;
  // What the achievements judge the run on: its session counters and how it ended.
  readonly facts: RunFacts;
  readonly finished: boolean;
  readonly firings: readonly FiringRecord[];
  readonly hits: HitCounts;
  // A skill player's inputs, as the game logs them: with the seed, a replay of the run.
  readonly inputs: readonly InputEvent[];
  // Pulls that moved the pack.
  readonly pullsMoved: number;
  // Items that do not move, by kind, and movers, by mover.
  readonly items: ItemCounts;
  readonly movers: ItemCounts;
  // The zones walked, in order.
  readonly route: readonly ZoneId[];
  // The run as it ended.
  readonly run: RunState;
  readonly tips: Cents;
  // The zones finished, in order.
  readonly zones: readonly ZoneRecord[];
}
