import type { SpawnSlotRole } from "../data/types";
import {
  SLOT_ROLES,
  type SlotConfiguration,
  slotFootprint,
  type SlotKind,
  type SlotLaneEffect,
  type SlotPlanningRole,
  type SlotSource,
} from "./slotConfig";
import { type SpawnQuota } from "./spawning";

export interface SlotJob<Kind extends string> {
  readonly auxiliary?: { readonly requestIndex: number; readonly memberIndex: number };
  readonly guaranteed?: true;
  readonly key: string;
  readonly laneEffect: SlotLaneEffect;
  readonly quietCoverage?: true;
  readonly ordinal: number;
  readonly phase: "active";
  readonly role: SlotPlanningRole;
  readonly sources: readonly SlotSource<Kind>[];
  readonly total: number;
}
const TRAJECTORY_FIRST: readonly SpawnSlotRole[] = [
  "encounterMoving",
  "minorMoving",
  "encounterFixed",
  "minorFixed",
];
export function makeSlotJobs<Kind extends string>(
  catalogue: readonly SlotKind<Kind>[],
  auxiliary: readonly SpawnQuota<Kind>[],
  config: SlotConfiguration<Kind>,
): SlotJob<Kind>[] {
  const jobs: SlotJob<Kind>[] = [];
  const guaranteed = Object.fromEntries(SLOT_ROLES.map((role) => [role, 0])) as unknown as Record<
    SpawnSlotRole,
    number
  >;
  const job = (role: SpawnSlotRole, ordinal: number, kind?: Kind): SlotJob<Kind> => ({
    key: `active:${role}:${ordinal}`,
    laneEffect: "possible",
    ordinal,
    phase: "active",
    role,
    sources: catalogue.filter(
      (source) =>
        source.role === role && source.weight > 0 && (kind === undefined || source.kind === kind),
    ),
    total: config.active[role],
  });
  for (const guarantee of config.guarantees) {
    for (let member = 0; member < guarantee.count; member++) {
      jobs.push({
        ...job(guarantee.role, guaranteed[guarantee.role]++, guarantee.kind),
        guaranteed: true,
      });
    }
  }
  // Moving trajectories reserve their full swept footprint before static choices.
  for (const role of TRAJECTORY_FIRST) {
    for (let member = guaranteed[role]; member < config.active[role]; member++) {
      jobs.push(job(role, member));
    }
  }
  auxiliary.forEach((request, requestIndex) => {
    const { count, kind, ...spec } = request;
    const role = request.mover === undefined ? "auxiliaryFixed" : "auxiliaryMoving";
    const source: SlotSource<Kind> = {
      compile: () => spec,
      footprint: slotFootprint(request),
      kind,
      role,
      weight: 1,
    };
    for (let memberIndex = 0; memberIndex < count; memberIndex++) {
      jobs.push({
        auxiliary: { memberIndex, requestIndex },
        key: `auxiliary:${requestIndex}:${memberIndex}`,
        laneEffect: spec.blocksLane === false ? "none" : "possible",
        ordinal: memberIndex,
        phase: "active",
        role,
        sources: [source],
        total: count,
      });
    }
  });
  return jobs;
}
export function minimumUnsharedCells<Kind extends string>(job: SlotJob<Kind>): number {
  if (
    job.role === "encounterMoving" ||
    job.role === "minorMoving" ||
    job.role === "auxiliaryMoving"
  ) {
    return 0;
  }
  // Moving-passable rewards can use cells already swept by movers.
  if (job.role === "auxiliaryFixed") {
    return 0;
  }
  // Standing footprints may overlap mover-held cells. Source metadata alone proves no
  // positive marginal demand on the native ledger's untaken-cell count.
  return 0;
}
