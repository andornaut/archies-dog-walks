import type { TUNING } from "../tuning.ts";

// How many dogs a walk sets out with.
export type PackSize = 1 | 2 | 3;
export type Size = "large" | "medium" | "small";

// The tuning as the game reads it: every value is a number, so a live edit type-checks.
export type LiveTuning = typeof TUNING;
export type UnitGroup = keyof LiveTuning;

// Only keys whose value is a number, so a nested table can never be named as an amount.
export type NumberKeys<Group> = {
  [K in keyof Group]: Group[K] extends number ? K : never;
}[keyof Group];

// Keys into one unit group of the tuning, so a key from the wrong unit is a type error.
export type CountKey = NumberKeys<LiveTuning["counts"]>;
export type HeartsKey = NumberKeys<LiveTuning["hearts"]>;
export type MoneyKey = NumberKeys<LiveTuning["money"]>;
export type MultiplierKey = NumberKeys<LiveTuning["multipliers"]>;
export type SecondsKey = NumberKeys<LiveTuning["seconds"]>;
export type PriceKey = keyof LiveTuning["money"]["prices"];
export type ProbabilityKey = NumberKeys<LiveTuning["probability"]>;

// How a distraction mover steps on and off the road: into an edge lane and back off (visit),
// from an edge lane off (leave), or from the road's edge away (edge).
export type DistractionPattern = "edge" | "leave" | "visit";

type Table<Key extends PropertyKey> = Readonly<Record<Key, number>>;
type OpenGroup = Readonly<Record<string, number | Table<string>>>;

// The values the rules read by name; each group may hold more keys for cards to name.
export interface Tuning {
  readonly counts: OpenGroup & {
    readonly dartLanesPerSecond: number;
    readonly dartStopLanesMax: number;
    readonly dartStopLanesMin: number;
    readonly gearDropsPerZone: Table<number>;
    readonly luckyFindsPerZone: Table<string>;
    readonly maxDartMovers: number;
    readonly maxEmptyRows: number;
    readonly maxMovers: number;
    readonly maxSlowVehicles: number;
    readonly packSizeMax: number;
    readonly tipsFirstZone: number;
    readonly tipsGainPerZone: number;
    readonly treatsPerZone: number;
  };
  readonly hearts: OpenGroup & {
    readonly maxBySize: Table<Size>;
    readonly maxOwnerHearts: number;
    readonly packSizeBonus: Table<PackSize>;
    readonly treat: number;
  };
  readonly money: OpenGroup & {
    readonly payPerDog: number;
    readonly prices: Table<string>;
    readonly startPurse: number;
    readonly tip: number;
    readonly treatCash: number;
  };
  readonly multipliers: OpenGroup & {
    readonly distractionLeaveLingerShare: number;
    readonly distractionVisitLingerShare: number;
    readonly scrollSpeedGainPerZone: number;
  };
  readonly pixels: OpenGroup & { readonly roadScrollSpeed: number };
  readonly probability: OpenGroup & {
    readonly distractionPatternOdds: Table<DistractionPattern>;
    readonly smallDodgeChance: number;
  };
  readonly seconds: OpenGroup & {
    readonly ballBounceSeconds: number;
    readonly firingHoldSeconds: number;
    readonly hitStopSeconds: number;
    readonly lookAheadSeconds: number;
    readonly minorHitStopSeconds: number;
    readonly moverHopSeconds: number;
    readonly moverStepSeconds: number;
    readonly moverWarningSeconds: number;
    readonly pathReactionMargin: number;
    readonly pullReactionWindow: number;
    readonly pullTell: number;
    readonly zoneAtBaseSpeed: number;
  };
}
