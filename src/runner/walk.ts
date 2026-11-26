import { assertNever } from "@andornaut/game-kit/runtime/assertNever";
import { chance, type Random } from "@andornaut/game-kit/runtime/random";
import { pixels } from "@andornaut/game-kit/runtime/units";

import type { DogId, EncounterId, GearId, MinorObstacleId } from "../data/ids.ts";
import type { CardSource, GameData, MovementKind } from "../data/index.ts";
import { formationOrder, type LaneDirection } from "../layout/index.ts";
import {
  affectedDogs,
  applyInstantEncounter,
  applyMinorContact,
  bumpCash,
  bumpParts,
  changeHearts,
  changeModified,
  type ChoiceOutcome,
  countBump,
  countLandedBump,
  countTally,
  expireAtZoneEnd,
  fireOwnersAtZero,
  fullPackBonus,
  grabGear,
  grabTreat,
  type HeartChange,
  hitLabel,
  modifiedStat,
  type ModifiedValue,
  modifiedValue,
  modifierCause,
  modifierCauses,
  modifierCausesOf,
  type MoneyChange,
  negatedCauses,
  opensCard,
  payZone,
  reachModified,
  read,
  spendSpareTreat,
  tickDebuffs,
  tipValue,
  type TreatGrabbed,
  walkLength,
} from "../rules/index.ts";
import { packDogs, type RunState } from "../state/index.ts";
import { addCents } from "../units.ts";
import {
  type Box,
  collideWithPack,
  type CollisionRules,
  hitDog,
  overlaps,
  pickupDog,
  tickInvulnerability,
} from "./collision.ts";
import {
  type HeldStep,
  type HitStop,
  hitStopLength,
  startHitStop,
  tickHitStop,
} from "./hitStop.ts";
import { advanceLaneControl, type LaneControl, laneControlIn, steerLane } from "./laneControl.ts";
import { stillInLane } from "./laneMotion.ts";
import { laneAt, moveMovers, type MoverItem, moverPlace, moverY } from "./movers.ts";
import { componentHitLength, itemHeight, obstacleHitBox, walkItemBox } from "./obstacleGeometry.ts";
import type { AdmissionReport } from "./spawnAdmission.ts";
import { type PathRow, type SpawnEvent, takeDueSpawns } from "./spawning.ts";
import { signatureContact } from "./walkContacts.ts";
import type { RoadGeometry } from "./walkGeometry.ts";
import {
  footprintOf,
  isGearDrop,
  isMinorObstacle,
  isObstacle,
  isPickup,
  isPullObstacle,
  type PickupKind,
  type WalkItem,
  type WalkItemKind,
  type WalkSpawn,
} from "./walkItems.ts";
import { laneMotionConfig, roadScrollSpeed, zoneLength } from "./walkMotion.ts";
import { shyHopped, stalkersStepped } from "./walkMoverChoices.ts";
import { packBoxes, sweptPackBoxes } from "./walkPackPlacement.ts";
import { passedWalker, scrolledItems, signatureOnRoad } from "./walkRoadItems.ts";

export { packBoxes, sweptPackBoxes };

export type WalkData = Pick<
  GameData,
  | "debuffs"
  | "dogs"
  | "encounters"
  | "homeText"
  | "minorObstacles"
  | "movementAssignments"
  | "movementProfiles"
  | "runText"
  | "shopGear"
  | "tuning"
  | "upgrades"
  | "walkerPerks"
  | "walkers"
  | "world"
>;

// Everything on the road that the run state does not hold. pending is this zone's spawns
// not yet in view, at zone distances. path is this zone's guaranteed path, at zone distances,
// empty before the first zone is planned. planned is what this zone's plan asked for from the
// tuning counts and weights, which the simulator compares with what it placed. herrings are this
// zone's red herring crossers, at zone distances, scenery the walk never reads. speedFactor scales
// the scroll speed, for testing. hitStop is set while a hit or a firing holds the walk still.
interface Road {
  admission?: AdmissionReport<WalkItemKind>;
  control: LaneControl;
  herrings: readonly SpawnEvent<WalkItemKind>[];
  hitStop: HitStop | null;
  invulnerableSeconds: number;
  items: readonly WalkItem[];
  nextItemId: number;
  path: readonly PathRow[];
  pending: readonly WalkSpawn[];
  planned: readonly PlannedCount[];
  speedFactor: number;
}

