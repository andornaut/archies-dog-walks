import { type Random, randomStream } from "@andornaut/game-kit/runtime/random";

import type { DogId, ZoneId } from "../../data/ids.ts";
import type { CardSource, GameData } from "../../data/index.ts";
import type { LaneDirection } from "../../layout/index.ts";
import {
  type CardData,
  cardFor,
  type CardView,
  type Choice,
  type ChoiceOutcome,
  chooseOption,
  expireAtZoneEnd,
  type MoneyChange,
  offerFork,
  openCard,
  read,
} from "../../rules/index.ts";
import type { RunState } from "../../state/index.ts";
import type { RoadGeometry } from "../walkGeometry.ts";
import { zoneLength } from "../walkMotion.ts";
import {
  planZoneWithContext,
  type ZonePlanFailure,
  zonePlanFailureMessage,
  type ZonePlanObservation,
} from "../zonePlan.ts";
import { holdForFiring } from "./firingStop.ts";
import { NO_PULLS, type PullData, type Pulls, type PullStep, stepPulls } from "./pulls.ts";
import {
  finishZone,
  headHome,
  resetZoneProgress,
  startRoad,
  steerWalk,
  stepWalk,
  type Walk,
  type WalkData,
  type WalkStep,
} from "./step.ts";
import { type DebuffMovementClock, hasDebuffDrift, stepDebuffMovement } from "./zoomies.ts";

// One walk's step order, shared by the run scene and the simulator: the inputs, the pulls, the
// Zoomies' drift, the walk, the firing hold, then the queued cards, the zone's end and the next
// zone's plan. The walk stands still while a card waits for its choice.

export type SessionData = CardData & Pick<GameData, "upgradeDrawOrder"> & PullData & WalkData;

// The run's random streams, each named from the seed, so a seed replays the same walk however
// the walk is driven. forks draws a fork's paths and upgrades what they carry, which the walk
// never draws from, so a seed offers the same forks however the walk goes. cards draws only the
// dogs' dodges. Each zone is planned from the seed and its zone index alone, from streams named
// by purpose (slotEntropy.ts) that restart from the seed with no saved count. draws counts the
// numbers cards, forks and upgrades have drawn for boundary resumes. Movement-debuff streams
// restart from the seed and zone index without a saved cursor.
export interface RunStreams {
  readonly cards: Random;
  debuffMovement(zone: number): Random;
  draws(): StreamDraws;
  readonly forks: Random;
  readonly observeSpawns?: (observation: ZonePlanObservation) => void;
  readonly seed: number;
  readonly upgrades: Random;
}

// How many numbers each of a run's streams has drawn.
export interface StreamDraws {
  readonly cards: number;
  readonly forks: number;
  readonly upgrades: number;
}

export const NO_DRAWS: StreamDraws = { cards: 0, forks: 0, upgrades: 0 };

// The road's geometry for the run's pack, which changes when an owner fires you.
type SessionGeometry = (run: RunState) => RoadGeometry;

// Where a choice or a neighbourhood cheat plans the zone that falls due: "inStep" plans it in the
// step; "deferred" leaves the session awaiting its plan (awaitsZonePlan) for withZonePlan to take
// the plan planZoneFromSeed makes elsewhere, such as in a worker, which is the same plan.
export type ZonePlanning = "deferred" | "inStep";

// What a step applies before it walks, in order: a lane move, or heading home, which ends the
// walk before the step.
export type SessionInput =
  { readonly direction: LaneDirection; readonly kind: "lane" } | { readonly kind: "home" };

export interface Session {
  // The card waiting for a choice.
  readonly card: CardView | null;
  // The road walked in the zones before this one.
  readonly distanceBeforeZone: number;
  // The next zone is planned once the cards after a zone's end are chosen.
  readonly needsZonePlan: boolean;
  readonly pulls: Pulls;
  // Cards still to open, in order.
  readonly queue: readonly CardSource[];
  // Run time: the milliseconds walked, hit stops included and cards not.
  readonly timeMs: number;
  readonly walk: Walk;
  // The zone's end waits behind the queued cards.
  readonly zoneEndPending: boolean;
  // Transient movement timing; neighbourhood boundaries reset the clock.
  readonly debuffMovement: DebuffMovementClock | null;
}

