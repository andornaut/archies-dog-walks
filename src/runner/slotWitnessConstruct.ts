import { visibleMoverRows } from "./moverCoverage";
import type {
  SlotCandidate,
  SlotCandidateOrder,
  SlotFrontierSequenceStep,
  SlotMotionTiers,
  SlotSequenceStep,
} from "./slotCandidateDomains";
import { nativeSlotPreparationOrderingHint, type PreparedSlotKind } from "./slotCandidates";
import type { ConstraintEntry, ConstraintOwner, ConstraintResult } from "./slotConstraintState";
import { coverageLeadingRows, createQuietCoverageState } from "./slotCoverage";
import { SLOT_OMISSION_ATTEMPTS, SLOT_ROW_PRESSURE } from "./slotDelivery";
import { createMovingCoverageHints } from "./slotMovingCoverageHints";
import type { SlotPocketProof } from "./slotPocketSupport";
import { drainSlotSolver } from "./slotSolverSession";
import { traverseSlotSources } from "./slotSourceTraversal";
import { balancedJobOrder, idealRowOrder, motionRank, rotatedColumns } from "./slotWitnessOrder";
import type { WitnessJob, WitnessOmission } from "./slotWitnessSearch";
import { blockingSpan, type PlannedSpawns, quotaFootprint, type SpawnPlan } from "./spawning";

type Rejection<Kind extends string> = Extract<ConstraintResult<Kind>, { accepted: false }>;
export type SlotWitnessBranchSupport<Kind extends string> =
  | { readonly proof?: SlotPocketProof<SlotCandidate<Kind>>; readonly status: "refuted" }
  | { readonly status: "unknown" | "budget" }
  | { readonly failure: Rejection<Kind>["failure"]; readonly status: "fatal" };
export type SlotWitnessRefutationAttestation =
  | { readonly dependencies: readonly ConstraintOwner[]; readonly status: "attested" }
  | { readonly status: "unknown" | "budget" };
export interface SlotWitnessConstructPorts<Kind extends string, Mark> {
  attestRefutation?(proof: SlotPocketProof<SlotCandidate<Kind>>): SlotWitnessRefutationAttestation;
  bestDelivery?(): number | undefined;
  candidates(
    job: WitnessJob<Kind>,
    prepared: PreparedSlotKind<Kind>,
    order: SlotCandidateOrder,
  ): Iterable<SlotFrontierSequenceStep<Kind>>;
  checkpoint(): Mark;
  complete(): { readonly accepted: true } | Rejection<Kind> | undefined;
  entries(): readonly ConstraintEntry<Kind>[];
  readonly coverageFirst?: boolean;
  readonly originalDrawsFirst?: boolean;
  motionTiers?(prepared: PreparedSlotKind<Kind>): SlotMotionTiers;
  readonly minimumDelivery?: number;
  // Failed placement attempts before a frame may omit its optional request; reserve by default.
  readonly omissionAttempts?: number;
  readonly ordinaryOrder?: "original" | "balanced";
  partial?(omissions: readonly WitnessOmission<Kind>[]): boolean | undefined;
  // Opens each job's sources progressively in their weighted order (traverseSlotSources).
  readonly fairSources?: boolean;
  hint?(job: WitnessJob<Kind>): SlotCandidate<Kind> | undefined;
  laneClosure?(): { readonly accepted: true } | Rejection<Kind> | undefined;
  preparations(job: WitnessJob<Kind>): Iterable<PreparedSlotKind<Kind>>;
  propagate(): boolean;
  // Whether a recorded rejection of this choice still holds for the current entries.
  rejects?(job: WitnessJob<Kind>, candidate: SlotCandidate<Kind>): boolean;
  repairRow?():
    { readonly row: number; readonly status: "row" } | { readonly status: "none" | "budget" };
  restore(mark: Mark): void;
  stopped?(): boolean;
  support?(): SlotWitnessBranchSupport<Kind>;
  test(job: WitnessJob<Kind>, candidate: SlotCandidate<Kind>): ConstraintResult<Kind> | undefined;
}
export type SlotWitnessConstructResult<Kind extends string> =
  | {
      readonly coverageKey?: string;
      readonly status: "compatible";
      readonly witness: readonly ConstraintEntry<Kind>[];
    }
  | { readonly status: "inconclusive" }
  | { readonly failure: Rejection<Kind>["failure"]; readonly status: "blocked" }
  | { readonly status: "budget" };
interface Option<Kind extends string> {
  readonly job: WitnessJob<Kind>;
  readonly candidate: SlotCandidate<Kind>;
}
type Choice<Kind extends string> =
  | {
      readonly continuation?: { readonly defer: () => void; readonly preferClear: boolean };
      readonly option: Option<Kind>;
      readonly status: "candidate";
    }
  | { readonly status: "source-end" }
  | { readonly status: "tier-end" };