// A spawn quota as counted: its kind, how many, and how they move, or null standing still.
interface PlannedCount {
  readonly count: number;
  readonly kind: WalkItemKind;
  readonly movement: MovementKind | null;
}

export interface Walk {
  road: Road;
  run: RunState;
}

// A lucky encounter that applied on contact, with no card, and the item the pack grabbed.
interface InstantFind {
  encounter: EncounterId;
  item: WalkItem;
  outcome: ChoiceOutcome;
}

// A tip the pack grabbed: the money it paid, and its item.
interface TipGrab {
  change: MoneyChange;
  item: WalkItem;
}

// A gear drop the pack grabbed: its gear, now the found item, and the found item it replaced,
// which went back, or null.
interface GearFind {
  gear: GearId;
  item: WalkItem;
  replaced: GearId | null;
}

// A minor obstacle the pack bumped: the dog it landed on, the hearts its owner lost, or null with
// none to lose, and the cash it also cost while a debuff such as Spotlight makes bumps cost cash,
// or null with none. The dog it would land on dodges it at its dodgeChance, and loses nothing.
export interface MinorBump {
  cash: MoneyChange | null;
  change: HeartChange | null;
  dodged: boolean;
  dog: DogId;
  item: MoverItem<MinorObstacleId> & Pick<WalkItem, "skin">;
}

// A treat the pack grabbed, and what it did (grabTreat): the hearts its owner gained, or with
// every owner at their max, the spare treat the pack held (stored) or the cash it paid.
type TreatGrab = Omit<TreatGrabbed, "state"> & { readonly item: WalkItem };

export type EncounterCard = Extract<CardSource, { kind: "encounter" }>;

// What a contact came from: a contact obstacle, such as a puddle, or a minor obstacle with
// contact.
type ContactSource =
  | { readonly encounter: EncounterId; readonly kind: "encounter" }
  | { readonly kind: "minor"; readonly obstacle: MinorObstacleId };

// An obstacle the pack touched that applies its effects on contact, the dog the touch landed on,
// and what its effects did.
interface ContactHit {
  dog: DogId;
  item: WalkItem;
  outcome: ChoiceOutcome;
  source: ContactSource;
}

// A value modifiers changed on the road, at the item it happened at: a bump's hearts, a tip's
// pay, a tip or a treat grabbed by reach, an obstacle the pack is immune to, or a value a
// contact's or a lucky find's effects changed.
interface RoadModified {
  // The actor touching an immune obstacle, retained only for transient impact feedback.
  readonly dog?: DogId;
  readonly item: WalkItem;
  readonly value: ModifiedValue;
}

// bumps, cards, contacts, found, instants, tips and treats are in the order the pack met them;
// modified every value modifiers changed, in the order the pack met their items; fired the
// owners a bump left at 0 hearts; spareTreat the spare treat given back to an owner the step's
// bumps cost hearts, before any firing (spendSpareTreat), or null; zoneEnded is set on the step
// that reaches the end of the zone.
// passed are unhit movers retired below the walker, with no collision or acquisition cue.
// encounterHits are the card obstacles met this step, which play a hit moment. A hit stop holds
// the step's cards and zone end back to the step it ends on.
export interface WalkStep {
  bumps: MinorBump[];
  cards: CardSource[];
  collected: WalkItem[];
  contacts: ContactHit[];
  encounterHits: EncounterCard[];
  // Runtime steps provide the actual met items, parallel to encounterHits.
  encounterItems?: readonly WalkItem[];
  fired: readonly DogId[];
  found: GearFind[];
  instants: InstantFind[];
  modified: RoadModified[];
  passed: WalkItem[];
  spareTreat: HeartChange | null;
  tips: TipGrab[];
  treats: TreatGrab[];
  walk: Walk;
  zoneEnded: boolean;
}