// What a step or a choice did, in order. input and chosen are stamped with the run time they
// applied at, which is where a replay applies them. walked has the road walked this run, zones
// before included. zoneEnded has the run before and after the zone's fees, and zonePlanned the
// walk as it stood before the plan.
export type SessionEvent =
  | { readonly kind: "cardOpened"; readonly view: CardView }
  | { readonly direction: LaneDirection; readonly kind: "drifted" }
  | {
      readonly choice: Choice;
      readonly kind: "chosen";
      readonly outcome: ChoiceOutcome;
      readonly timeMs: number;
      readonly view: CardView;
    }
  | { readonly input: SessionInput; readonly kind: "input"; readonly timeMs: number }
  | { readonly kind: "pulled"; readonly step: PullStep }
  | { readonly distance: number; readonly kind: "walked"; readonly step: WalkStep }
  | {
      readonly after: RunState;
      readonly before: RunState;
      readonly fees: readonly MoneyChange[];
      readonly kind: "zoneEnded";
    }
  | { readonly kind: "zonePlanned"; readonly unplanned: Walk };

export interface SessionStep {
  readonly events: readonly SessionEvent[];
  readonly session: Session;
}

// A walk cannot go on into a zone the planner has no plan for: the session stops with the
// planner's reason.
export class ZonePlanningError extends Error {
  readonly failure: ZonePlanFailure<string>;
  constructor(failure: ZonePlanFailure<string>) {
    super(zonePlanFailureMessage(failure));
    this.failure = failure;
    this.name = "ZonePlanningError";
  }
}

// A stream that counts its draws, having drawn skip numbers already.
function countedStream(seed: number, name: string, skip: number) {
  const random = randomStream(seed, name);
  for (let drawn = 0; drawn < skip; drawn++) {
    random();
  }
  let drawn = skip;
  return {
    drawn: () => drawn,
    random: () => {
      drawn += 1;
      return random();
    },
  };
}

// The run's streams, each having drawn as many numbers as drawn says: none for a new walk, and
// a resumed walk's count from when it was saved.
export function runStreams(seed: number, drawn: StreamDraws = NO_DRAWS): RunStreams {
  const cards = countedStream(seed, "cards", drawn.cards);
  const movementStreams = new Map<number, Random>();
  const debuffMovement = (zone: number): Random => {
    const existing = movementStreams.get(zone);
    if (existing !== undefined) {
      return existing;
    }
    const random = randomStream(seed, `debuffMovement-${zone}`);
    movementStreams.set(zone, random);
    return random;
  };
  const forks = countedStream(seed, "forks", drawn.forks);
  const upgrades = countedStream(seed, "upgrades", drawn.upgrades);
  return {
    cards: cards.random,
    debuffMovement,
    draws: () => ({
      cards: cards.drawn(),
      forks: forks.drawn(),
      upgrades: upgrades.drawn(),
    }),
    forks: forks.random,
    seed,
    upgrades: upgrades.random,
  };
}

// A walk about to start, its first zone planned.
export function startSession(
  data: SessionData,
  streams: RunStreams,
  geometry: SessionGeometry,
  walk: Walk,
): Session {
  return {
    ...unplannedStart(walk),
    needsZonePlan: false,
    walk: planCurrentZone(data, streams, geometry, walk),
  };
}

