import { describe, expect, it } from "vitest";

import { type Contact, pathShortfalls } from "../testing/avoidable";
import type { MoverPath } from "./movers";
import { SpawnCells } from "./spawnCells";
import {
  hitLength,
  moverMayTake,
  moverRests,
  openStretches,
  packFitsOnPath,
  packGap,
  type PathChange,
  pathReach,
  pickupAllowsMover,
  rowSpacing,
  type SpawnPlan,
  spawnRowDistances,
  takeDueSpawns,
} from "./spawning";

type Kind = "obstacle" | "tip" | "treat";

// 9 rows at 100..900, 5 lanes. A one-row hit box is 30 - 2 x 5 = 20px; with the 30px pack a
// row's window is 50px, leaving 50px of clear road between rows: at 100px/s that is 0.5s,
// time for a 0.05s step and 4 moves of 0.1s, so the pack can reach any lane from any row. No cap
// on rows that come on screen quiet, unless a test sets one. The path starts in the middle lane.
// No fixed kinds to swap among, unless a test sets them.
const plan: SpawnPlan<Kind> = {
  cellInset: 5,
  cellLength: 30,
  fixedKinds: [],
  laneCount: 5,
  laneInset: 5,
  laneMoveSeconds: 0.1,
  maxEmptyRows: Number.POSITIVE_INFINITY,
  minOpenLanes: 1,
  minSpacing: 100,
  moverCaps: { darts: 1, slowVehicles: 1, total: 3 },
  packHitLength: 30,
  packLength: 30,
  pathLaneMoveSeconds: 0.1,
  pathStart: 2,
  quotas: [
    { blocksLane: true, count: 6, kind: "obstacle" },
    { blocksLane: false, count: 9, kind: "tip" },
    { blocksLane: false, count: 3, kind: "treat" },
  ],
  reactionSeconds: 0,
  riderFollowGap: 30,
  roadLength: 1100,
  scrollSpeed: 100,
  sightLength: 1000,
  stepSeconds: 0.05,
  zoneLength: 1000,
};

// A 70px window leaves 0.3s between rows, which fits a step and one 0.25s move; the 1s into the
// first row fits a step and three.
const tight: SpawnPlan<Kind> = {
  ...plan,
  laneMoveSeconds: 0.25,
  packHitLength: 50,
  packLength: 50,
  pathLaneMoveSeconds: 0.25,
  quotas: [
    { blocksLane: true, count: 27, kind: "obstacle" },
    { blocksLane: false, count: 9, kind: "tip" },
  ],
};

describe("spawnRowDistances", () => {
  it("spaces rows minSpacing apart, clear of both ends of the zone, and needs a positive spacing", () => {
    expect(spawnRowDistances(100, 1000)).toEqual([100, 200, 300, 400, 500, 600, 700, 800, 900]);
    expect(spawnRowDistances(100, 1050).at(-1)).toBe(900);
    expect(spawnRowDistances(100, 150)).toEqual([]);
    expect(spawnRowDistances(100, 50)).toEqual([]);
    expect(() => spawnRowDistances(0, 1000)).toThrow("minSpacing must be positive");
  });
});

describe("packFitsOnPath", () => {
  // A car three rows long in lane 2, and the path changing from lane 1 to lane 2 just after it
  // meets the pack: road starts showing behind it at its hit box's far edge.
  const car = { distance: 0, lane: 2, lanes: 1, length: hitLength(plan, 3) };
  const behind = car.length;
  const change: PathChange = { at: 1, from: 1, to: 2 };
  it.each([
    {
      far: { distance: behind + packGap(plan, 1) - 1, lane: 1 },
      fits: false,
      name: "a pack gap less a pixel later, in the lane the path leaves",
    },
    {
      far: { distance: behind + packGap(plan, 1), lane: 1 },
      fits: true,
      name: "a pack gap later, in the lane the path leaves",
    },
    {
      far: { distance: behind + 1, lane: 2 },
      fits: true,
      name: "a pixel later, in the lane the path takes",
    },
    {
      far: { distance: behind + 1, lane: 3 },
      fits: true,
      name: "a pixel later, off the path's way",
    },
    {
      far: { distance: behind + 1, lane: 1 },
      fits: true,
      name: "a pixel later, with no change between",
      unchanged: true,
    },
  ])("fits a pack past a car and an obstacle $name: $fits", ({ far, fits, unchanged }) => {
    const changes = unchanged === true ? [] : [change];
    const other = { ...far, lanes: 1, length: hitLength(plan, 1) };
    expect(packFitsOnPath(plan, changes, car, other)).toBe(fits);
    expect(packFitsOnPath(plan, changes, other, car)).toBe(fits);
  });
});

