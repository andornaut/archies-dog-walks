import type {
  DebuffId,
  DogId,
  EncounterId,
  MinorObstacleId,
  MovementProfileId,
  SkinId,
  SkinnedObstacleId,
  UpgradeId,
  WalkerPerkId,
  ZoneId,
} from "../ids.ts";
import type {
  CountKey,
  HeartsKey,
  MoneyKey,
  MultiplierKey,
  PriceKey,
  ProbabilityKey,
  SecondsKey,
  Size,
} from "./tuning.ts";

// Lifetime counts the save keeps across walks for the badges: every dog's dodges, landed
// squirrel pulls, tips and treats grabbed, and the lucky finds that name one as their tally.
// Card option picks are counted apart, by encounter and option id.
export type TallyId =
  "dodges" | "neighboursMet" | "squirrelPulls" | "tips" | "treats" | "walletsFound";

// What a minor obstacle on the road looks like: its skin, or the obstacle itself when it has one
// look. Art, names and bump flash colours are keyed by it.
export type MinorLookId = Exclude<MinorObstacleId, SkinnedObstacleId> | SkinId;
export type NeighbourhoodId = ZoneId;

// What opened a card: an obstacle the pack hit, with the dogs it affected, or a fork, whose
// paths are the zones it leads to, left to right, each carrying the upgrade at its index, or
// none where it is null.
export type CardSource =
  | {
      readonly affected: readonly DogId[];
      readonly encounter: EncounterId;
      readonly kind: "encounter";
    }
  | {
      readonly kind: "fork";
      readonly paths: readonly ZoneId[];
      readonly upgrades: readonly (UpgradeId | null)[];
    };

// Card option picks counted across walks or in one run, by encounter and option id.
export type OptionPicks = Partial<Record<EncounterId, Readonly<Record<string, number>>>>;

// "start": owned from the first run; "shop": bought on the home screen at its price.
export type Unlock =
  { readonly price: PriceKey; readonly unlock: "shop" } | { readonly unlock: "start" };

interface Owner {
  readonly name: string;
  readonly role: string;
}

export type Dog = Unlock & {
  // The name in the dog's art keys: dog-<art> and its depth variants, face-dog-<art>,
  // portrait-dog-<art>, face-owner-<art>, face-owner-<art>-20, owner-<art> and the <art> tag of
  // ui-dog-card.
  readonly art: string;
  readonly breed: string;
  readonly look: string;
  readonly name: string;
  readonly owner: Owner;
  readonly size: Size;
};

// Which dogs an effect reaches, among the dogs still in the pack. "affected" is the dogs
// the encounter affected, and "lead" the front one of them in formation order.
export type Target =
  { readonly kind: "affected" } | { readonly kind: "all" } | { readonly kind: "lead" };

// "nextZone": the whole of the next zone.
export type Duration = "nextZone" | "run";

// Stats a modifier changes. An "add" names a key in the stat's own unit group.
// How many lanes beside the pack's tips and treats are grabbed from, how many encounter
// cards each zone cost no money, and how many spare treats the pack holds.
type CountStat = "freeCards" | "spareTreats" | "tipReach" | "treatReach";
// forgivenHearts: how many of the first hearts lost in each zone are forgiven.
type HeartsStat = "forgivenHearts" | "maxHearts";
type MoneyStat = "tipValue";
export type Stat =
  | CountStat
  | HeartsStat
  | MoneyStat
  // How many hearts a minor bump costs.
  | "bumpHearts"
  // How much cash a minor bump costs while a debuff, such as Spotlight, makes bumps cost cash.
  | "bumpMoney"
  // How long a debuff lasts.
  | "debuffSeconds"
  // The walker's agility: how many times faster than the base the pack changes lanes. An add
  // modifier changes the walker's agility; a multiply one, such as Muddy's, scales the pack's.
  | "agility"
  | "obstacleSpawns"
  // How many pulls a squirrel draws.
  | "squirrelPulls"
  | "tipSpawns"
  | "treatSpawns";

