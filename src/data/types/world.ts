import type { MinorObstacleId, ObstacleEncounterId, ZoneId } from "../ids.ts";

// Paws out of 5 on a fork's path card.
export type Difficulty = 1 | 2 | 3 | 4 | 5;

// How often each kind is drawn in a zone, relative to the others of its group. 0 keeps it out
// of the zone; each group needs at least one kind above 0.
export interface ZoneWeights {
  readonly minorObstacles: Readonly<Record<MinorObstacleId, number>>;
  readonly obstacles: Readonly<Record<ObstacleEncounterId, number>>;
}

export type SpawnSlotRole = "encounterFixed" | "encounterMoving" | "minorFixed" | "minorMoving";

export type SpawnSlotCounts = Readonly<Record<SpawnSlotRole, number>>;

// Each positive-weight kind is guaranteed once, consuming its role's budget rather than adding
// spawns.
interface ZoneSpawnSlots {
  // Delivered ordinary counts at each position in the walk, before upgrade modifiers.
  readonly counts: readonly [SpawnSlotCounts, ...SpawnSlotCounts[]];
  // Maximum validated counts, including supported modifiers and unused tuning headroom.
  readonly capacity: SpawnSlotCounts;
}

export interface Zone {
  // The zone's name in its art keys, such as backdrop-<art>.
  readonly art: string;
  // Reward count multipliers; hazard counts come only from spawnSlots.
  readonly density: {
    readonly luckyFinds: number;
    readonly tips: number;
  };
  readonly difficulty: Difficulty;
  // The difficulty in words, as a path card shows it.
  readonly difficultyName: string;
  readonly id: ZoneId;
  // Hex colours from the art palette. The leash stands out against the zone's road.
  readonly leashColour: string;
  // The chance that an obstacle or lucky encounter with an authored movement comes as a mover.
  // 0 or less also turns off the moving spawnSlots roles.
  readonly moverShare: number;
  readonly name: string;
  readonly roadColour: string;
  readonly roadShadowColour: string;
  // Multiplies the scroll speed, on top of multipliers.scrollSpeedGainPerZone.
  readonly speed: number;
  readonly spawnSlots: ZoneSpawnSlots;
  readonly weights: ZoneWeights;
}

export interface World {
  // The id of the zone every walk starts in, and of the zone every walk ends in.
  readonly firstZone: ZoneId;
  readonly lastZone: ZoneId;
  readonly name: string;
  // The zones every walk took before forks, in order: a cheat start at a later zone with no
  // route walks them.
  readonly preForkRoute: readonly ZoneId[];
  // How many zones a walk visits, none twice.
  readonly walkLength: number;
  // From easiest to hardest: a fork's paths keep this order, left to right.
  readonly zones: readonly [Zone, ...Zone[]];
}

// Where an ambient mover goes. Ambient movers are scenery: they never touch the road, collide,
// or change anything in play.
// - crossStreet: along the backdrop's cross street, in the near lane going right or the far
//   lane going left.
// - crossWalk: along one of the cross street's sidewalks, either way.
// - sidewalkAway, sidewalkToward: along a sidewalk beside the road (on the lawn's edge where
//   there is none), walking away from or toward the walker.
// - sky: across the backdrop band's top rows, above the skyline, either way, at full size, its
//   feet on a row drawn from its rows.
// - verge: on the lawn or paving beside the road. A steady mover darts in from the screen's
//   side, stops, and darts back out; a hopper or flier starts there and leaves the same way.
type AmbientPath =
  "crossStreet" | "crossWalk" | "sidewalkAway" | "sidewalkToward" | "sky" | "verge";

// How a mover covers its path: steadily, in bursts of one or two hops with a pause between
// them, or rising as it goes.
export type AmbientGait = "fly" | "hop" | "steady";

// One kind of ambient mover in a zone: its sprite and the tag it plays while moving, its path
// and gait, its speed while moving (band pixels a second on the cross street, its sidewalks
// and in the sky, road pixels a second beside the road) and how often one sets out, per minute.
// rows, for a sky mover, is the range its feet row is drawn from, in band pixels, from..to
// inclusive; without it, the plane's (SKY_ROWS in src/road/ambient.ts).
export interface AmbientMover {
  readonly gait: AmbientGait;
  readonly key: string;
  readonly path: AmbientPath;
  readonly perMinute: number;
  readonly rows?: { readonly from: number; readonly to: number };
  readonly speed: number;
  readonly tag: string;
}
