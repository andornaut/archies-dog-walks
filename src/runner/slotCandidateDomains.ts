import type { MoverDraws, MoverPlacement } from "./moverPlanning";
import {
  createSlotPathProjection,
  isNativeSlotCrossOnly,
  isNativeSlotPreparation,
  nativeSlotPreparationWallRows,
  type PreparedSlotKind,
  type SlotPathProjectionView,
  slotPlacementsAt,
} from "./slotCandidates";
import {
  type ConstraintOwner,
  createSlotIntrinsicProbe,
  createSlotPocketScope,
  projectSlotWalls,
  type SlotPocketOwner,
  type SlotPocketScope,
  slotPocketScopeMatches,
  slotPocketScopeOwner,
} from "./slotConstraintState";
import type { SlotPlacement } from "./slotFeasibility";
import { blockingSpan, type PlannedSpawns, rowSpacing, type SpawnPlan, zoneRows } from "./spawning";

export interface SlotCandidate<Kind extends string> {
  // Unbound native template. The transactional state owns temporary trace identity.
  readonly entry: SlotPlacement<Kind>;
  // Stable within this compiled problem, including distinct frozen preparations.
  readonly id: string;
  // Total occurrences of this reference in at(); callers retain the repeated array.
  readonly multiplicity: number;
  readonly prepared: PreparedSlotKind<Kind>;
}
export type IntrinsicResult = Readonly<ReturnType<ReturnType<typeof createSlotIntrinsicProbe>>>;
export type SlotSequenceStep<Kind extends string> =
  | { readonly status: "candidate"; readonly candidate: SlotCandidate<Kind> }
  | { readonly status: "budget"; readonly kind: "anchors" | "candidateChecks" | "propagation" };
export type SlotFrontierSequenceStep<Kind extends string> =
  SlotSequenceStep<Kind> | { readonly status: "empty-tier" } | { readonly status: "unavailable" };
export type SlotMotionTiers =
  | {
      readonly status: "tiers";
      readonly tiers: readonly number[];
      readonly draws: readonly MoverDraws[];
    }
  | { readonly status: "unknown" }
  | { readonly status: "budget" };
export interface SlotCandidateOrder {
  readonly rows: readonly number[];
  readonly columns: readonly number[];
  readonly columnStart: number;
  readonly motionTier?: number;
}
interface PocketWork {
  readonly anchor: () => boolean;
  readonly check: () => boolean;
  readonly propagate: () => boolean;
  readonly stopped: () => boolean;
}
const ownerDomainBrand: unique symbol = Symbol("complete-native-owner-domain");
export interface SlotOwnerDomainToken {
  readonly [ownerDomainBrand]: true;
}
export type SlotOwnerDomainStep<Kind extends string> =
  | { readonly status: "candidate"; readonly value: SlotCandidate<Kind> }
  | { readonly status: "complete"; readonly token: SlotOwnerDomainToken }
  | { readonly status: "unknown" }
  | { readonly status: "budget" };
const ownerWallsBrand: unique symbol = Symbol("complete-native-owner-walls");
export interface SlotOwnerWallsToken {
  readonly [ownerWallsBrand]: true;
}
export type SlotOwnerWallsStep<Kind extends string> =
  | {
      readonly guaranteedWalls: number;
      readonly status: "candidate";
      readonly value: SlotCandidate<Kind>;
    }
  | { readonly status: "complete"; readonly token: SlotOwnerWallsToken }
  | { readonly status: "progress" }
  | { readonly status: "unknown" }
  | { readonly status: "budget" };
interface OwnerFrontier<Kind extends string> {
  readonly scope: SlotPocketScope;
  readonly owner: ConstraintOwner;
  readonly profiles: readonly PreparedSlotKind<Kind>[];
  readonly values: readonly SlotCandidate<Kind>[];
}
type OwnerFrontierStep<Kind extends string> =
  | {
      readonly guaranteedWalls: number | undefined;
      readonly status: "candidate";
      readonly value: SlotCandidate<Kind>;
    }
  | { readonly frontier: OwnerFrontier<Kind>; readonly status: "complete" }
  | { readonly status: "progress" }
  | { readonly status: "unknown" }
  | { readonly status: "budget" };

