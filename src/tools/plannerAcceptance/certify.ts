import { gameData } from "../../data/index.ts";
import { modifiedStat } from "../../rules/modifiers.ts";
import { canonicalJson } from "../../runner/canonicalJson.ts";
import { auditSlotPartialPlan, auditSlotPlan } from "../../runner/slotAudit.ts";
import { apportionSlotCounts, SLOT_ROLES, slotCountTotal } from "../../runner/slotConfig.ts";
import { quietCoverage } from "../../runner/slotCoverage.ts";
import { materialisePartialSlotPlan, materialiseSlotPlan } from "../../runner/slotPlan.ts";
import type { SpawnAudit } from "../../runner/spawnValidation.ts";
import { type ZonePlanObservation, zoneSlotGuarantees } from "../../runner/zonePlan.ts";
import { compileZoneSlotInput } from "../../runner/zoneSlotInput.ts";
import type { RunState } from "../../state/runState.ts";
import type { PlanEvidence } from "./verdict.ts";
import { visibleWitness } from "./visibility.ts";

// An evidence defect that makes a plan's checks meaningless, as opposed to a failed criterion.
export class EvidenceError extends Error {}

function must(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new EvidenceError(message);
  }
}

const same = (a: unknown, b: unknown) => canonicalJson(a) === canonicalJson(b);

// A native geometry audit with no violation, finding or missing coverage.
export function geometryValid(audit: SpawnAudit): boolean {
  return (
    audit.status === "valid" &&
    audit.missingCoverage.length === 0 &&
    audit.violations.length === 0 &&
    audit.findings.every((finding) => finding.reasons.length === 0 && finding.coverage.length === 0)
  );
}

