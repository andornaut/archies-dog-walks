import type { BlockCell, MoverGeometry, MoverSpec } from "./moverModel.ts";
import { crossScrollTo, crossSpan, type LaneSpan, type MoverPath, moverPlace } from "./movers.ts";
import { signatureTravelSweeps } from "./signaturePaths.ts";

// The planned hit length of a mover rows long: the window less the pack's length, which is a
// one-row hit box, and a cell for each row after the first.
export function bodyLength(geometry: MoverGeometry, rows: number): number {
  return geometry.window - geometry.packLength + (rows - 1) * geometry.cellLength;
}

// A mover's hit length for its stands: its kind's drawn one, or the planned hit length of its
// footprint (bodyLength).
export function drawnHitLength(geometry: MoverGeometry, spec: MoverSpec): number {
  return spec.hitLength ?? bodyLength(geometry, spec.footprint.rows);
}

// Every cell of rowCount rows from firstRow by laneCount lanes from firstLane, row by row.
export function blockCells(
  firstRow: number,
  rowCount: number,
  firstLane: number,
  laneCount: number,
): BlockCell[] {
  return Array.from({ length: rowCount }, (_, i) =>
    Array.from({ length: laneCount }, (_unused, j) => ({ lane: firstLane + j, row: firstRow + i })),
  ).flat();
}

// The lanes on the road a box overlaps anywhere from lane position low to high: as collision cuts
// a mover's box to its lanes, it spans half a lane either side of its position, less inset lanes
// at each side. A box wholly off the road overlaps none: no lanes from lane 0.
export function laneSpan(laneCount: number, low: number, high: number, inset: number): LaneSpan {
  const first = Math.max(0, Math.floor(low - 1 + inset + 1e-9) + 1);
  const last = Math.min(laneCount - 1, Math.ceil(high + 1 - inset - 1e-9) - 1);
  return last < first ? { count: 0, first: 0 } : { count: last - first + 1, first };
}

// The lanes a crosser touches while its travel is from to to: its travel only moves one way and its
// lane position one way to its turn and the other way after, or to its stop and then not at all,
// so its ends and its turn bound it. Its box is inset lanes inside a lane at each side, none
// unless given, so a box between lanes touches both. A rider or stepping mover's are its own.
export function sweptLanes(
  laneCount: number,
  path: MoverPath,
  from: number,
  to: number,
  inset = 0,
): LaneSpan {
  if (path.motion === "signature") {
    const points = signatureTravelSweeps(path.route, from, to).flatMap((sweep) => [
      sweep.from.x,
      sweep.to.x,
    ]);
    return points.length === 0
      ? { count: 0, first: 0 }
      : laneSpan(laneCount, Math.min(...points), Math.max(...points), inset);
  }
  if (path.motion === "ride") {
    const merged = path.lane + (path.merge?.lanes ?? 0);
    return {
      count: path.lanes + Math.abs(merged - path.lane),
      first: Math.min(path.lane, merged),
    };
  }
  if (path.motion === "steps" || path.motion === "approach" || path.motion === "shy") {
    return { count: 1, first: path.lane };
  }
  const moving = Math.max(from, path.enterTravel);
  if (moving >= to) {
    return { count: 0, first: 0 };
  }
  // The lane position once the crosser's travel has reached travel.
  const at = (travel: number) =>
    moverPlace(laneCount, path, path.warning + crossScrollTo(path, travel)).lanePosition;
  const turn =
    path.turnAfter === null
      ? null
      : path.enterTravel + ((1 + path.tilt) * path.turnAfter) / path.lanesPerPixel;
  const places = [moving, to, ...(turn !== null && turn > moving && turn < to ? [turn] : [])].map(
    at,
  );
  const low = Math.min(...places);
  return laneSpan(laneCount, low, Math.max(...places) + crossSpan(path) - 1, inset);
}

// The fewest rows whose blocking length covers rows' blocking length stretched by stretch.
export function rowsCovering(geometry: MoverGeometry, rows: number, stretch: number): number {
  const { cellLength, window } = geometry;
  const needed = (window + (rows - 1) * cellLength) * stretch;
  return Math.max(rows, 1 + Math.ceil((needed - window) / cellLength - 1e-9));
}