// A live neighbourhood cheat replaces the unfinished route slot without awarding completion. A
// session awaiting its plan jumps as the planned session would.
export function jumpToNeighbourhood(
  data: SessionData,
  streams: RunStreams,
  geometry: SessionGeometry,
  planning: ZonePlanning,
  laneCount: number,
  zone: ZoneId,
  session: Session,
): SessionStep {
  const { road, run } = session.walk;
  if (run.phase.kind === "ended") {
    return { events: [], session };
  }
  // At the fork the last neighbourhood has already ended and its distance has been counted.
  const leaving = !session.needsZonePlan || awaitsZonePlan(session);
  const nextRun = resetZoneProgress({
    ...(leaving ? expireAtZoneEnd(run.zoneIndex, run) : run),
    phase: { kind: "walking" },
    route: [...run.route.slice(0, run.zoneIndex), zone],
  });
  const start = unplannedStart({
    road: { ...startRoad(laneCount, road.speedFactor), nextItemId: road.nextItemId },
    run: nextRun,
  });
  return continueWalk(data, streams, geometry, planning, [], {
    ...start,
    distanceBeforeZone: session.distanceBeforeZone + (leaving ? run.zoneDistance : 0),
    timeMs: session.timeMs,
  });
}

// Whether the session waits for its zone's plan before it walks on: its cards are chosen and the
// zone it is about to walk is not yet planned, as a "deferred" step leaves it.
export function awaitsZonePlan(session: Session): boolean {
  return (
    session.needsZonePlan &&
    session.card === null &&
    session.queue.length === 0 &&
    !session.zoneEndPending &&
    session.walk.run.phase.kind !== "ended"
  );
}

// The session awaiting its plan, with the walk planZoneFromSeed planned for it, as the step that
// deferred the plan would have left it planning in the step.
export function withZonePlan(session: Session, planned: Walk): Session {
  return { ...session, needsZonePlan: false, walk: planned };
}

// A walk about to start, its first zone not yet planned: the point a walk resumes from until
// its first zone ends (resumeSession).
export function unplannedStart(walk: Walk): Session {
  return {
    card: null,
    debuffMovement: null,
    distanceBeforeZone: 0,
    needsZonePlan: true,
    pulls: NO_PULLS,
    queue: [],
    timeMs: 0,
    walk,
    zoneEndPending: false,
  };
}

// A walk saved between zones, or at its start, goes on: the fork it waited at opens, or the zone
// it was about to walk is planned, as they did when it was saved. Throws for a session saved
// anywhere else.
export function resumeSession(
  data: SessionData,
  streams: RunStreams,
  geometry: SessionGeometry,
  session: Session,
): SessionStep {
  if (!session.needsZonePlan || session.card !== null || session.zoneEndPending) {
    throw new Error("A walk resumes only between zones or at its start");
  }
  return continueWalk(data, streams, geometry, "inStep", [], { ...session, debuffMovement: null });
}

// The session at a fork as a walk resumes from it: the fork card closed and queued first again,
// so resumeSession opens it as the zone's end did. A session with no card open is as it was.
export function forkPoint(session: Session): Session {
  const { card, walk } = session;
  if (card === null) {
    return session;
  }
  return {
    ...session,
    card: null,
    queue: [card.source, ...session.queue],
    walk: { ...walk, run: { ...walk.run, phase: { kind: "walking" } } },
  };
}

// The session that just planned a zone as a walk resumes from it: as it stood before the plan,
// with the walk the zonePlanned event names, so resumeSession plans the zone again.
export function zoneStartPoint(session: Session, unplanned: Walk): Session {
  return { ...session, debuffMovement: null, needsZonePlan: true, walk: unplanned };
}