// duration is absent for gear, which lasts every run it is taken on.
export type Modifier = { readonly duration?: Duration } & (
  | { readonly by: CountKey; readonly operation: "add"; readonly stat: CountStat }
  | { readonly by: HeartsKey; readonly operation: "add"; readonly stat: HeartsStat }
  | { readonly by: MoneyKey; readonly operation: "add"; readonly stat: MoneyStat }
  | { readonly by: MultiplierKey; readonly operation: "add"; readonly stat: "agility" }
  | { readonly by: MultiplierKey; readonly operation: "multiply"; readonly stat: Stat }
);

type HeartsDelta = -3 | -2 | -1 | 1 | 2 | 3;

// Applies once, whatever the pack size.
export interface MoneyEffect {
  readonly amount: MoneyKey;
  readonly change: "gain" | "lose";
  readonly kind: "money";
}

// Per owner.
export interface HeartsEffect {
  readonly amount: HeartsDelta;
  readonly kind: "hearts";
  readonly target: Target;
}

// A total of hearts shared by the dogs still walking, in formation order: each owner gets an
// even share, and the hearts left over go one each to the front dogs' owners first, so 3 is
// 3 for a lone dog, 2 and 1 for a pair and 1 each for a trio. A heart an owner cannot take goes to
// the next owner below their max, front dog first, and is lost only when every owner is full.
export interface SharedHeartsEffect {
  readonly amount: HeartsKey;
  readonly kind: "sharedHearts";
}

interface DebuffEffect {
  readonly debuff: DebuffId;
  readonly kind: "debuff";
}

// No card opens for the encounter while the pack is immune to it.
interface ImmuneEffect {
  readonly duration: Duration;
  readonly encounter: EncounterId;
  readonly kind: "immune";
}

export type ModifierEffect = Modifier & { readonly kind: "modifier" };

// A plain hit that would land on a dog of one of sizes misses it at chance, costing nothing, as
// a small dog's dodge does, for the rest of the walk. It adds to a small dog's own chance.
export interface DodgeEffect {
  readonly chance: ProbabilityKey;
  readonly kind: "dodge";
  readonly sizes: readonly [Size, ...Size[]];
}

// A free Skip on every obstacle card until it is taken, once per zone: each zone's start clears
// RunState.skipUsed.
interface SkipOptionEffect {
  readonly kind: "skipOption";
}

export type Effect =
  | DebuffEffect
  | DodgeEffect
  | HeartsEffect
  | ImmuneEffect
  | ModifierEffect
  | MoneyEffect
  | SharedHeartsEffect
  | SkipOptionEffect;

export interface CardOption {
  // Key of the option's illustration in the art manifest's images.
  readonly art: string;
  // Unique on its card and kept across renames: the save counts picks by it.
  readonly id: string;
  readonly effects: readonly Effect[];
  readonly name: string;
}

// Cards show two or three options side by side.
export type CardOptions =
  readonly [CardOption, CardOption] | readonly [CardOption, CardOption, CardOption];

type NonEmptyEffects = readonly [Effect, ...Effect[]];

// The encounter opens a card of options.
interface CardResolution {
  readonly kind: "card";
  readonly options: CardOptions;
}

// The encounter applies its effects on contact, with a popup instead of a card. art is the
// popup's illustration. Finding it counts one toward the lifetime tally.
interface InstantResolution {
  readonly art: string;
  readonly effects: NonEmptyEffects;
  readonly kind: "instant";
  readonly tally: TallyId;
}

// The obstacle applies its effects to the whole pack as it is touched, with a plain obstacle's
// hit stop and no card.
interface ContactResolution {
  readonly effects: NonEmptyEffects;
  // What an immunity to the obstacle does, as an effect's text says it, lower case: "puddles
  // don't muddy the pack".
  readonly immuneText: string;
  readonly kind: "contact";
}

// Touching the obstacle does nothing: its only cost is the dogs pulling toward it.
interface PullResolution {
  readonly kind: "pull";
}

