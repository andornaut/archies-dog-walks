import type { SpawnSlotCounts, SpawnSlotRole } from "../data/types.ts";
import { canonicalJson } from "./canonicalJson.ts";
import { moverLeavesMinimumLanes } from "./laneAlternatives.ts";
import { moverPlacementsWithWork } from "./moverPlanning.ts";
import { compileSlotKindDomain, describeSlotKind, slotMotionSelections } from "./slotCandidates.ts";
import {
  SLOT_ROLES,
  type SlotConfiguration,
  slotCountTotal,
  slotFootprint,
  type SlotKind,
  type SlotSource,
} from "./slotConfig.ts";
import { quietCoverage } from "./slotCoverage.ts";
import { describeSlotDelivery, type SlotOmission, type SlotPartialAudit } from "./slotDelivery.ts";
import { slotMotionStreams, type SlotSeedContext } from "./slotEntropy.ts";
import { makeSlotJobs } from "./slotJobs.ts";
import { materialiseSlotPlan, type SlotAssignment } from "./slotPlan.ts";
import {
  blockingLength,
  type PlannedSpawns,
  quotaFootprint,
  rowSpacing,
  type SpawnPlan,
  type SpawnQuota,
} from "./spawning.ts";
import { auditSpawnPlan, type SpawnAudit } from "./spawnValidation.ts";

function sameJson(a: unknown, b: unknown): boolean {
  return canonicalJson(a) === canonicalJson(b);
}
// A value's canonical JSON, computed on first use and then reused.
function lazyCanonicalJson(value: unknown): () => string | undefined {
  let known = false;
  let text: string | undefined;
  return () => {
    if (!known) {
      text = canonicalJson(value);
      known = true;
    }
    return text;
  };
}
function sameAuxiliaryRequest<Kind extends string>(
  actual: SpawnQuota<Kind>,
  expected: SpawnQuota<Kind>,
): boolean {
  const footprint = quotaFootprint(actual),
    wanted = quotaFootprint(expected);
  return (
    actual.count === 1 &&
    (actual.hazard ?? actual.blocksLane) === (expected.hazard ?? expected.blocksLane) &&
    sameJson(actual.mover, expected.mover) &&
    footprint.lanes === wanted.lanes &&
    footprint.rows === wanted.rows &&
    (["blocksLane", "first", "hitLength", "kind", "moversPassOver", "moversRestOn"] as const).every(
      (key) => actual[key] === expected[key],
    ) &&
    actual.within?.[0] === expected.within?.[0] &&
    actual.within?.[1] === expected.within?.[1]
  );
}
export interface SlotAudit {
  // Profile-binding template charges only; excludes materialised geometry reconstruction.
  readonly compiledTemplates: number;
  readonly configured: number;
  readonly delivered: number;
  readonly geometry: SpawnAudit;
  readonly status: "invalid" | "valid";
  readonly violations: readonly string[];
}
export function auditSlotPlan<Kind extends string>(
  context: SlotSeedContext,
  geometry: Omit<SpawnPlan<Kind>, "quotas">,
  path: PlannedSpawns<Kind>["path"],
  catalogue: readonly SlotKind<Kind>[],
  auxiliary: readonly SpawnQuota<Kind>[],
  config: SlotConfiguration<Kind>,
  phase: "active" | "capacity",
  assignments: readonly SlotAssignment<Kind>[],
): SlotAudit {
  return auditSlotAssignments(
    context,
    geometry,
    path,
    catalogue,
    auxiliary,
    config,
    phase,
    true,
    assignments,
  );
}

