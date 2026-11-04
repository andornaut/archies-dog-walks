import { herringSpawn, isHerring } from "./dartOutcomes.ts";
import { deepFreeze } from "./deepFreeze.ts";
import { moverLeavesMinimumLanes } from "./laneAlternatives.ts";
import { DART_LIFTS, drawMover, moverRetries } from "./moverDraws.ts";
import {
  type MoverDraws,
  type MoverPlacement,
  type MoverPlacementWork,
  type PlannerStreams,
} from "./moverModel.ts";
import { moverPlacementsWithWork } from "./moverPlanning.ts";
import { crossLength } from "./movers.ts";
import { isDartPlacement, leavesPathOpen } from "./moverSpots.ts";
import { slotFootprint, type SlotSource } from "./slotConfig.ts";
import type { SlotPlacement } from "./slotFeasibility.ts";
import { LaneBlocks } from "./spawnCells.ts";
import {
  blockingLength,
  pathHeldLanes,
  type PlannedSpawns,
  quotaFootprint,
  rowSpacing,
  type SpawnPlan,
  type SpawnQuota,
} from "./spawning.ts";

type Geometry<Kind extends string> = Omit<SpawnPlan<Kind>, "quotas">;
export interface SlotKindDescriptor<Kind extends string> {
  readonly draws?: MoverDraws;
  readonly herring: boolean;
  readonly request: SpawnQuota<Kind>;
  readonly source: SlotSource<Kind>;
}
export interface PreparedSlotKind<Kind extends string> extends SlotKindDescriptor<Kind> {
  readonly compiledCount: number;
  readonly columns: readonly number[];
  readonly placements: readonly MoverPlacement[];
}
export interface SlotPreparationWork {
  template(): boolean;
}
export interface SlotPreparationOrdering {
  readonly envelopeWidth: number;
}
export type SlotPreparationOrderingHintResult =
  | { readonly hint: SlotPreparationOrdering; readonly status: "hint" }
  | { readonly status: "unknown" }
  | { readonly kind: "propagation"; readonly status: "budget" };
export type SlotPreparationResult<Kind extends string> =
  | { readonly prepared: PreparedSlotKind<Kind>; readonly status: "complete" }
  | { readonly status: "budget" };
