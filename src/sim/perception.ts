import { getOrInsertComputed } from "@andornaut/game-kit/runtime/maps";
import type { Random } from "@andornaut/game-kit/runtime/random";

import type { DebuffId, DogId } from "../data/ids.ts";
import { laneMask } from "../layout/index.ts";
import {
  contactWindow,
  isObstacleCategory,
  isPullObstacle,
  itemCategory,
  type LaneControl,
  laneMoveSeconds,
  moverOutcomes,
  type MoverPath,
  pickupReach,
  type Pulls,
  type Walk,
  type WalkData,
  type WalkItem,
} from "../runner/index.ts";
import type { RunState } from "../state/index.ts";
import type { BotRoad } from "./bot.ts";
import type { LaneHazard, LanePrize, LanePull, PlannedMove } from "./lanePlan.ts";
import { itemLanes, MARGIN_SECONDS, moverHazards, moverPrizes } from "./moverContacts.ts";
import { type BotSight, moverShows, sightPaths } from "./sight.ts";
import type { Skill } from "./skills.ts";

// What a mover showed (moverShows) from since scroll after its cue appeared, first seen at
// clock time at.
interface Sighting {
  readonly at: number;
  readonly shows: string;
  readonly since: number;
}

// A mover as a bot that reads by sight has it: what it has perceived the mover show, the paths it
// reads from that, worked out when first needed, and what it has seen the mover show since,
// oldest first, each perceived reactionSeconds after it was seen.
interface MoverSight {
  paths: readonly MoverPath[] | null;
  perceived: Sighting;
  readonly seen: Sighting[];
}

// A Zoomies drift the bot has yet to react to: the clock time it saw the drift at, and the pack's
// lane control as the bot believes it until it reacts: as it would be without this drift and
// those after it.
interface UnseenDrift {
  readonly at: number;
  believed: LaneControl;
}

// A debuff on the pack that slows its lane changes, such as Muddy: the clock time the bot first
// saw it at, and whether it has reacted to it yet.
interface SlowingSeen {
  readonly at: number;
  perceived: boolean;
}

// A steering bot's state. clock is the seconds walked this run, hit stops included and cards
// not. Moves are at clock times. target is the lane the pack headed for, as the bot read it, when
// the bot last acted, null before it has. late holds mistimed lane changes still to come;
// noticeAt, when set, is when the bot notices its mistake, and until then it does not replan.
// tellsAt is when each leaning dog's tell started. sight is how it reads movers: by foresight,
// paths holds each mover's path as last seen; by sight, sights holds what each mover has shown.
// drifts holds the Zoomies drifts it has yet to react to, oldest first, and slowing the debuffs
// on the pack that slow its lane changes.
export interface Bot {
  readonly appearedAt: Map<number, number>;
  clock: number;
  readonly drifts: UnseenDrift[];
  readonly late: PlannedMove[];
  lastInputAt: number;
  noticeAt: number | null;
  readonly paths: Map<number, MoverPath>;
  readonly perceived: Set<number>;
  readonly perceivedTells: Set<DogId>;
  plan: PlannedMove[];
  // The bot's own stream: its errors never shift the game's draws.
  readonly random: Random;
  // After a pull, the bot changes lanes no sooner than this clock time.
  recoversAt: number;
  replan: boolean;
  readonly sight: BotSight;
  readonly sights: Map<number, MoverSight>;
  readonly skill: Skill;
  readonly slowing: Map<DebuffId, SlowingSeen>;
  target: number | null;
  readonly tellsAt: Map<DogId, number>;
}

// A gear drop is worth what a lucky find is: the bot grabs both alike.
const PRIZE_VALUES = { gear: 1, lucky: 1, tip: 1, treat: 1 } as const;

const OUTCOMES = new WeakMap<object, readonly MoverPath[]>();

// The paths a mover may yet take, as a bot that reads by foresight has them: its own, or, for a
// stalker or shy hopper with moves still to choose, every way it may choose them, since each
// choice waits on where the pack is then.
function pathsAhead(path: MoverPath): readonly MoverPath[] {
  if ((path.motion !== "approach" && path.motion !== "shy") || path.pending.length === 0) {
    return [path];
  }
  return getOrInsertComputed(path, () => moverOutcomes(path), OUTCOMES);
}

