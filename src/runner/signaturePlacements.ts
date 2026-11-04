import type { SignatureProfile } from "../data/types.ts";
import { delayOf } from "./moverDraws.ts";
import { blockCells, drawnHitLength, laneSpan, rowsCovering } from "./moverExtents.ts";
import type { MoverPlacement, PlacementContext } from "./moverModel.ts";
import type { LaneSpan } from "./movers.ts";
import {
  compileSignature,
  signaturePlace,
  type SignatureSweep,
  signatureTravelSweeps,
} from "./signaturePaths.ts";

// Choreography ends before pack contact. Reserve its whole continuous body sweep against
// other spawns, but block the guaranteed path only during actual contact with the pack.
export function signaturePlacements(
  context: PlacementContext,
  profile: SignatureProfile,
): MoverPlacement[] {
  const { draws, geometry, spec, work } = context;
  const { cellLength, laneCount, roadLength, rowSpacing, scrollSpeed, sightLength, window } =
    geometry;
  const span = spec.footprint.lanes;
  const height = Math.max(spec.footprint.rows * cellLength, drawnHitLength(geometry, spec));
  const warning = profile.warningSeconds * scrollSpeed;
  const at = warning + delayOf(spec.variation, draws, 0) * scrollSpeed;
  const inset = geometry.laneInset / cellLength;
  const preferred = draws.side < 0.5 ? -1 : 1;
  const directions: readonly (-1 | 1)[] = [preferred, preferred === -1 ? 1 : -1];
  const placements: MoverPlacement[] = [];
  for (const [directionIndex, direction] of directions.entries()) {
    for (let lane = 0; lane + span <= laneCount; lane++) {
      const route = compileSignature(
        geometry,
        profile,
        { count: draws.count, direction },
        { at, lane, span, travel: height },
      );
      if (route === null) {
        continue;
      }
      // Only exit legs may cross a road edge, and those legs are linear in X.
      const onRoad = (cut: number, sweep: SignatureSweep): SignatureSweep[] => {
        const dx = sweep.to.x - sweep.from.x;
        const left = -span + cut;
        const right = laneCount - cut;
        if (dx === 0) {
          return sweep.from.x > left && sweep.from.x < right ? [sweep] : [];
        }
        const fractions = [(left - sweep.from.x) / dx, (right - sweep.from.x) / dx].sort(
          (a, b) => a - b,
        );
        const first = Math.max(0, fractions[0] ?? 0);
        const last = Math.min(1, fractions[1] ?? 1);
        if (first >= last) {
          return [];
        }
        const start = sweep.start + (sweep.end - sweep.start) * first;
        const end = sweep.start + (sweep.end - sweep.start) * last;
        return [
          {
            component: sweep.component,
            end,
            from: signaturePlace(route, start, sweep.component),
            start,
            to: signaturePlace(route, end, sweep.component),
          },
        ];
      };
      const whole = signatureTravelSweeps(route, 0, roadLength + height).flatMap((sweep) =>
        onRoad(0, sweep),
      );
      const contact = signatureTravelSweeps(route, sightLength, sightLength + window).flatMap(
        (sweep) => onRoad(0, sweep),
      );
      if (whole.length === 0) {
        continue;
      }
      work?.beforePlacement();
      const firstContact =
        contact.length === 0
          ? route.complete + Math.max(0, sightLength - signaturePlace(route, route.complete).y)
          : Math.min(...contact.map((sweep) => sweep.start));
      const appears = sightLength - firstContact;
      const sweptSpan = (sweeps: readonly SignatureSweep[], cut = 0): LaneSpan => {
        const points = sweeps.flatMap((sweep) => [sweep.from.x, sweep.to.x]);
        return points.length === 0
          ? { count: 0, first: 0 }
          : laneSpan(laneCount, Math.min(...points), Math.max(...points) + span - 1, cut);
      };
      const levels = whole.flatMap((sweep) => [
        appears + sweep.start - sweep.from.y,
        appears + sweep.end - sweep.to.y,
      ]);
      const cells = whole.flatMap((sweep) => {
        const swept = sweptSpan([sweep]);
        const levels = [appears + sweep.start - sweep.from.y, appears + sweep.end - sweep.to.y];
        const firstRow = Math.floor(Math.min(...levels) / rowSpacing);
        const lastRow = Math.ceil((Math.max(...levels) + height) / rowSpacing);
        return blockCells(firstRow, lastRow - firstRow + 1, swept.first, swept.count);
      });
      const uniqueCells = [
        ...new Map(cells.map((cell) => [`${cell.row}:${cell.lane}`, cell])).values(),
      ];
      const drawnWindow = drawnHitLength(geometry, spec) + geometry.packHitLength;
      const touched = signatureTravelSweeps(route, sightLength, sightLength + drawnWindow).flatMap(
        (sweep) => onRoad(inset, sweep),
      );
      const contactLength =
        contact.length === 0 ? 0 : Math.max(...contact.map((sweep) => sweep.end)) - firstContact;
      placements.push({
        appears,
        body: {
          from: Math.min(...levels),
          lanes: sweptSpan(whole, inset),
          to: Math.max(...levels) + height,
        },
        cells: uniqueCells,
        lane,
        lanes: sweptSpan(contact),
        path: { lane, motion: "signature", movement: spec.movement, route, warning },
        rank: directions.length - directionIndex,
        rows: Math.max(1, rowsCovering(geometry, 1, contactLength / window)),
        screen: [appears, appears + Math.max(...whole.map((sweep) => sweep.end))],
        stands: touched.map((sweep) => {
          const hit = sweptSpan([sweep], inset);
          return {
            distance: appears + sweep.start - sightLength,
            lane: hit.first,
            lanes: hit.count,
            length: sweep.end - sweep.start - geometry.packHitLength,
          };
        }),
      });
    }
  }
  return placements;
}
