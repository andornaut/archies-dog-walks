import { newlyEarned } from "@andornaut/game-kit/runtime/achievements";
import { type Random, randomStream } from "@andornaut/game-kit/runtime/random";
import { keysOf } from "@andornaut/game-kit/runtime/records";

import type { InputEvent } from "../cheats/index.ts";
import type { DebuffId, DogId } from "../data/ids.ts";
import type { GameData } from "../data/index.ts";
import {
  currentZoneId,
  endReasonOf,
  lastHeartOwnersOf,
  newRun,
  runCountersOf,
  type RunFacts,
  walkEarnings,
} from "../rules/index.ts";
import {
  auditSpawnPlan,
  blocksLane,
  destinationLane,
  hasLeftRoad,
  laneMoveSeconds,
  moverPlace,
  moverY,
  type RoadGeometry,
  type SessionEvent,
  type Walk,
  type WalkItemKind,
  type WalkStep,
  type ZonePlanObservation,
} from "../runner/index.ts";
import { achievementJudge } from "../save/index.ts";
import { packDogs, type RunState } from "../state/index.ts";
import { type Cents, cents } from "../units.ts";
import { type ZoneDelivery, zoneDelivery } from "./delivery.ts";
import type {
  ChoiceRecord,
  DebuffCosts,
  DebuffsByZone,
  FiringRecord,
  HitCounts,
  ItemCount,
  ItemCounts,
  RunResult,
  SimConfig,
  SimData,
  ZoneRecord,
} from "./runResult.ts";
import { attachSpawnAudit, plannedWalkEvents, type ZoneWalkEvents } from "./walkEvents.ts";

// The reaction time a hit after a pull is measured against, fixed so the measure stays
// comparable when the tuning changes.
const AFTER_PULL_REACTION_SECONDS = 0.6;

// The run state and everything recorded about the run so far.
export interface Tally {
  // The lane the last pull moved the pack out of, and the bot clock until which a hit counts
  // as coming after it.
  afterPull: { readonly fromLane: number; readonly until: number } | null;
  cardsSeen: number;
  readonly choices: ChoiceRecord[];
  readonly debuffCosts: DebuffCosts;
  readonly debuffsByZone: DebuffsByZone;
  readonly deliveries: ZoneDelivery[];
  readonly spawnEvents: ZoneWalkEvents[];
  readonly spawnOrigins: Map<number, ZoneWalkEvents>;
  readonly firings: FiringRecord[];
  readonly hits: HitCounts;
  readonly inputs: InputEvent[];
  pullsMoved: number;
  readonly items: ItemCounts;
  readonly movers: ItemCounts;
  // What the card policy draws from, kept apart from the game's and the bot's draws so the
  // policies that never draw play identical runs.
  readonly policyRandom: Random;
  run: RunState;
  tips: Cents;
  readonly zones: ZoneRecord[];
}

// An item that reached the pack: under its mover if it moves, otherwise under its kind.
function countItem(
  tally: Tally,
  touched: boolean,
  item: { readonly kind: WalkItemKind; readonly moving: boolean },
): void {
  const counts: Partial<Record<string, ItemCount>> = item.moving ? tally.movers : tally.items;
  const key = item.kind;
  const count = counts[key] ?? { met: 0, touched: 0 };
  count.met += 1;
  count.touched += touched ? 1 : 0;
  counts[key] = count;
}

export function recordFirings(tally: Tally, before: RunState, fired: readonly DogId[]): void {
  for (const dog of fired) {
    tally.firings.push({ dog, zoneIndex: before.zoneIndex });
  }
}

// Counts items leaving the road, keeping unhit passed movers distinct from collisions.
// Other departures before the road edge touched the pack; the rest left the visible road.
export function countLeaving(
  data: SimData,
  tally: Tally,
  geometry: RoadGeometry,
  pulledFrom: number | null,
  before: Walk,
  step: WalkStep,
): void {
  const after = step.walk;
  if (after.road.items === before.road.items) {
    return;
  }
  const travel = after.run.zoneDistance - before.run.zoneDistance;
  const passed = new Set(step.passed.map(({ id }) => id));
  for (const item of before.road.items) {
    if (after.road.items.some(({ id }) => id === item.id)) {
      continue;
    }
    const { mover } = item;
    let touched: boolean;
    if (mover === undefined) {
      touched = item.y + travel < geometry.roadBottom;
    } else {
      const place = moverPlace(geometry.laneCount, mover.path, mover.since + travel);
      const y = moverY(geometry.roadTop, item.height, place);
      touched =
        !passed.has(item.id) &&
        !(hasLeftRoad(geometry.laneCount, place) || y >= geometry.roadBottom);
    }
    countItem(tally, touched, { kind: item.kind, moving: mover !== undefined });
    if (touched && blocksLane(data, item.kind)) {
      const inFromLane =
        pulledFrom !== null && pulledFrom >= item.lane && pulledFrom < item.lane + item.laneSpan;
      tally.hits.all += 1;
      tally.hits.afterPull += pulledFrom !== null && !inFromLane ? 1 : 0;
    }
  }
}