// Independently re-derives one runtime zone plan's evidence from the authored data, the run
// and a fresh audit of the planner's assignments.
export function certifyPlan(
  walk: { readonly route: string; readonly seed: number },
  run: RunState,
  observation: ZonePlanObservation,
): Omit<PlanEvidence, "nativeAuditValid"> {
  const slots = observation.slots;
  must(slots?.purpose === "runtime-actual", "Missing runtime-actual slot evidence");
  const { input } = slots;
  must(same(input.actualRun, run), "Actual run mismatch");
  must(
    input.context.seed === observation.context.seed && input.context.zoneIndex === run.zoneIndex,
    "Context mismatch",
  );
  const zoneId = run.route[run.zoneIndex];
  const zone = gameData.world.zones.find((candidate) => candidate.id === zoneId);
  must(zone !== undefined, `Missing zone ${zoneId}`);
  const authored = zone.spawnSlots.counts[run.zoneIndex];
  must(authored !== undefined, "Missing role targets");
  const roles = apportionSlotCounts(
    Math.round(
      modifiedStat(gameData.tuning, run.modifiers, "obstacleSpawns", slotCountTotal(authored)),
    ),
    authored,
  );
  must(same(roles, input.config.active), "Resolved roles differ from authored targets");
  must(same(zone.spawnSlots.capacity, input.config.capacity), "Capacity config mismatch");
  must(
    same(zoneSlotGuarantees(gameData, zone), input.config.guarantees),
    "Guarantee config mismatch",
  );
  const auxiliary = input.auxiliary.reduce((total, quota) => total + quota.count, 0);
  const configured = slotCountTotal(roles) + auxiliary;
  const required = Math.ceil((9 * configured) / 10);
  const { assignments, delivery } = slots;
  const delivered = assignments.length;
  must(
    delivery.configured === configured &&
      delivery.delivered === delivered &&
      delivery.required === required &&
      delivery.configured === delivery.delivered + delivery.omissions.length,
    "Delivery accounting differs from the original configured quotas",
  );

  const emitted = new Map<string, number>();
  for (const assignment of assignments) {
    emitted.set(assignment.role, (emitted.get(assignment.role) ?? 0) + 1);
  }
  const substitutes: string[] = [];
  const downgrades: string[] = [];
  for (const assignment of assignments) {
    const { binding, entry, key, role } = assignment;
    if (
      binding.kind !== entry.event.kind ||
      entry.request.kind !== entry.event.kind ||
      binding.role !== role
    ) {
      substitutes.push(key);
    }
    if (role === "auxiliaryFixed" || role === "auxiliaryMoving") {
      continue;
    }
    const source = input.catalogue.find(
      (candidate) =>
        candidate.role === role && candidate.kind === entry.event.kind && candidate.weight > 0,
    );
    if (source === undefined || source.weight !== binding.weight) {
      substitutes.push(key);
      continue;
    }
    const moving = role === "encounterMoving" || role === "minorMoving";
    const profiled = entry.event.mover !== undefined && entry.request.mover !== undefined;
    if (
      moving !== (source.movement !== null) ||
      (moving ? !profiled : entry.event.mover !== undefined)
    ) {
      downgrades.push(key);
    }
  }

  const { catalogue, geometry } = compileZoneSlotInput(input);
  const { path } = observation.planned;
  let certificate: PlanEvidence["certificate"];
  if (slots.status === "complete") {
    must(delivered === configured, "Complete status without full delivery");
    const fresh = auditSlotPlan(
      input.context,
      geometry,
      path,
      catalogue,
      input.auxiliary,
      input.config,
      "active",
      assignments,
    );
    certificate = {
      equalsSupplied: same(fresh, slots.active),
      geometryValid: geometryValid(fresh.geometry) && fresh.geometry.validPlaced === configured,
      kind: "auditSlotPlan",
      status:
        fresh.status === "valid" &&
        fresh.violations.length === 0 &&
        fresh.delivered === configured &&
        fresh.configured === configured
          ? "valid"
          : "invalid",
    };
  } else {
    const fresh = auditSlotPartialPlan(
      input.context,
      geometry,
      path,
      catalogue,
      input.auxiliary,
      input.config,
      delivery.omissions,
      assignments,
    );
    certificate = {
      equalsSupplied: same(fresh, slots.partialAudit),
      geometryValid: geometryValid(fresh.geometry) && fresh.geometry.validPlaced === delivered,
      kind: "auditSlotPartialPlan",
      status:
        fresh.status === "valid" &&
        fresh.violations.length === 0 &&
        fresh.failure === undefined &&
        fresh.delivery.configured === configured &&
        fresh.delivery.delivered === delivered
          ? "valid"
          : "invalid",
    };
  }
  const quiet = quietCoverage(geometry, assignments);
  const actual =
    slots.status === "complete"
      ? materialiseSlotPlan(geometry, path, assignments)
      : materialisePartialSlotPlan(geometry, path, delivery, assignments);
  must(
    same(actual.plan, observation.plan) && same(actual.planned, observation.planned),
    "Materialisation mismatch",
  );

  const kinds = input.catalogue
    .filter((source) => source.weight > 0)
    .map((source) => {
      const selected = assignments.filter(
        (assignment) =>
          assignment.phase === "active" &&
          assignment.role === source.role &&
          assignment.entry.event.kind === source.kind,
      );
      return {
        activeSelected: selected.length,
        kind: source.kind,
        role: source.role,
        visibleCertified: selected.filter(
          (assignment) => visibleWitness(geometry, run, assignment) !== null,
        ).length,
      };
    });

  return {
    attempts: (slots.diagnostics.attempts ?? []).map((attempt) => ({
      candidateChecks: attempt.candidateChecks,
      ordering: attempt.ordering,
      propagationChecks: attempt.propagationChecks,
      reserveRestart: attempt.reserveRestart,
      status: attempt.status,
    })),
    certificate,
    configured,
    delivered,
    guarantees: input.config.guarantees.map((guarantee) => ({
      count: guarantee.count,
      kind: guarantee.kind,
      role: guarantee.role,
      selected: assignments.filter(
        (assignment) =>
          assignment.role === guarantee.role && assignment.entry.event.kind === guarantee.kind,
      ).length,
    })),
    kinds,
    position: run.zoneIndex + 1,
    quietOver: quiet.over,
    required,
    route: walk.route,
    rush: run.modifiers.some((modifier) => modifier.by === "rushHourObstacles"),
    seed: walk.seed,
    status: slots.status,
    substitution: {
      capacityEmitted: assignments.filter((assignment) => assignment.phase !== "active").length,
      downgrades,
      overBudgetRoles: SLOT_ROLES.filter((role) => (emitted.get(role) ?? 0) > roles[role]),
      roadEmissionsMatch:
        observation.planned.events.length + observation.planned.herrings.length === delivered,
      substitutes,
    },
    zone: zone.id,
  };
}
