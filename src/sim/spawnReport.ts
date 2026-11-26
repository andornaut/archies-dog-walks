import type { EncounterId } from "../data/ids.ts";
import type { GameData } from "../data/index.ts";
import {
  minimumSlotDelivery,
  SLOT_RUNTIME_DELIVERY_FLOOR,
  slotCountTotal,
  type WalkItemKind,
} from "../runner/index.ts";
import { mean } from "./reportStats.ts";
import type { MatrixRow } from "./rowSummary.ts";
import type { RunResult } from "./simulate.ts";
import type { ZoneWalkEvents } from "./walkEvents.ts";

export interface SpawnRunReport {
  readonly seed: number;
  readonly zoneIndex: number;
  readonly route: RunResult["route"];
  readonly modifiers: RunResult["run"]["modifiers"];
  readonly zones: readonly ZoneWalkEvents[];
  readonly failure: NonNullable<RunResult["planningFailure"]> | null;
  readonly partial: Pick<
    RunResult,
    "cardsSeen" | "choices" | "earnings" | "facts" | "items" | "movers" | "zones"
  > | null;
  readonly snapshotPath?: string;
}

export const DEFAULT_SPAWN_TARGET =
  SLOT_RUNTIME_DELIVERY_FLOOR.numerator / SLOT_RUNTIME_DELIVERY_FLOOR.denominator;

export function parseSpawnTarget(text: string): number {
  const target = Number(text);
  if (text.trim() === "" || !Number.isFinite(target) || target < 0.8 || target > 1) {
    throw new RangeError(`--spawn-target takes a fraction from 0.8 to 1, not ${text}`);
  }
  return target;
}

function inconsistentSpawnAudit(zone: ZoneWalkEvents): boolean {
  const audit = zone.audit;
  const slots = zone.slots;
  const delivery = slots?.delivery;
  const certificate = slots?.status === "complete" ? slots.active : slots?.partialAudit;
  return (
    (delivery !== undefined &&
      (delivery.configured !== zone.configured ||
        delivery.delivered + delivery.omissions.length !== delivery.configured ||
        certificate?.status !== "valid" ||
        delivery.required !== minimumSlotDelivery(delivery.policy, delivery.configured) ||
        delivery.delivered < delivery.required ||
        (slots?.status === "complete" && delivery.omissions.length !== 0))) ||
    (audit !== undefined &&
      (audit.requested !== (delivery?.delivered ?? zone.configured) ||
        audit.validPlaced > audit.requested ||
        ![audit.requested, audit.placed, audit.validPlaced].every(
          (count) => Number.isSafeInteger(count) && count >= 0,
        ) ||
        audit.counts.reduce((n, count) => n + count.requested, 0) !== audit.requested ||
        audit.counts.reduce((n, count) => n + count.validPlaced, 0) !== audit.validPlaced ||
        audit.counts.reduce((n, count) => n + count.emitted, 0) !== audit.placed))
  );
}

export interface RoadObstacleSummary {
  readonly position: number;
  readonly zone: string;
  configured: number | null;
  requested: number;
  admitted: number;
  valid: number | null;
  validConfiguredRate: number | null;
}

export function combineRoadObstacleSummaries(
  records: readonly RoadObstacleSummary[],
): RoadObstacleSummary[] {
  const groups = new Map<string, RoadObstacleSummary>();
  for (const record of records) {
    const key = `${record.position}:${record.zone}`;
    const sum = groups.get(key) ?? {
      ...record,
      admitted: 0,
      configured: 0,
      requested: 0,
      valid: 0,
    };
    sum.requested += record.requested;
    sum.admitted += record.admitted;
    sum.configured =
      sum.configured === null || record.configured === null
        ? null
        : sum.configured + record.configured;
    sum.valid = sum.valid === null || record.valid === null ? null : sum.valid + record.valid;
    sum.validConfiguredRate =
      sum.valid === null || sum.configured === null || sum.configured === 0
        ? null
        : sum.valid / sum.configured;
    groups.set(key, sum);
  }
  return [...groups.values()].sort(
    (a, b) => a.position - b.position || a.zone.localeCompare(b.zone),
  );
}

