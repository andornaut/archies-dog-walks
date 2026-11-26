import { STEP_SECONDS } from "@andornaut/game-kit/runtime/clock/fixedStep";
import { chance, type Random } from "@andornaut/game-kit/runtime/random";

import type { DogId } from "../data/ids.ts";
import type { LaneDirection } from "../layout/index.ts";
import {
  laneMotionConfig,
  type PullEvent,
  type Pulls,
  type RoadGeometry,
  steerLane,
  steerWalk,
  type Walk,
  type WalkData,
} from "../runner/index.ts";
import { planLanes, WAIT_MARGIN } from "./lanePlan.ts";
import {
  type Bot,
  botView,
  controlRead,
  laneMoveRead,
  moveBelieved,
  perceiveAt,
} from "./perception.ts";
import type { BotSight } from "./sight.ts";
import type { Skill } from "./skills.ts";

export { moverHazards, moverPrizes } from "./moverContacts.ts";
export { laneMoveRead, moveBelieved, observeDrift, observeRoad } from "./perception.ts";

// The walk as the bot reads it: speed is the scroll speed in pixels per second.
export interface BotRoad {
  readonly data: WalkData;
  readonly geometry: RoadGeometry;
  readonly speed: number;
}

// Times within this are the same moment.
const SAME_MOMENT = 1e-9;
// A mistimed lane change comes up to this late.
const MISTIME_SECONDS = 0.25;
// The soonest a mistake is noticed, so a bot with no reaction delay still takes a frame.
const NOTICE_SECONDS = STEP_SECONDS;
// How long before a hazard a plan clears its lanes where it can. A replan during a lane change
// starts from when that change ends, which the change's late start, up to a step, has already
// pushed back, and still counts the next change up to a step late, so it has up to a step and a
// wait margin less to spare than the plan before it.
const SLACK_SECONDS = STEP_SECONDS + WAIT_MARGIN;
// How far apart the planner's waiting times are, besides the ends of hazards.
const GRID_SECONDS = 0.1;

export function newBot(random: Random, sight: BotSight, skill: Skill): Bot {
  return {
    appearedAt: new Map(),
    clock: 0,
    drifts: [],
    lastInputAt: -Infinity,
    late: [],
    noticeAt: null,
    paths: new Map(),
    perceived: new Set(),
    perceivedTells: new Set(),
    plan: [],
    random,
    recoversAt: -Infinity,
    replan: true,
    sight,
    sights: new Map(),
    skill,
    slowing: new Map(),
    target: null,
    tellsAt: new Map(),
  };
}

// The walk steps' length a lane change lasts: it ends on the first step at or after its
// duration.
function wholeSteps(seconds: number): number {
  return Math.ceil(seconds / STEP_SECONDS - SAME_MOMENT) * STEP_SECONDS;
}

// The bot plans from the lane control and lane move as it reads them (controlRead, laneMoveRead).
function replan(bot: Bot, road: BotRoad, pulls: Pulls, walk: Walk): void {
  const control = controlRead(bot, walk);
  const { motion } = control;
  const moving = motion.kind === "moving";
  // A pull during a lane change moves the target without turning the pack: it finishes the
  // change, then heads for the target, a lane change per lane.
  const lane = control.target;
  const turns = moving ? Math.abs(lane - motion.to) : 0;
  const readyAt = moving ? motion.duration - motion.elapsed + turns * motion.duration : 0;
  const settled = readyAt > 0 ? readyAt + WAIT_MARGIN : 0;
  const moveSeconds = wholeSteps(laneMoveRead(bot, road.data, walk.run));
  const { laneChangeCooldown, lookAheadSeconds } = bot.skill;
  const view = botView(bot, road, pulls, walk);
  const moves = planLanes(
    {
      gridSeconds: GRID_SECONDS,
      horizon: lookAheadSeconds,
      laneCount: road.geometry.laneCount,
      moveSeconds,
      moveStep: Math.max(moveSeconds, laneChangeCooldown),
      slackSeconds: SLACK_SECONDS,
    },
    {
      lane,
      movableAt: Math.max(
        readyAt,
        settled,
        bot.lastInputAt + laneChangeCooldown - bot.clock,
        bot.recoversAt - bot.clock,
      ),
      readyAt,
    },
    view.hazards,
    view.prizes,
    view.pulls,
  );
  bot.plan = moves.map((move) => ({ ...move, at: bot.clock + move.at }));
  bot.replan = false;
}

// A lane change that does not take, such as one off the road, makes the bot replan. It moves the
// lane control the bot believes in too.
function steer(
  bot: Bot,
  road: BotRoad,
  lanes: LaneDirection[],
  direction: LaneDirection,
  walk: Walk,
): Walk {
  const { laneCount } = road.geometry;
  const steered = steerWalk(road.data, laneCount, direction, walk);
  moveBelieved(bot, (control) =>
    steerLane(laneMotionConfig(road.data, laneCount, walk.run), direction, control),
  );
  lanes.push(direction);
  bot.lastInputAt = bot.clock;
  if (steered.road.control.target === walk.road.control.target) {
    bot.replan = true;
  }
  return steered;
}

