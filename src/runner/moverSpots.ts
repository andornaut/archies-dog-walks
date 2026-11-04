import { laneMask } from "../layout/lanes.ts";
import type {
  BlockCell,
  MoverBody,
  MoverDraws,
  MoverGeometry,
  MoverPlacement,
  MoverSpawn,
  MoverSpec,
  MoverStand,
} from "./moverModel.ts";
import type { LaneSpan, MoverPath } from "./movers.ts";
import { type MoverCaps, type OnScreen, onScreenOf, screenHasRoom } from "./moverScreen.ts";
import { type RiderSpan, riderSpanOf } from "./riderSpans.ts";
import type { SpawnRejection } from "./spawnAdmission.ts";
import type { FeasibilityObserver } from "./spawnFeasibilityDiagnostics.ts";

export function isDartPlacement(placement: Pick<MoverPlacement, "path">): boolean {
  return placement.path.motion === "cross";
}

// Reservation sharing is symmetric in a completed layout; construction insertion
// order remains governed by its directional grid query.
export function moverReservationsMayShare(
  a: MoverPath["motion"],
  b: MoverPath["motion"],
  aBlocksLane: boolean,
  bBlocksLane: boolean,
): boolean {
  return (
    (a === "cross") !== (b === "cross") ||
    (a === "ride" && b === "ride" && aBlocksLane && bBlocksLane)
  );
}

// The spawn planner's grid of rows and lanes. block blocks lanes in a row's window for rows rows,
// as a dart's sweep where dart is set, if every lane-blocking spawn keeps clear of the path, and
// undoes it unless keep is set. leavesRoom is false when taking the cells would leave too few for
// the spawns placed later that are never skipped. packFits is true when the pack fits between each
// stand and every lane-blocking spawn placed so far along the path, and between the stands
// themselves, and stand records the stands for the spawns placed later. isFree is true when a mover
// of a motion may take a cell (moverMayTake in spawning.ts). take holds a cell for a mover, a dart
// if dart is set, so nothing placed later takes it, but a lane-blocking standing spawn where no
// mover's body comes: occupy records a mover's body, at distances along the zone, for those.
// clearOf is true when a mover's body, at distances along the zone, shares no road with a
// lane-blocking standing spawn placed so far, which a dart may set off over. clearOfRiders is true
// when a lane-blocking rider's hit box keeps riderFollowGap from that of each recorded by rode, which a grid of
// movers that block no lane leaves out. heldLanes is the lane mask the path holds on a row, none
// without it.
export interface MoverVisibilityProof {
  readonly block: {
    readonly dart: boolean;
    readonly lanes: LaneSpan;
    readonly row: number;
    readonly rows: number;
  };
  readonly body?: MoverBody;
  readonly cells: readonly BlockCell[];
  readonly screen: readonly [number, number];
  readonly selection: { readonly draws: MoverDraws; readonly lift: number };
  readonly stands: readonly MoverStand[];
}

export interface MoverGrid {
  readonly onFailure?: FeasibilityObserver | undefined;
  block(row: number, lanes: LaneSpan, rows: number, keep: boolean, dart?: boolean): boolean;
  clearOf(body: MoverBody): boolean;
  clearRun(lanes: LaneSpan, row: number): number;
  isFree(motion: MoverPath["motion"], lane: number, row: number): boolean;
  leavesRoom(cells: readonly BlockCell[]): boolean;
  occupy(body: MoverBody): void;
  packFits(stands: readonly MoverStand[]): boolean;
  stand(stands: readonly MoverStand[]): void;
  take(dart: boolean, lane: number, row: number, rider?: boolean): void;
  canShow?(
    spawn: MoverSpawn<string>,
    interval: readonly [number, number],
    cells?: readonly BlockCell[],
  ): boolean;
  showed?(
    spawn: MoverSpawn<string>,
    interval: readonly [number, number],
    proof?: MoverVisibilityProof,
    request?: {
      readonly memberIndex: number;
      readonly quotaIndex: number;
      readonly requestedDraws?: MoverDraws;
    },
  ): void;
  clearOfRiders?(ride: RiderSpan): boolean;
  heldLanes?(row: number): number;
  rode?(ride: RiderSpan): void;
}

export interface Spot {
  readonly distance: number;
  readonly placement: MoverPlacement;
  readonly row: number;
}

function screenOf(spot: Spot): readonly [number, number] {
  const [start, end] = spot.placement.screen;
  return [spot.distance + start, spot.distance + end];
}