describe("packGap and packFitsOnPath over wide obstacles", () => {
  // At 100px/s a 0.1s lane move lasts two 0.05s steps, 10px, and a 0.2s reaction margin is 20px.
  const margined = { ...plan, reactionSeconds: 0.2 };
  it("is the pack, its lane moves and the reaction margin", () => {
    for (const { changes, gap } of [
      { changes: 1, gap: 30 + 10 + 20 },
      { changes: 3, gap: 30 + 3 * 10 + 20 },
    ]) {
      expect(packGap(margined, changes)).toBeCloseTo(gap, 9);
    }
  });

  // The path changes from lane 0 to lane 2 between the two: as the nearer one passes the pack is
  // short of the first lane on the way it covers, and as the farther one meets it, past the last.
  it.each([
    { far: { lane: 0, lanes: 2 }, moves: 2, name: "1-3, then 0-1", near: { lane: 1, lanes: 3 } },
    { far: { lane: 0, lanes: 1 }, moves: 1, name: "1-3, then 0", near: { lane: 1, lanes: 3 } },
    { far: { lane: 0, lanes: 2 }, moves: 1, name: "2-4, then 0-1", near: { lane: 2, lanes: 3 } },
    { far: { lane: 0, lanes: 1 }, moves: 0, name: "2-4, then 0", near: { lane: 2, lanes: 3 } },
  ])("leaves room for $moves lane moves between wide obstacles $name", ({ far, moves, near }) => {
    const change: PathChange = { at: 1, from: 0, to: 2 };
    const nearer = { ...near, distance: 0, length: hitLength(plan, 1) };
    const at = (gap: number) => ({ ...far, distance: nearer.length + gap, length: nearer.length });
    const tightest = moves === 0 ? 1 : packGap(margined, moves);
    for (const [a, b] of [
      [nearer, at(tightest - 1)],
      [at(tightest - 1), nearer],
    ] as const) {
      expect(packFitsOnPath(margined, [change], a, b)).toBe(moves === 0);
    }
    expect(packFitsOnPath(margined, [change], nearer, at(tightest))).toBe(true);
  });
});

// The independent check the planner tests use: a path holding lane 1 on the rows at 100 and 200
// and changing to lane 2 at 300, halfway at 250, a 30px pack and 150px of road per lane move.
describe("pathShortfalls", () => {
  const path = [
    { distance: 100, lane: 1 },
    { distance: 200, lane: 1 },
    { distance: 300, lane: 2 },
  ];
  const contact = (lane: number, start: number): Contact => ({
    end: start + 20,
    label: `lane ${lane} at ${start}`,
    lanes: new Set([lane]),
    start,
  });
  it.each([
    { contacts: [contact(1, 160)], name: "an obstacle in the path's lane", shortfalls: 1 },
    {
      contacts: [contact(2, 150), contact(1, 300)],
      name: "obstacles either side of the change with 130px between them",
      shortfalls: 1,
    },
    {
      contacts: [contact(2, 150), contact(1, 320)],
      name: "obstacles either side of the change with 150px between them",
      shortfalls: 0,
    },
    { contacts: [contact(1, 300)], name: "an obstacle after the change alone", shortfalls: 0 },
  ])("finds $shortfalls shortfalls with $name", ({ contacts, shortfalls }) => {
    expect(pathShortfalls(30, (moves) => 150 * moves, path, contacts)).toHaveLength(shortfalls);
  });
});