// Counts what each debuff cost in a walking step, from the run before it and the step's tips and
// bumps. A debuff lasted through the step when the run held it both before and after the step:
// one that ran out ended as the step began, so nothing in the step met it.
export function noteDebuffCosts(
  data: Pick<GameData, "debuffs">,
  costs: DebuffCosts,
  before: Pick<RunState, "debuffs">,
  step: Pick<WalkStep, "bumps" | "tips"> & {
    readonly walk: { readonly run: Pick<RunState, "debuffs"> };
  },
): void {
  for (const { change } of step.tips) {
    for (const cause of change.causes) {
      if (cause.kind === "modifier" && cause.source.kind === "debuff") {
        costs[cause.source.debuff].centsLost -= cause.amount;
      }
    }
  }
  const landed = step.bumps.filter(({ dodged }) => !dodged);
  if (landed.length === 0) {
    return;
  }
  const after = step.walk.run.debuffs.map(({ debuff }) => debuff);
  for (const debuff of after) {
    if (before.debuffs.some((active) => active.debuff === debuff)) {
      costs[debuff].bumpsWhile += landed.length;
    }
  }
  // A debuff held at a bump is still held after the step, so the one that made it cost cash is
  // among these.
  const cashing = after.find((debuff) => data.debuffs[debuff].bumpMoney !== undefined);
  if (cashing !== undefined) {
    costs[cashing].centsLost -= landed.reduce((sum, { cash }) => sum + (cash?.amount ?? 0), 0);
  }
}

// Counts a session step toward its zone's debuffs (ZoneDebuffs): the walking seconds it lasted
// and its landed bumps, toward each debuff the run held before and after it, or toward clear when
// it held none, and the debuffs the pack got in it.
export function noteZoneDebuffs(
  data: Pick<GameData, "world">,
  zones: DebuffsByZone,
  step: { readonly bumps: number; readonly seconds: number },
  before: Pick<RunState, "debuffs" | "debuffsGot" | "route" | "zoneIndex">,
  after: Pick<RunState, "debuffs" | "debuffsGot">,
): void {
  const id = currentZoneId(data, before);
  const zone = zones[id] ?? { clear: { bumps: 0, seconds: 0 }, debuffs: {} };
  zones[id] = zone;
  const cost = (debuff: DebuffId) => {
    const held = zone.debuffs[debuff] ?? { bumpsWhile: 0, periods: 0, seconds: 0 };
    zone.debuffs[debuff] = held;
    return held;
  };
  if (before.debuffs.length === 0 && after.debuffs.length === 0) {
    zone.clear.bumps += step.bumps;
    zone.clear.seconds += step.seconds;
  }
  for (const { debuff } of after.debuffs) {
    if (before.debuffs.some((active) => active.debuff === debuff)) {
      const held = cost(debuff);
      held.bumpsWhile += step.bumps;
      held.seconds += step.seconds;
    }
  }
  for (const debuff of keysOf(after.debuffsGot)) {
    const got = (after.debuffsGot[debuff] ?? 0) - (before.debuffsGot[debuff] ?? 0);
    if (got > 0) {
      cost(debuff).periods += got;
    }
  }
}

// Each pull that moved the pack starts the stretch in which a hit counts as coming after it.
export function notePulls(
  data: SimData,
  tally: Tally,
  clock: number,
  walk: Walk,
  pulled: readonly { readonly dog: DogId; readonly moved: boolean }[],
): void {
  const move = laneMoveSeconds(data, walk.run);
  for (const { moved } of pulled) {
    if (moved) {
      tally.pullsMoved += 1;
      tally.afterPull = {
        fromLane: destinationLane(walk.road.control.motion),
        until: clock + move + AFTER_PULL_REACTION_SECONDS + move,
      };
    }
  }
}

