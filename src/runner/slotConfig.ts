import type { SpawnSlotCounts, SpawnSlotRole } from "../data/types";
import type { PlannerStreams } from "./moverPlanning";
import { type Footprint, quotaFootprint, type SpawnQuota } from "./spawning";

// Tie order for integer allocation and stable role iteration.
export const SLOT_ROLES = [
  "encounterFixed",
  "encounterMoving",
  "minorFixed",
  "minorMoving",
] as const satisfies readonly SpawnSlotRole[];

// Capability of the full job domain for native lane-completion constraints only.
export type SlotLaneEffect = "none" | "possible";
export type SlotPlanningRole = SpawnSlotRole | "auxiliaryFixed" | "auxiliaryMoving";
export type SlotSource<Kind extends string> = Omit<SlotKind<Kind>, "role"> & {
  readonly role: SlotPlanningRole;
};

export interface SlotGuarantee<Kind extends string> {
  readonly count: number;
  readonly kind: Kind;
  readonly role: SpawnSlotRole;
}
export interface SlotConfiguration<Kind extends string> {
  readonly active: SpawnSlotCounts;
  readonly capacity: SpawnSlotCounts;
  readonly guarantees: readonly SlotGuarantee<Kind>[];
}
export interface SlotLimits {
  readonly anchors: number;
  readonly candidateChecks: number;
  readonly compiledTemplates: number;
  readonly slots: number;
}
export interface SlotKind<Kind extends string> {
  readonly footprint: Footprint;
  readonly kind: Kind;
  readonly role: SpawnSlotRole;
  readonly weight: number;
  // The adapter derives this specification from authored geometry and full motion data.
  readonly compile: (streams: PlannerStreams) => Omit<SpawnQuota<Kind>, "count" | "kind">;
}
// Moving profiles own their full shape; the standing-quota default is separate.
export function slotFootprint(quota: SpawnQuota<string>): Footprint {
  return quota.mover?.footprint ?? quotaFootprint(quota);
}

export interface SlotFailure<Kind extends string> {
  readonly code: string;
  readonly kind?: Kind;
  readonly role?: SlotPlanningRole;
  readonly required?: number;
  readonly available?: number;
}
export function slotCountTotal(counts: SpawnSlotCounts): number {
  return SLOT_ROLES.reduce((total, role) => total + counts[role], 0);
}

// Round the modified total once; role proportions never add or discard a logical slot.
export function apportionSlotCounts(total: number, counts: SpawnSlotCounts): SpawnSlotCounts {
  if (
    !Number.isSafeInteger(total) ||
    total < 0 ||
    SLOT_ROLES.some((role) => !Number.isSafeInteger(counts[role]) || counts[role] < 0)
  ) {
    throw new RangeError("Slot counts must be nonnegative safe integers");
  }
  const base = slotCountTotal(counts);
  if (!Number.isSafeInteger(base)) {
    throw new RangeError("Authored slot total exceeds safe integer range");
  }
  if (base === 0 && total !== 0) {
    throw new RangeError("A nonzero total needs authored role proportions");
  }
  const values = SLOT_ROLES.map((role, order) => {
    const exact = base === 0 ? 0 : (counts[role] * total) / base;
    return { fraction: exact - Math.floor(exact), order, role, value: Math.floor(exact) };
  });
  const remainder = total - values.reduce((sum, entry) => sum + entry.value, 0);
  const ranked = [...values].sort((a, b) => b.fraction - a.fraction || a.order - b.order);
  for (let index = 0; index < remainder; index++) {
    ranked[index]!.value++;
  }
  return Object.fromEntries(
    values.map(({ role, value }) => [role, value]),
  ) as unknown as SpawnSlotCounts;
}

// Well-formed budgets are not a geometric capacity certificate.
export function slotConfigurationFailures<Kind extends string>(
  catalogue: readonly SlotKind<Kind>[],
  limits: SlotLimits,
  config: SlotConfiguration<Kind>,
): SlotFailure<Kind>[] {
  const failures: SlotFailure<Kind>[] = [];
  if (Object.values(limits).some((limit) => !Number.isSafeInteger(limit) || limit <= 0)) {
    failures.push({ code: "invalid-construction-limit" });
  }
  if (catalogue.length > limits.compiledTemplates) {
    failures.push({
      available: limits.compiledTemplates,
      code: "catalogue-limit",
      required: catalogue.length,
    });
  }
  for (const role of SLOT_ROLES) {
    const active = config.active[role],
      capacity = config.capacity[role];
    if (
      !Number.isSafeInteger(active) ||
      active < 0 ||
      !Number.isSafeInteger(capacity) ||
      capacity < 0
    ) {
      failures.push({ code: "invalid-role-count", role });
    } else if (active > capacity) {
      failures.push({ available: capacity, code: "role-capacity", required: active, role });
    }
    if (capacity > 0 && !catalogue.some((entry) => entry.role === role && entry.weight > 0)) {
      failures.push({ code: "empty-role-pool", role });
    }
  }
  if (slotCountTotal(config.capacity) > limits.slots) {
    failures.push({
      available: limits.slots,
      code: "slot-limit",
      required: slotCountTotal(config.capacity),
    });
  }
  const kinds = new Set<string>();
  for (const entry of catalogue) {
    const key = `${entry.role}:${entry.kind}`;
    if (
      !Number.isSafeInteger(entry.footprint.lanes) ||
      entry.footprint.lanes < 1 ||
      !Number.isSafeInteger(entry.footprint.rows) ||
      entry.footprint.rows < 1
    ) {
      failures.push({ code: "invalid-footprint", kind: entry.kind, role: entry.role });
    }
    if (!Number.isFinite(entry.weight) || entry.weight < 0) {
      failures.push({ code: "invalid-weight", kind: entry.kind, role: entry.role });
    }
    if (kinds.has(key)) {
      failures.push({ code: "duplicate-kind-role", kind: entry.kind, role: entry.role });
    }
    kinds.add(key);
  }
  const guaranteed = new Map<SpawnSlotRole, number>();
  const seenGuarantees = new Set<string>();
  for (const guarantee of config.guarantees) {
    const key = `${guarantee.role}:${guarantee.kind}`;
    if (!Number.isSafeInteger(guarantee.count) || guarantee.count <= 0) {
      failures.push({
        code: "invalid-guarantee-count",
        kind: guarantee.kind,
        role: guarantee.role,
      });
    }
    if (seenGuarantees.has(key)) {
      failures.push({ code: "duplicate-guarantee", kind: guarantee.kind, role: guarantee.role });
    }
    seenGuarantees.add(key);
    if (
      !catalogue.some(
        (entry) =>
          entry.role === guarantee.role && entry.kind === guarantee.kind && entry.weight > 0,
      )
    ) {
      failures.push({ code: "unavailable-guarantee", kind: guarantee.kind, role: guarantee.role });
    }
    guaranteed.set(guarantee.role, (guaranteed.get(guarantee.role) ?? 0) + guarantee.count);
  }
  for (const [role, count] of guaranteed) {
    if (count > config.active[role]) {
      failures.push({
        available: config.active[role],
        code: "guarantee-budget",
        required: count,
        role,
      });
    }
  }
  return failures;
}
