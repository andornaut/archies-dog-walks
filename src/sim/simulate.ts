import { STEP_SECONDS } from "@andornaut/game-kit/runtime/clock/fixedStep";
import { randomStream } from "@andornaut/game-kit/runtime/random";

import { LANE_COUNT } from "../data/index.ts";
import type { CardView, Choice } from "../rules/index.ts";
import {
  advanceLaneControl,
  chooseCard,
  laneMotionConfig,
  pullLane,
  roadScrollSpeed,
  runStreams,
  screenRoadGeometry,
  type SessionInput,
  type SessionStep,
  startRoad,
  startSession,
  stepSession,
  type Walk,
  type ZonePlanObservation,
} from "../runner/index.ts";
import type { RunState } from "../state/index.ts";
import { addCents } from "../units.ts";
import {
  actBot,
  type BotRoad,
  moveBelieved,
  newBot,
  observeDrift,
  observePulls,
  observeRoad,
} from "./bot.ts";
import { choosePath, pickCardOption } from "./policies.ts";
import type { RunResult, SimConfig, SimData } from "./runResult.ts";
import {
  countLeaving,
  finishTally,
  noteChoice,
  noteDebuffCosts,
  notePulls,
  noteZoneDebuffs,
  noteZonePlan,
  recordFirings,
  startTally,
  type Tally,
} from "./tally.ts";
import { capturePlanningFailure, recordWalkEvents } from "./walkEvents.ts";

export type {
  DebuffCosts,
  DebuffsByZone,
  ItemCount,
  RunResult,
  SimConfig,
  SimData,
  SimPlayer,
} from "./runResult.ts";
export { noteDebuffCosts, noteZoneDebuffs } from "./tally.ts";

// The policies' choice on the open card: the route policy's path at a fork, or the card
// policy's option, with whether the card policy fell back (null at a fork).
function policyChoice(
  data: SimData,
  config: SimConfig,
  tally: Tally,
  run: RunState,
  card: CardView,
): { readonly choice: Choice; readonly fellBack: boolean | null } {
  const { source } = card;
  if (source.kind === "fork") {
    return {
      choice: choosePath(tally.policyRandom, config.route, source.paths.length),
      fellBack: null,
    };
  }
  return pickCardOption(data, tally.policyRandom, config.policy, run, card);
}

// What the bot reads of the road: its geometry for the pack and the zone's scroll speed.
function botRoadOf(data: SimData, walk: Walk): BotRoad & { readonly pack: RunState["pack"] } {
  return {
    data,
    geometry: screenRoadGeometry(walk.run),
    pack: walk.run.pack,
    speed: roadScrollSpeed(data, walk),
  };
}