function auditSlotAssignments<Kind extends string>(
  context: SlotSeedContext,
  geometry: Omit<SpawnPlan<Kind>, "quotas">,
  path: PlannedSpawns<Kind>["path"],
  catalogue: readonly SlotKind<Kind>[],
  auxiliary: readonly SpawnQuota<Kind>[],
  config: SlotConfiguration<Kind>,
  phase: "active" | "capacity",
  exact: boolean,
  assignments: readonly SlotAssignment<Kind>[],
): SlotAudit {
  const wanted: SpawnSlotCounts = phase === "active" ? config.active : config.capacity;
  const auxiliaryTotal = auxiliary.reduce((total, request) => total + request.count, 0);
  const configured = slotCountTotal(wanted) + auxiliaryTotal;
  const violations: string[] = [];
  let compiledTemplates = 0;
  const keys = new Set<string>();
  const actual = Object.fromEntries(SLOT_ROLES.map((role) => [role, 0])) as unknown as Record<
    SpawnSlotRole,
    number
  >;
  const auxiliaryIds = new Set<string>();
  assignments.forEach((assignment, index) => {
    const { binding, entry, role } = assignment;
    let source: SlotSource<Kind> | undefined;
    if (keys.has(assignment.key)) {
      violations.push("duplicate-slot");
    }
    keys.add(assignment.key);
    if (
      entry.trace.quotaIndex !== index ||
      entry.trace.memberIndex !== 0 ||
      entry.request.count !== 1
    ) {
      violations.push("slot-identity");
    }
    if (assignment.phase !== "active") {
      violations.push("capacity-slot-emitted");
    }
    if (
      binding.kind !== entry.event.kind ||
      binding.role !== role ||
      entry.request.kind !== entry.event.kind
    ) {
      violations.push("slot-kind-binding");
    }
    if (role === "auxiliaryFixed" || role === "auxiliaryMoving") {
      const ref = assignment.auxiliary;
      const request = ref === undefined ? undefined : auxiliary[ref.requestIndex];
      if (
        ref === undefined ||
        request === undefined ||
        !Number.isInteger(ref.requestIndex) ||
        !Number.isInteger(ref.memberIndex) ||
        ref.memberIndex < 0 ||
        ref.memberIndex >= request.count ||
        !sameAuxiliaryRequest(entry.request, request) ||
        assignment.phase !== "active"
      ) {
        violations.push("auxiliary-request-binding");
      }
      if (ref !== undefined) {
        const key = `${ref.requestIndex}:${ref.memberIndex}`;
        if (auxiliaryIds.has(key)) {
          violations.push("duplicate-auxiliary-request");
        }
        auxiliaryIds.add(key);
      }
      if (request !== undefined) {
        const { kind } = request;
        source = {
          compile: () => request,
          footprint: slotFootprint(request),
          kind,
          role: request.mover === undefined ? "auxiliaryFixed" : "auxiliaryMoving",
          weight: 1,
        };
      }
    } else {
      actual[role]++;
      source = catalogue.find(
        (candidate) =>
          candidate.role === role && candidate.kind === entry.event.kind && candidate.weight > 0,
      );
      if (source === undefined) {
        violations.push("slot-kind-pool");
      }
    }
    if (source !== undefined) {
      try {
        const expected = describeSlotKind(
          slotMotionStreams(context, assignment.key, source.kind),
          source,
        );
        if (
          source.role !== role ||
          source.weight !== binding.weight ||
          expected.herring !== entry.herring ||
          !sameJson(expected.request, entry.request) ||
          !sameJson(expected.draws, entry.trace.requestedDraws)
        ) {
          violations.push("slot-profile-binding");
        }
        const work = {
          beforePlacement() {
            compiledTemplates++;
          },
        };
        const selection = entry.trace.placement?.selection;
        const mover = expected.request.mover;
        const emittedPath = lazyCanonicalJson(entry.event.mover);
        let motionMatches: boolean;
        if (
          !expected.herring &&
          (mover?.motion.kind === "cross" || mover?.motion.kind === "ride")
        ) {
          const emittedSelection = lazyCanonicalJson(selection);
          const selected = slotMotionSelections(expected).find(
            (legal) => canonicalJson(legal) === emittedSelection(),
          );
          const placements =
            selected === undefined
              ? []
              : moverPlacementsWithWork(
                  work,
                  {
                    ...geometry,
                    rowSpacing: rowSpacing({ ...geometry, quotas: [] }),
                    window: blockingLength(geometry, 1),
                  },
                  mover,
                  selected.draws,
                  selected.lift,
                );
          if (placements.length === 0) {
            work.beforePlacement();
          }
          motionMatches = placements.some(
            (placement) =>
              (!expected.request.blocksLane ||
                moverLeavesMinimumLanes(geometry, mover.footprint, placement)) &&
              canonicalJson(placement.path) === emittedPath(),
          );
        } else {
          // Reactive ranks and counts require the complete fresh domain.
          const domain = compileSlotKindDomain(work, geometry, expected);
          const emittedDraws = lazyCanonicalJson(selection?.draws);
          motionMatches =
            selection !== undefined &&
            domain.placements.some(
              (placement) =>
                canonicalJson(placement.selection?.draws ?? expected.draws) === emittedDraws() &&
                (placement.selection?.lift ?? 0) === selection.lift &&
                canonicalJson(placement.path) === emittedPath(),
            );
        }
        if (!entry.herring && entry.event.mover !== undefined && !motionMatches) {
          violations.push("slot-motion-capability");
        }
      } catch {
        violations.push("slot-profile-definition");
      }
    }
  });
  for (const role of SLOT_ROLES) {
    if (exact ? actual[role] !== wanted[role] : actual[role] > wanted[role]) {
      violations.push(`slot-budget:${role}`);
    }
  }
  if (exact ? auxiliaryIds.size !== auxiliaryTotal : auxiliaryIds.size > auxiliaryTotal) {
    violations.push("auxiliary-budget");
  }
  const activeKinds = new Set(
    assignments
      .filter(
        (assignment) =>
          assignment.phase === "active" &&
          assignment.role !== "auxiliaryFixed" &&
          assignment.role !== "auxiliaryMoving",
      )
      .map((assignment) => assignment.entry.event.kind),
  );
  for (const kind of new Set(
    catalogue.filter((source) => source.weight > 0).map((source) => source.kind),
  )) {
    if (!activeKinds.has(kind)) {
      violations.push(`missing-enabled-kind:${kind}`);
    }
  }
  for (const guarantee of config.guarantees) {
    if (
      assignments.filter(
        (assignment) =>
          assignment.phase === "active" &&
          assignment.role === guarantee.role &&
          assignment.entry.event.kind === guarantee.kind,
      ).length < guarantee.count
    ) {
      violations.push(`guarantee:${guarantee.kind}`);
    }
  }
  if (quietCoverage(geometry, assignments).over > 0) {
    violations.push("quiet-row-coverage");
  }
  if (exact ? assignments.length !== configured : assignments.length > configured) {
    violations.push("configured-total");
  }
  const materialised = materialiseSlotPlan(geometry, path, assignments);
  const audited = auditSpawnPlan(materialised.plan, materialised.planned);
  return {
    compiledTemplates,
    configured,
    delivered: assignments.length,
    geometry: audited,
    status:
      violations.length === 0 &&
      audited.status === "valid" &&
      audited.validPlaced === (exact ? configured : assignments.length)
        ? "valid"
        : "invalid",
    violations,
  };
}