// Occupancy rejections per row within one frame, and the row each yielded value was drawn from.
interface RowPressure<Kind extends string> {
  readonly rejections: Map<number, number>;
  readonly rows: Map<SlotCandidate<Kind>, number>;
}
// A quiet-coverage scan over the leading quiet rows. Anchored scans try only blocking sources at
// rows whose footprint covers a leading row; blocking scans yield only values that cover one and
// defer the rest; open scans yield every value, leading rows first.
interface CoverageScan {
  readonly filter: "anchored" | "blocking" | "open";
  readonly leading: readonly number[];
}
// How one frame enumerates a job's sources: the rows and columns to try, a repair row to try
// first, an optional coverage scan, where blocking scans defer values and the frame's row pressure.
interface SourceScan<Kind extends string> {
  readonly columns?: ReadonlyMap<PreparedSlotKind<Kind>, readonly number[]>;
  readonly coverage?: CoverageScan;
  readonly deferred?: Option<Kind>[];
  readonly pressure?: RowPressure<Kind>;
  readonly repairRow?: number;
  readonly rows: readonly number[];
}
interface JobOrder<Kind extends string> {
  readonly fixed: boolean;
  readonly guaranteed: boolean;
  readonly key: string;
  readonly ordinal: number;
  readonly phase: WitnessJob<Kind>["phase"];
  readonly preparationMethod: WitnessJob<Kind>["preparations"];
  readonly total: number;
  readonly prepared: readonly PreparedSlotKind<Kind>[];
  readonly rows: readonly number[];
  readonly columns: ReadonlyMap<PreparedSlotKind<Kind>, readonly number[]>;
  readonly rank: number;
  readonly width: number;
  readonly envelopeWidth: number;
}

// Job/source pools and keyed native preparations stay fixed within one compiled problem.
// A changed preparation method or ordering field invalidates completed metadata.
export function createSlotWitnessConstruct<Kind extends string>(
  geometry: Omit<SpawnPlan<Kind>, "quotas">,
  path: PlannedSpawns<Kind>["path"],
  jobs: readonly WitnessJob<Kind>[],
) {
  const metadata = new WeakMap<WitnessJob<Kind>, JobOrder<Kind>>();
  const begin = <Mark>(ports: SlotWitnessConstructPorts<Kind, Mark>) =>
    construct(ports, geometry, path, metadata, jobs);
  const run = <Mark>(ports: SlotWitnessConstructPorts<Kind, Mark>) => drainSlotSolver(begin(ports));
  return Object.assign(run, { begin });
}

// This mode orders hypothetical choices. The caller owns every native check and work charge.
export function constructSlotWitness<Kind extends string, Mark>(
  ports: SlotWitnessConstructPorts<Kind, Mark>,
  geometry: Omit<SpawnPlan<Kind>, "quotas">,
  path: PlannedSpawns<Kind>["path"],
  jobs: readonly WitnessJob<Kind>[],
): SlotWitnessConstructResult<Kind> {
  return createSlotWitnessConstruct(geometry, path, jobs)(ports);
}

