import { herringSpawn } from "./dartOutcomes.ts";
import { moverLeavesMinimumLanes } from "./laneAlternatives.ts";
import { DART_LIFTS, moverRetries } from "./moverDraws.ts";
import type { MoverDraws, MoverPlacement, MoverPlacementWork } from "./moverModel.ts";
import { moverPlacementsWithWork } from "./moverPlanning.ts";
import type { Geometry, PreparedSlotKind, SlotKindDescriptor } from "./slotKindPreparation.ts";
import { blockingLength, quotaFootprint, rowSpacing } from "./spawning.ts";

export interface MotionIndex {
  readonly draws: readonly MoverDraws[];
  readonly members: readonly ReadonlySet<MoverPlacement>[];
}
export interface NativeMotionIndex {
  readonly motion: MotionIndex;
  readonly ranges: ReadonlyMap<
    ReadonlySet<MoverPlacement>,
    { readonly end: number; readonly first: number }
  >;
}
export interface NativeMotionCapture {
  index?: NativeMotionIndex;
}
export const readonlyMembers = (members: Set<MoverPlacement>): ReadonlySet<MoverPlacement> => {
  const view: ReadonlySet<MoverPlacement> = Object.freeze({
    [Symbol.iterator]: () => members[Symbol.iterator](),
    entries: () => members.entries(),
    forEach(callback: Parameters<ReadonlySet<MoverPlacement>["forEach"]>[0], thisArg?: unknown) {
      members.forEach((placement) => callback.call(thisArg, placement, placement, view));
    },
    has: (placement: MoverPlacement) => members.has(placement),
    keys: () => members.keys(),
    size: members.size,
    values: () => members.values(),
  });
  return view;
};

export function slotMotionSelections<Kind extends string>(
  descriptor: SlotKindDescriptor<Kind>,
): readonly { readonly draws: MoverDraws; readonly lift: number }[] {
  const { draws, herring, request } = descriptor;
  if (request.mover === undefined || herring) {
    return [];
  }
  if (draws === undefined) {
    throw new Error("A compiled moving slot needs frozen draws");
  }
  const { motion } = request.mover;
  const selections =
    motion.kind === "cross" || motion.kind === "ride"
      ? [draws, ...moverRetries(request.mover, draws)]
      : [draws];
  return selections.flatMap((draws) =>
    (motion.kind === "cross" ? [0, ...DART_LIFTS] : [0]).map((lift) => ({ draws, lift })),
  );
}

// Complete domains are rebuilt without producer attestation when used by an independent auditor.
export function compileSlotKindDomain<Kind extends string>(
  work: MoverPlacementWork | undefined,
  geometry: Geometry<Kind>,
  descriptor: SlotKindDescriptor<Kind>,
): PreparedSlotKind<Kind> {
  return compileSlotDomain(work, geometry, undefined, descriptor);
}

export function compileSlotDomain<Kind extends string>(
  work: MoverPlacementWork | undefined,
  geometry: Geometry<Kind>,
  capture: NativeMotionCapture | undefined,
  descriptor: SlotKindDescriptor<Kind>,
): PreparedSlotKind<Kind> {
  const { draws, herring, request, source } = descriptor;
  if (request.mover === undefined) {
    const footprint = quotaFootprint(request);
    work?.beforePlacement();
    return {
      columns: Array.from(
        { length: Math.max(0, geometry.laneCount - footprint.lanes + 1) },
        (_, lane) => lane,
      ),
      compiledCount: 1,
      herring: false,
      placements: [],
      request,
      source,
    };
  }
  if (draws === undefined) {
    throw new Error("A compiled moving slot needs frozen draws");
  }
  const grid = {
    ...geometry,
    rowSpacing: rowSpacing({ ...geometry, quotas: [] }),
    window: blockingLength(geometry, 1),
  };
  if (herring) {
    work?.beforePlacement();
    const sample = herringSpawn(grid, request.mover, draws, request.kind, [0]);
    return {
      columns: sample === null ? [] : [sample.lane],
      compiledCount: 1,
      draws,
      herring: true,
      placements: [],
      request,
      source,
    };
  }
  const placements =
    request.mover.motion.kind === "cross" || request.mover.motion.kind === "ride"
      ? slotMotionSelections(descriptor).flatMap(({ draws: selected, lift }) => {
          const selectedPlacements = new Map<MoverPlacement, MoverPlacement>();
          return moverPlacementsWithWork(work, grid, request.mover!, selected, lift).map(
            (placement) => {
              let bound = selectedPlacements.get(placement);
              if (bound === undefined) {
                const selection = { draws: selected, lift };
                bound = {
                  ...placement,
                  selection: capture === undefined ? selection : Object.freeze(selection),
                };
                selectedPlacements.set(placement, bound);
              }
              return bound;
            },
          );
        })
      : moverPlacementsWithWork(work, grid, request.mover, draws);
  if (placements.length === 0) {
    work?.beforePlacement();
  }
  // Reactive shapes retain their full compiled capability rather than narrowing to fit.
  const rank = Math.max(...placements.map((placement) => placement.rank ?? 0));
  const coupled = request.mover.motion.kind === "cross" || request.mover.motion.kind === "ride";
  const captured =
    capture !== undefined && coupled && (rank === 0 || placements.length === 0)
      ? {
          byDraw: new Map<MoverDraws, number>([[draws, 0]]),
          draws: [draws],
          members: [new Set<MoverPlacement>()],
          ranges: [{ contiguous: true, end: 0, first: -1 }],
          retained: 0,
        }
      : undefined;
  const widest = placements.filter((placement) => {
    const keep =
      (placement.rank ?? 0) === rank &&
      (!request.blocksLane ||
        moverLeavesMinimumLanes(geometry, request.mover!.footprint, placement));
    if (keep && captured !== undefined) {
      // Retention already visits each occurrence after the final template callback.
      const selected = placement.selection?.draws ?? draws;
      let tier = captured.byDraw.get(selected);
      if (tier === undefined) {
        tier = captured.draws.length;
        captured.byDraw.set(selected, tier);
        captured.draws.push(selected);
        captured.members.push(new Set());
        captured.ranges.push({ contiguous: true, end: 0, first: -1 });
      }
      captured.members[tier]!.add(placement);
      const range = captured.ranges[tier]!;
      if (range.first === -1) {
        range.first = captured.retained;
      } else {
        range.contiguous &&= range.end === captured.retained;
      }
      range.end = ++captured.retained;
    }
    return keep;
  });
  if (capture !== undefined && captured !== undefined) {
    const selected = captured.members.map(readonlyMembers);
    capture.index = {
      motion: { draws: Object.freeze(captured.draws), members: Object.freeze(selected) },
      ranges: new Map(
        selected.flatMap((members, ordinal) => {
          const range = captured.ranges[ordinal]!;
          return range.contiguous
            ? [[members, { end: range.end, first: Math.max(0, range.first) }] as const]
            : [];
        }),
      ),
    };
  }
  return {
    columns: [...new Set(widest.map((placement) => placement.lane))],
    compiledCount: Math.max(1, new Set(placements).size),
    draws,
    herring: false,
    placements: widest,
    request,
    source,
  };
}