// One step of seconds: the inputs, the pulls, the Zoomies' drift, the walk, then the step's cards
// are queued and an owner who fired you holds the walk. Then the next card opens, or the zone ends,
// or the next zone is planned. Does nothing while a card is open or unless walking.
export function stepSession(
  data: SessionData,
  streams: RunStreams,
  geometry: SessionGeometry,
  seconds: number,
  inputs: readonly SessionInput[],
  session: Session,
): SessionStep {
  if (session.card !== null || session.walk.run.phase.kind !== "walking") {
    return { events: [], session };
  }
  const events: SessionEvent[] = [];
  const pressed: LaneDirection[] = [];
  let { walk } = session;
  for (const input of inputs) {
    if (input.kind === "home") {
      const home = headHomeSession({ ...session, walk });
      return { events: [...events, ...home.events], session: home.session };
    }
    events.push({ input, kind: "input", timeMs: session.timeMs });
    pressed.push(input.direction);
    walk = steerWalk(data, geometry(walk.run).laneCount, input.direction, walk);
  }
  const road = geometry(walk.run);
  const pulled = stepPulls(data, road, seconds, pressed, session.pulls, walk);
  events.push({ kind: "pulled", step: pulled });
  const zoomies = stepDebuffMovement(
    data,
    road,
    streams.debuffMovement(walk.run.zoneIndex),
    seconds,
    session.debuffMovement,
    pulled.walk,
  );
  if (zoomies.drifted !== null) {
    events.push({ direction: zoomies.drifted, kind: "drifted" });
  }
  const step = stepWalk(data, road, streams.cards, seconds, zoomies.walk);
  walk = step.walk;
  const distance = session.distanceBeforeZone + walk.run.zoneDistance;
  events.push({ distance, kind: "walked", step });
  const fired = [
    ...step.fired,
    ...[...step.contacts, ...step.instants].flatMap(({ outcome }) => outcome.fired),
  ];
  const walked: Session = {
    ...session,
    debuffMovement: zoomies.clock,
    pulls: pulled.pulls,
    queue: step.cards.length === 0 ? session.queue : [...session.queue, ...step.cards],
    timeMs: session.timeMs + seconds * 1000,
    walk,
    zoneEndPending: session.zoneEndPending || step.zoneEnded,
  };
  return continueWalk(
    data,
    streams,
    geometry,
    "inStep",
    events,
    heldForFiring(data, fired, walked),
  );
}

// Applies the choice on the open card, then opens the next card, or ends the zone, or plans
// the next zone. Throws with no card open.
export function chooseCard(
  data: SessionData,
  streams: RunStreams,
  geometry: SessionGeometry,
  choice: Choice,
  session: Session,
): SessionStep {
  return chooseCardPlanning(data, streams, geometry, "inStep", choice, session);
}

function chooseCardPlanning(
  data: SessionData,
  streams: RunStreams,
  geometry: SessionGeometry,
  planning: ZonePlanning,
  choice: Choice,
  session: Session,
): SessionStep {
  const view = session.card;
  if (view === null) {
    throw new Error("No card is open");
  }
  const { run } = session.walk;
  const outcome = chooseOption(data, run, view, choice);
  const events: SessionEvent[] = [
    { choice, kind: "chosen", outcome, timeMs: session.timeMs, view },
  ];
  const chosen: Session = {
    ...session,
    card: null,
    walk: { ...session.walk, run: outcome.state },
  };
  return continueWalk(
    data,
    streams,
    geometry,
    planning,
    events,
    heldForFiring(data, outcome.fired, chosen),
  );
}

// The choice made on the card that view shows, or nothing once that card is no longer open: a
// press on a card can arrive after its choice closed it, before its scene stops.
export function chooseShownCard(
  data: SessionData,
  streams: RunStreams,
  geometry: SessionGeometry,
  planning: ZonePlanning,
  view: CardView,
  choice: Choice,
  session: Session,
): SessionStep {
  return session.card === view
    ? chooseCardPlanning(data, streams, geometry, planning, choice, session)
    : { events: [], session };
}

// Heading home keeps what the finished zones earned; it is stamped at the run time of the step it comes
// before.
export function headHomeSession(session: Session): SessionStep {
  const input: SessionInput = { kind: "home" };
  return {
    events: [{ input, kind: "input", timeMs: session.timeMs }],
    session: { ...session, walk: { ...session.walk, run: headHome(session.walk.run) } },
  };
}