// A zone's end: fees are the zone's pay, banked, and after the last zone the Walk bonus;
// run is the run after it.
interface ZoneEnd {
  fees: readonly MoneyChange[];
  run: RunState;
}

export function startRoad(laneCount: number, speedFactor = 1): Road {
  return {
    control: laneControlIn(stillInLane(Math.floor(laneCount / 2))),
    herrings: [],
    hitStop: null,
    invulnerableSeconds: 0,
    items: [],
    nextItemId: 0,
    path: [],
    pending: [],
    planned: [],
    speedFactor,
  };
}

// Steering during a hit stop is dropped, not queued.
export function steerWalk(
  data: Pick<GameData, "debuffs" | "dogs" | "tuning" | "walkers">,
  laneCount: number,
  direction: LaneDirection,
  walk: Walk,
): Walk {
  if (walk.road.hitStop !== null) {
    return walk;
  }
  const config = laneMotionConfig(data, laneCount, walk.run);
  const control = steerLane(config, direction, walk.road.control);
  return { ...walk, road: { ...walk.road, control } };
}

// How many lanes beside the pack's a pickup is collected from: tipReach and treatReach
// modifiers, such as Long reach's.
export function pickupReach(
  data: Pick<GameData, "tuning">,
  run: Pick<RunState, "modifiers">,
  kind: PickupKind,
): number {
  const stat = kind === "treat" ? "treatReach" : "tipReach";
  return Math.round(modifiedStat(data.tuning, run.modifiers, stat, 0));
}

// A tip pays what tips are worth now, with its causes.
export function collectTip(
  data: WalkData,
  run: RunState,
): { readonly run: RunState; readonly tip: MoneyChange } {
  const tip = tipValue(data, run);
  return { run: { ...run, money: addCents(run.money, tip.amount) }, tip };
}

// A minor bump costs the dog's owner the hearts a bump costs now (bumpParts), with the value
// modifiers changed: hearts.bump's loss, changed by bumpHearts modifiers, then cut by a forgiving
// one such as Second chance's. While a debuff such as Spotlight makes bumps cost cash and there is
// cash, it costs that cash too (bumpCash), which nothing forgives. Each change is null when it
// changed nothing.
function bumpDog(
  data: WalkData,
  dog: DogId,
  run: RunState,
): {
  readonly cash: MoneyChange | null;
  readonly change: HeartChange | null;
  readonly modified: readonly (ModifiedValue | null)[];
  readonly state: RunState;
} {
  const parts = bumpParts(data, run);
  const bumped = changeHearts(data, [{ amount: -parts.value, kind: "bump" }], dog, run);
  const cash = bumpCash(data, bumped.state);
  const state =
    cash === null
      ? bumped.state
      : { ...bumped.state, money: addCents(bumped.state.money, cash.amount) };
  const paid = cash === null ? null : changeModified(cash);
  if (bumped.change === null) {
    return { cash, change: null, modified: [paid], state };
  }
  const raised = negatedCauses(modifierCauses(parts.contributions));
  const by = [...raised, ...modifierCausesOf(bumped.change)];
  const base = -read(data.tuning, "hearts", "bump");
  const hearts = modifiedValue({ dog, kind: "hearts" }, base, by);
  return { cash, change: bumped.change, modified: [hearts, paid], state };
}

// The chance a plain hit landing on the dog misses it: probability.smallDodgeChance for a small
// dog, plus the chance of each dodge effect in play whose sizes hold the dog's, at most 1.
function dodgeChance(
  data: Pick<GameData, "dogs" | "tuning">,
  run: Pick<RunState, "dodges">,
  dog: DogId,
): number {
  const { size } = data.dogs[dog];
  const own = size === "small" ? read(data.tuning, "probability", "smallDodgeChance") : 0;
  const added = run.dodges
    .filter(({ sizes }) => sizes.includes(size))
    .reduce((sum, dodge) => sum + read(data.tuning, "probability", dodge.chance), 0);
  return Math.min(1, own + added);
}