// Road quotas include pull-only obstacles; lucky finds, pickups and gear are separate.
export function sumRoadObstacleEvents(
  data: Pick<GameData, "encounters" | "minorObstacles">,
  records: readonly ZoneWalkEvents[],
): RoadObstacleSummary[] {
  return combineRoadObstacleSummaries(
    records.map((zone) => {
      const isRoadObstacle = (kind: string) =>
        kind in data.minorObstacles || data.encounters[kind as EncounterId]?.kind === "obstacle";
      const flows = Object.entries(zone.kinds).flatMap(([kind, flow]) =>
        flow !== undefined && isRoadObstacle(kind) ? [flow] : [],
      );
      const requested = flows.reduce((sum, flow) => sum + flow.requested, 0);
      const unknown =
        zone.audit === undefined ||
        zone.audit.status === "unverified" ||
        zone.audit.missingCoverage.length > 0 ||
        flows.some((flow) => flow.valid === null);
      const frozenRequested = zone.audit?.counts
        .filter(({ kind }) => isRoadObstacle(kind))
        .reduce((sum, count) => sum + count.requested, 0);
      const configured =
        unknown ||
        inconsistentSpawnAudit(zone) ||
        (zone.slots === undefined && frozenRequested !== requested)
          ? null
          : zone.slots === undefined
            ? requested
            : slotCountTotal(zone.slots.delivery.configuredByRole);
      return {
        admitted: flows.reduce((sum, flow) => sum + flow.admitted, 0),
        configured,
        position: zone.position,
        requested,
        valid: unknown ? null : flows.reduce((sum, flow) => sum + flow.valid!, 0),
        validConfiguredRate: null,
        zone: zone.zone,
      };
    }),
  );
}

export interface SpawnEventSummary {
  readonly position: number;
  readonly zone: string;
  readonly kind: string;
  exposures: number;
  variationExposures: number;
  configured: number | null;
  planned: number;
  requested: number;
  admitted: number;
  generated: number;
  herrings: number;
  encountered: number;
  touched: number;
  passed: number;
  departed: number;
  valid: number | null;
  goal: "met" | "below floor" | "invalid" | "unverified";
  configuredTargetGoal: "met" | "below target" | "invalid" | "unverified";
  perExposure: Readonly<Record<SpawnCountField, { mean: number; min: number; max: number } | null>>;
  validConfiguredRate: number | null;
}

const SPAWN_COUNT_FIELDS = [
  "admitted",
  "configured",
  "departed",
  "encountered",
  "generated",
  "herrings",
  "passed",
  "planned",
  "requested",
  "touched",
  "valid",
] as const;
type SpawnCountField = (typeof SPAWN_COUNT_FIELDS)[number];

