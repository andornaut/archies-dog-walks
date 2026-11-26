import { deepFreeze } from "./deepFreeze.ts";
import type { MoverDraws, MoverPlacement } from "./moverModel.ts";
import { leavesPathOpen } from "./moverSpots.ts";
import { type MotionIndex, readonlyMembers } from "./slotDomainCompile.ts";
import type { SlotPlacement } from "./slotFeasibility.ts";
import {
  type Geometry,
  isNativeSlotPreparation,
  nativeSlotPreparationOf,
  type PreparedSlotKind,
} from "./slotKindPreparation.ts";
import { slotPlacementsAt, translatedPlacementsAt } from "./slotPlacementsAt.ts";
import { LaneBlocks } from "./spawnCells.ts";
import { pathHeldLanes, type PlannedSpawns, rowSpacing } from "./spawning.ts";

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
    const attested = nativeSlotPreparationOf(prepared);
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
      const producer = nativeSlotPreparationOf(prepared)!.motion;
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
        !isNativeSlotPreparation(prepared) ||
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
        nativeSlotPreparationOf(prepared)!.motion?.ranges.get(selectedRefs) ??
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