// Whether the dog dodges the hit landing on it, at its dodgeChance. A dog with no chance draws
// nothing from random.
function dodges(
  data: Pick<GameData, "dogs" | "tuning">,
  random: Random,
  run: Pick<RunState, "dodges">,
  dog: DogId,
): boolean {
  const odds = dodgeChance(data, run, dog);
  return odds > 0 && chance(random, odds);
}

// The front dog, the first walking dog in formation order.
function frontDog(run: RunState): DogId {
  const [front] = formationOrder(packDogs(run));
  if (front === undefined) {
    throw new Error("A hit needs a walking dog");
  }
  return front;
}

// One fixed step of walking. Scrolls the road at the zone's speed, brings spawns into view,
// moves the pack, then collides: tips and treats are grabbed, a plain obstacle costs the
// owner of the dog it lands on a heart unless the dog dodges it, card obstacles (outside
// the grace window) become cards for the pack, and lucky finds apply at once. An obstacle the
// pack is immune to is harmless: it is removed, and nothing else happens. A plain hit or an
// obstacle with a hit moment starts a hit stop, and the steps it lasts hold everything still.
// random draws for dodges. Does nothing unless walking.
export function stepWalk(
  data: WalkData,
  geometry: RoadGeometry,
  random: Random,
  stepSeconds: number,
  walk: Walk,
): WalkStep {
  const { road, run } = walk;
  if (run.phase.kind !== "walking") {
    return stillStep(NOTHING_HELD, walk);
  }
  if (road.hitStop !== null) {
    const ticked = tickHitStop(stepSeconds, road.hitStop);
    return "stop" in ticked
      ? stillStep(NOTHING_HELD, { road: { ...road, hitStop: ticked.stop }, run })
      : stillStep(ticked.released, { road: { ...road, hitStop: null }, run });
  }
  const length = zoneLength(data);
  // The step stops at the end of the zone.
  let zoneDistance: number = run.zoneDistance;
  let zoneEnded = false;
  if (stepSeconds > 0) {
    const step = roadScrollSpeed(data, walk) * stepSeconds;
    zoneEnded = !(step < length - zoneDistance);
    zoneDistance = zoneEnded ? length : zoneDistance + step;
  }
  const travel = zoneDistance - run.zoneDistance;

  const due = takeDueSpawns(zoneDistance, road.pending);
  let nextItemId = road.nextItemId;
  const arrived = due.due.map((event): WalkItem => {
    const profile = event.mover?.motion === "signature" ? event.mover.route.profile : undefined;
    const height =
      profile?.kind === "delayedTrail"
        ? componentHitLength(geometry, profile)
        : itemHeight(data, geometry, event.kind, event.mover !== undefined);
    return {
      height,
      id: nextItemId++,
      kind: event.kind,
      lane: event.lane,
      laneSpan: footprintOf(data, event.kind).lanes,
      ...(event.mover === undefined
        ? {}
        : { mover: { path: event.mover, since: zoneDistance - event.distance } }),
      ...(event.skin === undefined ? {} : { skin: event.skin }),
      y: geometry.roadTop - height + (zoneDistance - event.distance),
    };
  });
  const started = arrived.flatMap((item) => {
    const { mover } = item;
    if (mover?.path.motion !== "signature") {
      return moveMovers(geometry, 0, [item]);
    }
    const place = moverPlace(geometry.laneCount, mover.path, mover.since);
    return [
      {
        ...item,
        lane: laneAt(place.lanePosition),
        y: moverY(geometry.roadTop, item.height, place),
      },
    ];
  });
  const scrolled = scrolledItems(data, geometry, travel, road.items, started);

  const control = advanceLaneControl(
    laneMotionConfig(data, geometry.laneCount, run),
    stepSeconds,
    road.control,
  );
  const { cues, pickups } = scrolled;
  const solid = shyHopped(
    geometry,
    control.motion,
    stalkersStepped(geometry, control.motion, scrolled.solid),
  );
  // Swept from where the last step left the pack to where this one leaves it.
  const pack = sweptPackBoxes(geometry, road.control.motion, control.motion, run);
  const beforePack = packBoxes(geometry, road.control.motion, run);
  const afterPack = packBoxes(geometry, control.motion, run);
  // An obstacle hits a part of the pack; a lucky find, as a pickup does, touches its outline.
  const touching = (item: WalkItem) =>
    isObstacle(data, item.kind)
      ? item.mover?.path.motion === "signature"
        ? signatureContact(data, geometry, beforePack, afterPack, travel, item)
        : hitDog(pack, obstacleHitBox(data, geometry, item))
      : pickupDog(pack, walkItemBox(geometry, item));
  const invulnerable = tickInvulnerability(stepSeconds, road.invulnerableSeconds);
  // A pull obstacle, such as a squirrel, passes through the pack: touching it does nothing.
  const passing = solid.filter((item) => isPullObstacle(data, item.kind));
  const { hits, invulnerableSeconds, remaining } = collideWithPack(
    collisionRules(data, run),
    touching,
    invulnerable,
    passing.length === 0 ? solid : solid.filter((item) => !passing.includes(item)),
  );
  // A pickup reached past its lanes, by Long reach, goes to the front dog.
  // A pickup the pack's outline misses was grabbed by reach alone.
  const byReach: WalkItem[] = [];
  const pickupsHit = pickups.flatMap((item): { dog: DogId; item: WalkItem }[] => {
    const reach = pickupReach(data, run, item.kind as PickupKind) * geometry.cell.length;
    const box: Box = walkItemBox(geometry, item);
    const reached = overlaps(pack.outline, {
      ...box,
      left: box.left - reach,
      right: box.right + reach,
    });
    if (reached && reach > 0 && !overlaps(pack.outline, box)) {
      byReach.push(item);
    }
    return reached ? [{ dog: pickupDog(pack, box) ?? frontDog(run), item }] : [];
  });

  // Timed debuffs count down on walking steps only, so a hit stop or a card holds them.
  let nextRun: RunState = { ...tickDebuffs(stepSeconds, run), zoneDistance: pixels(zoneDistance) };
  const bumps: MinorBump[] = [];
  const cards: EncounterCard[] = [];
  const collected: WalkItem[] = [];
  const contacts: ContactHit[] = [];
  const encounterItems: WalkItem[] = [];
  const found: GearFind[] = [];
  const instants: InstantFind[] = [];
  const modified: RoadModified[] = [];
  const tips: TipGrab[] = [];
  const treats: TreatGrab[] = [];
  const modifiedAt = (item: WalkItem, values: readonly (ModifiedValue | null)[]) => {
    for (const value of values) {
      if (value !== null) {
        modified.push({ item, value });
      }
    }
  };
  const meet = ({ dog, item }: { dog: DogId; item: WalkItem }): void => {
    const { kind } = item;
    if (isPickup(kind) && byReach.includes(item)) {
      modifiedAt(item, [reachModified(data, run, kind)]);
    }
    if (kind === "tip") {
      const pickup = collectTip(data, nextRun);
      nextRun = countTally("tips", pickup.run);
      tips.push({ change: pickup.tip, item });
      collected.push(item);
      modifiedAt(item, [changeModified(pickup.tip)]);
    } else if (kind === "treat") {
      const { state, ...grab } = grabTreat(data, dog, countTally("treats", nextRun));
      nextRun = state;
      treats.push({ ...grab, item });
      collected.push(item);
      modifiedAt(item, [grab.change === null ? null : changeModified(grab.change)]);
    } else if (isMinorObstacle(data, kind)) {
      // One with contact is met as a contact obstacle is: no dodge, and its effects on the pack.
      if (data.minorObstacles[kind].contact !== undefined) {
        const affected = affectedDogs(run);
        if (affected.length === 0) {
          return;
        }
        const outcome = applyMinorContact(data, nextRun, kind, affected);
        nextRun = outcome.state;
        contacts.push({ dog, item, outcome, source: { kind: "minor", obstacle: kind } });
        modifiedAt(item, outcome.modified);
        return;
      }
      const minor = { ...item, kind };
      if (dodges(data, random, nextRun, dog)) {
        // Every dog's dodge counts toward the dodges tally, a dodge effect's included.
        nextRun = countTally("dodges", nextRun);
        bumps.push({ cash: null, change: null, dodged: true, dog, item: minor });
        return;
      }
      const bump = bumpDog(data, dog, countBump(nextRun));
      nextRun = countLandedBump(kind, bump.state);
      bumps.push({ cash: bump.cash, change: bump.change, dodged: false, dog, item: minor });
      modifiedAt(item, bump.modified);
    } else if (isGearDrop(data, kind)) {
      const grab = grabGear(data, kind, nextRun);
      nextRun = grab.run;
      found.push({ gear: kind, item, replaced: grab.replaced });
      collected.push(item);
      modifiedAt(item, grab.modified);
    } else {
      const affected = affectedDogs(run);
      if (!opensCard(affected, run, kind)) {
        const immunity =
          affected.length === 0
            ? undefined
            : run.immunities.find(({ encounter }) => encounter === kind);
        if (immunity !== undefined) {
          const by = [modifierCause(-1, immunity.source)];
          const value = modifiedValue({ encounter: kind, kind: "immune" }, 1, by);
          if (value !== null) {
            modified.push({ dog, item, value });
          }
        }
        return;
      }
      const { resolution } = data.encounters[kind];
      switch (resolution.kind) {
        case "card":
          cards.push({ affected, encounter: kind, kind: "encounter" });
          if (hitLabel(data.encounters[kind]) !== null) {
            encounterItems.push(item);
          }
          return;
        case "contact":
        case "instant": {
          const outcome = applyInstantEncounter(data, nextRun, kind, affected);
          nextRun = outcome.state;
          if (resolution.kind === "instant") {
            nextRun = countTally(resolution.tally, nextRun);
            instants.push({ encounter: kind, item, outcome });
          } else {
            contacts.push({ dog, item, outcome, source: { encounter: kind, kind: "encounter" } });
          }
          modifiedAt(item, outcome.modified);
          return;
        }
        // A pull obstacle passes through the pack (passing), so the pack never meets one.
        case "pull":
          return;
        default:
          assertNever(resolution);
      }
    }
  };
  const meetAll = (met: readonly { dog: DogId; item: WalkItem }[]): void => {
    for (const each of met) {
      if (nextRun.phase.kind === "ended") {
        break;
      }
      meet(each);
    }
  };
  // The hits land first, then a held spare treat gives back a heart they cost. An owner they left
  // at 0 hearts fires you before the pickups, so a treat grabbed this step cannot save them; with
  // no dogs left the walk ends.
  meetAll(hits);
  const spare = spendSpareTreat(
    data,
    bumps.flatMap(({ change }) => (change === null ? [] : [change])),
    nextRun,
  );
  const firing = fireOwnersAtZero(spare.state);
  nextRun =
    firing.fired.length > 0 && packDogs(firing.state).length === 0
      ? { ...firing.state, phase: { kind: "ended", reason: "noDogs" } }
      : firing.state;
  meetAll(pickupsHit);
  // A card met this step affects only the dogs still walking after its hits.
  const walking = packDogs(nextRun);
  const stepCards = cards.map((card): EncounterCard => ({
    ...card,
    affected: card.affected.filter((dog) => walking.includes(dog)),
  }));
  const encounterHits = stepCards.filter(
    (card) => hitLabel(data.encounters[card.encounter]) !== null,
  );
  const hitStop = startHitStop(
    false,
    hitStopLength(
      {
        encounter: read(data.tuning, "seconds", "hitStopSeconds"),
        minor: read(data.tuning, "seconds", "minorHitStopSeconds"),
      },
      {
        encounters: encounterHits.length,
        minors: bumps.filter(({ dodged }) => !dodged).length + contacts.length,
      },
    ),
    { cards: stepCards, zoneEnded },
  );
  const retained = [
    ...remaining.filter((item) => signatureOnRoad(geometry, item)),
    ...passing.filter((item) => signatureOnRoad(geometry, item)),
    ...cues,
    ...(pickupsHit.length === 0
      ? pickups
      : pickups.filter((item) => !pickupsHit.some((hit) => hit.item === item))),
  ];
  const passed = [...scrolled.passed];
  const items = retained.filter((item) => {
    if (passedWalker(data, geometry, item)) {
      passed.push(item);
      return false;
    }
    return true;
  });
  return {
    bumps,
    cards: hitStop === null ? stepCards : [],
    collected,
    contacts,
    encounterHits,
    encounterItems,
    fired: firing.fired,
    found,
    instants,
    modified,
    passed,
    spareTreat: spare.change,
    tips,
    treats,
    walk: {
      road: {
        ...road,
        control,
        hitStop,
        invulnerableSeconds,
        items,
        nextItemId,
        pending: due.pending,
      },
      run: nextRun,
    },
    zoneEnded: hitStop === null && zoneEnded,
  };
}