// The lane mask within reach lanes of the mask's lanes, on a road laneCount lanes wide.
function widenMask(laneCount: number, reach: number, mask: number): number {
  let widened = mask;
  for (let step = 0; step < reach; step++) {
    widened |= (widened << 1) | (widened >> 1);
  }
  return widened & laneMask(0, laneCount);
}

// When an item comes into view: at the far edge of the road, or, with visionSeconds, once it
// is that close to the pack. A mover shows from its warning cue on.
function visibleAt(bot: Bot, appeared: number, contactStart: number, mover: boolean): number {
  const { visionSeconds } = bot.skill;
  return visionSeconds === undefined || mover
    ? appeared
    : Math.max(appeared, bot.clock + contactStart - visionSeconds);
}

export function perceiveAt(bot: Bot, road: BotRoad, item: WalkItem): number {
  const appeared = bot.appearedAt.get(item.id) ?? bot.clock;
  const { start } = contactWindow(road.geometry.packBand, road.speed, item.y, item.height);
  return visibleAt(bot, appeared, start, item.mover !== undefined) + bot.skill.reactionSeconds;
}

// What a bot that reads by sight sees a mover show: a change is perceived reactionSeconds after
// it is seen.
function observeMover(bot: Bot, id: number, mover: NonNullable<WalkItem["mover"]>): void {
  const sighting = {
    at: bot.clock,
    shows: moverShows(mover.path, mover.since),
    since: mover.since,
  };
  const sight = bot.sights.get(id);
  if (sight === undefined) {
    bot.sights.set(id, { paths: null, perceived: sighting, seen: [] });
  } else if ((sight.seen.at(-1) ?? sight.perceived).shows !== sighting.shows) {
    sight.seen.push(sighting);
  }
}

// Whether a debuff slows the pack's lane changes, such as Muddy.
function slowsLanes(data: Pick<WalkData, "debuffs">, debuff: DebuffId): boolean {
  return data.debuffs[debuff].modifiers.some(({ stat }) => stat === "agility");
}

// Records when each debuff on the pack that slows its lane changes was first seen, and forgets
// those that have run out.
function observeSlowing(bot: Bot, data: Pick<WalkData, "debuffs">, run: RunState): void {
  for (const debuff of bot.slowing.keys()) {
    if (!run.debuffs.some((active) => active.debuff === debuff)) {
      bot.slowing.delete(debuff);
    }
  }
  for (const { debuff } of run.debuffs) {
    if (!bot.slowing.has(debuff) && slowsLanes(data, debuff)) {
      bot.slowing.set(debuff, { at: bot.clock, perceived: false });
    }
  }
}

// How long a lane move takes as the bot reads it: at the pack's speed without the debuffs that
// slow it which the bot has yet to react to, such as a Muddy that has just begun.
export function laneMoveRead(bot: Bot, data: WalkData, run: RunState): number {
  const unseen = (debuff: DebuffId) => bot.slowing.get(debuff)?.perceived === false;
  if (!run.debuffs.some(({ debuff }) => unseen(debuff))) {
    return laneMoveSeconds(data, run);
  }
  return laneMoveSeconds(data, {
    ...run,
    debuffs: run.debuffs.filter(({ debuff }) => !unseen(debuff)),
  });
}

// A Zoomies drift the pack made in the step just walked, from control, its lane control just
// before the drift. The bot reacts to it driftReactionSeconds after it sees it, and until then plans
// as if the pack had not drifted.
export function observeDrift(bot: Bot, control: LaneControl): void {
  bot.drifts.push({ at: bot.clock, believed: control });
}

// Moves the pack's lane control as the bot believes it, for each drift it has yet to react to,
// as the walk moves the pack's own: by a lane change, a pull or a walking step.
export function moveBelieved(bot: Bot, change: (control: LaneControl) => LaneControl): void {
  for (const drift of bot.drifts) {
    drift.believed = change(drift.believed);
  }
}

// The pack's lane control as the bot reads it: as it would be without the drifts it has yet to
// react to.
export function controlRead(bot: Bot, walk: Walk): LaneControl {
  return bot.drifts[0]?.believed ?? walk.road.control;
}