// Every kind uses the full zone-exposure denominator, including draws with zero of that kind.
// The delivery floor is checked independently per zone, never on pooled admission totals.
export function sumSpawnEvents(
  records: readonly ZoneWalkEvents[],
  byKind = false,
  variationRecords: readonly ZoneWalkEvents[] = records,
): SpawnEventSummary[] {
  const variation = new Set(variationRecords);
  const groups = new Map<string, SpawnEventSummary>();
  const samples = new Map<string, Record<SpawnCountField, (number | null)[]>>();
  const zoneKinds = new Map<string, Set<string>>();
  for (const zone of records) {
    const key = `${zone.position}:${zone.zone}`;
    const kinds = zoneKinds.get(key) ?? new Set<string>();
    for (const kind of Object.keys(zone.kinds)) {
      kinds.add(kind);
    }
    for (const { kind } of zone.audit?.counts ?? []) {
      kinds.add(kind);
    }
    zoneKinds.set(key, kinds);
  }
  for (const zone of records) {
    const kinds = byKind ? [...zoneKinds.get(`${zone.position}:${zone.zone}`)!].sort() : ["all"];
    for (const kind of kinds) {
      const key = `${zone.position}:${zone.zone}:${kind}`;
      const sum = groups.get(key) ?? {
        admitted: 0,
        configured: 0,
        configuredTargetGoal: "met",
        departed: 0,
        encountered: 0,
        exposures: 0,
        generated: 0,
        goal: "met",
        herrings: 0,
        kind,
        passed: 0,
        perExposure: Object.fromEntries(
          SPAWN_COUNT_FIELDS.map((field) => [field, null]),
        ) as SpawnEventSummary["perExposure"],
        planned: 0,
        position: zone.position,
        requested: 0,
        touched: 0,
        valid: 0,
        validConfiguredRate: null,
        variationExposures: 0,
        zone: zone.zone,
      };
      sum.exposures++;
      const exposure = Object.fromEntries(SPAWN_COUNT_FIELDS.map((field) => [field, 0])) as Record<
        SpawnCountField,
        number | null
      >;
      const observed =
        samples.get(key) ??
        (Object.fromEntries(
          SPAWN_COUNT_FIELDS.map((field) => [field, [] as (number | null)[]]),
        ) as Record<SpawnCountField, (number | null)[]>);
      const audited = zone.audit?.counts.filter((count) => kind === "all" || count.kind === kind);
      const configured =
        zone.slots === undefined
          ? (audited?.reduce((n, count) => n + count.requested, 0) ?? null)
          : kind === "all"
            ? zone.configured
            : zone.slots.delivery.omissions.some((omission) => omission.kind === undefined)
              ? null
              : (zone.kinds[kind as WalkItemKind]?.requested ?? 0);
      exposure.configured = configured;
      sum.configured =
        sum.configured === null || configured === null ? null : sum.configured + configured;
      const flows = Object.entries(zone.kinds)
        .filter(([id]) => kind === "all" || id === kind)
        .map(([, flow]) => flow);
      for (const flow of flows) {
        if (flow === undefined) {
          continue;
        }
        sum.planned += flow.requested;
        exposure.planned! += flow.requested;
        for (const field of [
          "admitted",
          "generated",
          "herrings",
          "encountered",
          "touched",
          "passed",
          "departed",
        ] as const) {
          sum[field] += flow[field];
          exposure[field]! += flow[field];
        }
      }
      exposure.requested = configured ?? flows.reduce((n, flow) => n + (flow?.requested ?? 0), 0);
      sum.requested += exposure.requested;
      const valid =
        zone.audit === undefined ||
        zone.audit.status === "unverified" ||
        zone.audit.missingCoverage.length > 0
          ? null
          : (audited?.reduce((n, count) => n + count.validPlaced, 0) ?? null);
      exposure.valid = valid;
      sum.valid = sum.valid === null || valid === null ? null : sum.valid + valid;
      const invalid =
        zone.audit !== undefined &&
        (zone.audit.status === "invalid" ||
          zone.audit.violations.length > 0 ||
          inconsistentSpawnAudit(zone) ||
          zone.audit.findings.some((finding) => finding.reasons.length > 0));
      const unverified =
        zone.audit === undefined ||
        zone.audit.status === "unverified" ||
        zone.audit.missingCoverage.length > 0 ||
        zone.audit.findings.some((finding) => finding.coverage.length > 0) ||
        zone.audit.validPlaced !== zone.audit.placed;
      const goal = invalid
        ? "invalid"
        : unverified
          ? "unverified"
          : zone.audit!.validPlaced >= minimumSlotDelivery("runtime-90", zone.configured) &&
              zone.audit!.meetsValidPlacementFloor
            ? "met"
            : "below floor";
      const configuredGoal = invalid
        ? "invalid"
        : unverified
          ? "unverified"
          : zone.audit!.validPlaced === zone.configured
            ? "met"
            : "below target";
      if (
        goal === "invalid" ||
        (sum.goal !== "invalid" && goal === "unverified") ||
        (sum.goal === "met" && goal === "below floor")
      ) {
        sum.goal = goal;
      }
      if (
        configuredGoal === "invalid" ||
        (sum.configuredTargetGoal !== "invalid" && configuredGoal === "unverified") ||
        (sum.configuredTargetGoal === "met" && configuredGoal === "below target")
      ) {
        sum.configuredTargetGoal = configuredGoal;
      }
      if (variation.has(zone)) {
        sum.variationExposures++;
        for (const field of SPAWN_COUNT_FIELDS) {
          observed[field].push(exposure[field]);
        }
      }
      samples.set(key, observed);
      groups.set(key, sum);
    }
  }
  return [...groups.values()]
    .map((sum) => {
      const observed = samples.get(`${sum.position}:${sum.zone}:${sum.kind}`)!;
      return {
        ...sum,
        perExposure: Object.fromEntries(
          SPAWN_COUNT_FIELDS.map((field) => {
            const values = observed[field];
            return [
              field,
              values.length === 0 || values.some((value) => value === null)
                ? null
                : {
                    max: Math.max(...(values as number[])),
                    mean: mean(values as number[]),
                    min: Math.min(...(values as number[])),
                  },
            ];
          }),
        ) as SpawnEventSummary["perExposure"],
        validConfiguredRate:
          sum.valid === null || sum.configured === null || sum.configured === 0
            ? null
            : sum.valid / sum.configured,
      };
    })
    .sort(
      (a, b) =>
        a.position - b.position || a.zone.localeCompare(b.zone) || a.kind.localeCompare(b.kind),
    );
}