describe("pathReach and rowSpacing", () => {
  // tight's 70px window leaves 30px between rows 100px apart. A move lasts whole 0.05s steps,
  // and needs a step to spare. The path changes by up to two lanes where the pack fits past them
  // on the road between one-row spawns two rows apart.
  it.each([
    { name: "a step and a move fit", reach: 2, spaced: tight, spacing: 100 },
    {
      name: "52px between rows fits two 25px moves but not their step to spare",
      reach: 2,
      spaced: { ...tight, packHitLength: 28, packLength: 28 },
      spacing: 100,
    },
    {
      name: "a 0.26s move lasts six steps, 30px",
      reach: 2,
      spaced: { ...tight, laneMoveSeconds: 0.26, pathLaneMoveSeconds: 0.26 },
      spacing: 105,
    },
    {
      name: "at 200px/s a 10px step and a 50px move need 60px",
      reach: 2,
      spaced: { ...tight, scrollSpeed: 200 },
      spacing: 130,
    },
    {
      name: "a hit box 30px longer than its row widens a 120px window's rows past minSpacing",
      reach: 2,
      spaced: { ...tight, cellInset: -20 },
      spacing: 150,
    },
    {
      name: "a 1.2s reaction margin leaves room for one move at most",
      reach: 1,
      spaced: { ...tight, reactionSeconds: 1.2 },
      spacing: 100,
    },
    {
      name: "two lanes leave one to change to",
      reach: 1,
      spaced: { ...plan, laneCount: 2, laneMoveSeconds: 0, pathLaneMoveSeconds: 0, pathStart: 0 },
      spacing: 100,
    },
  ] satisfies readonly {
    name: string;
    reach: number;
    spaced: SpawnPlan<Kind>;
    spacing: number;
  }[])("spaces rows and reaches $reach lanes when $name", ({ reach, spaced, spacing }) => {
    expect(rowSpacing(spaced)).toBe(spacing);
    expect(pathReach(spaced)).toBe(reach);
  });
});

// On a road of 5 lanes, written lane 0 first: each stretch between walls (W) keeps a lane the darts
// (D) leave open (.), wherever the walls stand.
describe("openStretches", () => {
  const masks = (road: string) =>
    [..."WD"].map((mark) =>
      [...road].reduce((mask, cell, lane) => (cell === mark ? mask | (1 << lane) : mask), 0),
    );
  it.each([
    { open: true, road: "....." },
    { open: true, road: "DDDD." },
    { open: false, road: "DDDDD" },
    { open: true, road: ".DWD." },
    { open: false, road: "..WDD" },
    { open: true, road: "D.WD." },
    { open: false, road: "DWDW." },
    { open: true, road: "WWW.D" },
    { open: false, road: "WWWDD" },
  ])("leaves a stretch of $road open: $open", ({ open, road }) => {
    const [walls = 0, darts = 0] = masks(road);
    expect(openStretches(5, walls, darts)).toBe(open);
  });
});

// A dart may set off over cells other spawns hold, and a rider pass over cells only darts hold;
// no other mover takes a cell anything holds, and nothing but a dart takes one a dart holds
// alongside another spawn.
describe("moverMayTake", () => {
  it.each([
    { byDarts: false, byOthers: false, motion: "cross", takes: true },
    { byDarts: false, byOthers: true, motion: "cross", takes: true },
    { byDarts: true, byOthers: false, motion: "cross", takes: false },
    { byDarts: false, byOthers: false, motion: "ride", takes: true },
    { byDarts: true, byOthers: false, motion: "ride", takes: true },
    { byDarts: false, byOthers: true, motion: "ride", takes: false },
    { byDarts: true, byOthers: true, motion: "ride", takes: false },
    { byDarts: false, byOthers: false, motion: "steps", takes: true },
    { byDarts: true, byOthers: false, motion: "steps", takes: false },
    { byDarts: false, byOthers: true, motion: "approach", takes: false },
    { byDarts: true, byOthers: false, motion: "shy", takes: false },
  ] as const)(
    "lets a $motion mover take a cell held by darts $byDarts, by others $byOthers: $takes",
    ({ byDarts, byOthers, motion, takes }) => {
      expect(moverMayTake(motion, byDarts, byOthers)).toBe(takes);
    },
  );
});