// Original jobs remain the identity and profile namespace even when optional members are absent.
export function auditSlotPartialPlan<Kind extends string>(
  context: SlotSeedContext,
  geometry: Omit<SpawnPlan<Kind>, "quotas">,
  path: PlannedSpawns<Kind>["path"],
  catalogue: readonly SlotKind<Kind>[],
  auxiliary: readonly SpawnQuota<Kind>[],
  config: SlotConfiguration<Kind>,
  omissions: readonly SlotOmission<Kind>[],
  assignments: readonly SlotAssignment<Kind>[],
): SlotPartialAudit<Kind> {
  const delivery = describeSlotDelivery("runtime-90", config, auxiliary, omissions, assignments);
  const checked = auditSlotAssignments(
    context,
    geometry,
    path,
    catalogue,
    auxiliary,
    config,
    "active",
    false,
    assignments,
  );
  const violations = [...checked.violations];
  const ordinary = (violation: string) =>
    violation === "quiet-row-coverage" ||
    violation.startsWith("guarantee:") ||
    violation.startsWith("missing-enabled-kind:");
  let invariant = violations.some((violation) => !ordinary(violation));
  const reject = (reason: string, unexpected = true) => {
    violations.push(reason);
    invariant ||= unexpected;
  };
  if (delivery.delivered < delivery.required) {
    reject("delivery-floor", false);
  }
  const supplied = assignments.length + omissions.length;
  if (supplied !== delivery.configured) {
    reject("job-partition");
  }
  const guaranteedByRole = { encounterFixed: 0, encounterMoving: 0, minorFixed: 0, minorMoving: 0 };
  let boundedGuarantees = true;
  for (const guarantee of config.guarantees) {
    if (
      !SLOT_ROLES.includes(guarantee.role) ||
      !Number.isSafeInteger(guarantee.count) ||
      guarantee.count < 0
    ) {
      boundedGuarantees = false;
      continue;
    }
    guaranteedByRole[guarantee.role] += guarantee.count;
    if (guaranteedByRole[guarantee.role] > config.active[guarantee.role]) {
      boundedGuarantees = false;
    }
  }
  if (!boundedGuarantees) {
    reject("partial-configuration");
  }
  // Enumeration is bounded by the supplied ledger instead of an unchecked configured count.
  if (boundedGuarantees && delivery.configured <= supplied) {
    const jobs = makeSlotJobs(catalogue, auxiliary, config);
    const byKey = new Map(jobs.map((job) => [job.key, job]));
    const selected = new Set<string>();
    for (const assignment of assignments) {
      const job = byKey.get(assignment.key);
      if (selected.has(assignment.key)) {
        reject("duplicate-selected-job");
      }
      selected.add(assignment.key);
      if (job === undefined) {
        reject("unknown-selected-job");
        continue;
      }
      if (job.role !== assignment.role || !sameJson(job.auxiliary, assignment.auxiliary)) {
        reject("selected-job-binding");
      }
      if (
        !job.sources.some(
          (source) =>
            source.kind === assignment.entry.event.kind &&
            source.role === assignment.role &&
            source.weight === assignment.binding.weight,
        )
      ) {
        reject("selected-job-source");
      }
    }
    const omitted = new Set<string>();
    for (const omission of omissions) {
      const job = byKey.get(omission.key);
      if (omitted.has(omission.key)) {
        reject("duplicate-omitted-job");
      }
      omitted.add(omission.key);
      if (selected.has(omission.key)) {
        reject("selected-and-omitted-job");
      }
      if (job === undefined) {
        reject("unknown-omitted-job");
        continue;
      }
      if (job.role !== omission.role || !sameJson(job.auxiliary, omission.auxiliary)) {
        reject("omitted-job-binding");
      }
      const kinds = [...new Set(job.sources.map((source) => source.kind))];
      const knownKind = kinds.length === 1 ? kinds[0] : undefined;
      if (omission.kind !== knownKind) {
        reject("omitted-job-kind");
      }
      if (
        omission.reason !== "domain-exhausted" &&
        omission.reason !== "not-selected-within-allowance"
      ) {
        reject("omission-reason");
      }
      if (job.guaranteed === true) {
        reject(`protected-owner:${job.key}`, false);
      }
    }
    for (const job of jobs) {
      if (!selected.has(job.key) && !omitted.has(job.key)) {
        reject("unclassified-job");
      }
      if (job.guaranteed === true && !selected.has(job.key) && !omitted.has(job.key)) {
        reject(`protected-owner:${job.key}`, false);
      }
    }
  }
  if (
    checked.geometry.status !== "valid" ||
    checked.geometry.requested !== delivery.delivered ||
    checked.geometry.placed !== delivery.delivered ||
    checked.geometry.validPlaced !== delivery.delivered ||
    checked.geometry.findings.length !== delivery.delivered ||
    checked.geometry.missingCoverage.length > 0 ||
    checked.geometry.findings.some(
      (finding) => finding.reasons.length > 0 || finding.coverage.length > 0,
    )
  ) {
    reject("partial-native-geometry");
  }
  return {
    compiledTemplates: checked.compiledTemplates,
    delivery,
    ...(violations.length === 0
      ? {}
      : { failure: invariant ? ("invariant" as const) : ("ineligible" as const) }),
    geometry: checked.geometry,
    purpose: "runtime-partial",
    status: violations.length === 0 ? "valid" : "invalid",
    violations: [...new Set(violations)],
  };
}
