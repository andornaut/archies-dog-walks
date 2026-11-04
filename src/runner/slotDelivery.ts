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

// The runtime release floor: a runtime-90 plan delivers at least nine tenths of its original requests.
export const SLOT_RUNTIME_DELIVERY_FLOOR = Object.freeze({
  denominator: 10,
  numerator: 9,
} as const);
// Failed placement attempts a search frame makes before it may omit its optional request. A runtime
// attempt explores with the large threshold. If it holds no floor-meeting layout once it has used
// SLOT_OMISSION_RESERVE of its work allowance, it restarts from the empty layout with the reserve
// threshold for the rest of that allowance.
export const SLOT_OMISSION_ATTEMPTS = Object.freeze({ explore: 128, reserve: 3 } as const);
export const SLOT_OMISSION_RESERVE = Object.freeze({ denominator: 4, numerator: 3 } as const);
// Runtime search moves a row behind a job's untried rows once this many of its values have been
// rejected there for occupied space within one search frame, whose earlier placements stay fixed.
export const SLOT_ROW_PRESSURE = Object.freeze({
  rejections: 2,
  rules: Object.freeze(new Set(["body", "cells"])),
} as const);
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