// What an obstacle covers on the road: lanes across and rows along it. One row is a lane-width
// of road. The rulebook allows no obstacle wider than 3 lanes.
interface Shape {
  readonly lanes: 1 | 2 | 3;
  readonly rows: 1 | 2 | 3;
}

// How many times a mover moves: a count from min to max, both included, drawn per mover as it is
// planned. A fixed count has min equal to max.
export interface MoveCount {
  readonly max: number;
  readonly min: number;
}

// A dart's tilt, drawn per dart from min to max: above 0 it comes down the road faster than the
// road, below 0 slower, at 0 with it.
interface Tilt {
  readonly max: number;
  readonly min: number;
}

// How an obstacle moves when it comes as a mover, its first move after a cue
// seconds.moverWarningSeconds long and each later one with no cue unless its kind cues each, and
// only while the mover is still ahead of the pack's rows. A stepper's or hopper's later moves run
// back to back. approach: steps steps toward the pack, each to the spot a lane to either side, a
// row down or diagonally down that is nearest the pack as the step is chosen,
// seconds.moverStepSeconds each; the first's cue seconds.approachFirstDelayMin to
// approachFirstDelayMax after it is wholly on the road, each later one, with no cue of its own,
// once the step before has ended and the road left between it and the pack is
// multipliers.approachSecondRoadShareMin to Max of the road's length. dart: across the road at
// counts.dartLanesPerSecond, coming down it at 1 + tilt of the road's speed meanwhile, its tilt
// drawn per dart from its range cut to the steepest the zone's pace leaves a start for, setting off
// multipliers.dartStartRoadShareMin to Max of the road ahead of the pack, drawn per dart and never
// so low that the pack has less than seconds.pathReactionMargin after its cue (above Max for a
// steep enough tilt), nor so high that its cue is off the road; one that has crossed by the time it
// reaches the pack's rows passes harmlessly. A dart turns back at turnBackShare of its kind, drawn
// per dart: with no cue, once it has crossed multipliers.dartTurnAtShareMin to Max of the road,
// drawn per dart, it crosses the whole road back the other way at its tilt. A dart stops at
// stopShare of its kind instead, drawn with the same draw, the two shares adding up to at most 1:
// with no cue, it stops in the lane counts.dartStopLanesMin to Max lanes from the edge it enters
// from, drawn per dart, and stands there, coming down the road with it, until it scrolls off; past
// the road's far edge, it crosses instead. A dart that stops never turns back. A dart is one row
// long, and one wider than a lane, its lanes crossing together, never stops. inLane: down its
// lane at factor of the road's speed, above 1 toward the pack, below 1 away. hop: times jumps, each
// of 1 to most spots one way, lanes to either side or, unless sideways, a row up the road or
// diagonally up, landing seconds.moverHopSeconds after it leaves; a shy hopper, at
// probability.shyHopperShare of its kind drawn per mover, instead makes each hop away from the
// pack, starting once the road between it and the pack's rows is down to seconds.shyHopNearSeconds
// of the road's travel, ending in neither the pack's lane nor one it is moving into, no nearer it
// across the road, and at most most rows up the road. step: steps spots, each a lane to either side
// or a row toward or away, seconds.moverStepSeconds each.
// bounce: hops hops a lane to one side and then back, strictly left and right in turn, the first
// either way, seconds.moverHopSeconds each, each after a cue pauseSeconds long (the sign spinner's
// spin). dive: across the road at speed of counts.dartLanesPerSecond, tilted as a dart is, landing
// a lane short of the lane counts.dartStopLanesMin to Max lanes from the edge it enters from, drawn
// per dive, then sliding that last lane at slide of its speed and staying down there, coming down
// the road with it; it never turns back and never stops on the verge. follow: steps steps a lane to
// either side as one block, seconds.moverStepSeconds each, each after a cue pauseSeconds long (the
// leader's signal). stopAndGo: stops + 1 pushes down its lane at factor of the road's speed,
// goSeconds each, standing still on the road for stopSeconds between them, each push after a cue.
// stopAndGoAcross: across the road level with it at speed of counts.dartLanesPerSecond, set off as
// a dart is, standing still on the road for stopSeconds once in one of its stops, cued again
// before it sets off once more; it never turns back or stops for good. Each of its stops is the
// lanes it covers while it stands there, first and last, counted on the road from 0 at the left,
// as many as its footprint is wide. It stands in the stop drawn for it per mover, each as likely,
// on a row where that stop leaves the path's lanes open, or failing that in the nearest other stop
// in its list that has such a row. With herringShare, that share of them, drawn per mover, are
// red herrings: with no cue, each crosses the whole road without stopping as its row comes on
// screen, gone before it is down to multipliers.distractionEndRoadShare of the road ahead of the
// pack, and blocks nothing. sway: times times a step a lane to one side and back, rocking between
// two lanes, seconds.moverStepSeconds each, pausing pauseSeconds after every step. merge: down its
// lane at factor of the road's speed, as an in-lane mover, then once its travel down the road is
// mergeAt of the way to the pack's rows, after a cue, a lane to one side with room over
// mergeSeconds, and on down that lane; it merges once, and never once it has reached the pack's
// rows. A cue at least seconds.moverWarningSeconds long precedes each move that has one.
// The archetypes: dash and swoop are dart (a swoop has a tilt or a turn back), wander is step,
// stalk is approach, cruise is inLane, stop-and-go is stopAndGo down a lane and stopAndGoAcross
// across the road, and hop, bounce, dive, follow (follow the leader), merge and sway are their own
// names.
// Each in-lane mover's speed varies by up to multipliers.moverSpeedJitter either way and each
// dart's and dive's by up to multipliers.dartSpeedJitter, each step and hop comes up to
// seconds.moverTimingJitter late, and each step's and hop's length varies by up to
// seconds.moverMoveSecondsJitter of it either way.
export type Movement =
  | { readonly kind: "approach"; readonly steps: MoveCount }
  | { readonly hops: MoveCount; readonly kind: "bounce"; readonly pauseSeconds: number }
  | {
      readonly kind: "dart";
      readonly stopShare: number;
      readonly tilt: Tilt;
      readonly turnBackShare: number;
    }
  | { readonly kind: "dive"; readonly slide: number; readonly speed: number; readonly tilt: Tilt }
  | { readonly kind: "follow"; readonly pauseSeconds: number; readonly steps: MoveCount }
  | {
      readonly kind: "hop";
      readonly most: 1 | 2;
      readonly shy?: true;
      readonly sideways?: true;
      readonly times: MoveCount;
    }
  | { readonly kind: "inLane"; readonly factor: number }
  | {
      readonly factor: number;
      readonly kind: "merge";
      readonly mergeAt: number;
      readonly mergeSeconds: number;
    }
  | { readonly kind: "step"; readonly steps: MoveCount }
  | {
      readonly factor: number;
      readonly goSeconds: number;
      readonly kind: "stopAndGo";
      readonly stopSeconds: number;
      readonly stops: MoveCount;
    }
  | {
      readonly herringShare?: ProbabilityKey;
      readonly kind: "stopAndGoAcross";
      readonly speed: number;
      readonly stopSeconds: number;
      readonly stops: readonly StopLanes[];
    }
  | { readonly kind: "sway"; readonly pauseSeconds: number; readonly times: MoveCount };