// A planned lane change, unless the bot errs: then it is missed or comes late, the rest of
// the plan is dropped, and the bot replans once it notices.
function attempt(
  bot: Bot,
  road: BotRoad,
  lanes: LaneDirection[],
  direction: LaneDirection,
  walk: Walk,
): Walk {
  const { errorRate, reactionSeconds } = bot.skill;
  if (!chance(bot.random, errorRate)) {
    return steer(bot, road, lanes, direction, walk);
  }
  bot.plan = [];
  const noticed = Math.max(reactionSeconds, NOTICE_SECONDS);
  if (chance(bot.random, 0.5)) {
    bot.noticeAt = bot.clock + noticed;
  } else {
    const at = bot.clock + bot.random() * MISTIME_SECONDS;
    bot.late.push({ at, direction });
    bot.noticeAt = at + noticed;
  }
  return walk;
}

// A dog's tell starts the wait before the bot sees it. After a pull, the bot drags back, if that is
// better, once it has reacted to the pull and the pull's move has ended. A pull the bot did not see
// coming spoils its plan until it has seen the tell; one it saw coming was in its plan. A pull
// toward the lane the pack already heads for moved nothing, so the bot replans without it. A tell
// after a pull, for a target with pulls left, starts the wait again.
export function observePulls(
  bot: Bot,
  tells: readonly { readonly dog: DogId }[],
  pulled: readonly PullEvent[],
): void {
  for (const { dog, moved } of pulled) {
    if (moved) {
      bot.recoversAt = Math.max(bot.recoversAt, bot.clock + bot.skill.reactionSeconds);
    }
    if (bot.perceivedTells.has(dog) || !moved) {
      bot.replan = true;
    } else {
      bot.plan = [];
      const seen = (bot.tellsAt.get(dog) ?? bot.clock) + bot.skill.reactionSeconds;
      bot.noticeAt = Math.max(bot.noticeAt ?? -Infinity, seen, bot.clock + NOTICE_SECONDS);
    }
    bot.tellsAt.delete(dog);
    bot.perceivedTells.delete(dog);
  }
  for (const { dog } of tells) {
    bot.tellsAt.set(dog, bot.clock);
    bot.perceivedTells.delete(dog);
  }
}

// Everything the bot does at its clock time: perceives the items, tells, Zoomies drifts and
// debuffs that slow lane changes due, notices a mistake, replans when it has something new or
// the pack heads for a lane it did not steer for, and makes the lane changes due: the lane moves
// it makes, in order, and the walk they steer. Nothing during a hit stop, which drops lane
// changes.
export function actBot(
  bot: Bot,
  road: BotRoad,
  pulls: Pulls,
  walk: Walk,
): { readonly lanes: readonly LaneDirection[]; readonly walk: Walk } {
  const lanes: LaneDirection[] = [];
  if (walk.road.hitStop !== null) {
    return { lanes, walk };
  }
  const due = bot.clock + SAME_MOMENT;
  const { driftReactionSeconds } = bot.skill;
  for (let drift = bot.drifts[0]; drift !== undefined; drift = bot.drifts[0]) {
    if (drift.at + driftReactionSeconds > due) {
      break;
    }
    bot.drifts.shift();
    bot.replan = true;
  }
  for (const slowing of bot.slowing.values()) {
    if (!slowing.perceived && slowing.at + driftReactionSeconds <= due) {
      slowing.perceived = true;
      bot.replan = true;
    }
  }
  if (bot.target !== null && bot.target !== controlRead(bot, walk).target) {
    bot.replan = true;
  }
  let acted = walk;
  for (const item of acted.road.items) {
    if (!bot.perceived.has(item.id) && perceiveAt(bot, road, item) <= due) {
      bot.perceived.add(item.id);
      bot.replan = true;
    }
  }
  for (const [dog, at] of bot.tellsAt) {
    if (!bot.perceivedTells.has(dog) && at + bot.skill.reactionSeconds <= due) {
      bot.perceivedTells.add(dog);
      bot.replan = true;
    }
  }
  for (const [id, sight] of bot.sights) {
    for (
      let next = sight.seen[0];
      next !== undefined && next.at + bot.skill.reactionSeconds <= due;
      next = sight.seen[0]
    ) {
      sight.seen.shift();
      sight.perceived = next;
      sight.paths = null;
      bot.replan ||= bot.perceived.has(id);
    }
  }
  for (;;) {
    const lateIndex = bot.late.findIndex((move) => move.at <= due);
    const late = bot.late[lateIndex];
    if (late !== undefined) {
      bot.late.splice(lateIndex, 1);
      acted = steer(bot, road, lanes, late.direction, acted);
      continue;
    }
    if (bot.noticeAt !== null && bot.noticeAt <= due) {
      bot.noticeAt = null;
      bot.replan = true;
    }
    if (bot.noticeAt === null && bot.replan) {
      replan(bot, road, pulls, acted);
    }
    const move = bot.plan[0];
    if (move === undefined || move.at > due) {
      bot.target = controlRead(bot, acted).target;
      return { lanes, walk: acted };
    }
    bot.plan.shift();
    acted = attempt(bot, road, lanes, move.direction, acted);
  }
}
