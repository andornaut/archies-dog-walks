import { weightedPick } from "@andornaut/game-kit/random";

import { auditSlotPartialPlan, auditSlotPlan, type SlotAudit } from "./slotAudit";
import { createSlotCandidateDomains } from "./slotCandidateDomains";
import {
  isNativeSlotPreparation,
  type PreparedSlotKind,
  prepareSlotKindWithin,
} from "./slotCandidates";
import {
  type SlotConfiguration,
  slotConfigurationFailures,
  slotCountTotal,
  type SlotFailure,
  type SlotKind,
  type SlotLimits,
  type SlotSource,
} from "./slotConfig";
import { createSlotConstructionState } from "./slotConstraintState";
import {
  describeSlotDelivery,
  minimumSlotDelivery,
  type SlotDelivery,
  type SlotDeliveryPolicy,
  type SlotOmission,
  type SlotPartialAudit,
} from "./slotDelivery";
import { slotMotionStreams, slotRandom } from "./slotEntropy";
import { makeSlotJobs, type SlotJob } from "./slotJobs";
import { guaranteeCompatiblePath } from "./slotPath";
import { materialisePartialSlotPlan, materialiseSlotPlan, type SlotAssignment } from "./slotPlan";
import { createSlotPocketAdapter } from "./slotPocketAdapter";
import {
  createSlotWitnessSearch,
  type WitnessJob,
  type WitnessOmission,
  type WitnessSelection,
  type WitnessWork,
} from "./slotWitnessSearch";
import {
  drawPath,
  type PlannedSpawns,
  rowSpacing,
  type SpawnPlan,
  type SpawnQuota,
  zoneRows,
} from "./spawning";

export const SLOT_LIMITS: SlotLimits = {
  anchors: 32768,
  candidateChecks: 32768,
  compiledTemplates: 65536,
  slots: 512,
};
export interface SlotPlanningContext {
  readonly seed: number;
  readonly zoneIndex: number;
  readonly limits: SlotLimits;
  readonly runtimeSearch?: "original-then-balanced";
  // CLEANUP (added 2026-11-02): remove runtime-90 after all required contexts reach 100% within the allowance.
  readonly delivery?: SlotDeliveryPolicy;
  // CLEANUP (added 2026-11-02): remove if fair-source exploration is declined.
  readonly fairSources?: boolean;
  // CLEANUP (added 2026-11-02): remove if the initial coverage ordering experiment is declined.
  readonly coverageFirst?: boolean;
  // CLEANUP (added 2026-11-03): remove this comparison switch after original-draw ordering qualification.
  readonly originalDrawsFirst?: boolean;
}
export interface SlotAttemptDiagnostics {
  readonly candidateChecks: number;
  // The attempt's own work when it first held a layout meeting the delivery floor.
  readonly firstFloor?: { readonly candidateChecks: number; readonly propagationChecks: number };
  readonly ordering: "original" | "balanced";
  readonly propagationChecks: number;
  // Whether the attempt restarted with the reserve omission threshold (SLOT_OMISSION_RESERVE).
  readonly reserveRestart: boolean;
  readonly status: "compatible" | "partial" | "blocked" | "budget";
}
export interface SlotDiagnostics {
  readonly attempts?: readonly SlotAttemptDiagnostics[];
  readonly activeCommits: number;
  readonly anchors: number;
  readonly candidateChecks: number;
  readonly audits: number;
  readonly certificateTemplates: number;
  readonly commits: number;
  readonly compiledTemplates: number;
  readonly profileCompiles: number;
  readonly propagationChecks: number;
  readonly rejections: Readonly<Record<string, number>>;
}
export interface SlotCertificate<Kind extends string> {
  readonly assignments: readonly SlotAssignment<Kind>[];
  readonly audit: SlotAudit;
  readonly phase: "active" | "capacity";
  readonly plan: SpawnPlan<Kind>;
  readonly planned: PlannedSpawns<Kind>;
}
interface SlotCompositionComplete<Kind extends string> {
  readonly status: "complete";
  readonly plan: SpawnPlan<Kind>;
  readonly planned: PlannedSpawns<Kind>;
  readonly assignments: readonly SlotAssignment<Kind>[];
  readonly diagnostics: SlotDiagnostics;
}
export type SlotPlanningFailure<Kind extends string> = {
  readonly status: "unsupported";
  readonly stage: "configuration" | "construction" | "invariant";
  readonly certificates?: readonly SlotCertificate<Kind>[];
  readonly provisional?: {
    readonly assignments: readonly SlotAssignment<Kind>[];
    readonly path: PlannedSpawns<Kind>["path"];
  };
  readonly failures: readonly SlotFailure<Kind>[];
  readonly delivered: number;
  readonly diagnostics: SlotDiagnostics;
};
interface SlotCompositionPartial<Kind extends string> {
  readonly status: "partial";
  readonly plan: SpawnPlan<Kind>;
  readonly planned: PlannedSpawns<Kind>;
  readonly assignments: readonly SlotAssignment<Kind>[];
  readonly diagnostics: SlotDiagnostics;
  readonly delivery: SlotDelivery<Kind>;
  readonly partialAudit: SlotPartialAudit<Kind>;
}
export type SlotPlanningResult<Kind extends string> =
  | (SlotCompositionComplete<Kind> & {
      readonly activeAudit: SlotAudit;
      readonly delivery: SlotDelivery<Kind>;
    })
  | SlotCompositionPartial<Kind>
  | SlotPlanningFailure<Kind>;