// The counts of the zone just planned, read from the road the plan left.
export function noteZonePlan(
  data: SimData,
  seed: number,
  tally: Tally,
  observations: Map<number, ZonePlanObservation>,
  observe: SimConfig["observeSpawnPlan"],
  walk: Walk,
): void {
  const { run } = walk;
  const observation = observations.get(run.zoneIndex);
  const selected =
    observation === undefined
      ? walk.road
      : {
          herrings: observation.planned.herrings,
          pending: observation.planned.events,
          planned: observation.plan.quotas.map(({ count, kind, mover }) => ({
            count,
            kind,
            movement: mover?.movement ?? null,
          })),
          ...(observation.slots === undefined ? {} : { slots: observation.slots }),
        };
  tally.deliveries.push(zoneDelivery(data, run.zoneIndex + 1, currentZoneId(data, run), selected));
  const events = plannedWalkEvents(seed, run, currentZoneId(data, run), selected);
  if (observation !== undefined) {
    events.admission = observation.planned.admission;
    attachSpawnAudit(
      events,
      auditSpawnPlan(observation.plan, observation.planned, observation.planned.visibility),
    );
    observations.delete(run.zoneIndex);
  }
  tally.spawnEvents.push(events);
  if (observation !== undefined) {
    observe?.(observation, run);
  }
}

// A choice's record: an encounter card seen, and the firings it brought about.
export function noteChoice(
  tally: Tally,
  fellBack: boolean | null,
  run: RunState,
  event: Extract<SessionEvent, { kind: "chosen" }>,
): void {
  const { choice, outcome, view } = event;
  recordFirings(tally, run, outcome.fired);
  if (view.source.kind === "fork") {
    return;
  }
  const option = view.options.find(({ index }) => index === choice);
  tally.cardsSeen += 1;
  tally.choices.push({ cost: option?.cost ?? cents(0), fellBack });
}

export function startTally(data: SimData, seed: number, config: SimConfig): Tally {
  return {
    afterPull: null,
    cardsSeen: 0,
    choices: [],
    debuffCosts: Object.fromEntries(
      Object.keys(data.debuffs).map((debuff) => [debuff, { bumpsWhile: 0, centsLost: 0 }]),
    ) as DebuffCosts,
    debuffsByZone: {},
    deliveries: [],
    firings: [],
    hits: { afterPull: 0, all: 0 },
    inputs: [],
    items: {},
    movers: {},
    policyRandom: randomStream(seed, "policy"),
    pullsMoved: 0,
    run: newRun(data, config.pack.length, {
      dogs: config.pack,
      gear: config.gear,
      walker: config.walker,
    }),
    spawnEvents: [],
    spawnOrigins: new Map(),
    tips: cents(0),
    zones: [],
  };
}

export function finishTally(
  data: SimData,
  config: SimConfig,
  tally: Tally,
  planningFailure: RunResult["planningFailure"],
): RunResult {
  const { banked, lost } = walkEarnings(endReasonOf(tally.run), tally.run);
  const facts: RunFacts = {
    ...runCountersOf(tally.run),
    dogsHome: packDogs(tally.run).length,
    earnedCents: banked,
    lastHeartOwners: lastHeartOwnersOf(tally.run),
    packSize: config.pack.length,
    zonesFinished: tally.zones.length,
  };
  return {
    ...(planningFailure === undefined ? {} : { planningFailure }),
    badges: newlyEarned(achievementJudge(data), data.achievements, "run", { run: facts }, []),
    cardsSeen: tally.cardsSeen,
    cashLost: lost,
    choices: tally.choices,
    debuffCosts: tally.debuffCosts,
    debuffsByZone: tally.debuffsByZone,
    deliveries: tally.deliveries,
    earnings: banked,
    facts,
    finished: tally.run.phase.kind === "ended" && tally.run.phase.reason === "finished",
    firings: tally.firings,
    hits: tally.hits,
    inputs: tally.inputs,
    items: tally.items,
    movers: tally.movers,
    pullsMoved: tally.pullsMoved,
    route: tally.run.route,
    run: tally.run,
    spawnEvents: tally.spawnEvents,
    tips: tally.tips,
    zones: tally.zones,
  };
}