// The walk with its current zone planned from the seed, as a step plans it: the same seed and
// walk plan the same zone wherever they are planned. Throws a ZonePlanningError when the zone has
// no plan.
export function planZoneFromSeed(
  data: SessionData,
  geometry: SessionGeometry,
  seed: number,
  walk: Walk,
): Walk {
  return planCurrentZone(data, { seed }, geometry, walk);
}

function planCurrentZone(
  data: SessionData,
  streams: Pick<RunStreams, "observeSpawns" | "seed">,
  geometry: SessionGeometry,
  walk: Walk,
): Walk {
  const outcome = planZoneWithContext(
    data,
    geometry(walk.run),
    {
      ...(streams.observeSpawns === undefined ? {} : { observePlan: streams.observeSpawns }),
      seed: streams.seed,
      zoneIndex: walk.run.zoneIndex,
    },
    walk,
  );
  if (outcome.status === "failed") {
    throw new ZonePlanningError(outcome.failure);
  }
  return outcome.walk;
}

// An owner who just fired you holds the walk while their moment plays, as a hit stop does:
// the queued cards and the zone's end wait for it.
function heldForFiring(data: SessionData, fired: readonly DogId[], session: Session): Session {
  const { walk } = session;
  if (fired.length === 0 || walk.run.phase.kind === "ended") {
    return session;
  }
  const hold = holdForFiring(
    read(data.tuning, "seconds", "firingHoldSeconds"),
    fired,
    { cards: session.queue, zoneEnded: session.zoneEndPending },
    walk.road.hitStop,
  );
  return {
    ...session,
    queue: hold.queued.cards,
    walk: { ...walk, road: { ...walk.road, hitStop: hold.stop } },
    zoneEndPending: hold.queued.zoneEnded,
  };
}

function continueWalk(
  data: SessionData,
  streams: RunStreams,
  geometry: SessionGeometry,
  planning: ZonePlanning,
  events: SessionEvent[],
  current: Session,
): SessionStep {
  const session =
    current.debuffMovement !== null && !hasDebuffDrift(data, current.walk)
      ? { ...current, debuffMovement: null }
      : current;
  const { walk } = session;
  if (walk.run.phase.kind === "ended") {
    return { events, session };
  }
  const [source, ...queue] = session.queue;
  if (source !== undefined) {
    const run = openCard(source, walk.run);
    const view = cardFor(data, run, source);
    events.push({ kind: "cardOpened", view });
    return { events, session: { ...session, card: view, queue, walk: { ...walk, run } } };
  }
  if (session.zoneEndPending) {
    return endZone(data, streams, geometry, planning, events, {
      ...session,
      zoneEndPending: false,
    });
  }
  if (session.needsZonePlan && planning === "inStep") {
    const next = planCurrentZone(data, streams, geometry, walk);
    events.push({ kind: "zonePlanned", unplanned: walk });
    return { events, session: { ...session, needsZonePlan: false, walk: next } };
  }
  return { events, session };
}

// Pays the zone's fees, then, unless the walk is over, queues the fork, each of whose paths
// carries an upgrade, before the next zone is planned.
function endZone(
  data: SessionData,
  streams: RunStreams,
  geometry: SessionGeometry,
  planning: ZonePlanning,
  events: SessionEvent[],
  session: Session,
): SessionStep {
  const before = session.walk.run;
  const { fees, run } = finishZone(data, before);
  events.push({ after: run, before, fees, kind: "zoneEnded" });
  const ended: Session = { ...session, debuffMovement: null, walk: { ...session.walk, run } };
  if (run.phase.kind === "ended") {
    return { events, session: ended };
  }
  const fork: CardSource = offerFork(data, streams, run);
  return continueWalk(data, streams, geometry, planning, events, {
    ...ended,
    distanceBeforeZone: session.distanceBeforeZone + zoneLength(data),
    needsZonePlan: true,
    queue: [...session.queue, fork],
  });
}