function* construct<Kind extends string, Mark>(
  ports: SlotWitnessConstructPorts<Kind, Mark>,
  geometry: Omit<SpawnPlan<Kind>, "quotas">,
  path: PlannedSpawns<Kind>["path"],
  metadata: WeakMap<WitnessJob<Kind>, JobOrder<Kind>>,
  jobs: readonly WitnessJob<Kind>[],
): Generator<void, SlotWitnessConstructResult<Kind>, void> {
  if (ports.stopped?.()) {
    return { status: "budget" };
  }
  const root = ports.checkpoint();
  const omissionAttempts = ports.omissionAttempts ?? SLOT_OMISSION_ATTEMPTS.reserve;
  const byKey = new Map(jobs.map((job) => [job.key, job]));
  const {
    coverage,
    rows: coverageRows,
    spacing: coverageSpacing,
  } = createQuietCoverageState(geometry);
  const movingCoverageRows = createMovingCoverageHints(geometry);
  const coveragePlan = { ...geometry, quotas: [] };
  const omissions = new Map<WitnessJob<Kind>, WitnessOmission<Kind>["reason"]>();
  const omitted = (): readonly WitnessOmission<Kind>[] =>
    Object.freeze([...omissions].map(([job, reason]) => Object.freeze({ job, reason })));
  const restoreOmissions = (saved: readonly WitnessOmission<Kind>[]) => {
    omissions.clear();
    for (const { job, reason } of saved) {
      omissions.set(job, reason);
    }
  };
  let budget = false;
  let completionRule: string | undefined;
  let closureChecked = false;
  let fatal: Rejection<Kind>["failure"] | undefined;
  const stopped = () => {
    budget ||= ports.stopped?.() === true;
    return budget || fatal !== undefined;
  };
  const charge = () => {
    if (stopped()) {
      return false;
    }
    if (!ports.propagate()) {
      budget = true;
      return false;
    }
    return !stopped();
  };
  let distanceRows: Map<number, number> | undefined;
  const fixedAnchors = new Map<number, ReadonlyMap<number, readonly number[]>>();
  const rowsByDistance = () => {
    if (distanceRows !== undefined) {
      return distanceRows;
    }
    const result = new Map<number, number>();
    for (const [row, distance] of coverageRows.entries()) {
      if (!charge()) {
        return undefined;
      }
      result.set(distance, row);
    }
    distanceRows = result;
    return result;
  };
  const anchorsFor = (footprintRows: number) => {
    const cached = fixedAnchors.get(footprintRows);
    if (cached !== undefined) {
      return cached;
    }
    const result = new Map<number, number[]>();
    for (let first = 0; first < coverageRows.length; first++) {
      if (!charge()) {
        return undefined;
      }
      const last = blockingSpan(coveragePlan, coverageSpacing, first, footprintRows).lastRow;
      for (let row = first; row <= last && row < coverageRows.length; row++) {
        if (!charge()) {
          return undefined;
        }
        const anchors = result.get(row) ?? [];
        anchors.push(first);
        result.set(row, anchors);
      }
    }
    fixedAnchors.set(footprintRows, result);
    return result;
  };
  const coversLeading = (candidate: SlotCandidate<Kind>, leading: readonly number[]) => {
    const entry = candidate.entry;
    if (entry.herring || !entry.request.blocksLane) {
      return false;
    }
    if (entry.event.mover !== undefined) {
      for (const row of leading) {
        if (!charge()) {
          return false;
        }
        if (visibleMoverRows(geometry, [coverageRows[row]!], entry).length > 0) {
          return true;
        }
      }
      return false;
    }
    const first = rowsByDistance()?.get(entry.event.distance);
    if (first === undefined) {
      return false;
    }
    const last = blockingSpan(
      coveragePlan,
      coverageSpacing,
      first,
      quotaFootprint(entry.request).rows,
    ).lastRow;
    for (const row of leading) {
      if (!charge()) {
        return false;
      }
      if (first <= row && row <= last) {
        return true;
      }
    }
    return false;
  };
  const present = () => new Set(stopped() ? [] : ports.entries().map(({ owner }) => owner.key));
  const resolved = () => new Set([...present(), ...[...omissions.keys()].map((job) => job.key)]);
  const dominated = () => {
    const best = ports.minimumDelivery === undefined ? undefined : ports.bestDelivery?.();
    return best !== undefined && jobs.length - omissions.size <= best;
  };
  const leadingRows = () =>
    stopped() ? undefined : coverageLeadingRows(geometry, coverage(ports.entries()));
  // A job's source sequence is fixed within one compiled problem; replay it once fully read.
  const preparationLists = new Map<WitnessJob<Kind>, readonly PreparedSlotKind<Kind>[]>();
  function* readPreparations(job: WitnessJob<Kind>): Generator<PreparedSlotKind<Kind>> {
    if (stopped()) {
      return;
    }
    const known = preparationLists.get(job);
    if (known !== undefined) {
      for (const prepared of known) {
        if (stopped()) {
          break;
        }
        yield prepared;
      }
      stopped();
      return;
    }
    const sources = ports.preparations(job);
    if (stopped()) {
      return;
    }
    const read: PreparedSlotKind<Kind>[] = [];
    let complete = true;
    for (const prepared of sources) {
      if (stopped()) {
        complete = false;
        break;
      }
      if (!ports.propagate()) {
        budget = true;
        complete = false;
        break;
      }
      if (stopped()) {
        complete = false;
        break;
      }
      read.push(prepared);
      yield prepared;
    }
    if (!stopped() && complete) {
      preparationLists.set(job, Object.freeze(read));
    }
  }
  const rowOrder = (job: WitnessJob<Kind>) => idealRowOrder(path.length, job);
  const columnOrder = (job: WitnessJob<Kind>, prepared: PreparedSlotKind<Kind>) =>
    rotatedColumns(geometry.laneCount, job, prepared);
  const matches = (job: WitnessJob<Kind>, order: JobOrder<Kind>) =>
    order.preparationMethod === job.preparations &&
    order.fixed === job.fixed &&
    order.guaranteed === job.guaranteed &&
    order.key === job.key &&
    order.ordinal === job.ordinal &&
    order.phase === job.phase &&
    order.total === job.total;
  const orderFor = (job: WitnessJob<Kind>): JobOrder<Kind> => {
    const cached = metadata.get(job);
    if (!stopped() && cached !== undefined && matches(job, cached)) {
      return cached;
    }
    const identity = {
      fixed: job.fixed,
      guaranteed: job.guaranteed,
      key: job.key,
      ordinal: job.ordinal,
      phase: job.phase,
      preparationMethod: job.preparations,
      total: job.total,
    };
    const prepared = Object.freeze([...readPreparations(job)]);
    let envelopeWidth = Infinity;
    for (const source of prepared) {
      if (stopped()) {
        break;
      }
      if (source.placements.length === 0) {
        envelopeWidth = Math.min(envelopeWidth, source.source.footprint.lanes);
        continue;
      }
      const native = nativeSlotPreparationOrderingHint(ports, source);
      if (native.status === "budget") {
        budget = true;
        break;
      }
      if (stopped()) {
        break;
      }
      if (native.status === "hint") {
        envelopeWidth = Math.min(envelopeWidth, native.hint.envelopeWidth);
        continue;
      }
      for (const placement of source.placements) {
        if (stopped() || !ports.propagate()) {
          budget = true;
          break;
        }
        envelopeWidth = Math.min(envelopeWidth, placement.lanes.count);
      }
      if (stopped()) {
        break;
      }
    }
    const order = Object.freeze({
      ...identity,
      columns: new Map(prepared.map((source) => [source, Object.freeze(columnOrder(job, source))])),
      envelopeWidth: Number.isFinite(envelopeWidth) ? envelopeWidth : 0,
      prepared,
      rank: Math.min(...prepared.map(motionRank)),
      rows: Object.freeze(rowOrder(job)),
      width: Math.max(0, ...prepared.map((source) => source.source.footprint.lanes)),
    });
    // Cache ordering metadata only after complete EOF. It never attests native admission.
    if (
      !stopped() &&
      matches(job, order) &&
      prepared.length > 0 &&
      prepared.every(
        (source) =>
          Object.isFrozen(source) &&
          Object.isFrozen(source.columns) &&
          Object.isFrozen(source.placements) &&
          Object.isFrozen(source.request),
      )
    ) {
      metadata.set(job, order);
    }
    return order;
  };
  function* options(
    scan: SourceScan<Kind>,
    traversal:
      { readonly hint: SlotCandidate<Kind> | undefined; readonly seen: Set<string> } | undefined,
    job: WitnessJob<Kind>,
    prepared: Iterable<PreparedSlotKind<Kind>>,
  ): Generator<Choice<Kind>> {
    if (stopped()) {
      return;
    }
    const { columns, deferred, pressure, repairRow, rows } = scan;
    const quietRows = scan.coverage?.leading;
    const covering = scan.coverage?.filter === "anchored";
    const filtered = scan.coverage !== undefined && scan.coverage.filter !== "open";
    const seen = traversal?.seen ?? new Set<string>();
    const hint = traversal === undefined ? ports.hint?.(job) : traversal.hint;
    if (stopped()) {
      return;
    }
    const hintRow =
      hint?.entry.trace.placement?.block.row ??
      path.findIndex((row) => row.distance === hint?.entry.event.distance);
    const eligible = (candidate: SlotCandidate<Kind>) =>
      !filtered || coversLeading(candidate, quietRows!);
    const deferredIds = new Set<string>();
    // The caller supplies the frozen weighted kind order. Hints only reorder its native values.
    for (const source of prepared) {
      if (filtered && (source.herring || !source.request.blocksLane)) {
        continue;
      }
      const sourceColumns = covering
        ? source.columns
        : (columns?.get(source) ?? columnOrder(job, source));
      const preferredRow =
        repairRow !== undefined &&
        source.request.blocksLane &&
        source.request.mover === undefined &&
        rows.includes(repairRow)
          ? repairRow
          : undefined;
      let sourceRows =
        preferredRow === undefined
          ? rows
          : [preferredRow, ...rows.filter((row) => row !== preferredRow)];
      if (covering && quietRows !== undefined && source.request.mover === undefined) {
        const anchors = anchorsFor(quotaFootprint(source.request).rows);
        if (anchors === undefined) {
          return;
        }
        const ordered: number[] = [];
        const seenRows = new Set<number>();
        for (const leading of quietRows) {
          if (!charge()) {
            return;
          }
          if (anchors.has(leading) && !seenRows.has(leading)) {
            seenRows.add(leading);
            ordered.push(leading);
          }
        }
        for (const leading of quietRows) {
          if (!charge()) {
            return;
          }
          for (const row of anchors.get(leading) ?? []) {
            if (!charge()) {
              return;
            }
            if (!seenRows.has(row)) {
              seenRows.add(row);
              ordered.push(row);
            }
          }
        }
        sourceRows = ordered;
      }
      if (quietRows !== undefined) {
        const hinted = movingCoverageRows(ports, quietRows, sourceRows, source);
        if (hinted === undefined) {
          budget = true;
          return;
        }
        sourceRows = hinted;
      }
      const frontiers = ports.originalDrawsFirst === true ? ports.motionTiers?.(source) : undefined;
      if (frontiers?.status === "budget") {
        budget = true;
        return;
      }
      const tiers = frontiers?.status === "tiers" ? frontiers.tiers : [undefined];
      let fallback = false;
      for (let index = 0; index < tiers.length || fallback; index++) {
        const motionTier: number | undefined = fallback ? undefined : tiers[index];
        fallback = false;
        const sourceHint =
          hint?.prepared === source &&
          rows.includes(hintRow) &&
          sourceColumns.includes(hint.entry.event.lane) &&
          eligible(hint) &&
          (motionTier === undefined ||
            (frontiers?.status === "tiers" &&
              frontiers.draws[motionTier] ===
                (hint.entry.placement?.selection?.draws ?? source.draws)));
        if (stopped()) {
          return;
        }
        if (
          sourceHint &&
          (frontiers?.status !== "tiers" || !seen.has(hint.id)) &&
          (preferredRow === undefined || hintRow === preferredRow) &&
          (quietRows === undefined || hintRow === sourceRows[0])
        ) {
          seen.add(hint.id);
          yield { option: { candidate: hint, job }, status: "candidate" };
        }
        let emptyTier = false;
        // Each source keeps its own row order; a pressured row waits behind the untried rows.
        const queue = [...sourceRows];
        const ordered = pressure !== undefined && !covering && quietRows === undefined;
        while (queue.length > 0) {
          const open = ordered
            ? queue.findIndex(
                (row) => (pressure.rejections.get(row) ?? 0) < SLOT_ROW_PRESSURE.rejections,
              )
            : 0;
          const row = queue.splice(Math.max(0, open), 1)[0]!;
          if (stopped()) {
            return;
          }
          if (covering && !source.request.blocksLane) {
            continue;
          }
          if (sourceHint && row === hintRow && !seen.has(hint.id)) {
            seen.add(hint.id);
            yield { option: { candidate: hint, job }, status: "candidate" };
          }
          const candidates = ports.candidates(job, source, {
            columnStart: 0,
            columns: sourceColumns,
            ...(motionTier === undefined ? {} : { motionTier }),
            rows: [row],
          });
          if (stopped()) {
            return;
          }
          for (const step of candidates) {
            if (stopped()) {
              return;
            }
            if (step.status === "budget") {
              budget = true;
              return;
            }
            if (step.status === "empty-tier") {
              emptyTier = true;
              break;
            }
            if (step.status === "unavailable") {
              fallback = motionTier !== undefined;
              break;
            }
            if (!seen.has(step.candidate.id)) {
              const useful = eligible(step.candidate);
              if (stopped()) {
                return;
              }
              if (useful) {
                seen.add(step.candidate.id);
                pressure?.rows.set(step.candidate, row);
                yield { option: { candidate: step.candidate, job }, status: "candidate" };
              } else if (deferred !== undefined && !deferredIds.has(step.candidate.id)) {
                if (!charge()) {
                  return;
                }
                deferredIds.add(step.candidate.id);
                deferred.push({ candidate: step.candidate, job });
              }
            }
          }
          if (stopped()) {
            return;
          }
          if (emptyTier || fallback) {
            break;
          }
        }
        if (motionTier !== undefined) {
          // Drain unsafe values from this draw tuple before opening later retry tuples.
          yield { status: "tier-end" };
        }
        if (motionTier === undefined) {
          break;
        }
      }
      if (stopped()) {
        return;
      }
      // Suspend the source until its deferred branches have been explored.
      yield { status: "source-end" };
    }
  }
  function* fairOptions(
    scan: SourceScan<Kind>,
    job: WitnessJob<Kind>,
    prepared: Iterable<PreparedSlotKind<Kind>>,
  ): Generator<Choice<Kind>> {
    if (stopped()) {
      return;
    }
    const traversal = { hint: ports.hint?.(job), seen: new Set<string>() };
    const pending = new WeakMap<
      PreparedSlotKind<Kind>,
      Extract<Choice<Kind>, { status: "candidate" }>
    >();
    const cursor = traverseSlotSources(
      {
        *candidates(source): Generator<SlotSequenceStep<Kind>> {
          const deferred: Option<Kind>[] = [];
          for (const choice of options(scan, traversal, job, [source])) {
            if (choice.status === "source-end" || choice.status === "tier-end") {
              for (const option of deferred) {
                pending.set(source, {
                  continuation: {
                    defer: () => {
                      throw new Error("Unsafe fallback cannot be deferred again");
                    },
                    preferClear: false,
                  },
                  option,
                  status: "candidate",
                });
                yield { candidate: option.candidate, status: "candidate" };
              }
              deferred.length = 0;
            } else {
              pending.set(source, {
                continuation: { defer: () => deferred.push(choice.option), preferClear: true },
                option: choice.option,
                status: "candidate",
              });
              yield { candidate: choice.option.candidate, status: "candidate" };
            }
          }
        },
        held: (candidate) => ports.rejects?.(job, candidate) === true,
        propagate: ports.propagate,
        stopped,
      },
      prepared,
    );
    try {
      for (;;) {
        const next = cursor.next();
        if (next.done) {
          budget ||= next.value.status !== "complete";
          return;
        }
        const choice = pending.get(next.value.source);
        if (choice === undefined || choice.option.candidate !== next.value.candidate) {
          throw new Error("Missing source continuation candidate");
        }
        yield choice;
      }
    } finally {
      cursor.return({ status: "stopped" });
    }
  }
  const sourceOptions = (
    scan: SourceScan<Kind>,
    job: WitnessJob<Kind>,
    prepared: Iterable<PreparedSlotKind<Kind>>,
  ) =>
    ports.fairSources === true
      ? fairOptions(scan, job, prepared)
      : options(scan, undefined, job, prepared);
  const complete = () => {
    if (stopped()) {
      return false;
    }
    const result = ports.complete();
    completionRule = result?.accepted === false ? result.failure.rule : undefined;
    budget ||= result === undefined;
    if (result?.accepted === false && result.failure.classification === "unattributed") {
      fatal = result.failure;
    }
    return !stopped() && result?.accepted === true;
  };
  const learned = new Set<SlotPocketProof<SlotCandidate<Kind>>>();
  let backjump: number | undefined;
  // The native rule that rejected the latest tested value, if any.
  let rejectedRule: string | undefined;
  let fullCompletion = false;
  const attest = (proof: SlotPocketProof<SlotCandidate<Kind>>, current: WitnessJob<Kind>) => {
    const result = ports.attestRefutation?.(proof);
    budget ||= result?.status === "budget";
    if (stopped() || result?.status !== "attested") {
      return false;
    }
    const entries = ports.entries();
    const dependencies = new Set(result.dependencies);
    if (
      dependencies.size !== result.dependencies.length ||
      result.dependencies.some(
        (owner) =>
          byKey.get(owner.key) !== owner || !entries.some((entry) => entry.owner === owner),
      )
    ) {
      return false;
    }
    const indices = result.dependencies.map((owner) =>
      owner === current
        ? frames.length - 1
        : frames.findIndex((frame) => frame.selected?.job === owner),
    );
    // A dependency outside the search frames cannot justify an ancestor jump.
    if (indices.length > 0 && indices.every((index) => index >= 0)) {
      const target = Math.max(...indices);
      if (target < frames.length - 1) {
        backjump = target;
      }
    }
    return true;
  };
  const attempt = (
    preferClear: boolean,
    { candidate, job }: Option<Kind>,
  ): "accepted" | "deferred" | "rejected" => {
    if (stopped()) {
      return "rejected";
    }
    backjump = undefined;
    const before = ports.checkpoint();
    if (stopped()) {
      return "rejected";
    }
    const result = ports.test(job, candidate);
    rejectedRule = result?.accepted === false ? result.failure.rule : undefined;
    budget ||= result === undefined;
    if (result?.accepted === false && result.failure.classification === "unattributed") {
      fatal = result.failure;
    }
    if (!stopped() && result?.accepted === true) {
      if (ports.minimumDelivery !== undefined && ports.entries().length === jobs.length) {
        fullCompletion = complete();
        if (fullCompletion) {
          return "accepted";
        }
        ports.restore(before);
        return "rejected";
      }
      if (preferClear && ports.laneClosure !== undefined) {
        const checked = ports.laneClosure();
        budget ||= checked === undefined;
        if (!stopped() && checked?.accepted === false) {
          // A later owner may repair this partial lane failure.
          ports.restore(before);
          return "deferred";
        }
      }
      if (stopped()) {
        ports.restore(before);
        return "rejected";
      }
      // Reuse only a native reattestation of the exact current conditional context.
      for (const proof of learned) {
        if (attest(proof, job)) {
          ports.restore(before);
          return "rejected";
        }
        if (stopped()) {
          ports.restore(before);
          return "rejected";
        }
      }
      const support = ports.support?.();
      budget ||= support?.status === "budget";
      if (support?.status === "fatal") {
        fatal = support.failure;
      }
      if (
        !stopped() &&
        support?.status === "refuted" &&
        support.proof !== undefined &&
        attest(support.proof, job)
      ) {
        learned.add(support.proof);
      }
      if (!stopped() && support?.status !== "refuted") {
        return "accepted";
      }
    }
    ports.restore(before);
    return "rejected";
  };
  const unfinished = (): SlotWitnessConstructResult<Kind> => {
    stopped();
    return fatal === undefined
      ? { status: budget ? "budget" : "inconclusive" }
      : { failure: fatal, status: "blocked" };
  };
  interface Frame {
    readonly before: Mark;
    readonly closureChecked: boolean;
    readonly covering: boolean;
    readonly initialCoverage?: true;
    readonly cursor: Generator<Choice<Kind>>;
    readonly deferred: Option<Kind>[];
    readonly job?: WitnessJob<Kind>;
    readonly omissions: readonly WitnessOmission<Kind>[];
    readonly pressure?: RowPressure<Kind>;
    omissionOffered: boolean;
    attempts: number;
    deferredIndex: number;
    selected?: Option<Kind>;
    sourceEnded: boolean;
  }
  const frames: Frame[] = [];
  try {
    const existing = present();
    const mandatory = jobs
      .map((job, index) => ({ index, job }))
      .filter(({ job }) => job.guaranteed && !existing.has(job.key))
      .map(({ index, job }) => ({ index, job, order: orderFor(job) }))
      .sort(
        (a, b) =>
          // Full motion envelopes order moving owners only; reactive alternatives remain native.
          (a.order.rank < 5 && b.order.rank < 5
            ? b.order.envelopeWidth - a.order.envelopeWidth
            : 0) ||
          a.order.rank - b.order.rank ||
          b.order.width - a.order.width ||
          a.index - b.index,
      );
    // Compiled nonblocking guarantees affect variable order only, never native admission facts.
    const nonblockingGuarantees = new Set(
      mandatory
        .filter(
          ({ order }) =>
            order.prepared.length > 0 &&
            order.prepared.every((prepared) => prepared.request.blocksLane === false),
        )
        .map(({ job }) => job),
    );
    const delayedForOrdering = (job: WitnessJob<Kind>) =>
      job.laneEffect === "none" || nonblockingGuarantees.has(job);
    function* choices(
      pressure: RowPressure<Kind> | undefined,
      job: WitnessJob<Kind>,
    ): Generator<Choice<Kind>> {
      if (stopped()) {
        return;
      }
      let repairRow: number | undefined;
      if (job.fixed && ports.repairRow !== undefined) {
        const advice = ports.repairRow();
        budget ||= advice.status === "budget";
        if (stopped()) {
          return;
        }
        repairRow = advice.status === "row" ? advice.row : undefined;
      }
      const scan = {
        ...(pressure === undefined ? {} : { pressure }),
        ...(repairRow === undefined ? {} : { repairRow }),
      };
      if (job.guaranteed) {
        const order = orderFor(job);
        yield* sourceOptions(
          { ...scan, columns: order.columns, rows: order.rows },
          job,
          order.prepared,
        );
      } else {
        yield* sourceOptions({ ...scan, rows: rowOrder(job) }, job, readPreparations(job));
      }
    }
    function* fixedCoverageChoices(filled: ReadonlySet<string>, leading: readonly number[]) {
      // Coverage owners retain their original priority independently of variable hardness.
      for (const job of jobs) {
        if (stopped()) {
          return;
        }
        if (job.fixed && !filled.has(job.key)) {
          yield* sourceOptions(
            { coverage: { filter: "anchored", leading }, rows: leading },
            job,
            readPreparations(job),
          );
        }
      }
    }
    function* coverageChoices(filled: ReadonlySet<string>, leading: readonly number[]) {
      yield* fixedCoverageChoices(filled, leading);
      if (ports.minimumDelivery !== undefined) {
        const ordinary: { job: WitnessJob<Kind>; sources: PreparedSlotKind<Kind>[] }[] = [];
        const deferred: Option<Kind>[] = [];
        for (const job of jobs) {
          if (!job.fixed && job.laneEffect !== "none" && !filled.has(job.key)) {
            if (!charge()) {
              return;
            }
            const sources: PreparedSlotKind<Kind>[] = [];
            ordinary.push({ job, sources });
            function* blockers() {
              const prepared = job.guaranteed ? orderFor(job).prepared : readPreparations(job);
              for (const source of prepared) {
                if (!charge()) {
                  return;
                }
                if (!source.herring && source.request.blocksLane) {
                  yield source;
                } else {
                  sources.push(source);
                }
              }
            }
            yield* sourceOptions(
              { coverage: { filter: "blocking", leading }, deferred, rows: rowOrder(job) },
              job,
              blockers(),
            );
          }
        }
        for (const option of deferred) {
          if (!charge()) {
            return;
          }
          yield { option, status: "candidate" as const };
        }
        for (const { job, sources } of ordinary) {
          if (!charge()) {
            return;
          }
          yield* sourceOptions(
            { coverage: { filter: "open", leading }, rows: rowOrder(job) },
            job,
            sources,
          );
        }
      }
    }
    // Static proportional order affect ordinary runtime choices, never native admission.
    let ordinaryOrder: readonly WitnessJob<Kind>[] | undefined;
    const balancedJobs = () => (ordinaryOrder ??= balancedJobOrder(charge, jobs));
    // Prefer one initial coverage owner before wide guarantees; all ordinary choices remain.
    let initialCoveragePending =
      ports.coverageFirst === true &&
      mandatory.some(({ job, order }) => !job.fixed && order.width > 1);
    // Runtime search orders each job's rows by occupancy pressure; exact construction keeps the
    // fixed row order its pocket proofs replay.
    const ordinaryFrame = (job: WitnessJob<Kind>) => {
      const pressure =
        ports.minimumDelivery === undefined
          ? undefined
          : { rejections: new Map<number, number>(), rows: new Map<SlotCandidate<Kind>, number>() };
      return {
        covering: false,
        cursor: choices(pressure, job),
        job,
        ...(pressure === undefined ? {} : { pressure }),
      };
    };
    const next = ():
      Pick<Frame, "covering" | "cursor" | "initialCoverage" | "job" | "pressure"> | undefined => {
      const filled = resolved();
      if (initialCoveragePending && frames.length === 0) {
        initialCoveragePending = false;
        const leading = leadingRows();
        if (leading?.includes(0)) {
          return {
            covering: true,
            cursor: fixedCoverageChoices(filled, leading),
            initialCoverage: true,
          };
        }
      }
      const guaranteed = mandatory.find(
        ({ job }) =>
          !filled.has(job.key) && (ports.minimumDelivery !== undefined || !delayedForOrdering(job)),
      );
      if (guaranteed !== undefined) {
        return ordinaryFrame(guaranteed.job);
      }
      const leading = leadingRows();
      if (leading !== undefined) {
        return { covering: true, cursor: coverageChoices(filled, leading) };
      }
      const ordinary =
        ports.minimumDelivery !== undefined && ports.ordinaryOrder === "balanced"
          ? balancedJobs()
          : jobs;
      if (ordinary === undefined) {
        return undefined;
      }
      const remaining = ordinary.filter((job) => !filled.has(job.key));
      const selected =
        ports.minimumDelivery !== undefined && ports.ordinaryOrder === "balanced"
          ? remaining[0]
          : (remaining.find((job) => !delayedForOrdering(job)) ??
            mandatory.find(({ job }) => !filled.has(job.key))?.job ??
            remaining[0]);
      if (selected !== undefined) {
        if (
          !closureChecked &&
          ports.laneClosure !== undefined &&
          remaining.every((job) => job.laneEffect === "none")
        ) {
          const checked = ports.laneClosure();
          budget ||= checked === undefined;
          if (checked?.accepted === false) {
            if (checked.failure.classification === "unattributed") {
              fatal = checked.failure;
            }
            if (checked.failure.rule === "open-stretches") {
              completionRule = checked.failure.rule;
              return undefined;
            }
          }
          if (stopped()) {
            return undefined;
          }
          closureChecked = true;
        }
        return ordinaryFrame(selected);
      }
      return undefined;
    };
    let descend = true;
    while (!stopped()) {
      yield;
      if (stopped()) {
        break;
      }
      if (descend && dominated()) {
        descend = false;
      }
      if (descend) {
        completionRule = undefined;
        if (ports.partial !== undefined && !stopped()) {
          budget ||= ports.partial(omitted()) === undefined;
        }
        const pending = dominated() ? undefined : next();
        if (stopped()) {
          break;
        }
        if (pending === undefined) {
          if (present().size === jobs.length && complete()) {
            const witness = [...ports.entries()];
            const coverageKey = frames.find((frame) => frame.covering)?.selected?.job.key;
            if (!stopped()) {
              return {
                ...(coverageKey === undefined ? {} : { coverageKey }),
                status: "compatible",
                witness,
              };
            }
          }
          // Native stretch failure is unchanged by these trailing nonblocking owners.
          if (completionRule === "open-stretches") {
            while (!stopped()) {
              const trailing = frames.at(-1);
              const selected = trailing?.selected;
              if (
                trailing === undefined ||
                trailing.covering ||
                selected === undefined ||
                byKey.get(selected.job.key) !== selected.job ||
                selected.job.laneEffect !== "none" ||
                selected.candidate.entry.request.blocksLane !== false
              ) {
                break;
              }
              frames.pop();
              trailing.cursor.return(undefined);
              ports.restore(trailing.before);
              closureChecked = trailing.closureChecked;
              restoreOmissions(trailing.omissions);
            }
          }
          descend = false;
        } else {
          frames.push({
            ...pending,
            attempts: 0,
            before: ports.checkpoint(),
            closureChecked,
            deferred: [],
            deferredIndex: 0,
            omissionOffered: false,
            omissions: omitted(),
            sourceEnded: false,
          });
        }
      }
      if (stopped()) {
        break;
      }
      const frame = frames.at(-1);
      if (frame === undefined) {
        break;
      }
      ports.restore(frame.before);
      closureChecked = frame.closureChecked;
      restoreOmissions(frame.omissions);
      descend = false;
      // The count bound discards an omission subtree, never a native domain alternative.
      if (dominated()) {
        frames.pop();
        frame.cursor.return(undefined);
        continue;
      }
      const omit = (reason: WitnessOmission<Kind>["reason"]) => {
        const job = frame.job;
        if (
          frame.omissionOffered ||
          job?.optional !== true ||
          job.guaranteed ||
          ports.minimumDelivery === undefined ||
          omissions.size >= jobs.length - ports.minimumDelivery
        ) {
          return false;
        }
        frame.omissionOffered = true;
        delete frame.selected;
        omissions.set(job, reason);
        descend = true;
        return true;
      };
      // Offer the omission once the request's own failed attempts reach the threshold, so its
      // domain is explored before the allowance is spent. The original cursor stays suspended
      // and retains every subsequent native value.
      if (frame.attempts >= omissionAttempts && omit("not-selected-within-allowance")) {
        continue;
      }
      let option: Option<Kind>;
      let preferClear = !frame.sourceEnded;
      let defer: (() => void) | undefined;
      if (frame.sourceEnded) {
        const deferred = frame.deferred[frame.deferredIndex++];
        if (deferred === undefined) {
          frame.deferred.length = 0;
          frame.deferredIndex = 0;
          frame.sourceEnded = false;
          continue;
        }
        option = deferred;
      } else {
        const value = frame.cursor.next();
        if (stopped()) {
          break;
        }
        if (value.done) {
          if (omit("domain-exhausted")) {
            continue;
          }
          frames.pop();
          if (frame.initialCoverage === true) {
            descend = true;
          }
          continue;
        }
        if (value.value.status === "source-end" || value.value.status === "tier-end") {
          frame.sourceEnded = true;
          continue;
        }
        option = value.value.option;
        if (value.value.continuation !== undefined) {
          preferClear = value.value.continuation.preferClear;
          defer = value.value.continuation.defer;
        }
      }
      frame.attempts++;
      rejectedRule = undefined;
      const admitted = attempt(preferClear, option);
      const pressuredRow = frame.pressure?.rows.get(option.candidate);
      if (
        admitted === "rejected" &&
        pressuredRow !== undefined &&
        rejectedRule !== undefined &&
        SLOT_ROW_PRESSURE.rules.has(rejectedRule)
      ) {
        frame.pressure!.rejections.set(
          pressuredRow,
          (frame.pressure!.rejections.get(pressuredRow) ?? 0) + 1,
        );
      }
      if (backjump !== undefined && !stopped()) {
        while (frames.length - 1 > backjump) {
          const abandoned = frames.pop()!;
          abandoned.cursor.return(undefined);
          ports.restore(abandoned.before);
          closureChecked = abandoned.closureChecked;
          restoreOmissions(abandoned.omissions);
        }
        backjump = undefined;
        continue;
      }
      if (admitted === "deferred") {
        if (defer !== undefined) {
          defer();
        } else {
          frame.deferred.push(option);
        }
      } else if (admitted === "accepted") {
        frame.selected = option;
        if (fullCompletion) {
          const witness = [...ports.entries()];
          const coverageKey = frames.find((current) => current.covering)?.selected?.job.key;
          if (!stopped()) {
            return {
              ...(coverageKey === undefined ? {} : { coverageKey }),
              status: "compatible",
              witness,
            };
          }
        }
        if (
          option.job.laneEffect !== "none" ||
          option.candidate.entry.request.blocksLane !== false
        ) {
          closureChecked = false;
        }
        descend = true;
      }
    }
    return unfinished();
  } finally {
    try {
      for (let index = frames.length - 1; index >= 0; index--) {
        frames[index]!.cursor.return(undefined);
      }
    } finally {
      ports.restore(root);
    }
  }
}