// Records when each item new on the road came into view, from how far the road has scrolled
// since, and forgets items that have left. By foresight, a mover whose path has changed, a
// stalker that has chosen a step, makes the bot replan; by sight, what each mover shows is
// recorded. A debuff that slows lane changes is recorded when first seen.
export function observeRoad(bot: Bot, road: BotRoad, walk: Walk): void {
  observeSlowing(bot, road.data, walk.run);
  const { items } = walk.road;
  let oldest = Infinity;
  for (const item of items) {
    oldest = Math.min(oldest, item.id);
    if (!bot.appearedAt.has(item.id)) {
      const scrolled = item.mover?.since ?? item.y - (road.geometry.roadTop - item.height);
      bot.appearedAt.set(item.id, bot.clock - scrolled / road.speed);
    }
    const { mover } = item;
    if (mover !== undefined && bot.sight === "sight") {
      observeMover(bot, item.id, mover);
    }
    const path = mover?.path;
    if (path !== undefined && bot.sight === "foresight") {
      const seen = bot.paths.get(item.id);
      if (seen !== undefined && seen !== path) {
        bot.replan = true;
      }
      bot.paths.set(item.id, path);
    }
  }
  for (const id of bot.appearedAt.keys()) {
    if (id < oldest) {
      bot.appearedAt.delete(id);
      bot.paths.delete(id);
      bot.perceived.delete(id);
      bot.sights.delete(id);
    }
  }
}

// The paths the bot reads a mover as taking: by foresight, every path it may yet take; by sight,
// those it may take from what the bot has perceived it show.
function pathsRead(bot: Bot, road: BotRoad, item: WalkItem): readonly MoverPath[] {
  const { mover } = item;
  if (mover === undefined) {
    return [];
  }
  if (bot.sight === "foresight") {
    return pathsAhead(mover.path);
  }
  const sight = bot.sights.get(item.id);
  if (sight === undefined) {
    return sightPaths(road, mover.since, item);
  }
  sight.paths ??= sightPaths(road, sight.perceived.since, item);
  return sight.paths;
}

// What the bot steers around and toward: every item it has perceived that has not yet passed
// the pack, within its planning horizon.
export function botView(
  bot: Bot,
  road: BotRoad,
  pulls: Pulls,
  walk: Walk,
): {
  readonly hazards: LaneHazard[];
  readonly prizes: LanePrize[];
  readonly pulls: LanePull[];
} {
  const { data, geometry, speed } = road;
  const hazards: LaneHazard[] = [];
  const prizes: LanePrize[] = [];
  const horizon = bot.skill.lookAheadSeconds;
  for (const item of walk.road.items) {
    // A pull obstacle is harmless to touch: only its pulls matter.
    if (!bot.perceived.has(item.id) || isPullObstacle(data, item.kind)) {
      continue;
    }
    const category = itemCategory(data, item.kind);
    if (item.mover !== undefined) {
      const paths = pathsRead(bot, road, item);
      if (isObstacleCategory(category)) {
        hazards.push(...moverHazards(road, horizon, paths, item));
      } else {
        prizes.push(...moverPrizes(road, horizon, PRIZE_VALUES[category], paths, item));
      }
      continue;
    }
    const { end, start } = contactWindow(geometry.packBand, speed, item.y, item.height);
    if (end <= 0 || start > horizon) {
      continue;
    }
    const lanes = itemLanes(item);
    if (isObstacleCategory(category)) {
      hazards.push({ from: start - MARGIN_SECONDS, lanes, to: end + MARGIN_SECONDS });
    } else {
      const reach =
        category === "lucky" || category === "gear" ? 0 : pickupReach(data, walk.run, category);
      prizes.push({
        at: start,
        lanes: widenMask(geometry.laneCount, reach, lanes),
        value: PRIZE_VALUES[category],
      });
    }
  }
  // A strain seen coming is planned as a pull when its tell runs out within the look-ahead;
  // one waiting on its target, such as a squirrel that does not move yet, is reacted to once
  // it pulls.
  const { strain } = pulls;
  const seenPulls: LanePull[] =
    strain !== null &&
    strain.tellSeconds > 0 &&
    strain.tellSeconds < horizon &&
    bot.perceivedTells.has(strain.dog)
      ? [
          {
            at: strain.tellSeconds,
            direction: strain.direction,
            reactSeconds: bot.skill.reactionSeconds,
          },
        ]
      : [];
  return { hazards, prizes, pulls: seenPulls };
}