export type MovementKind = Movement["kind"];

// Named path recipes hold tuning and art metadata. The planner chooses a complete route
// before spawning, and rejects it if its footprint or reaction intervals are unsafe.
export type SignatureProfile = {
  // Minimum time before pack contact after every component finishes its defining motion.
  // The planner also retains at least this many seconds of base-road-scroll visibility.
  readonly finishAheadSeconds: number;
  // Cue interval before each cued leg. Leg durations contain motion time only.
  readonly warningSeconds: number;
} & (
  | {
      readonly anchor: { readonly x: number; readonly y: number };
      readonly bends: MoveCount;
      readonly bendSeconds: number;
      readonly downFactor: number;
      readonly followerDelays: readonly [number, number];
      readonly frame: { readonly height: number; readonly width: number };
      readonly kind: "delayedTrail";
      readonly laneStep: 1;
      readonly spriteKey: string;
      readonly straightSeconds: number;
    }
  | {
      readonly kind: "rectangle";
      readonly lanes: 1;
      readonly legSeconds: number;
      readonly rows: 1;
    }
  | {
      readonly downSeconds: number;
      readonly kind: "turnExit";
      readonly lanesPerSecond: number;
      readonly rows: 1;
    }
  | {
      readonly arcs: MoveCount;
      readonly arcSeconds: number;
      readonly downFactor: number;
      readonly kind: "alternatingArcs";
      readonly laneStep: 1;
    }
  | {
      readonly downFactor: number;
      readonly kind: "reflectingDiagonal";
      readonly lanesPerSecond: number;
      readonly reflections: MoveCount;
    }
  | {
      readonly count: 2;
      readonly downFactor: number;
      readonly kind: "successiveMerges";
      readonly laneStep: 1;
      readonly mergeSeconds: number;
      readonly straightSeconds: number;
    }
);

