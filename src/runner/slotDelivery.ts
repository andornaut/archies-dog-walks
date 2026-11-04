import { SLOT_ROLES, type SlotConfiguration, type SlotPlanningRole } from "./slotConfig";
import type { SlotAssignment } from "./slotPlan";
import type { SpawnQuota } from "./spawning";
import type { SpawnAudit } from "./spawnValidation";

export type SlotDeliveryPolicy = "exact" | "runtime-90";
export type SlotDeliveryCounts = Readonly<Record<SlotPlanningRole, number>>;
export type SlotOmissionReason = "domain-exhausted" | "not-selected-within-allowance";

export interface SlotOmission<Kind extends string> {
  readonly auxiliary?: { readonly requestIndex: number; readonly memberIndex: number };
  readonly key: string;
  readonly kind?: Kind;
  readonly reason: SlotOmissionReason;
  readonly role: SlotPlanningRole;
}
export type SlotDeliveryFloor =
  | { readonly numerator: 1; readonly denominator: 1 }
  | { readonly numerator: 9; readonly denominator: 10 };
export interface SlotDelivery<Kind extends string> {
  readonly configured: number;
  readonly configuredByRole: SlotDeliveryCounts;
  readonly delivered: number;
  readonly deliveredByRole: SlotDeliveryCounts;
  readonly floor: SlotDeliveryFloor;
  readonly omissions: readonly SlotOmission<Kind>[];
  readonly policy: SlotDeliveryPolicy;
  readonly required: number;
}
export interface SlotPartialAudit<Kind extends string> {
  readonly compiledTemplates: number;
  readonly delivery: SlotDelivery<Kind>;
  readonly failure?: "ineligible" | "invariant";
  readonly geometry: SpawnAudit;
  readonly purpose: "runtime-partial";
  readonly status: "invalid" | "valid";
  readonly violations: readonly string[];
}

// CLEANUP (added 2026-11-02): remove runtime-90 when all required contexts reach 100% within approved runtime limits.
export const SLOT_RUNTIME_DELIVERY_FLOOR = Object.freeze({
  denominator: 10,
  numerator: 9,
} as const);
// Failed placement attempts a search frame makes before it may omit its optional request.
export const SLOT_OMISSION_ATTEMPTS = 3;
const EXACT_FLOOR = Object.freeze({ denominator: 1, numerator: 1 } as const);

export function slotDeliveryFloor(policy: SlotDeliveryPolicy): SlotDeliveryFloor {
  switch (policy) {
    case "exact":
      return EXACT_FLOOR;
    case "runtime-90":
      return SLOT_RUNTIME_DELIVERY_FLOOR;
    default:
      throw new RangeError("Unknown slot delivery policy");
  }
}

export function minimumSlotDelivery(policy: SlotDeliveryPolicy, configured: number): number {
  if (!Number.isSafeInteger(configured) || configured < 0) {
    throw new RangeError("Configured slot total must be a nonnegative safe integer");
  }
  const { denominator, numerator } = slotDeliveryFloor(policy);
  return (
    Math.floor(configured / denominator) * numerator +
    Math.ceil(((configured % denominator) * numerator) / denominator)
  );
}

export function describeSlotDelivery<Kind extends string>(
  policy: SlotDeliveryPolicy,
  config: SlotConfiguration<Kind>,
  auxiliary: readonly SpawnQuota<Kind>[],
  omissions: readonly SlotOmission<Kind>[],
  assignments: readonly SlotAssignment<Kind>[],
): SlotDelivery<Kind> {
  const configuredByRole: Record<SlotPlanningRole, number> = {
    ...config.active,
    auxiliaryFixed: 0,
    auxiliaryMoving: 0,
  };
  for (const request of auxiliary) {
    configuredByRole[request.mover === undefined ? "auxiliaryFixed" : "auxiliaryMoving"] +=
      request.count;
  }
  const deliveredByRole: Record<SlotPlanningRole, number> = {
    auxiliaryFixed: 0,
    auxiliaryMoving: 0,
    encounterFixed: 0,
    encounterMoving: 0,
    minorFixed: 0,
    minorMoving: 0,
  };
  for (const assignment of assignments) {
    if (Object.hasOwn(deliveredByRole, assignment.role)) {
      deliveredByRole[assignment.role]++;
    }
  }
  if (Object.values(configuredByRole).some((count) => !Number.isSafeInteger(count) || count < 0)) {
    throw new RangeError("Configured slot categories must be nonnegative safe integers");
  }
  const configured =
    SLOT_ROLES.reduce((sum, role) => sum + configuredByRole[role], 0) +
    configuredByRole.auxiliaryFixed +
    configuredByRole.auxiliaryMoving;
  return Object.freeze({
    configured,
    configuredByRole: Object.freeze(configuredByRole),
    delivered: assignments.length,
    deliveredByRole: Object.freeze(deliveredByRole),
    floor: slotDeliveryFloor(policy),
    omissions: Object.freeze(
      omissions.map((omission) =>
        Object.freeze({
          ...omission,
          ...(omission.auxiliary === undefined
            ? {}
            : { auxiliary: Object.freeze({ ...omission.auxiliary }) }),
        }),
      ),
    ),
    policy,
    required: minimumSlotDelivery(policy, configured),
  });
}