const sequenceKey = (order: SlotCandidateOrder, jobKey: string) =>
  JSON.stringify([
    jobKey,
    order.rows,
    order.columns,
    order.columnStart,
    ...(order.motionTier === undefined ? [] : [order.motionTier]),
  ]);
interface CandidateSequence<Kind extends string> {
  readonly distinct: Set<string>;
  readonly candidates: SlotCandidate<Kind>[];
  anchor: number;
  expanding: boolean;
  pending: readonly SlotCandidate<Kind>[] | undefined;
  occurrence: number;
  complete: boolean;
  readonly views: Map<string, { indices: number[]; scanned: number }>;
}
interface NativeDomain<Kind extends string> {
  readonly anchors: Map<string, readonly SlotCandidate<Kind>[]>;
  readonly identity: number;
  readonly projected: Map<string, readonly SlotCandidate<Kind>[]>;
  readonly wrappers: Map<string, SlotCandidate<Kind>>;
  readonly variants: ReadonlyMap<MoverPlacement, number>;
}

// Freeze owned wrappers and proof arrays without changing borrowed prepared geometry.
function immutableEntry<Kind extends string>(entry: SlotPlacement<Kind>): SlotPlacement<Kind> {
  const proof = entry.trace.placement;
  if (proof !== undefined) {
    Object.freeze(proof.block);
    Object.freeze(proof.body);
    proof.cells.forEach(Object.freeze);
    Object.freeze(proof.cells);
    Object.freeze(proof.screen);
    proof.stands.forEach(Object.freeze);
    Object.freeze(proof.stands);
    Object.freeze(proof);
  }
  Object.freeze(entry.event);
  Object.freeze(entry.trace);
  return Object.freeze(entry);
}