export type ConfiguredMovement =
  Movement | { readonly kind: "profile"; readonly profile: MovementProfileId };

// Context selects a leaf once, before planning. Overrides cannot nest or silently replace
// an unsafe signature with a different movement.
export type MovementAssignment =
  | ConfiguredMovement
  | {
      readonly default: ConfiguredMovement;
      readonly kind: "byZone";
      readonly zones: Readonly<Partial<Record<NeighbourhoodId, ConfiguredMovement>>>;
    };

// The lanes a stop-and-go across covers at one of its stops: its first and last, counted on the
// road from 0 at the left (Movement).
export type StopLanes = readonly [first: number, last: number];

// "obstacle": hit by accident. A card obstacle opens a card for the whole pack, with hitLabel
// shown large as it hits; a contact obstacle applies its effects as it is touched; a pull
// obstacle does nothing when touched. An obstacle the pack is immune to is harmless. "lucky": a
// good thing to bump into, one cell big, applied on contact with no card. An obstacle or lucky
// encounter with a movement comes as a mover at the zone's moverShare; a lucky one stays a prize
// as it moves, never something the pack steers around. A card obstacle's hitWord is the comic
// word drawn in font-comic over its hit burst: A to Z, ! ? - and space. An obstacle appears in
// the zones that weigh it above 0.
export type Encounter = {
  readonly name: string;
} & (
  | {
      readonly kind: "lucky";
      readonly movement?: Movement;
      readonly resolution: InstantResolution;
    }
  | ({
      readonly kind: "obstacle";
      readonly movement?: Movement;
      readonly shape: Shape;
    } & (
      | {
          readonly hitLabel: string;
          readonly hitWord: string;
          readonly resolution: CardResolution;
        }
      | { readonly resolution: ContactResolution | PullResolution }
    ))
);

// An obstacle that opens no card: bumping it costs the touching dog's owner hearts.bump, as
// bumpHearts modifiers change it, and, while a debuff with bumpMoney such as Spotlight lasts and
// there is cash, that cash too; the dog it lands on may dodge it.
// The hit stops the road for seconds.minorHitStopSeconds.
// One with contact is no bump: touching it applies its effects instead, as a contact obstacle
// such as a puddle does (ContactResolution), with no dodge and no immunity. It counts as no bump,
// in a zone or toward a bump badge, and stops the road as a bump does.
// Each zone's weights set how often it appears there, and it appears only where weighed above 0.
// One with a movement comes as a mover at the zone's moverShare. One onFoot is a person or an
// animal, not a vehicle or a thing, which the distraction movers are drawn from.
// One with skins never moves and has a look per neighbourhood instead of one name and look: each
// skin names the zones it appears in, which are the zones that weigh the obstacle above 0. Each
// spawn picks one of its zone's skins, evenly, and is drawn, named and flashed as that skin.
export type MinorObstacle =
  | {
      readonly contact?: MinorContact;
      readonly movement?: Movement;
      readonly name: string;
      readonly onFoot?: true;
      readonly shape: Shape;
    }
  | {
      readonly contact?: never;
      readonly movement?: never;
      readonly onFoot?: never;
      readonly shape: Shape;
      readonly skins: Readonly<Record<string, ObstacleSkin>>;
    };