interface MotionIndex {
  readonly draws: readonly MoverDraws[];
  readonly members: readonly ReadonlySet<MoverPlacement>[];
}
interface NativeMotionIndex {
  readonly motion: MotionIndex;
  readonly ranges: ReadonlyMap<
    ReadonlySet<MoverPlacement>,
    { readonly end: number; readonly first: number }
  >;
}
interface NativeMotionCapture {
  index?: NativeMotionIndex;
}
const readonlyMembers = (members: Set<MoverPlacement>): ReadonlySet<MoverPlacement> => {
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
// Native preparations are deeply frozen, borrowed source and profile included, so a registered
// preparation keeps the shape it was compiled with.
const nativePreparations = new WeakMap<
  PreparedSlotKind<string>,
  {
    readonly crossOnly: boolean;
    readonly hasStops: boolean;
    readonly maximumRows: number | undefined;
    readonly motion: NativeMotionIndex | undefined;
    readonly ordering: SlotPreparationOrdering;
  }
>();

function nativePreparation<Kind extends string>(
  motion: NativeMotionIndex | undefined,
  prepared: PreparedSlotKind<Kind>,
): PreparedSlotKind<Kind> {
  let hasStops = false;
  let envelopeWidth = prepared.placements.length === 0 ? prepared.source.footprint.lanes : Infinity;
  let crossOnly = prepared.request.mover !== undefined && prepared.placements.length > 0;
  let maximumRows =
    prepared.request.mover === undefined
      ? quotaFootprint(prepared.request).rows
      : prepared.placements.length > 0
        ? 0
        : undefined;
  for (const placement of prepared.placements) {
    envelopeWidth = Math.min(envelopeWidth, placement.lanes.count);
    crossOnly &&= isDartPlacement(placement);
    if (maximumRows !== undefined) {
      maximumRows =
        Number.isSafeInteger(placement.rows) && placement.rows > 0
          ? Math.max(maximumRows, placement.rows)
          : undefined;
    }
    hasStops ||= placement.stop !== undefined;
  }
  deepFreeze(prepared);
  if (maximumRows !== undefined && (!Number.isSafeInteger(maximumRows) || maximumRows < 1)) {
    maximumRows = undefined;
  }
  nativePreparations.set(prepared, {
    crossOnly,
    hasStops,
    maximumRows,
    motion,
    ordering: Object.freeze({ envelopeWidth }),
  });
  return prepared;
}

export function isNativeSlotCrossOnly(prepared: PreparedSlotKind<string>): boolean {
  return isNativeSlotPreparation(prepared) && nativePreparations.get(prepared)!.crossOnly;
}

export function isNativeSlotPreparation(prepared: PreparedSlotKind<string>): boolean {
  return nativePreparations.has(prepared);
}

// This preparation-time hint only orders choices; it never attests admission, row support or a
// complete domain traversal.
export function nativeSlotPreparationOrderingHint(
  work: { readonly propagate: () => boolean },
  prepared: PreparedSlotKind<string>,
): SlotPreparationOrderingHintResult {
  if (!work.propagate()) {
    return { kind: "propagation", status: "budget" };
  }
  const origin = nativePreparations.get(prepared);
  return origin === undefined ? { status: "unknown" } : { hint: origin.ordering, status: "hint" };
}

export function nativeSlotPreparationWallRows(
  prepared: PreparedSlotKind<string>,
): number | undefined {
  return isNativeSlotPreparation(prepared)
    ? nativePreparations.get(prepared)!.maximumRows
    : undefined;
}

export function prepareSlotKind<Kind extends string>(
  streams: PlannerStreams,
  geometry: Geometry<Kind>,
  source: SlotSource<Kind>,
): PreparedSlotKind<Kind> {
  return nativePreparation(
    undefined,
    compileSlotKindDomain(undefined, geometry, describeSlotKind(streams, source)),
  );
}

export function prepareSlotKindWithin<Kind extends string>(
  work: SlotPreparationWork,
  streams: PlannerStreams,
  geometry: Geometry<Kind>,
  source: SlotSource<Kind>,
): SlotPreparationResult<Kind> {
  const exhausted = {};
  try {
    const descriptor = describeSlotKind(streams, source);
    const compile = source.compile;
    const capture: NativeMotionCapture = {};
    const prepared = compileSlotDomain(
      {
        beforePlacement() {
          if (!work.template()) {
            throw exhausted;
          }
        },
      },
      geometry,
      capture,
      descriptor,
    );
    return {
      prepared: nativePreparation(compile === source.compile ? capture.index : undefined, prepared),
      status: "complete",
    };
  } catch (error) {
    if (error === exhausted) {
      return { status: "budget" };
    }
    throw error;
  }
}

export function describeSlotKind<Kind extends string>(
  streams: PlannerStreams,
  source: SlotSource<Kind>,
): SlotKindDescriptor<Kind> {
  const compiled = source.compile(streams);
  const hazard = source.role !== "auxiliaryFixed" && source.role !== "auxiliaryMoving";
  if (compiled.hazard !== undefined && compiled.hazard !== hazard) {
    throw new Error(`Slot hazard role mismatch: ${source.role}:${source.kind}`);
  }
  const request: SpawnQuota<Kind> = { ...compiled, count: 1, hazard, kind: source.kind };
  const footprint = slotFootprint(request);
  if (footprint.lanes !== source.footprint.lanes || footprint.rows !== source.footprint.rows) {
    throw new Error(`Slot footprint mismatch: ${source.role}:${source.kind}`);
  }
  const moving =
    source.role === "encounterMoving" ||
    source.role === "minorMoving" ||
    source.role === "auxiliaryMoving";
  if (moving !== (request.mover !== undefined)) {
    throw new Error(`Slot profile role mismatch: ${source.role}:${source.kind}`);
  }
  if (request.mover === undefined) {
    return { herring: false, request, source };
  }
  const draws = drawMover(streams);
  return { draws, herring: isHerring(request.mover, draws), request, source };
}

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

function compileSlotDomain<Kind extends string>(
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

export function slotPlacementsAt<Kind extends string>(
  geometry: Geometry<Kind>,
  anchor: {
    readonly distance: number;
    readonly lane: number;
    readonly row: number;
    readonly slot: number;
  },
  prepared: PreparedSlotKind<Kind>,
): SlotPlacement<Kind>[] {
  return translatedPlacementsAt(geometry, anchor, prepared);
}

function translatedPlacementsAt<Kind extends string>(
  geometry: Geometry<Kind>,
  anchor: Parameters<typeof slotPlacementsAt<Kind>>[1],
  prepared: PreparedSlotKind<Kind>,
  eligible?: ReadonlySet<MoverPlacement>,
  placements: readonly MoverPlacement[] = prepared.placements,
): SlotPlacement<Kind>[] {
  const { draws, request } = prepared;
  const { distance, lane, row, slot } = anchor;
  const spacing = rowSpacing({ ...geometry, quotas: [] });
  const identity = { index: 0, memberIndex: 0, quotaIndex: slot };
  if (!prepared.columns.includes(lane)) {
    return [];
  }
  if (request.mover === undefined) {
    const until =
      distance +
      geometry.roadLength +
      (request.hitLength ?? quotaFootprint(request).rows * geometry.cellLength);
    return [
      {
        event: { distance, kind: request.kind, lane },
        herring: false,
        request,
        trace: {
          ...identity,
          entry: distance,
          hazard: request.hazard ?? request.blocksLane,
          kind: request.kind,
          lane,
          nativeUntil: until,
          row: Math.floor(distance / spacing),
          source: "events",
          until,
        },
      },
    ];
  }
  if (draws === undefined) {
    throw new Error("A compiled moving slot needs frozen draws");
  }
  const grid = { ...geometry, rowSpacing: spacing, window: blockingLength(geometry, 1) };
  const clearance =
    Math.max(0, geometry.roadLength - geometry.sightLength) +
    geometry.packLength +
    (request.mover.hitLength ?? geometry.cellLength);
  if (prepared.herring) {
    const event = herringSpawn(grid, request.mover, draws, request.kind, [distance]);
    if (event?.mover.motion !== "cross" || event.lane !== lane) {
      return [];
    }
    const nativeUntil =
      event.distance +
      crossLength(geometry.laneCount, request.mover.footprint.lanes) / event.mover.lanesPerPixel;
    return [
      {
        event,
        herring: true,
        request,
        trace: {
          ...identity,
          entry: event.distance,
          hazard: request.hazard ?? request.blocksLane,
          kind: request.kind,
          lane,
          nativeUntil,
          requestedDraws: draws,
          row: Math.floor(event.distance / spacing),
          source: "herrings",
          until: nativeUntil + clearance,
        },
      },
    ];
  }
  const translated = new Map<MoverPlacement, SlotPlacement<Kind>[]>();
  return placements
    .filter(
      (placement) => placement.lane === lane && (eligible === undefined || eligible.has(placement)),
    )
    .flatMap((placement): SlotPlacement<Kind>[] => {
      const previous = translated.get(placement);
      if (previous !== undefined) {
        return previous;
      }
      const screen = [distance + placement.screen[0], distance + placement.screen[1]] as const;
      if (screen[0] < 0 || screen[1] > geometry.zoneLength) {
        translated.set(placement, []);
        return [];
      }
      const event = {
        distance: distance + placement.appears,
        kind: request.kind,
        lane,
        mover: placement.path,
      };
      const entries: SlotPlacement<Kind>[] = [
        {
          event,
          herring: false,
          placement,
          request,
          trace: {
            ...identity,
            entry: event.distance,
            hazard: request.hazard ?? request.blocksLane,
            kind: request.kind,
            lane,
            nativeUntil: screen[1],
            placement: {
              block: {
                dart: isDartPlacement(placement),
                lanes: placement.lanes,
                row,
                rows: placement.rows,
              },
              ...(placement.body === undefined
                ? {}
                : {
                    body: {
                      ...placement.body,
                      from: distance + placement.body.from,
                      to: distance + placement.body.to,
                    },
                  }),
              cells: placement.cells.map((cell) => ({ lane: cell.lane, row: row + cell.row })),
              screen,
              selection: placement.selection ?? { draws, lift: 0 },
              stands: placement.stands.map((stand) => ({
                ...stand,
                distance: distance + stand.distance,
              })),
            },
            requestedDraws: draws,
            row: Math.floor(event.distance / spacing),
            source: "events",
            until: screen[1] + clearance,
          },
        },
      ];
      translated.set(placement, entries);
      return entries;
    });
}

interface PathProjectionGroup {
  readonly members: MoverPlacement[];
  readonly footprints: Map<string, MoverPlacement[]>;
}
interface StopAdmittedGroups {
  readonly groups: readonly PathProjectionGroup[];
  readonly skippedTemplates: number;
}
interface PathProjectionCatalogue {
  readonly admitted: Map<number, Map<number, StopAdmittedGroups>>;
  indexed: number;
  readonly lanes: Map<number, Map<string, PathProjectionGroup>>;
}
type PathProjectionBudget = {
  readonly kind: "candidateChecks" | "propagation";
  readonly status: "budget";
};

const pathProjectionViewBrand: unique symbol = Symbol("slot-path-projection-view");
export interface SlotPathProjectionView<Kind extends string> {
  readonly [pathProjectionViewBrand]: PreparedSlotKind<Kind>;
}
export type SlotPathProjectionViewResult<Kind extends string> =
  | { readonly status: "empty-view" }
  | { readonly status: "view"; readonly view: SlotPathProjectionView<Kind> }
  | { readonly status: "unknown" }
  | { readonly kind: "propagation"; readonly status: "budget" };
type PathProjectionWork = {
  readonly check: () => boolean;
  readonly propagate?: (() => boolean) | undefined;
};
type PathProjectionResult<Kind extends string> =
  | { readonly status: "entries"; readonly entries: readonly SlotPlacement<Kind>[] }
  | PathProjectionBudget;

// Only producer-attested immutable catalogues may skip translation by shared native proofs.
export function createSlotPathProjection<Kind extends string>(
  geometry: Geometry<Kind>,
  path: PlannedSpawns<Kind>["path"],
) {
  deepFreeze(geometry);
  deepFreeze(path);
  const held = pathHeldLanes(path.map((row) => row.lane));
  const plan = { ...geometry, quotas: [] };
  const lanes = new LaneBlocks(plan, rowSpacing(plan), held);
  const catalogues = new WeakMap<PreparedSlotKind<Kind>, PathProjectionCatalogue>();
  // Path and stop proofs depend only on their keys and the fixed path, so every view shares them.
  const proofs = new Map<string, boolean>();
  type PropagationBudget = PathProjectionBudget & { readonly kind: "propagation" };
  interface PreparationIndex {
    readonly aliases: ReadonlyMap<MoverPlacement, readonly number[]>;
    readonly motion: MotionIndex | undefined;
  }
  const indices = new WeakMap<PreparedSlotKind<Kind>, PreparationIndex>();
  const nativeRanges = new WeakMap<
    ReadonlySet<MoverPlacement>,
    {
      readonly end: number;
      readonly first: number;
      readonly index: PreparationIndex;
      readonly prepared: PreparedSlotKind<Kind>;
    }
  >();
  const views = new WeakMap<
    SlotPathProjectionView<Kind>,
    {
      readonly prepared: PreparedSlotKind<Kind>;
      readonly placements: readonly MoverPlacement[];
      catalogue?: PathProjectionCatalogue;
    }
  >();
  const stats = {
    catalogues: 0,
    footprintGroups: 0,
    groupLookups: 0,
    groups: 0,
    indexedTemplates: 0,
    membershipBuilds: 0,
    membershipVisits: 0,
    nativeChecks: 0,
    pathEvaluations: 0,
    pathReuse: 0,
    pathSkippedTemplates: 0,
    skippedTemplates: 0,
    stopCatalogueLookups: 0,
    stopCatalogueReuse: 0,
    stopEvaluations: 0,
    stopReuse: 0,
  };
  const current = (prepared: PreparedSlotKind<Kind>) => {
    // Native registration checks stay visible separately from indexed placement work.
    stats.nativeChecks++;
    if (!isNativeSlotPreparation(prepared)) {
      indices.delete(prepared);
      return false;
    }
    return true;
  };
  const publishView = (
    prepared: PreparedSlotKind<Kind>,
    placements: MoverPlacement[],
  ): SlotPathProjectionViewResult<Kind> => {
    if (!current(prepared)) {
      return { status: "unknown" };
    }
    const view = Object.freeze({ [pathProjectionViewBrand]: prepared });
    views.set(view, { placements: Object.freeze(placements), prepared });
    return { status: "view", view };
  };
  const index = (
    work: { readonly propagate: () => boolean },
    prepared: PreparedSlotKind<Kind>,
  ): PreparationIndex | PropagationBudget | { readonly status: "unknown" } => {
    const cached = indices.get(prepared);
    if (cached !== undefined) {
      return cached;
    }
    const aliases = new Map<MoverPlacement, number[]>();
    const kind = prepared.request.mover?.motion.kind;
    const draws = prepared.draws === undefined ? [] : [prepared.draws];
    const members: Set<MoverPlacement>[] = draws.map(() => new Set());
    const ranges = draws.map(() => ({ contiguous: true, end: 0, first: -1 }));
    const byDraw = new Map<MoverDraws, number>(draws.map((draw, ordinal) => [draw, ordinal]));
    let motion = !prepared.herring && draws.length > 0 && (kind === "cross" || kind === "ride");
    for (let ordinal = 0; ordinal < prepared.placements.length; ordinal++) {
      if (!work.propagate()) {
        return { kind: "propagation", status: "budget" };
      }
      stats.membershipVisits++;
      const placement = prepared.placements[ordinal]!;
      let occurrences = aliases.get(placement);
      if (occurrences === undefined) {
        occurrences = [];
        aliases.set(placement, occurrences);
      }
      occurrences.push(ordinal);
      motion &&= (placement.rank ?? 0) === 0;
      if (motion) {
        const selected = placement.selection?.draws ?? prepared.draws!;
        let tier = byDraw.get(selected);
        if (tier === undefined) {
          tier = draws.length;
          byDraw.set(selected, tier);
          draws.push(selected);
          members.push(new Set());
          ranges.push({ contiguous: true, end: 0, first: -1 });
        }
        members[tier]!.add(placement);
        const range = ranges[tier]!;
        if (range.first === -1) {
          range.first = ordinal;
        } else {
          range.contiguous &&= range.end === ordinal;
        }
        range.end = ordinal + 1;
      }
    }
    if (!current(prepared)) {
      return { status: "unknown" };
    }
    // Publish grouping and all alias ordinals together only after complete billed work.
    const built: PreparationIndex = {
      aliases,
      motion: motion
        ? { draws: Object.freeze(draws), members: Object.freeze(members.map(readonlyMembers)) }
        : undefined,
    };
    built.motion?.members.forEach((selected, ordinal) => {
      const range = ranges[ordinal]!;
      if (range.contiguous) {
        nativeRanges.set(selected, {
          end: range.end,
          first: Math.max(0, range.first),
          index: built,
          prepared,
        });
      }
    });
    indices.set(prepared, built);
    stats.membershipBuilds++;
    return built;
  };
  function at(
    work: PathProjectionWork,
    anchor: Parameters<typeof slotPlacementsAt<Kind>>[1],
    prepared: PreparedSlotKind<Kind>,
  ): PathProjectionResult<Kind>;
  function at(
    work: PathProjectionWork,
    anchor: Parameters<typeof slotPlacementsAt<Kind>>[1],
    prepared: PreparedSlotKind<Kind>,
    view: SlotPathProjectionView<Kind> | undefined,
  ): PathProjectionResult<Kind> | { readonly status: "unavailable" };
  function at(
    work: PathProjectionWork,
    anchor: Parameters<typeof slotPlacementsAt<Kind>>[1],
    prepared: PreparedSlotKind<Kind>,
    view?: SlotPathProjectionView<Kind>,
  ): PathProjectionResult<Kind> | { readonly status: "unavailable" } {
    const selected = view === undefined ? undefined : views.get(view);
    if (view !== undefined) {
      if (selected === undefined || selected.prepared !== prepared) {
        return { status: "unavailable" };
      }
      // This native source/scope guard is separate from view-only catalogue indexing.
      if (!work.check()) {
        return { kind: "candidateChecks", status: "budget" };
      }
      if (!current(prepared)) {
        views.delete(view);
        return { status: "unavailable" };
      }
    }
    const placements = selected?.placements ?? prepared.placements;
    const attested = nativePreparations.get(prepared);
    if (
      attested === undefined ||
      prepared.herring ||
      prepared.request.mover === undefined ||
      (!attested.hasStops && !prepared.request.blocksLane)
    ) {
      return {
        entries:
          selected === undefined
            ? slotPlacementsAt(geometry, anchor, prepared)
            : translatedPlacementsAt(geometry, anchor, prepared, undefined, placements),
        status: "entries",
      };
    }
    let catalogue = selected === undefined ? catalogues.get(prepared) : selected.catalogue;
    if (catalogue === undefined) {
      catalogue = { admitted: new Map(), indexed: 0, lanes: new Map() };
      if (selected === undefined) {
        catalogues.set(prepared, catalogue);
      } else {
        selected.catalogue = catalogue;
      }
      stats.catalogues++;
    }
    while (catalogue.indexed < placements.length) {
      if (work.propagate !== undefined && !work.propagate()) {
        return { kind: "propagation", status: "budget" };
      }
      const placement = placements[catalogue.indexed]!;
      let groups = catalogue.lanes.get(placement.lane);
      if (groups === undefined) {
        groups = new Map();
        catalogue.lanes.set(placement.lane, groups);
      }
      const stop = placement.stop;
      const key = stop === undefined ? "none" : `${stop.first}:${stop.count}`;
      let group = groups.get(key);
      if (group === undefined) {
        group = { footprints: new Map(), members: [] };
        groups.set(key, group);
        stats.groups++;
      }
      group.members.push(placement);
      if (prepared.request.blocksLane) {
        const footprint = `${placement.lanes.first}:${placement.lanes.count}:${placement.rows}`;
        let members = group.footprints.get(footprint);
        if (members === undefined) {
          members = [];
          group.footprints.set(footprint, members);
          stats.footprintGroups++;
        }
        members.push(placement);
      }
      catalogue.indexed++;
      stats.indexedTemplates++;
    }
    const eligible = new Set<MoverPlacement>();
    const addFootprints = (group: PathProjectionGroup): PathProjectionBudget | undefined => {
      for (const [footprint, members] of group.footprints) {
        if (work.propagate !== undefined && !work.propagate()) {
          return { kind: "propagation", status: "budget" };
        }
        const pathKey = `path:${anchor.row}:${footprint}`;
        let pathAccepted = proofs.get(pathKey);
        if (pathAccepted === undefined) {
          if (!work.check()) {
            return { kind: "candidateChecks", status: "budget" };
          }
          const placement = members[0]!;
          pathAccepted = lanes.pathFits(
            { lane: placement.lanes.first, row: anchor.row },
            { lanes: placement.lanes.count, rows: placement.rows },
          );
          proofs.set(pathKey, pathAccepted);
          stats.pathEvaluations++;
        } else {
          stats.pathReuse++;
        }
        if (pathAccepted) {
          for (const member of members) {
            eligible.add(member);
          }
        } else {
          stats.pathSkippedTemplates += members.length;
          stats.skippedTemplates += members.length;
        }
      }
      return undefined;
    };
    if (!attested.hasStops) {
      // Frozen native placements cannot acquire stops after preparation.
      const group = catalogue.lanes.get(anchor.lane)?.get("none");
      const budget = group === undefined ? undefined : addFootprints(group);
      if (budget !== undefined) {
        return budget;
      }
    } else {
      // Stop admission depends only on the held mask, not the absolute translation row.
      if (work.propagate !== undefined && !work.propagate()) {
        return { kind: "propagation", status: "budget" };
      }
      stats.stopCatalogueLookups++;
      const mask = held[anchor.row] ?? 0;
      let byMask = catalogue.admitted.get(anchor.lane);
      if (byMask === undefined) {
        byMask = new Map();
        catalogue.admitted.set(anchor.lane, byMask);
      }
      let admitted = byMask.get(mask);
      if (admitted === undefined) {
        const groups: PathProjectionGroup[] = [];
        let skippedTemplates = 0;
        for (const [stop, group] of catalogue.lanes.get(anchor.lane) ?? []) {
          if (work.propagate !== undefined && !work.propagate()) {
            return { kind: "propagation", status: "budget" };
          }
          stats.groupLookups++;
          const key = `stop:${mask}:${stop}`;
          let accepted = proofs.get(key);
          if (accepted === undefined) {
            if (!work.check()) {
              return { kind: "candidateChecks", status: "budget" };
            }
            accepted = leavesPathOpen(mask, group.members[0]!);
            proofs.set(key, accepted);
            stats.stopEvaluations++;
          } else {
            stats.stopReuse++;
          }
          if (accepted) {
            groups.push(group);
          } else {
            skippedTemplates += group.members.length;
          }
        }
        // An interrupted traversal must not publish an incomplete admission catalogue.
        admitted = { groups, skippedTemplates };
        byMask.set(mask, admitted);
      } else {
        stats.stopCatalogueReuse++;
      }
      stats.skippedTemplates += admitted.skippedTemplates;
      for (const group of admitted.groups) {
        if (work.propagate !== undefined && !work.propagate()) {
          return { kind: "propagation", status: "budget" };
        }
        if (!prepared.request.blocksLane) {
          for (const member of group.members) {
            eligible.add(member);
          }
          continue;
        }
        const budget = addFootprints(group);
        if (budget !== undefined) {
          return budget;
        }
      }
    }
    return {
      entries:
        eligible.size === 0
          ? []
          : translatedPlacementsAt(geometry, anchor, prepared, eligible, placements),
      status: "entries",
    };
  }
  return {
    at,
    // The view and native source guard of `at`, for an anchor whose entries are already projected.
    guard(
      work: PathProjectionWork,
      prepared: PreparedSlotKind<Kind>,
      view: SlotPathProjectionView<Kind>,
    ): { readonly status: "current" } | PathProjectionBudget | { readonly status: "unavailable" } {
      const selected = views.get(view);
      if (selected === undefined || selected.prepared !== prepared) {
        return { status: "unavailable" };
      }
      if (!work.check()) {
        return { kind: "candidateChecks", status: "budget" };
      }
      if (!current(prepared)) {
        views.delete(view);
        return { status: "unavailable" };
      }
      return { status: "current" };
    },
    motionTiers(
      work: { readonly propagate: () => boolean },
      prepared: PreparedSlotKind<Kind>,
    ):
      | ({ readonly status: "tiers" } & MotionIndex)
      | PropagationBudget
      | { readonly status: "unknown" } {
      const kind = prepared.request.mover?.motion.kind;
      if (
        prepared.herring ||
        prepared.draws === undefined ||
        (kind !== "cross" && kind !== "ride") ||
        !current(prepared)
      ) {
        return { status: "unknown" };
      }
      const producer = nativePreparations.get(prepared)!.motion;
      if (producer !== undefined) {
        return { ...producer.motion, status: "tiers" };
      }
      const saved = index(work, prepared);
      return "status" in saved
        ? saved
        : saved.motion === undefined
          ? { status: "unknown" }
          : { ...saved.motion, status: "tiers" };
    },
    statistics() {
      return { ...stats };
    },
    // A view is an ordering subset, never preparation or complete-domain attestation.
    view(
      work: { readonly propagate: () => boolean },
      prepared: PreparedSlotKind<Kind>,
      selectedRefs: ReadonlySet<MoverPlacement>,
    ): SlotPathProjectionViewResult<Kind> {
      if (
        !nativePreparations.has(prepared) ||
        prepared.herring ||
        prepared.request.mover === undefined
      ) {
        return { status: "unknown" };
      }
      // One issuance charge remains separate from the shared placement traversal.
      if (!work.propagate()) {
        return { kind: "propagation", status: "budget" };
      }
      // Native draw groups retain their original occurrence order, including aliases.
      const indexedRange = nativeRanges.get(selectedRefs);
      const range =
        nativePreparations.get(prepared)!.motion?.ranges.get(selectedRefs) ??
        (indexedRange?.prepared === prepared && indexedRange.index === indices.get(prepared)
          ? indexedRange
          : undefined);
      if (range !== undefined) {
        if (range.first === range.end) {
          return current(prepared) ? { status: "empty-view" } : { status: "unknown" };
        }
        const placements: MoverPlacement[] = [];
        for (let ordinal = range.first; ordinal < range.end; ordinal++) {
          if (!work.propagate()) {
            return { kind: "propagation", status: "budget" };
          }
          placements.push(prepared.placements[ordinal]!);
        }
        return publishView(prepared, placements);
      }
      if (!current(prepared)) {
        return { status: "unknown" };
      }
      const requested = selectedRefs[Symbol.iterator]();
      let next = requested.next();
      // This is an empty ordering subset, never a complete native owner-domain proof.
      if (next.done) {
        return current(prepared) ? { status: "empty-view" } : { status: "unknown" };
      }
      try {
        if (!work.propagate()) {
          return { kind: "propagation", status: "budget" };
        }
        const indexed = index(work, prepared);
        if ("status" in indexed) {
          return indexed;
        }
        const selected = new Set<MoverPlacement>();
        const occurrences: { readonly ordinal: number; readonly placement: MoverPlacement }[] = [];
        while (!next.done) {
          const placement = next.value;
          const aliases = indexed.aliases.get(placement);
          if (aliases === undefined) {
            return { status: "unknown" };
          }
          if (!selected.has(placement)) {
            selected.add(placement);
            for (const ordinal of aliases) {
              if (!work.propagate()) {
                return { kind: "propagation", status: "budget" };
              }
              occurrences.push({ ordinal, placement });
            }
          }
          next = requested.next();
          if (!next.done && !work.propagate()) {
            return { kind: "propagation", status: "budget" };
          }
        }
        const exhausted = {};
        try {
          occurrences.sort((left, right) => {
            if (!work.propagate()) {
              throw exhausted;
            }
            return left.ordinal - right.ordinal;
          });
        } catch (error) {
          if (error === exhausted) {
            return { kind: "propagation", status: "budget" };
          }
          throw error;
        }
        const placements = occurrences.map(({ placement }) => placement);
        return publishView(prepared, placements);
      } finally {
        if (!next.done) {
          requested.return?.();
        }
      }
    },
  };
}