function opensFor(run: RunState, encounter: EncounterId): boolean {
  return opensCard(affectedDogs(run), run, encounter);
}

// Obstacles are graced. A hit that opens no card is scenery: it counts no bump and starts no
// grace window.
function collisionRules(data: WalkData, run: RunState): CollisionRules<WalkItem> {
  return {
    graced: (item) => isObstacle(data, item.kind),
    invulnerabilitySeconds: read(data.tuning, "seconds", "collisionGrace"),
    startsInvulnerability: ({ kind }) =>
      isMinorObstacle(data, kind) || opensFor(run, kind as EncounterId),
  };
}

const NOTHING_HELD: HeldStep = { cards: [], zoneEnded: false };

// A step in which the walk does not move, giving out only what it held.
function stillStep(held: HeldStep, walk: Walk): WalkStep {
  return {
    bumps: [],
    cards: [...held.cards],
    collected: [],
    contacts: [],
    encounterHits: [],
    encounterItems: [],
    fired: [],
    found: [],
    instants: [],
    modified: [],
    passed: [],
    spareTreat: null,
    tips: [],
    treats: [],
    walk,
    zoneEnded: held.zoneEnded,
  };
}

// The end of a zone: every dog still walking is paid, each debuff on counts the zone, the effects
// that lasted the zone expire, then the run moves to the next position, whose zone the fork picks,
// or ends once the walk's last zone is done.
export function finishZone(data: WalkData, run: RunState): ZoneEnd {
  const { changes, state: paid } = payZone(data, run);
  const expired = expireAtZoneEnd(run.zoneIndex, paid);
  if (run.zoneIndex >= walkLength(data) - 1) {
    const bonus = fullPackBonus(data, expired);
    return {
      fees: [...changes, ...bonus.changes],
      run: { ...bonus.state, phase: { kind: "ended", reason: "finished" } },
    };
  }
  return {
    fees: changes,
    run: resetZoneProgress({ ...expired, zoneIndex: run.zoneIndex + 1 }),
  };
}

// A fresh neighbourhood starts with its own allowances and distance.
export function resetZoneProgress(run: RunState): RunState {
  return {
    ...run,
    cardsThisZone: 0,
    heartsForgiven: 0,
    skipUsed: false,
    zoneDistance: pixels(0),
  };
}

// Heading home ends the walk, which keeps its last zone's end money (walkEarnings); the current
// zone pays nothing.
export function headHome(run: RunState): RunState {
  return { ...run, phase: { kind: "ended", reason: "wentHome" } };
}