export type SlotCapacityResult<Kind extends string> =
  | (SlotCompositionComplete<Kind> & { readonly capacityAudit: SlotAudit })
  | SlotPlanningFailure<Kind>;
type SlotCompositionResult<Kind extends string> =
  | (SlotCompositionComplete<Kind> & {
      readonly audit: SlotAudit;
      readonly delivery: SlotDelivery<Kind>;
    })
  | SlotCompositionPartial<Kind>
  | SlotPlanningFailure<Kind>;

export class SlotPlanningError<Kind extends string> extends Error {
  constructor(
    readonly result: Extract<SlotPlanningResult<Kind>, { readonly status: "unsupported" }>,
  ) {
    super(`Unsupported slot configuration (${result.stage}): ${JSON.stringify(result.failures)}`);
    this.name = "SlotPlanningError";
  }
}

// Runtime emits only an independently audited actual composition.
export function planSlotSpawns<Kind extends string>(
  context: SlotPlanningContext,
  geometry: Omit<SpawnPlan<Kind>, "quotas">,
  catalogue: readonly SlotKind<Kind>[],
  auxiliary: readonly SpawnQuota<Kind>[],
  config: SlotConfiguration<Kind>,
): SlotPlanningResult<Kind> {
  const result = planSlotComposition("active", context, geometry, catalogue, auxiliary, config);
  if (result.status !== "complete") {
    return result;
  }
  const { audit, ...complete } = result;
  return { ...complete, activeAudit: audit };
}

// Offline capacity certification constructs a separate maximum composition from an empty root.
export function planSlotCapacity<Kind extends string>(
  context: SlotPlanningContext,
  geometry: Omit<SpawnPlan<Kind>, "quotas">,
  catalogue: readonly SlotKind<Kind>[],
  auxiliary: readonly SpawnQuota<Kind>[],
  config: SlotConfiguration<Kind>,
): SlotCapacityResult<Kind> {
  const result = planSlotComposition("capacity", context, geometry, catalogue, auxiliary, config);
  if (result.status === "unsupported") {
    return result;
  }
  if (result.status === "partial") {
    throw new Error("Independent capacity construction must remain exact");
  }
  return {
    assignments: result.assignments,
    capacityAudit: result.audit,
    diagnostics: result.diagnostics,
    plan: result.plan,
    planned: result.planned,
    status: "complete",
  };
}

