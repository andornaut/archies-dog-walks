import { bodyLength, drawnHitLength } from "./moverExtents.ts";
import type { MoverGeometry, MoverPlacement, MoverSpec } from "./moverModel.ts";

// A lane-blocking rider in road and time: the lanes it covers over its whole path as a lane mask,
// the zone's scroll from which its hit box is on the road and moving (from) until it has left the
// road's bottom (to), its speed down the road over the road's, and its planned hit length.
export interface RiderSpan {
  readonly from: number;
  readonly lanes: number;
  readonly length: number;
  readonly speed: number;
  readonly to: number;
}

// The rider span of a rider spawned at distance, at its planned hit length.
export function riderSpanOf(
  geometry: MoverGeometry,
  spec: MoverSpec,
  distance: number,
  placement: MoverPlacement,
): RiderSpan | undefined {
  const { path } = placement;
  if (path.motion !== "ride") {
    return undefined;
  }
  const length = Math.max(
    bodyLength(geometry, spec.footprint.rows),
    drawnHitLength(geometry, spec),
  );
  const from = distance + path.warning;
  return {
    from,
    lanes: ((1 << placement.lanes.count) - 1) << placement.lanes.first,
    length,
    speed: path.speedMultiplier,
    to: from + (geometry.roadLength + length) / path.speedMultiplier,
  };
}

// Whether two riders come within gap of each other: they share a lane and, at some moment both are
// on the road, less than gap of road lies between their hit boxes. Each one's travel grows at its
// speed from when it enters, so the road between them changes linearly over the moments they share.
export function ridersMeet(gap: number, a: RiderSpan, b: RiderSpan): boolean {
  if ((a.lanes & b.lanes) === 0) {
    return false;
  }
  const from = Math.max(a.from, b.from);
  const to = Math.min(a.to, b.to);
  if (from >= to) {
    return false;
  }
  // a's travel less b's: a's hit box ends at its travel and starts its length above it, so b's
  // lies wholly above a's, gap clear, while this is at least a's length and gap, and wholly below
  // while it is at most less b's length and gap.
  const ahead = (scroll: number) => a.speed * (scroll - a.from) - b.speed * (scroll - b.from);
  const [low, high] = [ahead(from), ahead(to)].sort((x, y) => x - y) as [number, number];
  return low < a.length + gap && high > -(b.length + gap);
}