// What touching a minor obstacle with contact does: its effects, as a contact obstacle's.
interface MinorContact {
  readonly effects: NonEmptyEffects;
}

// One look of a minor obstacle with skins: its name and the zones it appears in.
interface ObstacleSkin {
  readonly name: string;
  // Zone ids, at least one.
  readonly zones: readonly [string, ...string[]];
}

// How long an upgrade card's effects last: applied at once, through the next zone, or for
// the rest of the run.
export type UpgradeDuration = "nextZone" | "now" | "run";

// effect is what the upgrade does in a line, as a fork's path card shows it.
export interface Upgrade {
  // Key of the card's illustration in the art manifest's images.
  readonly art: string;
  // Its effect in a few words, under its name on a fork's path card.
  readonly cardEffect: string;
  // Its effect in full, on the enlarged path card, its effect icon's hold and the message strip.
  readonly effect: string;
  readonly effects: NonEmptyEffects;
  readonly kind: "boost" | "tradeOff";
  readonly name: string;
}

export interface Gear {
  readonly effects: NonEmptyEffects;
  readonly name: string;
  readonly price: PriceKey;
  // Its effect in a few words, on its shop row.
  readonly short: string;
}

// The dog slots, numbered from 1 in order, each bought on its own in any order. A run takes at
// most one dog per owned slot.
export type DogSlot = Unlock;

// A walker walks from the start, or unlocks the first time a walk finishes with at least dogs
// still walking at its end.
type WalkerUnlock =
  { readonly dogs: number; readonly unlock: "finishWalk" } | { readonly unlock: "start" };

// A walker's perk: its name, its effect in one line, and its effects, which last every walk the
// walker walks, as gear's do.
export interface WalkerPerk {
  readonly effect: string;
  readonly effects: NonEmptyEffects;
  readonly name: string;
}

// A walker the player can pick, walking with its agility and the effects of its perk. agility
// multiplies the pack's lane-change speed. spriteKey and portraitKey are keys into the art
// manifest.
// greeting is what the walker says as they join, after the first walk that unlocks them.
export type Walker = WalkerUnlock & {
  readonly agility: number;
  readonly greeting: string;
  readonly name: string;
  readonly perk: WalkerPerkId;
  readonly portraitKey: string;
  readonly spriteKey: string;
};

// A debuff lasts its seconds of walking, a time that stops during a hit stop and under a card,
// and never past the zone's end. Nothing cures it. stake is what it does, as a card states it
// after the debuff's name, its {seconds} filled with how long it would last and its {cash} with
// its bumpMoney. Its modifiers change stats while it lasts; a movement profile acts through
// the session clock instead. While one with bumpMoney lasts, a plain bump also costs that cash,
// as bumpMoney modifiers change it, on top of its hearts: all the cash there is when that is
// less, and none at $0.
export interface DebuffDriftMovement {
  readonly direction: "heading" | "random" | "steeringOrRandom";
  readonly interval:
    | { readonly kind: "fixed"; readonly seconds: SecondsKey }
    | { readonly kind: "uniform"; readonly max: SecondsKey; readonly min: SecondsKey };
  readonly kind: "drift";
}

export interface Debuff {
  readonly bumpMoney?: MoneyKey;
  readonly modifiers: readonly Modifier[];
  // At most one debuff defines movement: all active debuffs share one drift clock.
  readonly movement?: DebuffDriftMovement;
  readonly name: string;
  readonly seconds: SecondsKey;
  readonly stake: string;
}
