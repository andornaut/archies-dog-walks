import {
  type SlotConfiguration,
  slotConfigurationFailures,
  slotCountTotal,
  type SlotFailure,
  type SlotKind,
  type SlotLimits,
} from "./slotConfig.ts";
import { slotRandom } from "./slotEntropy.ts";
import type { SlotPlanningContext } from "./slotPlanner.ts";
import {
  drawPath,
  type PlannedSpawns,
  rowSpacing,
  type SpawnPlan,
  type SpawnQuota,
  zoneRows,
} from "./spawning.ts";

type SlotPlanFrame<Kind extends string> =
  | { readonly status: "unsupported"; readonly failures: readonly SlotFailure<Kind>[] }
  | {
      readonly status: "ready";
      readonly path: PlannedSpawns<Kind>["path"];
      readonly pathDraws: readonly number[];
    };

export function createSlotPlanFrame<Kind extends string>(
  maximum: SlotLimits,
  limits: SlotLimits,
  context: SlotPlanningContext,
  geometry: Omit<SpawnPlan<Kind>, "quotas">,
  catalogue: readonly SlotKind<Kind>[],
  auxiliary: readonly SpawnQuota<Kind>[],
  config: SlotConfiguration<Kind>,
): SlotPlanFrame<Kind> {
  const failures = slotConfigurationFailures(catalogue, limits, config);
  if (
    limits.candidateChecks > 2 * maximum.candidateChecks ||
    limits.anchors > maximum.anchors ||
    limits.compiledTemplates > maximum.compiledTemplates ||
    limits.slots > maximum.slots
  ) {
    failures.push({ code: "portfolio-work-limit" });
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
    return { failures, status: "unsupported" };
  }
  const base: SpawnPlan<Kind> = { ...geometry, quotas: [] };
  let spacing: number;
  try {
    spacing = rowSpacing(base);
  } catch {
    return { failures: [{ code: "invalid-row-grid" }], status: "unsupported" };
  }
  if (
    !Number.isFinite(spacing) ||
    spacing <= 0 ||
    !Number.isFinite(geometry.zoneLength) ||
    geometry.zoneLength <= 0 ||
    !Number.isFinite(geometry.sightLength) ||
    geometry.sightLength < 0
  ) {
    return { failures: [{ code: "invalid-row-grid" }], status: "unsupported" };
  }
  const rowBound =
    Math.ceil(geometry.zoneLength / spacing) + Math.ceil(geometry.sightLength / spacing) + 2;
  if (rowBound > limits.anchors) {
    return {
      failures: [{ available: limits.anchors, code: "grid-work-limit", required: rowBound }],
      status: "unsupported",
    };
  }
  const rows = zoneRows(base, spacing);
  if (rows.length === 0 || rows.length > limits.anchors) {
    return {
      failures: [{ available: limits.anchors, code: "row-grid-limit", required: rows.length }],
      status: "unsupported",
    };
  }
  const invalidFootprint = catalogue.find(
    (source) => source.footprint.lanes > geometry.laneCount || source.footprint.rows > rows.length,
  );
  if (invalidFootprint !== undefined) {
    return {
      failures: [
        {
          code: "footprint-does-not-fit",
          kind: invalidFootprint.kind,
          role: invalidFootprint.role,
        },
      ],
      status: "unsupported",
    };
  }
  const pathDraws: number[] = [];
  const pathRandom = slotRandom(context, "path");
  const pathLanes = drawPath(
    () => {
      const value = pathRandom();
      pathDraws.push(value);
      return value;
    },
    base,
    rows.length,
  );
  return {
    path: rows.map((distance, row) => ({ distance, lane: pathLanes[row]! })),
    pathDraws,
    status: "ready",
  };
}