// A spot's body, if it has one, at distances along the zone.
function bodyOf(spot: Spot): MoverBody | undefined {
  const { body } = spot.placement;
  return body === undefined
    ? undefined
    : { from: spot.distance + body.from, lanes: body.lanes, to: spot.distance + body.to };
}

// Whether a placement's stop, if it has one, leaves open the lanes the path holds on its row, held
// as a lane mask.
export function leavesPathOpen(held: number, placement: Pick<MoverPlacement, "stop">): boolean {
  const { stop } = placement;
  return stop === undefined || (laneMask(stop.first, stop.count) & held) === 0;
}

function standsOf(spot: Spot): MoverStand[] {
  return spot.placement.stands.map((stand) => ({
    ...stand,
    distance: spot.distance + stand.distance,
  }));
}

// Commits an already selected compiled candidate without changing its motion.
// What a kept spot is recorded in: the road's geometry, the planner's grid and the movers on
// screen that its caps count.
interface SpotKeep {
  readonly geometry: MoverGeometry;
  readonly grid: MoverGrid;
  readonly onScreen: OnScreen[];
}

export function keepMoverSpot(keep: SpotKeep, spec: MoverSpec, spot: Spot): void {
  const { geometry, grid, onScreen } = keep;
  const { placement } = spot;
  const dart = isDartPlacement(placement);
  const rider = placement.path.motion === "ride";
  placement.cells.forEach(({ lane, row }) => grid.take(dart, lane, spot.row + row, rider));
  const ride = riderSpanOf(geometry, spec, spot.distance + placement.appears, placement);
  if (ride !== undefined) {
    grid.rode?.(ride);
  }
  const body = bodyOf(spot);
  if (body !== undefined) {
    grid.occupy(body);
  }
  grid.block(spot.row, placement.lanes, placement.rows, true, dart);
  grid.stand(standsOf(spot));
  onScreen.push(onScreenOf(placement.path, screenOf(spot)));
}

export function moverWithinZone(geometry: { readonly zoneLength: number }, spot: Spot): boolean {
  const [start, end] = screenOf(spot);
  return start >= 0 && end <= geometry.zoneLength;
}

// What a spot is fitted against: the road's geometry and the zone's length, the screen caps, the
// planner's grid and the movers on screen that its caps count, and reject, which records why a
// spot does not fit.
interface SpotFit {
  readonly caps: MoverCaps;
  readonly geometry: MoverGeometry & { readonly zoneLength: number };
  readonly grid: MoverGrid;
  readonly onScreen: readonly OnScreen[];
  readonly reject: (reason: SpawnRejection) => false;
}

export function fitsMoverSpot(
  fit: SpotFit,
  spec: MoverSpec,
  kind: string | undefined,
  spot: Spot,
): boolean {
  const { caps, geometry, grid, onScreen, reject } = fit;
  const [start, end] = screenOf(spot);
  const { placement } = spot;
  const { cells } = placement;
  const body = bodyOf(spot);
  const rider = riderSpanOf(geometry, spec, spot.distance + placement.appears, placement);
  if (!moverWithinZone(geometry, spot)) {
    return reject("outside-zone");
  }
  if (
    kind !== undefined &&
    !(
      grid.canShow?.(
        {
          distance: spot.distance + placement.appears,
          kind,
          lane: placement.lane,
          mover: placement.path,
        },
        [start, end],
        cells.map(({ lane, row }) => ({ lane, row: spot.row + row })),
      ) ?? true
    )
  ) {
    return false;
  }
  if (!screenHasRoom(caps, onScreen, onScreenOf(placement.path, [start, end]), grid.onFailure)) {
    return reject("screen-cap");
  }
  if (!cells.every(({ lane, row }) => grid.isFree(placement.path.motion, lane, spot.row + row))) {
    return reject("cells");
  }
  if (!(rider === undefined || (grid.clearOfRiders?.(rider) ?? true))) {
    return reject("rider-gap");
  }
  if (body !== undefined && !grid.clearOf(body)) {
    return reject("body");
  }
  if (!grid.leavesRoom(cells.map(({ lane, row }) => ({ lane, row: spot.row + row })))) {
    return reject("reservation");
  }
  if (!grid.packFits(standsOf(spot))) {
    return reject("pack-gap");
  }
  return (
    grid.block(spot.row, placement.lanes, placement.rows, false, isDartPlacement(placement)) ||
    reject("open-lanes")
  );
}