// Validation is independent of gameplay completion and never pools one zone's surplus
// against another zone's missing events.
export function spawnValidationFailures(target: number, rows: readonly MatrixRow[]): string[] {
  parseSpawnTarget(String(target));
  return rows.flatMap((row) =>
    row.spawnRuns.flatMap((run) => {
      const failed =
        run.failure === null ? [] : [`seed ${run.seed}: planning failed: ${run.failure.message}`];
      if (run.zones.length === 0 && run.failure === null) {
        return [`seed ${run.seed}: no zone audit recorded`];
      }
      return [
        ...failed,
        ...run.zones.flatMap((zone) => {
          const audit = zone.audit;
          const reasons: string[] = [];
          if (audit === undefined) {
            reasons.push("missing audit");
          } else {
            if (audit.status !== "valid") {
              reasons.push(`audit ${audit.status}`);
            }
            if (audit.missingCoverage.length > 0) {
              reasons.push(`missing coverage: ${audit.missingCoverage.join(", ")}`);
            }
            if (inconsistentSpawnAudit(zone)) {
              reasons.push("frozen configured quota mismatch");
            }
            if (
              audit.validPlaced !== audit.placed ||
              audit.findings.some((finding) => finding.coverage.length > 0)
            ) {
              reasons.push("unverified emitted placements");
            }
            if (
              audit.validPlaced > audit.requested ||
              audit.findings.some((finding) => finding.reasons.length > 0)
            ) {
              reasons.push("invalid emitted placements");
            }
            const floor = Math.max(
              Math.ceil(zone.configured * target),
              zone.slots?.delivery.required ?? 0,
            );
            if (
              (target === 1 ? audit.validPlaced !== zone.configured : audit.validPlaced < floor) ||
              !audit.meetsValidPlacementFloor
            ) {
              reasons.push(`valid ${audit.validPlaced}/${zone.configured}, requires ${floor}`);
            }
            if (audit.violations.length > 0) {
              reasons.push(...audit.violations.slice(0, 3));
            }
          }
          const context = `seed ${zone.seed}, zone ${zone.position} ${zone.zone}`;
          return reasons.length === 0 ? [] : [`${context}: ${reasons.join("; ")}`];
        }),
      ];
    }),
  );
}