// Only immutable native prerequisites belong here. Prefix occupancy, lane unions,
// open stretches, reservations, visibility and caps remain transactional checks.
// Runtime search, which records conflicts instead of looking up negative visibility, passes
// negativeVisibility false so intrinsic checks skip their visibility attestations.
export function createSlotCandidateDomains<Kind extends string>(
  geometry: Omit<SpawnPlan<Kind>, "quotas">,
  path: PlannedSpawns<Kind>["path"],
  options: { readonly negativeVisibility?: boolean } = {},
) {
  const nativeGeometry = { ...geometry, moverCaps: { ...geometry.moverCaps } };
  const plan = { ...nativeGeometry, quotas: [] };
  const spacing = rowSpacing(plan);
  const rows = zoneRows(plan, spacing);
  const probeIntrinsic = createSlotIntrinsicProbe(
    nativeGeometry,
    path,
    options.negativeVisibility !== false,
  );
  const projection = createSlotPathProjection(nativeGeometry, path);
  const jobs = new Map<
    string,
    {
      nextIdentity: number;
      readonly preparations: WeakMap<PreparedSlotKind<Kind>, NativeDomain<Kind>>;
    }
  >();
  const owned = new WeakSet<SlotCandidate<Kind>>();
  const proofs = new WeakMap<SlotCandidate<Kind>, IntrinsicResult>();
  const sequences = new WeakMap<PreparedSlotKind<Kind>, Map<string, CandidateSequence<Kind>>>();
  const motionTiers = new WeakMap<
    PreparedSlotKind<Kind>,
    {
      readonly draws: readonly MoverDraws[];
      readonly members: readonly ReadonlySet<MoverPlacement>[];
      readonly views: Map<number, SlotPathProjectionView<Kind>>;
    }
  >();
  const stats = {
    expansions: 0,
    filterScans: 0,
    filterViews: 0,
    filtered: 0,
    replays: 0,
    traversals: 0,
    unaryChecks: 0,
  };
  const validateAnchor = (row: number, lane: number) => {
    if (
      !Number.isSafeInteger(row) ||
      row < 0 ||
      row >= rows.length ||
      !Number.isSafeInteger(lane) ||
      lane < 0 ||
      lane >= nativeGeometry.laneCount
    ) {
      throw new RangeError("Invalid native slot anchor");
    }
  };
  const nativeDomain = (jobKey: string, prepared: PreparedSlotKind<Kind>): NativeDomain<Kind> => {
    let sources = jobs.get(jobKey);
    if (sources === undefined) {
      sources = { nextIdentity: 0, preparations: new WeakMap() };
      jobs.set(jobKey, sources);
    }
    let domain = sources.preparations.get(prepared);
    if (domain === undefined) {
      const variants = new Map<MoverPlacement, number>();
      prepared.placements.forEach((placement, index) => {
        if (!variants.has(placement)) {
          variants.set(placement, index);
        }
      });
      domain = {
        anchors: new Map(),
        identity: sources.nextIdentity++,
        projected: new Map(),
        variants,
        wrappers: new Map(),
      };
      sources.preparations.set(prepared, domain);
    }
    return domain;
  };
  const wrap = (
    native: NativeDomain<Kind>,
    jobKey: string,
    prepared: PreparedSlotKind<Kind>,
    row: number,
    lane: number,
    entries: readonly SlotPlacement<Kind>[],
  ): readonly SlotCandidate<Kind>[] => {
    const occurrences = new Map<SlotPlacement<Kind>, number>();
    for (const entry of entries) {
      occurrences.set(entry, (occurrences.get(entry) ?? 0) + 1);
    }
    const candidates = new Map<SlotPlacement<Kind>, SlotCandidate<Kind>>();
    const result = Object.freeze(
      entries.map((entry) => {
        const variant = entry.placement === undefined ? 0 : native.variants.get(entry.placement);
        if (variant === undefined) {
          throw new Error("Unrecognised native slot template");
        }
        const id = JSON.stringify([
          jobKey,
          prepared.source.kind,
          native.identity,
          variant,
          row,
          lane,
        ]);
        let candidate = candidates.get(entry) ?? native.wrappers.get(id);
        if (candidate === undefined) {
          candidate = Object.freeze({
            entry: immutableEntry(entry),
            id,
            multiplicity: occurrences.get(entry)!,
            prepared,
          });
          native.wrappers.set(id, candidate);
          candidates.set(entry, candidate);
          owned.add(candidate);
        }
        return candidate;
      }),
    );
    return result;
  };
  const pocketScopes = new WeakSet<SlotPocketScope>();
  const pocketValues = new WeakMap<
    SlotPocketScope,
    Map<SlotCandidate<Kind>, { owner: ConstraintOwner; shape: string }>
  >();
  const completedOwners = new WeakMap<SlotOwnerDomainToken, OwnerFrontier<Kind>>();
  const completedWalls = new WeakMap<
    SlotOwnerWallsToken,
    OwnerFrontier<Kind> & { readonly row: number }
  >();
  const wallMasks = new WeakMap<
    SlotCandidate<Kind>,
    Map<number, { mask: number; shape: string }>
  >();
  const signature = (candidate: SlotCandidate<Kind>) =>
    JSON.stringify(candidate.entry, (_key, value: unknown) =>
      typeof value === "number" && !Number.isFinite(value) ? { numeric: String(value) } : value,
    );
  const pocketContext = createSlotPocketScope(geometry, path, []);
  const validPocketScope = (scope: SlotPocketScope) =>
    pocketScopes.has(scope) &&
    slotPocketScopeMatches(pocketContext, geometry, path) &&
    slotPocketScopeMatches(scope, geometry, path);
  const profilesMatch = (
    work: PocketWork,
    scope: SlotPocketScope,
    owner: ConstraintOwner,
    profiles: readonly PreparedSlotKind<Kind>[],
  ): boolean | undefined => {
    if (work.stopped()) {
      return undefined;
    }
    const registered = slotPocketScopeOwner(scope, owner);
    if (registered === undefined || registered.phase !== "active") {
      return false;
    }
    const preparations = registered.preparations();
    if (work.stopped()) {
      return undefined;
    }
    let index = 0;
    let matched = true;
    for (const prepared of preparations) {
      if (work.stopped() || !work.propagate() || work.stopped()) {
        return undefined;
      }
      if (prepared !== profiles[index++] || !isNativeSlotPreparation(prepared)) {
        matched = false;
        break;
      }
      if (work.stopped()) {
        return undefined;
      }
    }
    return work.stopped()
      ? undefined
      : matched && index === profiles.length && validPocketScope(scope);
  };
  const attestsFrontier = (
    work: PocketWork,
    scope: SlotPocketScope,
    row: number | undefined,
    owner: ConstraintOwner,
    saved: OwnerFrontier<Kind> | undefined,
    values: readonly { readonly value: SlotCandidate<Kind>; readonly guaranteedWalls?: number }[],
  ): boolean | undefined => {
    if (work.stopped() || !work.propagate() || work.stopped()) {
      return undefined;
    }
    if (
      (row !== undefined && (!Number.isSafeInteger(row) || row < 0 || row >= rows.length)) ||
      !validPocketScope(scope) ||
      saved?.scope !== scope ||
      saved.owner !== owner ||
      saved.values.length !== values.length
    ) {
      return false;
    }
    const profiles = profilesMatch(work, scope, owner, saved.profiles);
    if (profiles !== true) {
      return profiles;
    }
    for (let index = 0; index < values.length; index++) {
      if (work.stopped() || !work.propagate() || work.stopped()) {
        return undefined;
      }
      const item = values[index];
      const candidate = saved.values[index]!;
      const binding = pocketValues.get(scope)?.get(candidate);
      const projection = row === undefined ? undefined : wallMasks.get(candidate)?.get(row);
      if (
        item?.value !== candidate ||
        binding?.owner !== owner ||
        binding.shape !== signature(candidate) ||
        (row !== undefined &&
          (projection === undefined ||
            projection.shape !== binding.shape ||
            item.guaranteedWalls !== projection.mask))
      ) {
        return false;
      }
    }
    return work.stopped() ? undefined : validPocketScope(scope);
  };
  function* ownerFrontier(
    work: PocketWork,
    scope: SlotPocketScope,
    row: number | undefined,
    owner: ConstraintOwner,
  ): Generator<OwnerFrontierStep<Kind>> {
    if (work.stopped()) {
      yield { status: "budget" };
      return;
    }
    if (
      !validPocketScope(scope) ||
      (row !== undefined && (!Number.isSafeInteger(row) || row < 0 || row >= rows.length))
    ) {
      yield { status: "unknown" };
      return;
    }
    const registered = slotPocketScopeOwner(scope, owner);
    if (registered === undefined || registered.phase !== "active") {
      yield { status: "unknown" };
      return;
    }
    const activeWork = {
      anchor: () => !work.stopped() && work.anchor() && !work.stopped(),
      check: () => !work.stopped() && work.check() && !work.stopped(),
      propagate: () => !work.stopped() && work.propagate() && !work.stopped(),
      stopped: work.stopped,
    };
    const frontier: SlotCandidate<Kind>[] = [];
    const distinct = new Set<SlotCandidate<Kind>>();
    const profiles: PreparedSlotKind<Kind>[] = [];
    const preparations = registered.preparations();
    if (work.stopped()) {
      yield { status: "budget" };
      return;
    }
    for (const raw of preparations) {
      if (!activeWork.propagate()) {
        yield { status: "budget" };
        return;
      }
      if (!isNativeSlotPreparation(raw)) {
        yield { status: "unknown" };
        return;
      }
      if (work.stopped()) {
        yield { status: "budget" };
        return;
      }
      const prepared = raw as PreparedSlotKind<Kind>;
      profiles.push(prepared);
      let anchorRows: number[] | undefined;
      if (row !== undefined) {
        // Preserve preparation identities even when every native value has zero walls.
        if (rows.length > 0 && prepared.columns.length > 0) {
          nativeDomain(owner.key, prepared);
        }
        if (!prepared.request.blocksLane || isNativeSlotCrossOnly(prepared)) {
          yield { status: "progress" };
          if (work.stopped()) {
            yield { status: "budget" };
            return;
          }
          continue;
        }
        const maximumRows = nativeSlotPreparationWallRows(prepared);
        if (maximumRows !== undefined && nativeGeometry.cellLength > 0 && spacing > 0) {
          const last = blockingSpan(plan, spacing, 0, maximumRows).lastRow;
          if (Number.isSafeInteger(last) && last >= 0) {
            const first = Math.max(0, row - last);
            anchorRows = Array.from(
              { length: row - first + 1 },
              (_value, offset) => first + offset,
            );
            if (anchorRows.length < rows.length) {
              yield { status: "progress" };
              if (work.stopped()) {
                yield { status: "budget" };
                return;
              }
            }
          }
        }
      }
      for (const step of domain.sequence(
        activeWork,
        {
          columnStart: 0,
          columns: prepared.columns,
          rows: anchorRows ?? rows.map((_distance, row) => row),
        },
        owner.key,
        prepared,
      )) {
        if (work.stopped() || step.status === "budget" || !activeWork.propagate()) {
          yield { status: "budget" };
          return;
        }
        const candidate = step.candidate;
        if (distinct.has(candidate)) {
          continue;
        }
        distinct.add(candidate);
        pocketValues.get(scope)!.set(candidate, { owner, shape: signature(candidate) });
        let guaranteedWalls: number | undefined;
        if (row !== undefined) {
          const projection = domain.guaranteedWalls(activeWork, scope, row, owner, candidate);
          if (projection.status !== "walls") {
            yield { status: projection.status };
            return;
          }
          guaranteedWalls = projection.mask;
          if (guaranteedWalls === 0) {
            yield { status: "progress" };
            if (work.stopped()) {
              yield { status: "budget" };
              return;
            }
            continue;
          }
        }
        frontier.push(candidate);
        yield { guaranteedWalls, status: "candidate", value: candidate };
      }
      if (work.stopped()) {
        yield { status: "budget" };
        return;
      }
    }
    if (work.stopped()) {
      yield { status: "budget" };
      return;
    }
    if (profiles.length === 0 || !validPocketScope(scope)) {
      yield { status: "unknown" };
      return;
    }
    const matched = profilesMatch(work, scope, owner, profiles);
    if (matched !== true) {
      yield { status: matched === undefined ? "budget" : "unknown" };
      return;
    }
    if (!activeWork.propagate()) {
      yield { status: "budget" };
      return;
    }
    if (!validPocketScope(scope)) {
      yield { status: "unknown" };
      return;
    }
    yield {
      frontier: Object.freeze({
        owner,
        profiles: Object.freeze(profiles),
        scope,
        values: Object.freeze(frontier),
      }),
      status: "complete",
    };
  }
  const domain = {
    at(
      jobKey: string,
      prepared: PreparedSlotKind<Kind>,
      row: number,
      lane: number,
    ): readonly SlotCandidate<Kind>[] {
      validateAnchor(row, lane);
      const domain = nativeDomain(jobKey, prepared);
      const anchor = `${row}:${lane}`;
      const previous = domain.anchors.get(anchor);
      if (previous !== undefined) {
        return previous;
      }
      const entries = slotPlacementsAt(
        nativeGeometry,
        { distance: rows[row]!, lane, row, slot: 0 },
        prepared,
      );
      const result = wrap(domain, jobKey, prepared, row, lane, entries);
      domain.anchors.set(anchor, result);
      return result;
    },
    attestOwnerWalls(
      work: PocketWork,
      scope: SlotPocketScope,
      row: number,
      owner: ConstraintOwner,
      values: readonly { readonly value: SlotCandidate<Kind>; readonly guaranteedWalls: number }[],
      token: SlotOwnerWallsToken,
    ): boolean | undefined {
      if (work.stopped()) {
        return undefined;
      }
      const saved = completedWalls.get(token);
      return saved?.row === row && attestsFrontier(work, scope, row, owner, saved, values);
    },
    attestsCompleteOwnerDomain(
      work: PocketWork,
      scope: SlotPocketScope,
      owner: ConstraintOwner,
      values: readonly SlotCandidate<Kind>[],
      token: SlotOwnerDomainToken,
    ): boolean | undefined {
      return attestsFrontier(
        work,
        scope,
        undefined,
        owner,
        completedOwners.get(token),
        values.map((value) => ({ value })),
      );
    },
    attestsOwnerDomain(
      work: PocketWork,
      scope: SlotPocketScope,
      row: number,
      owner: ConstraintOwner,
      values: readonly { readonly value: SlotCandidate<Kind>; readonly guaranteedWalls: number }[],
      token: SlotOwnerDomainToken,
    ): boolean | undefined {
      return attestsFrontier(work, scope, row, owner, completedOwners.get(token), values);
    },
    cachedIntrinsic(candidate: SlotCandidate<Kind>): IntrinsicResult | undefined {
      return proofs.get(candidate);
    },
    *completeOwnerDomain(
      work: PocketWork,
      scope: SlotPocketScope,
      owner: ConstraintOwner,
    ): Generator<SlotOwnerDomainStep<Kind>> {
      for (const step of ownerFrontier(work, scope, undefined, owner)) {
        if (step.status === "complete") {
          const token = Object.freeze({ [ownerDomainBrand]: true as const });
          completedOwners.set(token, step.frontier);
          yield { status: "complete", token };
        } else if (step.status === "candidate") {
          yield { status: "candidate", value: step.value };
        } else if (step.status !== "progress") {
          yield step;
        }
      }
    },
    *completeOwnerWalls(
      work: PocketWork,
      scope: SlotPocketScope,
      row: number,
      owner: ConstraintOwner,
    ): Generator<SlotOwnerWallsStep<Kind>> {
      for (const step of ownerFrontier(work, scope, row, owner)) {
        if (step.status === "complete") {
          const token = Object.freeze({ [ownerWallsBrand]: true as const });
          completedWalls.set(token, { ...step.frontier, row });
          yield { status: "complete", token };
        } else if (step.status === "candidate") {
          if (step.guaranteedWalls === undefined) {
            yield { status: "unknown" };
            return;
          }
          yield { guaranteedWalls: step.guaranteedWalls, status: "candidate", value: step.value };
        } else {
          yield step;
        }
      }
    },
    // Only a finished immutable frontier has a cardinality; prefix exclusions do not narrow it.
    completedCardinality(
      order: SlotCandidateOrder,
      jobKey: string,
      prepared: PreparedSlotKind<Kind>,
    ): number | undefined {
      if (order.motionTier !== undefined) {
        return undefined;
      }
      const sequence = sequences.get(prepared)?.get(sequenceKey(order, jobKey));
      return sequence?.complete ? sequence.distinct.size : undefined;
    },
    *frontierSequence(
      work: {
        readonly anchor: () => boolean;
        readonly check: () => boolean;
        readonly exclude?: () => ReadonlySet<string> | undefined;
        readonly propagate?: () => boolean;
      },
      order: SlotCandidateOrder,
      jobKey: string,
      prepared: PreparedSlotKind<Kind>,
    ): Generator<SlotFrontierSequenceStep<Kind>> {
      let view: SlotPathProjectionView<Kind> | undefined;
      if (order.motionTier !== undefined) {
        const tier = motionTiers.get(prepared);
        const selected = tier?.members[order.motionTier];
        if (selected === undefined || work.propagate === undefined) {
          yield { status: "unavailable" };
          return;
        }
        // Empty subsets always require a fresh issuer guard, including revisits.
        view = selected.size === 0 ? undefined : tier!.views.get(order.motionTier);
        if (view === undefined) {
          const issued = projection.view({ propagate: work.propagate }, prepared, selected);
          if (issued.status === "budget") {
            yield issued;
            return;
          }
          if (issued.status === "empty-view") {
            yield { status: "empty-tier" };
            return;
          }
          if (issued.status !== "view") {
            yield { status: "unavailable" };
            return;
          }
          view = issued.view;
          tier!.views.set(order.motionTier, view);
        }
      }
      stats.traversals++;
      let preparedSequences = sequences.get(prepared);
      if (preparedSequences === undefined) {
        preparedSequences = new Map();
        sequences.set(prepared, preparedSequences);
      }
      const key = sequenceKey(order, jobKey);
      let sequence = preparedSequences.get(key);
      if (sequence === undefined) {
        sequence = {
          anchor: 0,
          candidates: [],
          complete: false,
          distinct: new Set(),
          expanding: false,
          occurrence: 0,
          pending: undefined,
          views: new Map(),
        };
        preparedSequences.set(key, sequence);
      }
      if (view !== undefined && (sequence.expanding || sequence.anchor > 0)) {
        // Cached candidates and empty tier EOF still revalidate borrowed native geometry.
        const row = order.rows[0];
        const lane = order.columns[order.columnStart % order.columns.length];
        if (row !== undefined && lane !== undefined) {
          const checked = projection.guard(work, prepared, view);
          if (checked.status !== "current") {
            if (checked.status === "unavailable") {
              motionTiers.get(prepared)!.views.delete(order.motionTier!);
            }
            yield checked;
            return;
          }
        }
      }
      let index = 0;
      while (true) {
        const excluded = work.exclude?.();
        if (work.exclude !== undefined && excluded === undefined) {
          yield { kind: "propagation", status: "budget" };
          return;
        }
        if (index < sequence.candidates.length) {
          if (excluded !== undefined && excluded.size > 0) {
            const key = JSON.stringify([...excluded].sort());
            let view = sequence.views.get(key);
            if (view === undefined) {
              view = { indices: [], scanned: 0 };
              sequence.views.set(key, view);
              stats.filterViews++;
            }
            while (view.scanned < sequence.candidates.length) {
              if (work.propagate !== undefined && !work.propagate()) {
                yield { kind: "propagation", status: "budget" };
                return;
              }
              stats.filterScans++;
              if (!excluded.has(sequence.candidates[view.scanned]!.id)) {
                view.indices.push(view.scanned);
              }
              view.scanned++;
            }
            let first = 0;
            let last = view.indices.length;
            while (first < last) {
              const middle = Math.floor((first + last) / 2);
              if (view.indices[middle]! < index) {
                first = middle + 1;
              } else {
                last = middle;
              }
            }
            const next = view.indices[first] ?? sequence.candidates.length;
            stats.filtered += next - index;
            index = next;
            if (index >= sequence.candidates.length) {
              continue;
            }
          }
          stats.replays++;
          yield { candidate: sequence.candidates[index++]!, status: "candidate" };
          continue;
        }
        if (sequence.complete) {
          return;
        }
        if (sequence.pending === undefined) {
          if (sequence.anchor >= order.rows.length * order.columns.length) {
            sequence.complete = true;
            return;
          }
          if (!sequence.expanding) {
            if (!work.anchor()) {
              yield { kind: "anchors", status: "budget" };
              return;
            }
            sequence.expanding = true;
            stats.expansions++;
          }
          const row = order.rows[Math.floor(sequence.anchor / order.columns.length)]!;
          const lane = order.columns[(order.columnStart + sequence.anchor) % order.columns.length]!;
          validateAnchor(row, lane);
          const native = nativeDomain(jobKey, prepared);
          const anchor = `${row}:${lane}${order.motionTier === undefined ? "" : `:tier:${order.motionTier}`}`;
          let projected = native.projected.get(anchor);
          if (projected === undefined) {
            const anchorValue = { distance: rows[row]!, lane, row, slot: 0 };
            const result =
              view === undefined
                ? projection.at(work, anchorValue, prepared)
                : projection.at(work, anchorValue, prepared, view);
            if (result.status !== "entries") {
              if (result.status === "unavailable") {
                motionTiers.get(prepared)!.views.delete(order.motionTier!);
              }
              yield result;
              return;
            }
            projected = wrap(native, jobKey, prepared, row, lane, result.entries);
            native.projected.set(anchor, projected);
          } else if (view !== undefined) {
            // A projected tier anchor revalidates its view without rebuilding the same entries.
            const checked = projection.guard(work, prepared, view);
            if (checked.status !== "current") {
              if (checked.status === "unavailable") {
                motionTiers.get(prepared)!.views.delete(order.motionTier!);
              }
              yield checked;
              return;
            }
          }
          sequence.pending = projected;
          sequence.occurrence = 0;
        }
        if (sequence.occurrence >= sequence.pending.length) {
          sequence.pending = undefined;
          sequence.expanding = false;
          sequence.anchor++;
          continue;
        }
        const candidate = sequence.pending[sequence.occurrence]!;
        if (!proofs.has(candidate)) {
          if (!work.check()) {
            yield { kind: "candidateChecks", status: "budget" };
            return;
          }
        }
        const result = domain.intrinsic(candidate);
        sequence.occurrence++;
        if (result.accepted) {
          sequence.candidates.push(candidate);
          sequence.distinct.add(candidate.id);
          index++;
          if (excluded?.has(candidate.id)) {
            stats.filtered++;
          } else {
            yield { candidate, status: "candidate" };
          }
        }
      }
    },

    guaranteedWalls(
      work: PocketWork,
      scope: SlotPocketScope,
      row: number,
      owner: ConstraintOwner,
      candidate: SlotCandidate<Kind>,
    ):
      | { readonly status: "walls"; readonly mask: number }
      | { readonly status: "unknown" }
      | { readonly status: "budget" } {
      if (work.stopped() || !work.propagate() || work.stopped()) {
        return { status: "budget" };
      }
      const binding = pocketValues.get(scope)?.get(candidate);
      if (
        !Number.isSafeInteger(row) ||
        row < 0 ||
        row >= rows.length ||
        !validPocketScope(scope) ||
        binding?.owner !== owner ||
        binding.shape !== signature(candidate) ||
        !proofs.get(candidate)?.accepted
      ) {
        return { status: "unknown" };
      }
      let projected = wallMasks.get(candidate)?.get(row);
      if (projected === undefined) {
        if (!work.check()) {
          return { status: "budget" };
        }
        let mask: number | undefined;
        try {
          mask = projectSlotWalls(
            () => !work.stopped() && work.propagate() && !work.stopped(),
            nativeGeometry,
            path,
            row,
            candidate.entry,
          );
        } catch {
          return { status: "unknown" };
        }
        if (work.stopped() || mask === undefined) {
          return { status: "budget" };
        }
        projected = { mask, shape: binding.shape };
        let byRow = wallMasks.get(candidate);
        if (byRow === undefined) {
          byRow = new Map();
          wallMasks.set(candidate, byRow);
        }
        byRow.set(row, projected);
      }
      return projected.shape === binding.shape
        ? { mask: projected.mask, status: "walls" }
        : { status: "unknown" };
    },
    intrinsic(candidate: SlotCandidate<Kind>): IntrinsicResult {
      let result = proofs.get(candidate);
      if (result === undefined) {
        if (!owned.has(candidate)) {
          throw new Error("Candidate belongs to another compiled domain");
        }
        stats.unaryChecks++;
        result = Object.freeze(probeIntrinsic(candidate.entry));
        proofs.set(candidate, result);
      }
      return result;
    },
    motionTiers(
      work: { readonly propagate: () => boolean },
      prepared: PreparedSlotKind<Kind>,
    ): SlotMotionTiers {
      const indexed = projection.motionTiers(work, prepared);
      if (indexed.status !== "tiers") {
        motionTiers.delete(prepared);
        return indexed.status === "budget" ? { status: "budget" } : { status: "unknown" };
      }
      let saved = motionTiers.get(prepared);
      if (saved === undefined || saved.members !== indexed.members) {
        saved = { draws: indexed.draws, members: indexed.members, views: new Map() };
        motionTiers.set(prepared, saved);
      }
      return {
        draws: saved.draws,
        status: "tiers",
        tiers: saved.draws.map((_draw, index) => index),
      };
    },
    pocketScope(owners: readonly SlotPocketOwner[]): SlotPocketScope {
      const scope = createSlotPocketScope(geometry, path, owners);
      pocketScopes.add(scope);
      pocketValues.set(scope, new Map());
      return scope;
    },
    *sequence(
      work: {
        readonly anchor: () => boolean;
        readonly check: () => boolean;
        readonly exclude?: () => ReadonlySet<string> | undefined;
        readonly propagate?: () => boolean;
      },
      order: SlotCandidateOrder,
      jobKey: string,
      prepared: PreparedSlotKind<Kind>,
    ): Generator<SlotSequenceStep<Kind>> {
      for (const step of domain.frontierSequence(
        work,
        { columnStart: order.columnStart, columns: order.columns, rows: order.rows },
        jobKey,
        prepared,
      )) {
        if (step.status === "unavailable" || step.status === "empty-tier") {
          throw new Error("Full native traversal cannot use a motion tier");
        }
        yield step;
      }
    },

    statistics() {
      return { ...stats, projection: projection.statistics() };
    },
  };
  return domain;
}
