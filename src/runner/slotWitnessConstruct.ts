import type { SlotCandidate } from "./slotCandidateDomains.ts";
import type { PreparedSlotKind } from "./slotCandidates.ts";
import { SLOT_ROW_PRESSURE } from "./slotDelivery.ts";
import { drainSlotSolver } from "./slotSolverSession.ts";
import type {
  Choice,
  Option,
  Rejection,
  RowPressure,
  SlotWitnessBudget,
  SlotWitnessConstructPorts,
  SlotWitnessConstructResult,
} from "./slotWitnessConstructTypes.ts";
import { createWitnessCoverage } from "./slotWitnessCoverage.ts";
import { createWitnessJobOrdering, type JobOrder } from "./slotWitnessJobOrder.ts";
import { createWitnessSourceOptions } from "./slotWitnessOptions.ts";
import { balancedJobOrder } from "./slotWitnessOrder.ts";
import type { WitnessJob, WitnessOmission } from "./slotWitnessSearch.ts";
import type { PlannedSpawns, SpawnPlan } from "./spawning.ts";

export type {
  SlotWitnessConstructPorts,
  SlotWitnessConstructResult,
} from "./slotWitnessConstructTypes.ts";

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

function* construct<Kind extends string, Mark>(
  ports: SlotWitnessConstructPorts<Kind, Mark>,
  geometry: Omit<SpawnPlan<Kind>, "quotas">,
  path: PlannedSpawns<Kind>["path"],
  metadata: WeakMap<WitnessJob<Kind>, JobOrder<Kind>>,
  jobs: readonly WitnessJob<Kind>[],
): Generator<void, SlotWitnessConstructResult<Kind>, void> {
  if (ports.stopped()) {
    return { status: "budget" };
  }
  const root = ports.checkpoint();
  const byKey = new Map(jobs.map((job) => [job.key, job]));
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
    budget ||= ports.stopped();
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
  const work: SlotWitnessBudget = {
    charge,
    exhaust: () => {
      budget = true;
    },
    stopped,
  };
  const coverage = createWitnessCoverage(ports, work, geometry);
  const ordering = createWitnessJobOrdering(ports, work, geometry, path, metadata);
  const { orderFor, readPreparations, rowOrder } = ordering;
  const { leadingRows } = coverage;
  const sourceOptions = createWitnessSourceOptions(ports, work, coverage, ordering);
  const present = () => new Set(stopped() ? [] : ports.entries().map(({ owner }) => owner.key));
  const resolved = () => new Set([...present(), ...[...omissions.keys()].map((job) => job.key)]);
  const dominated = () => {
    const best = ports.bestDelivery();
    return best !== undefined && jobs.length - omissions.size <= best;
  };
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
  // The native rule that rejected the latest tested value, if any.
  let rejectedRule: string | undefined;
  let fullCompletion = false;
  const attempt = (
    preferClear: boolean,
    { candidate, job }: Option<Kind>,
  ): "accepted" | "deferred" | "rejected" => {
    if (stopped()) {
      return "rejected";
    }
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
      if (ports.entries().length === jobs.length) {
        fullCompletion = complete();
        if (fullCompletion) {
          return "accepted";
        }
        ports.restore(before);
        return "rejected";
      }
      if (preferClear) {
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
      return "accepted";
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
    function* choices(
      pressure: RowPressure<Kind> | undefined,
      job: WitnessJob<Kind>,
    ): Generator<Choice<Kind>> {
      if (stopped()) {
        return;
      }
      let repairRow: number | undefined;
      if (job.fixed) {
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
    // Static proportional order affect ordinary runtime choices, never native admission.
    let ordinaryOrder: readonly WitnessJob<Kind>[] | undefined;
    const balancedJobs = () => (ordinaryOrder ??= balancedJobOrder(charge, jobs));
    // Prefer one initial coverage owner before wide guarantees; all ordinary choices remain.
    let initialCoveragePending = mandatory.some(({ job, order }) => !job.fixed && order.width > 1);
    // Each ordinary frame orders its job's rows by occupancy pressure.
    const ordinaryFrame = (job: WitnessJob<Kind>) => {
      const pressure = {
        rejections: new Map<number, number>(),
        rows: new Map<SlotCandidate<Kind>, number>(),
      };
      return { covering: false, cursor: choices(pressure, job), job, pressure };
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
      const guaranteed = mandatory.find(({ job }) => !filled.has(job.key));
      if (guaranteed !== undefined) {
        return ordinaryFrame(guaranteed.job);
      }
      const leading = leadingRows();
      if (leading !== undefined) {
        return { covering: true, cursor: coverageChoices(filled, leading) };
      }
      const ordinary = ports.ordinaryOrder === "balanced" ? balancedJobs() : jobs;
      if (ordinary === undefined) {
        return undefined;
      }
      const remaining = ordinary.filter((job) => !filled.has(job.key));
      // Every guarantee is placed by now; the original order delays jobs with no lane effect.
      const selected =
        ports.ordinaryOrder === "balanced"
          ? remaining[0]
          : (remaining.find((job) => job.laneEffect !== "none") ?? remaining[0]);
      if (selected !== undefined) {
        if (!closureChecked && remaining.every((job) => job.laneEffect === "none")) {
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
        if (!stopped()) {
          budget ||= ports.partial(omitted()) === undefined;
        }
        const pending = dominated() ? undefined : next();
        if (stopped()) {
          break;
        }
        if (pending === undefined) {
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
      if (frame.attempts >= ports.omissionAttempts && omit("not-selected-within-allowance")) {
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
