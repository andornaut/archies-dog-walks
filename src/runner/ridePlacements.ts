import type { LaneDirection } from "../layout/lanes.ts";
import { speedFactor } from "./moverDraws.ts";
import { blockCells, bodyLength, drawnHitLength, rowsCovering } from "./moverExtents.ts";
import type { MoverMotion, MoverPlacement, PlacementContext } from "./moverModel.ts";

// A rider enters as its row reaches the point where riding at its speed brings it to the pack
// just as the row's window starts. Faster than the road, it overtakes what is in its lanes,
// from the rows above its own to those below the pack; slower, those rows overtake it, and it
// overlaps the pack for longer, which its rows cover. Its speed is its kind's at its drawn
// factor; every factor keeps it coming down the road. Its cue shows from as soon as its row comes
// on screen, and for at least warningSeconds. One that merges moves a lane to either side that
// stays on the road, one placement each, starting once its travel is its merge's share of the way
// to the pack's rows. Its full visible cue may start before body entry; the merge must finish
// before pack contact. With no room for the complete merge itself, it
// has no placement. It is placed as a rider over both its lanes, blocking and standing in each.
export function ridePlacements(
  context: PlacementContext,
  motion: Extract<MoverMotion, { kind: "ride" }>,
): MoverPlacement[] {
  const { draws, geometry, spec, work } = context;
  const { cellLength, laneCount, roadLength, rowSpacing, scrollSpeed, sightLength } = geometry;
  const speedMultiplier = motion.speedMultiplier * speedFactor(spec.variation, draws);
  if (speedMultiplier <= 0 || speedMultiplier === 1) {
    throw new Error("A rider must move faster or slower than the road");
  }
  const { lanes: across, rows } = spec.footprint;
  const warning = spec.warningSeconds * scrollSpeed;
  const enters = sightLength - sightLength / speedMultiplier;
  // Its cue shows from as soon as its row comes on screen, and never for less than its warning.
  const shown = Math.max(warning, enters);
  const leaves = enters + (roadLength + rows * cellLength) / speedMultiplier;
  // The row offset, in distance, that the rider's near end is level with at a scroll.
  const level = (scroll: number) => scroll - speedMultiplier * (scroll - enters);
  const firstRow = Math.floor(Math.min(level(enters), level(leaves)) / rowSpacing);
  const lastRow = Math.ceil(
    (Math.max(level(enters), level(leaves)) + (rows - 1) * cellLength) / rowSpacing,
  );
  const blockRows = rowsCovering(geometry, rows, 1 / speedMultiplier);
  // Its body covers the road its near end is level with from entering until its hit box, drawn
  // no longer than its planned hit length, has left the road's bottom, and its hit length above.
  const length = bodyLength(geometry, rows);
  const gone = enters + (roadLength + Math.max(length, rows * cellLength)) / speedMultiplier;
  const [nearest, farthest] = [level(enters), level(gone)].sort((a, b) => a - b);
  // A merge's start, as travel down the road from the road's top, and its length in scroll.
  const mergeLength = (motion.merge?.seconds ?? 0) * scrollSpeed;
  const latestMergeFrom = sightLength - mergeLength * speedMultiplier;
  if (motion.merge !== undefined && latestMergeFrom < 0) {
    return [];
  }
  const onRoadMergeFrom = Math.max(
    warning * speedMultiplier,
    Math.min((motion.merge?.at ?? 0) * sightLength, latestMergeFrom),
  );
  // Keep existing feasible timing. A fast rider's cue can start at its visible lane sign
  // before the body enters, with the full merge ending before the pack-contact boundary.
  const mergeFrom =
    onRoadMergeFrom > latestMergeFrom ? Math.max(0, latestMergeFrom - 1e-9) : onRoadMergeFrom;
  const directions = motion.merge === undefined ? [0] : [-1, 1];
  return Array.from({ length: laneCount - across + 1 }, (_, lane) => lane).flatMap((lane) =>
    directions.flatMap((direction): MoverPlacement[] => {
      const merged = lane + direction;
      if (merged < 0 || merged + across > laneCount) {
        return [];
      }
      work?.beforePlacement();
      const lanes = { count: across + Math.abs(direction), first: Math.min(lane, merged) };
      const merge =
        direction === 0
          ? {}
          : {
              merge: {
                at: shown + mergeFrom / speedMultiplier,
                cue: warning,
                lanes: direction as LaneDirection,
                length: mergeLength,
              },
            };
      return [
        {
          appears: enters - shown,
          body: { from: nearest ?? 0, lanes, to: (farthest ?? 0) + length },
          cells: blockCells(firstRow, lastRow - firstRow + 1, lanes.first, lanes.count),
          lane,
          lanes,
          path: {
            lane,
            lanes: across,
            ...merge,
            motion: "ride",
            movement: spec.movement,
            speedMultiplier,
            warning: shown,
          },
          rows: blockRows,
          screen: [enters - shown, leaves],
          stands: [
            {
              distance: 0,
              lane: lanes.first,
              lanes: lanes.count,
              length:
                (drawnHitLength(geometry, spec) + geometry.packHitLength) / speedMultiplier -
                geometry.packHitLength,
            },
          ],
        },
      ];
    }),
  );
}