function planSlotComposition<Kind extends string>(
  purpose: "active" | "capacity",
  context: SlotPlanningContext,
  geometry: Omit<SpawnPlan<Kind>, "quotas">,
  catalogue: readonly SlotKind<Kind>[],
  auxiliary: readonly SpawnQuota<Kind>[],
  config: SlotConfiguration<Kind>,
): SlotCompositionResult<Kind> {
  const policy = purpose === "active" ? (context.delivery ?? "exact") : "exact";
  const optionalDelivery = policy === "runtime-90";
  const portfolio = optionalDelivery && context.runtimeSearch === "original-then-balanced";
  const limits =
    context.runtimeSearch !== undefined && !optionalDelivery
      ? {
          ...context.limits,
          candidateChecks: Math.min(context.limits.candidateChecks, SLOT_LIMITS.candidateChecks),
        }
      : context.limits;
  const attempts: SlotAttemptDiagnostics[] = [];
  let attemptStart = { candidateChecks: 0, propagationChecks: 0 };
  let attemptFloor: SlotAttemptDiagnostics["firstFloor"];
  let attemptRestarted = false;
  let attemptStopped = false;
  const assignments: SlotAssignment<Kind>[] = [];
  let path: PlannedSpawns<Kind>["path"] = [];
  const stats = {
    activeCommits: 0,
    anchors: 0,
    audits: 0,
    candidateChecks: 0,
    certificateTemplates: 0,
    commits: 0,
    compiledTemplates: 0,
    profileCompiles: 0,
    propagationChecks: 0,
    rejections: {} as Record<string, number>,
  };
  const diagnostics = (): SlotDiagnostics => ({
    ...stats,
    ...(portfolio ? { attempts: [...attempts] } : {}),
    rejections: { ...stats.rejections },
  });
  const unsupported = (
    stage: "configuration" | "construction" | "invariant",
    failures: readonly SlotFailure<Kind>[],
    certificates?: readonly SlotCertificate<Kind>[],
  ): Extract<SlotPlanningResult<Kind>, { status: "unsupported" }> => ({
    ...(certificates === undefined ? {} : { certificates }),
    ...(path.length === 0 ? {} : { provisional: { assignments: [...assignments], path } }),
    delivered: stats.activeCommits,
    diagnostics: diagnostics(),
    failures,
    stage,
    status: "unsupported",
  });
  const failures = slotConfigurationFailures(catalogue, limits, config);
  if (context.runtimeSearch !== undefined && context.runtimeSearch !== "original-then-balanced") {
    failures.push({ code: "invalid-runtime-search" });
  }
  if (
    context.runtimeSearch !== undefined &&
    (limits.candidateChecks > 2 * SLOT_LIMITS.candidateChecks ||
      limits.anchors > SLOT_LIMITS.anchors ||
      limits.compiledTemplates > SLOT_LIMITS.compiledTemplates ||
      limits.slots > SLOT_LIMITS.slots)
  ) {
    failures.push({ code: "portfolio-work-limit" });
  }
  if (policy !== "exact" && policy !== "runtime-90") {
    failures.push({ code: "invalid-delivery-policy" });
  }
  const auxiliaryTotal = auxiliary.reduce((total, request) => total + request.count, 0);
  if (auxiliary.some((request) => !Number.isSafeInteger(request.count) || request.count < 0)) {
    failures.push({ code: "invalid-auxiliary-count" });
  }
  if (
    Number.isSafeInteger(auxiliaryTotal) &&
    slotCountTotal(config.capacity) + auxiliaryTotal > limits.slots
  ) {
    failures.push({
      available: limits.slots,
      code: "slot-limit",
      required: slotCountTotal(config.capacity) + auxiliaryTotal,
    });
  }
  if (auxiliary.some((request) => request.hazard ?? request.blocksLane)) {
    failures.push({ code: "hazard-in-auxiliary-budget" });
  }
  if (
    !Number.isSafeInteger(context.seed) ||
    context.seed < 0 ||
    context.seed > 0xffffffff ||
    !Number.isSafeInteger(context.zoneIndex) ||
    context.zoneIndex < 0
  ) {
    failures.push({ code: "invalid-seed-context" });
  }
  if (failures.length) {
    return unsupported("configuration", failures);
  }
  const base: SpawnPlan<Kind> = { ...geometry, quotas: [] };
  let spacing: number;
  try {
    spacing = rowSpacing(base);
  } catch {
    return unsupported("configuration", [{ code: "invalid-row-grid" }]);
  }
  if (
    !Number.isFinite(spacing) ||
    spacing <= 0 ||
    !Number.isFinite(geometry.zoneLength) ||
    geometry.zoneLength <= 0 ||
    !Number.isFinite(geometry.sightLength) ||
    geometry.sightLength < 0
  ) {
    return unsupported("configuration", [{ code: "invalid-row-grid" }]);
  }
  const rowBound =
    Math.ceil(geometry.zoneLength / spacing) + Math.ceil(geometry.sightLength / spacing) + 2;
  if (rowBound > limits.anchors) {
    return unsupported("configuration", [
      { available: limits.anchors, code: "grid-work-limit", required: rowBound },
    ]);
  }
  const rows = zoneRows(base, spacing);
  if (rows.length === 0 || rows.length > limits.anchors) {
    return unsupported("configuration", [
      { available: limits.anchors, code: "row-grid-limit", required: rows.length },
    ]);
  }
  const invalidFootprint = catalogue.find(
    (source) => source.footprint.lanes > geometry.laneCount || source.footprint.rows > rows.length,
  );
  if (invalidFootprint !== undefined) {
    return unsupported("configuration", [
      { code: "footprint-does-not-fit", kind: invalidFootprint.kind, role: invalidFootprint.role },
    ]);
  }
  const fork = (name: string) => slotRandom(context, name);
  const pathDraws: number[] = [];
  const pathRandom = fork("path");
  const pathLanes = drawPath(
    {
      movers: () => {
        const value = pathRandom();
        pathDraws.push(value);
        return value;
      },
      spawns: fork("path-reserved"),
    },
    base,
    rows.length,
  );
  path = rows.map((distance, row) => ({ distance, lane: pathLanes[row]! }));
  if (
    geometry.maxEmptyRows !== Infinity &&
    (!Number.isSafeInteger(geometry.maxEmptyRows) || geometry.maxEmptyRows < 0)
  ) {
    return unsupported("configuration", [{ code: "invalid-quiet-row-limit" }]);
  }
  const composition = { ...config, active: purpose === "active" ? config.active : config.capacity };
  const originalJobs = makeSlotJobs(catalogue, auxiliary, composition);
  const guarantees = originalJobs.filter((job) => job.guaranteed === true);
  const preparedCache = new Map<string, PreparedSlotKind<Kind>>();
  let workFailure: Extract<SlotPlanningResult<Kind>, { status: "unsupported" }> | undefined;
  const finishWorkFailure = () =>
    workFailure === undefined ? undefined : { ...workFailure, diagnostics: diagnostics() };
  const prepareSource = (
    job: SlotJob<Kind>,
    source: SlotSource<Kind>,
  ): PreparedSlotKind<Kind> | undefined => {
    if (workFailure !== undefined || attemptStopped) {
      return undefined;
    }
    const key = `${job.key}:${source.kind}`;
    const cached = preparedCache.get(key);
    if (cached !== undefined) {
      return cached;
    }
    if (stats.compiledTemplates >= limits.compiledTemplates) {
      workFailure = unsupported("construction", [
        {
          available: limits.compiledTemplates,
          code: "template-budget",
          kind: source.kind,
          role: job.role,
        },
      ]);
      return undefined;
    }
    try {
      const before = stats.compiledTemplates;
      stats.profileCompiles++;
      const prepared = prepareSlotKindWithin(
        {
          template() {
            if (stats.compiledTemplates >= limits.compiledTemplates) {
              return false;
            }
            stats.compiledTemplates++;
            return true;
          },
        },
        slotMotionStreams(context, job.key, source.kind),
        geometry,
        source,
      );
      if (prepared.status === "budget") {
        workFailure = unsupported("construction", [
          {
            available: limits.compiledTemplates,
            code: "template-budget",
            kind: source.kind,
            role: job.role,
          },
        ]);
        return undefined;
      }
      const option = prepared.prepared;
      if (
        stats.compiledTemplates > limits.compiledTemplates ||
        stats.compiledTemplates - before !== option.compiledCount
      ) {
        workFailure = unsupported("invariant", [{ code: "template-accounting" }]);
        return undefined;
      }
      preparedCache.set(key, option);
      return option;
    } catch {
      workFailure = unsupported("configuration", [
        { code: "invalid-profile", kind: source.kind, role: job.role },
      ]);
      return undefined;
    }
  };
  const mandatory = [];
  for (const job of guarantees) {
    for (const source of job.sources) {
      const prepared = prepareSource(job, source);
      if (prepared === undefined) {
        return finishWorkFailure()!;
      }
      mandatory.push({ ordinal: job.ordinal, prepared, total: job.total });
    }
  }
  const pathBudget = (type: "anchors" | "candidateChecks") => {
    if (workFailure !== undefined || attemptStopped) {
      return false;
    }
    if (stats[type] >= limits[type]) {
      workFailure ??= unsupported("construction", [
        {
          available: limits[type],
          code: type === "anchors" ? "anchor-budget" : "candidate-budget",
        },
      ]);
      return false;
    }
    if (
      portfolio &&
      type === "candidateChecks" &&
      stats[type] - attemptStart[type] >= SLOT_LIMITS.candidateChecks
    ) {
      attemptStopped = true;
      return false;
    }
    stats[type]++;
    return true;
  };
  const conditioned = guaranteeCompatiblePath(geometry, path, pathDraws, mandatory, {
    anchor: () => pathBudget("anchors"),
    check: () => pathBudget("candidateChecks"),
  });
  if (workFailure !== undefined) {
    return finishWorkFailure()!;
  }
  if (attemptStopped) {
    return unsupported("construction", [
      { available: SLOT_LIMITS.candidateChecks, code: "candidate-attempt-budget" },
    ]);
  }
  if (conditioned.failedKind !== undefined) {
    return unsupported("construction", [
      { code: "guarantee-path-domain", kind: conditioned.failedKind },
    ]);
  }
  path = conditioned.path;
  const domains = createSlotCandidateDomains(geometry, path, {
    negativeVisibility: !optionalDelivery,
  });
  const layouts = new Map<string, number>();
  const sourceOrders = new Map<SlotJob<Kind>, readonly SlotSource<Kind>[]>();
  const orderSources = (job: SlotJob<Kind>) => {
    let ordered = sourceOrders.get(job);
    if (ordered === undefined) {
      const remaining = [...job.sources];
      const values: SlotSource<Kind>[] = [];
      const draw = fork(`${job.key}-source-order`);
      while (remaining.length > 0) {
        const selected = weightedPick(
          draw,
          remaining,
          remaining.map((source) => source.weight),
        );
        values.push(selected);
        remaining.splice(remaining.indexOf(selected), 1);
      }
      ordered = Object.freeze(values);
      sourceOrders.set(job, ordered);
    }
    return ordered;
  };
  const witnessJobs: WitnessJob<Kind>[] = originalJobs.map((job) => ({
    columnPick: () => {
      let draw = layouts.get(job.key);
      if (draw === undefined) {
        draw = fork(`${job.key}-layout`)();
        layouts.set(job.key, draw);
      }
      return draw;
    },
    fixed: job.role === "encounterFixed" || job.role === "minorFixed",
    guaranteed: job.guaranteed === true,
    key: job.key,
    laneEffect: job.laneEffect,
    ...(optionalDelivery && !job.guaranteed ? { optional: true as const } : {}),
    ordinal: job.ordinal,
    phase: job.phase,
    *preparations() {
      if (workFailure !== undefined || attemptStopped) {
        return;
      }
      for (const source of orderSources(job)) {
        const prepared = prepareSource(job, source);
        if (prepared === undefined) {
          return;
        }
        yield prepared;
      }
    },
    total: job.total,
  }));
  const witnessByKey = new Map(witnessJobs.map((job) => [job.key, job]));
  const sourceByKey = new Map(originalJobs.map((job) => [job.key, job]));
  const bind = (
    selected: readonly WitnessSelection<Kind>[],
  ): SlotAssignment<Kind>[] | undefined => {
    const ledger: SlotAssignment<Kind>[] = [];
    for (const value of selected) {
      const job = sourceByKey.get(value.job.key),
        source = value.candidate.prepared.source;
      if (
        job === undefined ||
        witnessByKey.get(job.key) !== value.job ||
        value.owner !== value.job ||
        !job.sources.includes(source) ||
        source.role !== job.role ||
        value.entry.trace.quotaIndex !== ledger.length ||
        value.entry.trace.memberIndex !== 0 ||
        value.entry.event !== value.candidate.entry.event ||
        value.entry.request !== value.candidate.entry.request ||
        value.entry.placement !== value.candidate.entry.placement
      ) {
        return undefined;
      }
      ledger.push({
        ...(job.auxiliary === undefined ? {} : { auxiliary: job.auxiliary }),
        binding: { kind: source.kind, role: source.role, weight: source.weight },
        entry: value.entry,
        key: job.key,
        phase: job.phase,
        role: job.role,
      });
    }
    return ledger;
  };
  const bindOmissions = (
    missing: readonly WitnessOmission<Kind>[],
  ): readonly SlotOmission<Kind>[] | undefined => {
    const omitted: SlotOmission<Kind>[] = [];
    for (const value of missing) {
      const job = sourceByKey.get(value.job.key);
      if (job === undefined || witnessByKey.get(job.key) !== value.job || job.guaranteed) {
        return undefined;
      }
      const kinds = new Set(job.sources.map((source) => source.kind));
      omitted.push(
        Object.freeze({
          ...(job.auxiliary === undefined ? {} : { auxiliary: job.auxiliary }),
          ...(kinds.size === 1 ? { kind: job.sources[0]!.kind } : {}),
          key: job.key,
          reason: value.reason,
          role: job.role,
        }),
      );
    }
    return Object.freeze(omitted);
  };
  const certifyPartial = (
    missing: readonly SlotOmission<Kind>[],
    ledger: readonly SlotAssignment<Kind>[],
  ) => {
    const audit = auditSlotPartialPlan(
      context,
      geometry,
      path,
      catalogue,
      auxiliary,
      config,
      missing,
      ledger,
    );
    stats.audits++;
    stats.certificateTemplates += audit.compiledTemplates;
    return audit;
  };
  const certify = (phase: "active" | "capacity", ledger: readonly SlotAssignment<Kind>[]) => {
    const audit = auditSlotPlan(
      context,
      geometry,
      path,
      catalogue,
      auxiliary,
      config,
      phase,
      ledger,
    );
    stats.audits++;
    stats.certificateTemplates += audit.compiledTemplates;
    return audit;
  };
  const certificate = (
    phase: "active" | "capacity",
    audit: SlotAudit,
    ledger: readonly SlotAssignment<Kind>[],
  ): SlotCertificate<Kind> => ({
    ...materialiseSlotPlan(geometry, path, ledger),
    assignments: ledger,
    audit,
    phase,
  });
  const meter = {
    anchor: () => pathBudget("anchors"),
    check: () => pathBudget("candidateChecks"),
    progress: () => {
      const allowance = portfolio ? SLOT_LIMITS.candidateChecks : limits.candidateChecks;
      const share = (type: "candidateChecks" | "propagationChecks") => {
        const used = stats[type] - attemptStart[type];
        const remaining = Math.max(
          0,
          Math.min(allowance - used, limits.candidateChecks - stats[type]),
        );
        return used + remaining === 0 ? 1 : used / (used + remaining);
      };
      return Math.max(share("candidateChecks"), share("propagationChecks"));
    },
    propagate: () => {
      if (workFailure !== undefined || attemptStopped) {
        return false;
      }
      if (stats.propagationChecks >= limits.candidateChecks) {
        workFailure = unsupported("construction", [
          { available: limits.candidateChecks, code: "propagation-budget" },
        ]);
        return false;
      }
      if (
        portfolio &&
        stats.propagationChecks - attemptStart.propagationChecks >= SLOT_LIMITS.candidateChecks
      ) {
        attemptStopped = true;
        return false;
      }
      stats.propagationChecks++;
      return true;
    },
    stopped: () => workFailure !== undefined || attemptStopped,
  };
  const contextShape = () => {
    try {
      return JSON.stringify([geometry, path], (_key, value: unknown) =>
        typeof value === "number" && !Number.isFinite(value) ? { numeric: String(value) } : value,
      );
    } catch {
      return undefined;
    }
  };
  if (portfolio && !meter.propagate()) {
    return (
      finishWorkFailure() ?? unsupported("construction", [{ code: "propagation-attempt-budget" }])
    );
  }
  const origin = portfolio ? contextShape() : undefined;
  if (portfolio && origin === undefined) {
    return unsupported("invariant", [{ code: "changed-portfolio-context" }]);
  }
  // Necessary row support shares the native solve allowance and runs only on unsafe prefixes.
  const pocket = createSlotPocketAdapter(meter, geometry, path, domains, witnessJobs);
  const work: WitnessWork<Kind> = {
    ...(optionalDelivery
      ? {
          certifyPartial(
            selected: readonly WitnessSelection<Kind>[],
            missing: readonly WitnessOmission<Kind>[],
          ) {
            const ledger = bind(selected),
              omissions = bindOmissions(missing);
            if (ledger === undefined || omissions === undefined) {
              workFailure = unsupported("invariant", [{ code: "missing-selected-source" }]);
              return false;
            }
            const audit = certifyPartial(omissions, ledger);
            if (audit.status !== "valid" && audit.failure === "invariant") {
              workFailure = unsupported("invariant", [{ code: "partial-slot-audit" }]);
            }
            return audit.status === "valid";
          },
          minimumDelivery: minimumSlotDelivery(policy, originalJobs.length),
        }
      : {
          attestRefutation: (state, proof) => pocket.attestRefutation(state, proof),
          support: (state) => pocket.check(state, "active"),
        }),
    ...meter,
    coverageFirst: context.coverageFirst === true,
    fairSources: context.fairSources === true,
    floorMet() {
      attemptFloor ??= {
        candidateChecks: stats.candidateChecks - attemptStart.candidateChecks,
        propagationChecks: stats.propagationChecks - attemptStart.propagationChecks,
      };
    },
    originalDrawsFirst: context.originalDrawsFirst !== false,
    rejected(candidate, failure) {
      const key = `${candidate.prepared.source.kind}:${failure.rule}`;
      stats.rejections[key] = (stats.rejections[key] ?? 0) + 1;
    },
    reserveRestarted() {
      attemptRestarted = true;
    },
  };
  const recordAttempt = (
    ordering: "original" | "balanced",
    status: SlotAttemptDiagnostics["status"],
  ) => {
    if (portfolio) {
      attempts.push({
        candidateChecks: stats.candidateChecks - attemptStart.candidateChecks,
        ...(attemptFloor === undefined ? {} : { firstFloor: attemptFloor }),
        ordering,
        propagationChecks: stats.propagationChecks - attemptStart.propagationChecks,
        reserveRestart: attemptRestarted,
        status,
      });
    }
    attemptFloor = undefined;
    attemptRestarted = false;
  };
  const solve = (ordering: "original" | "balanced") => {
    const board = createSlotConstructionState(geometry, path);
    const result = createSlotWitnessSearch(geometry, path, domains, witnessJobs, {
      ...work,
      ordinaryOrder: ordering,
    }).solve(board);
    recordAttempt(ordering, result.status);
    return result;
  };
  let solved = solve("original");
  if (
    portfolio &&
    workFailure === undefined &&
    solved.status !== "compatible" &&
    solved.status !== "partial" &&
    !(solved.status === "blocked" && solved.failure?.classification === "unattributed")
  ) {
    attemptStart = {
      candidateChecks: stats.candidateChecks,
      propagationChecks: stats.propagationChecks,
    };
    attemptStopped = false;
    if (meter.propagate() && contextShape() !== origin) {
      workFailure = unsupported("invariant", [{ code: "changed-portfolio-context" }]);
    }
    for (const prepared of preparedCache.values()) {
      if (!meter.propagate()) {
        break;
      }
      if (!isNativeSlotPreparation(prepared)) {
        workFailure = unsupported("invariant", [{ code: "stale-prepared-source" }]);
        break;
      }
    }
    if (!meter.stopped()) {
      solved = solve("balanced");
    } else {
      recordAttempt("balanced", workFailure?.stage === "invariant" ? "blocked" : "budget");
    }
  }
  const finalWorkFailure = finishWorkFailure();
  if (
    finalWorkFailure !== undefined &&
    !(
      solved.status === "partial" &&
      stats.compiledTemplates <= limits.compiledTemplates &&
      finalWorkFailure.stage === "construction" &&
      finalWorkFailure.failures.every(({ code }) =>
        ["anchor-budget", "candidate-budget", "propagation-budget", "template-budget"].includes(
          code,
        ),
      )
    )
  ) {
    return finalWorkFailure;
  }
  if (solved.status === "partial") {
    const selected = bind(solved.selections),
      omissions = bindOmissions(solved.omissions);
    if (selected === undefined || omissions === undefined) {
      return unsupported("invariant", [{ code: "missing-selected-source" }]);
    }
    assignments.push(...selected);
    stats.commits = assignments.length;
    const partialAudit = certifyPartial(omissions, assignments);
    if (partialAudit.status !== "valid") {
      return unsupported("invariant", [{ code: "final-partial-slot-audit" }]);
    }
    stats.activeCommits = assignments.length;
    return {
      ...materialisePartialSlotPlan(geometry, path, partialAudit.delivery, assignments),
      assignments,
      delivery: partialAudit.delivery,
      diagnostics: diagnostics(),
      partialAudit,
      status: "partial",
    };
  }
  if (solved.status !== "compatible") {
    return unsupported("construction", [
      {
        code:
          solved.status === "blocked"
            ? (solved.failure?.rule ?? "bounded-joint-construction")
            : "bounded-joint-construction",
      },
    ]);
  }
  const selected = bind(solved.selections);
  if (selected === undefined) {
    return unsupported("invariant", [{ code: "missing-selected-source" }]);
  }
  assignments.push(...selected);
  stats.commits = assignments.length;
  const audit = certify(purpose, assignments);
  if (audit.status !== "valid") {
    return unsupported(
      "invariant",
      [{ code: "final-slot-audit" }],
      [certificate(purpose, audit, assignments)],
    );
  }
  stats.activeCommits = assignments.length;
  return {
    ...materialiseSlotPlan(geometry, path, assignments),
    assignments,
    audit,
    delivery: describeSlotDelivery(policy, composition, auxiliary, [], assignments),
    diagnostics: diagnostics(),
    status: "complete",
  };
}