// The bot plays the walk on the game's own session, a step of STEP_SECONDS at a time as the
// game steps it: its lane moves are the steps' inputs, and the policies choose each
// card as it opens. The inputs are logged as the game logs them, so the run's seed and log
// replay it in the game. A Zoomies drift reaches the bot as the walk makes it, and the pulls and
// walking that follow move the lane control it believes in until it reacts (observeDrift).
function playBySkill(data: SimData, seed: number, config: SimConfig, tally: Tally): void {
  const { player } = config;
  const observations = new Map<number, ZonePlanObservation>();
  const streams = {
    ...runStreams(seed),
    observeSpawns: (observation: ZonePlanObservation) =>
      observations.set(observation.context.zoneIndex, observation),
  };
  const bot = newBot(randomStream(seed, "bot"), player.sight, player.skill);
  const start = { road: startRoad(LANE_COUNT), run: tally.run };
  let session = startSession(data, streams, screenRoadGeometry, start);
  noteZonePlan(data, seed, tally, observations, config.observeSpawnPlan, session.walk);
  let road = botRoadOf(data, session.walk);
  while (session.walk.run.phase.kind !== "ended") {
    const { card, walk } = session;
    tally.run = walk.run;
    const clock = bot.clock;
    let acted = walk;
    // Whether the card policy fell back on this step's card, for its choice's record.
    let fellBack: boolean | null = null;
    let step: SessionStep;
    if (card === null) {
      if (walk.run.pack !== road.pack) {
        road = botRoadOf(data, walk);
      }
      observeRoad(bot, road, walk);
      const action = actBot(bot, road, session.pulls, walk);
      const inputs = action.lanes.map((direction): SessionInput => ({ direction, kind: "lane" }));
      step = stepSession(data, streams, screenRoadGeometry, STEP_SECONDS, inputs, session);
      bot.clock += STEP_SECONDS;
      acted = action.walk;
      if (walk.road.hitStop !== null) {
        bot.replan = true;
      }
    } else {
      const picked = policyChoice(data, config, tally, walk.run, card);
      fellBack = picked.fellBack;
      step = chooseCard(data, streams, screenRoadGeometry, picked.choice, session);
      bot.replan = true;
    }
    let pulledWalk = acted;
    let landed = 0;
    for (const event of step.events) {
      switch (event.kind) {
        case "cardOpened":
          bot.replan = true;
          break;
        case "chosen":
          noteChoice(tally, fellBack, walk.run, event);
          tally.inputs.push({ choice: event.choice, kind: "card", timeMs: event.timeMs });
          break;
        case "input":
          tally.inputs.push({ ...event.input, timeMs: event.timeMs });
          break;
        case "drifted":
          observeDrift(bot, pulledWalk.road.control);
          break;
        case "pulled":
          for (const { direction, moved } of event.step.pulled) {
            if (moved) {
              moveBelieved(bot, (control) =>
                pullLane(
                  laneMotionConfig(data, road.geometry.laneCount, acted.run),
                  direction,
                  control,
                ),
              );
            }
          }
          observePulls(bot, event.step.tells, event.step.pulled);
          notePulls(data, tally, clock, acted, event.step.pulled);
          pulledWalk = event.step.walk;
          break;
        case "walked": {
          // The walk holds the pack still through a hit stop.
          if (walk.road.hitStop === null) {
            const { run } = pulledWalk;
            moveBelieved(bot, (control) =>
              advanceLaneControl(
                laneMotionConfig(data, road.geometry.laneCount, run),
                STEP_SECONDS,
                control,
              ),
            );
          }
          const { afterPull } = tally;
          const pulledFrom =
            afterPull !== null && bot.clock <= afterPull.until ? afterPull.fromLane : null;
          const zoneEvents = tally.spawnEvents.at(-1);
          if (zoneEvents !== undefined) {
            recordWalkEvents(tally.spawnOrigins, zoneEvents, pulledWalk, event.step);
          }
          countLeaving(data, tally, road.geometry, pulledFrom, pulledWalk, event.step);
          noteDebuffCosts(data, tally.debuffCosts, pulledWalk.run, event.step);
          landed = event.step.bumps.filter(({ dodged }) => !dodged).length;
          for (const { outcome } of [...event.step.contacts, ...event.step.instants]) {
            recordFirings(tally, pulledWalk.run, outcome.fired);
          }
          recordFirings(tally, pulledWalk.run, event.step.fired);
          tally.tips = event.step.tips.reduce(
            (sum, tip) => addCents(sum, tip.change.amount),
            tally.tips,
          );
          if (event.step.bumps.length > 0) {
            bot.replan = true;
          }
          break;
        }
        case "zoneEnded":
          tally.zones.push({
            fees: event.fees.flatMap(({ amount, dog }) => (dog === null ? [] : [{ amount, dog }])),
            zoneIndex: event.before.zoneIndex,
          });
          break;
        case "zonePlanned":
          noteZonePlan(data, seed, tally, observations, config.observeSpawnPlan, step.session.walk);
          road = botRoadOf(data, step.session.walk);
          bot.replan = true;
          break;
      }
    }
    const walking = card === null && walk.road.hitStop === null;
    noteZoneDebuffs(
      data,
      tally.debuffsByZone,
      { bumps: landed, seconds: walking ? STEP_SECONDS : 0 },
      walk.run,
      step.session.walk.run,
    );
    session = step.session;
    tally.run = session.walk.run;
  }
  tally.run = session.walk.run;
}

// One run on the real rules: each zone planned as the game plans it, items hit, collected or
// avoided by the player, cards chosen by the policy, fees paid at each zone's end, then an
// upgrade picked and the route policy's path taken at the fork before the next zone.
// Deterministic for a given seed. A skill player's run draws from the game's named streams
// (runStreams) and the bot's and policies' own, so its seed and inputs replay it in the game.
export function simulateRun(data: SimData, seed: number, config: SimConfig): RunResult {
  const tally = startTally(data, seed, config);
  const planningFailure = capturePlanningFailure(seed, () =>
    playBySkill(data, seed, config, tally),
  );
  return finishTally(data, config, tally, planningFailure);
}
