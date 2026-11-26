import { deepFreeze } from "./deepFreeze.ts";
import type { SlotAudit } from "./slotAudit.ts";
import { createSlotCandidateDomains } from "./slotCandidateDomains.ts";
import { isNativeSlotPreparation } from "./slotCandidates.ts";
import { createSlotCertification } from "./slotCertify.ts";
import type { SlotConfiguration, SlotFailure, SlotKind, SlotLimits } from "./slotConfig.ts";
import { createSlotConstructionState } from "./slotConstraintState.ts";
import {
  describeSlotDelivery,
  minimumSlotDelivery,
  type SlotDelivery,
  type SlotDeliveryPolicy,
  type SlotPartialAudit,
} from "./slotDelivery.ts";
import { slotRandom } from "./slotEntropy.ts";
import { makeSlotJobs } from "./slotJobs.ts";
import { guaranteeCompatiblePath } from "./slotPath.ts";
import {
  materialisePartialSlotPlan,
  materialiseSlotPlan,
  type SlotAssignment,
} from "./slotPlan.ts";
import { createSlotPlanFrame } from "./slotPlanFrame.ts";
import { createSlotPreparationCache, createSlotWitnessJobs } from "./slotPreparationCache.ts";
import {
  createSlotWitnessSearch,
  type WitnessOmission,
  type WitnessSelection,
  type WitnessWork,
} from "./slotWitnessSearch.ts";
import { createSlotWorkMeter } from "./slotWorkMeter.ts";
import type { PlannedSpawns, SpawnPlan, SpawnQuota } from "./spawning.ts";

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
  readonly phase: "active";
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

// Runtime emits only an independently audited actual composition. It certifies the runtime-90
// floor while preferring full delivery, and tries the original ordering, then the balanced one,
// each within one SLOT_LIMITS.candidateChecks allowance of the context's total limit.
export function planSlotSpawns<Kind extends string>(
  context: SlotPlanningContext,
  geometry: Omit<SpawnPlan<Kind>, "quotas">,
  catalogue: readonly SlotKind<Kind>[],
  auxiliary: readonly SpawnQuota<Kind>[],
  config: SlotConfiguration<Kind>,
): SlotPlanningResult<Kind> {
  const policy: SlotDeliveryPolicy = "runtime-90";
  const limits = context.limits;
  const assignments: SlotAssignment<Kind>[] = [];
  let path: PlannedSpawns<Kind>["path"] = [];
  let workFailure: SlotPlanningFailure<Kind> | undefined;
  const fail = (stage: SlotPlanningFailure<Kind>["stage"], failure: SlotFailure<Kind>) => {
    workFailure = unsupported(stage, [failure]);
  };
  const {
    attemptProgress,
    attemptStopped,
    diagnostics,
    meter,
    recordAttempt,
    startAttempt,
    stats,
  } = createSlotWorkMeter<Kind>(
    limits,
    SLOT_LIMITS,
    () => workFailure !== undefined,
    (failure) => fail("construction", failure),
  );
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
  const frame = createSlotPlanFrame(
    SLOT_LIMITS,
    limits,
    context,
    geometry,
    catalogue,
    auxiliary,
    config,
  );
  if (frame.status === "unsupported") {
    return unsupported("configuration", frame.failures);
  }
  path = frame.path;
  const { pathDraws } = frame;
  if (
    geometry.maxEmptyRows !== Infinity &&
    (!Number.isSafeInteger(geometry.maxEmptyRows) || geometry.maxEmptyRows < 0)
  ) {
    return unsupported("configuration", [{ code: "invalid-quiet-row-limit" }]);
  }
  const originalJobs = makeSlotJobs(catalogue, auxiliary, config);
  const guarantees = originalJobs.filter((job) => job.guaranteed === true);
  const finishWorkFailure = () =>
    workFailure === undefined ? undefined : { ...workFailure, diagnostics: diagnostics() };
  const { cachedPreparations, prepareSource } = createSlotPreparationCache(
    limits,
    context,
    geometry,
    stats,
    meter.stopped,
    fail,
  );
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
  const conditioned = guaranteeCompatiblePath(geometry, path, pathDraws, mandatory, {
    anchor: meter.anchor,
    check: meter.check,
  });
  if (workFailure !== undefined) {
    return finishWorkFailure()!;
  }
  if (attemptStopped()) {
    return unsupported("construction", [
      { available: SLOT_LIMITS.candidateChecks, code: "candidate-attempt-budget" },
    ]);
  }
  if (conditioned.failedKind !== undefined) {
    return unsupported("construction", [
      { code: "guarantee-path-domain", kind: conditioned.failedKind },
    ]);
  }
  // The second attempt reuses the domains and preparations built on this frozen context.
  deepFreeze(geometry);
  path = deepFreeze(conditioned.path);
  const domains = createSlotCandidateDomains(geometry, path);
  const witnessJobs = createSlotWitnessJobs(
    (name) => slotRandom(context, name),
    meter.stopped,
    prepareSource,
    originalJobs,
  );
  const { bind, bindOmissions, certificate, certify, certifyPartial } = createSlotCertification(
    context,
    geometry,
    path,
    catalogue,
    auxiliary,
    config,
    stats,
    originalJobs,
    witnessJobs,
  );
  if (!meter.propagate()) {
    return (
      finishWorkFailure() ?? unsupported("construction", [{ code: "propagation-attempt-budget" }])
    );
  }
  const work: Omit<WitnessWork<Kind>, "ordinaryOrder"> = {
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
    ...meter,
    ...attemptProgress,
  };
  const solve = (ordering: "original" | "balanced") => {
    const board = createSlotConstructionState(geometry, path);
    const result = createSlotWitnessSearch(
      { ...work, ordinaryOrder: ordering },
      geometry,
      path,
      domains,
      witnessJobs,
    ).solve(board);
    recordAttempt(ordering, result.status);
    return result;
  };
  let solved = solve("original");
  if (
    workFailure === undefined &&
    solved.status !== "compatible" &&
    solved.status !== "partial" &&
    !(solved.status === "blocked" && solved.failure.classification === "unattributed")
  ) {
    startAttempt();
    // The balanced attempt bills one boundary check, then one per reused preparation.
    meter.propagate();
    for (const prepared of cachedPreparations()) {
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
      { code: solved.status === "blocked" ? solved.failure.rule : "bounded-joint-construction" },
    ]);
  }
  const selected = bind(solved.selections);
  if (selected === undefined) {
    return unsupported("invariant", [{ code: "missing-selected-source" }]);
  }
  assignments.push(...selected);
  stats.commits = assignments.length;
  const audit = certify(assignments);
  if (audit.status !== "valid") {
    return unsupported(
      "invariant",
      [{ code: "final-slot-audit" }],
      [certificate(audit, assignments)],
    );
  }
  stats.activeCommits = assignments.length;
  return {
    ...materialiseSlotPlan(geometry, path, assignments),
    activeAudit: audit,
    assignments,
    delivery: describeSlotDelivery(policy, config, auxiliary, [], assignments),
    diagnostics: diagnostics(),
    status: "complete",
  };
}