describe("takeDueSpawns", () => {
  const events = [
    { distance: 100, kind: "tip", lane: 0 },
    { distance: 200, kind: "obstacle", lane: 1 },
    { distance: 300, kind: "tip", lane: 2 },
  ];

  it("splits the events into those reached, at or past their distance, and those still ahead", () => {
    expect(takeDueSpawns(250, events)).toEqual({ due: events.slice(0, 2), pending: [events[2]] });
    expect(takeDueSpawns(200, events).due).toEqual(events.slice(0, 2));
    expect(takeDueSpawns(199.9, events).due).toEqual(events.slice(0, 1));
  });
});

describe("moverRests", () => {
  // A dart whose cue shows for 50px of scroll and sets off 300px down the road, crossing 0.01
  // lanes a pixel at a tilt of 0.2. Stopping after 1.5 lanes takes 150px of scroll, so it stands
  // level with a spawn its cue's distance plus 50 - 300 - 0.2 x 150 = -280 away.
  const dart = {
    direction: 1,
    enterTravel: 300,
    idle: 0,
    lanesPerPixel: 0.01,
    motion: "cross",
    movement: "dart",
    stopAfter: null,
    tilt: 0.2,
    turnAfter: null,
    warning: 50,
  } as const;
  const step = (lanes: number, travel: number) => ({ at: 0, lanes, length: 10, travel });

  it.each<{ name: string; path: MoverPath; rests: { distance: number; lane: number }[] }>([
    { name: "a dart that crosses", path: dart, rests: [] },
    {
      name: "a dart from the left that stops short",
      path: { ...dart, stopAfter: 1.5 },
      rests: [{ distance: 720, lane: 1 }],
    },
    {
      name: "a dart from the right that stops short",
      path: { ...dart, direction: -1, stopAfter: 1.5 },
      rests: [{ distance: 720, lane: 3 }],
    },
    {
      name: "a rider",
      path: {
        lane: 2,
        lanes: 1,
        motion: "ride",
        movement: "inLane",
        speedMultiplier: 2,
        warning: 50,
      },
      rests: [],
    },
    {
      name: "a stepper, at its last spot",
      path: {
        lane: 1,
        motion: "steps",
        movement: "step",
        steps: [step(1, 0), step(0, 64), step(1, 64)],
        warning: 50,
      },
      rests: [{ distance: 872, lane: 3 }],
    },
    {
      name: "a hopper that hops up the road",
      path: { lane: 4, motion: "steps", movement: "hop", steps: [step(-1, -64)], warning: 50 },
      rests: [{ distance: 1064, lane: 3 }],
    },
  ])("finds where $name stands", ({ path, rests }) => {
    expect(moverRests(5, 1000, path)).toEqual(rests);
  });
});

describe("standing pickups during mover admission", () => {
  it("keeps passable pickup cells occupied and restores their mover-blocking state", () => {
    const cells = new SpawnCells(3, 3, 0);
    cells.standOn(1, 2, true);
    expect(cells.isFree("ride", 1, 1, true)).toBe(true);
    expect(cells.heldFor(1, { blocksLane: true, count: 1, kind: "fixed" })).toBe(2);
    const restore = cells.save();
    cells.lift(1, 2);
    cells.standOn(1, 2);
    expect(cells.isFree("ride", 1, 1, true)).toBe(false);
    restore();
    expect(cells.isFree("ride", 1, 1, true)).toBe(true);
    expect(cells.untaken([{ lane: 1, row: 1 }])).toBe(0);
  });

  it("allows crossing a passable pickup but preserves its no-rest rule", () => {
    const pickup = {
      firstRow: 1,
      from: 100,
      lane: 1,
      lanes: 1,
      lastRow: 1,
      moversPassOver: true,
      moversRestOn: false,
      to: 200,
    };
    const mover = { blocksLane: true, cells: [{ lane: 1, row: 1 }], lanes: 1, rests: [] };
    expect(pickupAllowsMover(pickup, mover)).toBe(true);
    expect(pickupAllowsMover({ ...pickup, moversPassOver: false }, mover)).toBe(false);
    expect(
      pickupAllowsMover(pickup, {
        ...mover,
        rests: [{ distance: 150, lane: 1, lanes: 1, length: 20 }],
      }),
    ).toBe(false);
  });
});
