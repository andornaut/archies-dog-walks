import { STEP_SECONDS } from "@andornaut/game-kit/clock/fixedStep";
import { chanceRound, shuffled } from "@andornaut/game-kit/random";
import { keysOf } from "@andornaut/game-kit/records";

import type {
  EncounterId,
  GameData,
  MinorObstacleId,
  ObstacleEncounterId,
  SpawnSlotRole,
  Zone,
  ZoneId,
} from "../data/types.ts";
import { PART_INSET } from "../layout/packFormation.ts";
import { drawGearDrops } from "../rules/gearDrops.ts";
import { modifiedStat } from "../rules/modifiers.ts";
import { currentZone, currentZoneId } from "../rules/route.ts";
import { read } from "../rules/units.ts";
import { slowestDebuffedAgility, slowestPackAgility } from "../rules/walkers.ts";
import { zoneStats } from "../rules/zones.ts";
import type { RunState } from "../state/runState.ts";
import { assignedMovement, type ProfiledMovement } from "./movementAssignments.ts";
import type { PlannerStreams } from "./moverPlanning.ts";
import { moverMovement, moverSpec } from "./moverSpecs.ts";
import { pickSkin } from "./obstacleLooks.ts";
import type { SlotAudit } from "./slotAudit.ts";
import { apportionSlotCounts, slotCountTotal, type SlotGuarantee } from "./slotConfig.ts";
import { minimumSlotDelivery, type SlotDelivery, type SlotPartialAudit } from "./slotDelivery.ts";
import type { SlotAssignment } from "./slotPlan.ts";
import { SLOT_LIMITS, type SlotDiagnostics } from "./slotPlanner.ts";
import type { PlannedSpawns, SpawnPlan, SpawnQuota } from "./spawning.ts";
import { type SpawnPlanSnapshot, type SpawnSearchContext } from "./spawnSearch.ts";
import { spacedStretch } from "./stretches.ts";
import {
  componentHitLength,
  itemHeight,
  plannedCellInset,
  type RoadGeometry,
  type Walk,
  type WalkData,
  walkScrollSpeed,
  zoneLength,
} from "./walk.ts";
import {
  blocksLane,
  footprintOf,
  isMinorObstacle,
  isObstacle,
  type ObstacleKind,
  opensACard,
  type WalkItemKind,
  type WalkSpawn,
} from "./walkItems.ts";
import {
  replayZoneSlots,
  type ZoneSlotInput,
  type ZoneSlotKind,
  ZoneSlotPlanningError,
} from "./zoneSlotInput.ts";

// The entries of a zone's weights above 0, in the data's order.
function positiveWeights<Id extends string>(weights: Readonly<Record<Id, number>>): [Id, number][] {
  return keysOf(weights)
    .map((id): [Id, number] => [id, weights[id]])
    .filter(([, weight]) => weight > 0);
}

// The chance weights of the obstacles in the run's current zone.
export function obstacleWeights(
  data: Pick<GameData, "world">,
  run: Pick<RunState, "route" | "zoneIndex">,
): [ObstacleEncounterId, number][] {
  return positiveWeights(currentZone(data, run).weights.obstacles);
}

// The minor obstacles that may appear in the run's current zone, with their weights.
export function minorObstacleWeights(
  data: Pick<GameData, "world">,
  run: Pick<RunState, "route" | "zoneIndex">,
): [MinorObstacleId, number][] {
  return positiveWeights(currentZone(data, run).weights.minorObstacles);
}

type MovementData = Pick<
  GameData,
  "encounters" | "minorObstacles" | "movementAssignments" | "movementProfiles"
>;

// The movement zone gives kind, or null in a zone without movers.
function zoneMovement(data: MovementData, zone: Zone, kind: ObstacleKind): ProfiledMovement | null {
  return zone.moverShare <= 0 ? null : assignedMovement(data, zone.id as ZoneId, kind);
}

// The slot role of a kind from pool with movement.
function slotRole(pool: "encounter" | "minor", movement: ProfiledMovement | null): SpawnSlotRole {
  if (pool === "encounter") {
    return movement === null ? "encounterFixed" : "encounterMoving";
  }
  return movement === null ? "minorFixed" : "minorMoving";
}

const isMovingRole = (role: SpawnSlotRole) => role === "encounterMoving" || role === "minorMoving";

// One guarantee for each kind zone weighs above 0, so every such kind appears at least once.
// Guaranteed jobs reserve slots in this order: moving roles before fixed roles, then larger
// footprints (lanes times rows), then more lanes, then kind names in code-unit order.
export function zoneSlotGuarantees(data: MovementData, zone: Zone): SlotGuarantee<ObstacleKind>[] {
  const sources = [
    ...positiveWeights(zone.weights.obstacles).map(([kind]) => ({
      kind,
      pool: "encounter" as const,
    })),
    ...positiveWeights(zone.weights.minorObstacles).map(([kind]) => ({
      kind,
      pool: "minor" as const,
    })),
  ].map(({ kind, pool }) => ({
    footprint: footprintOf(data, kind),
    kind,
    role: slotRole(pool, zoneMovement(data, zone, kind)),
  }));
  const area = ({ footprint }: (typeof sources)[number]) => footprint.lanes * footprint.rows;
  return sources
    .sort(
      (a, b) =>
        Number(isMovingRole(b.role)) - Number(isMovingRole(a.role)) ||
        area(b) - area(a) ||
        b.footprint.lanes - a.footprint.lanes ||
        (a.kind < b.kind ? -1 : a.kind > b.kind ? 1 : 0),
    )
    .map(({ kind, role }) => ({ count: 1, kind, role }));
}

// The guarantees name each positive-weight catalogue kind once, in its catalogue role.
function assertGuaranteesMatchWeights(
  catalogue: readonly ZoneSlotKind<WalkItemKind>[],
  guarantees: readonly SlotGuarantee<WalkItemKind>[],
): void {
  const key = ({ kind, role }: { kind: string; role: string }) => `${role}:${kind}`;
  const weighted = catalogue
    .filter(({ weight }) => weight > 0)
    .map(key)
    .sort();
  const guaranteed = guarantees.map(key).sort();
  if (
    guarantees.some(({ count }) => count !== 1) ||
    weighted.length !== guaranteed.length ||
    weighted.some((entry, index) => entry !== guaranteed[index])
  ) {
    throw new Error("Zone guarantees must name each positive-weight kind once");
  }
}

// The walk's first zone starts with spawns on the road in view, the first meeting the pack no
// sooner than this long in; later zones start with their own spawns still to come into view.
export function firstContactSeconds(
  data: Pick<GameData, "tuning">,
  run: Pick<RunState, "zoneIndex">,
): number | undefined {
  return run.zoneIndex === 0 ? read(data.tuning, "seconds", "firstZoneContact") : undefined;
}

// A zone's auxiliary requests, drawn from its spawns stream: of each lucky find kind, zoneStats'
// luckyFinds rounded by chanceRound, in the kinds' order, then shuffled, each a quota of its own
// held to its spaced stretch of the zone (spacedStretch) and, where its look moves, a mover at the
// zone's mover share; then its gear drops (drawGearDrops), each a quota of its own held to its
// spaced stretch; then its tips and treats, scaled as Rush hour and the like scale them. None
// blocks a lane.
export function auxiliarySpawnQuotas(
  data: WalkData,
  streams: PlannerStreams,
  run: RunState,
): SpawnQuota<WalkItemKind>[] {
  const random = streams.spawns;
  const zone = currentZone(data, run);
  const zoneId = currentZoneId(data, run);
  const stats = zoneStats(data.tuning, zone, run.zoneIndex);
  const scaled = (stat: "tipSpawns" | "treatSpawns", base: number) =>
    Math.round(modifiedStat(data.tuning, run.modifiers, stat, base));
  const moverQuota = (kind: WalkItemKind, movement: ProfiledMovement, count: number) => ({
    blocksLane: false,
    count,
    kind,
    mover: moverSpec(data, streams, footprintOf(data, kind), movement),
  });
  const finds = shuffled(
    random,
    (Object.entries(stats.luckyFinds) as [EncounterId, number][]).flatMap(([kind, expected]) =>
      Array.from({ length: chanceRound(random, expected) }, () => kind),
    ),
  );
  const lucky = finds.map((kind, i): SpawnQuota<WalkItemKind> => {
    const within = spacedStretch(finds.length, i);
    const movement = moverMovement(data, random, zone.moverShare, zoneId, kind);
    return movement === null
      ? { blocksLane: false, count: 1, footprint: footprintOf(data, kind), kind, within }
      : { ...moverQuota(kind, movement, 1), within };
  });
  const drops = drawGearDrops(data, random, run);
  return [
    ...lucky,
    ...drops.map((gear, i): SpawnQuota<WalkItemKind> => ({
      blocksLane: false,
      count: 1,
      kind: gear,
      within: spacedStretch(drops.length, i),
    })),
    {
      blocksLane: false,
      count: scaled("tipSpawns", stats.tips),
      kind: "tip",
      moversPassOver: true,
      moversRestOn: true,
    },
    {
      blocksLane: false,
      count: scaled("treatSpawns", stats.treats),
      kind: "treat",
      moversPassOver: true,
    },
  ];
}

export type ZoneSlotDelivery = {
  readonly delivery: SlotDelivery<WalkItemKind>;
} & (
  | { readonly active: SlotAudit; readonly status: "complete" }
  | { readonly partialAudit: SlotPartialAudit<WalkItemKind>; readonly status: "partial" }
);

export interface ZonePlanObservation {
  readonly context: SpawnSearchContext;
  readonly plan: SpawnPlan<WalkItemKind>;
  readonly planned: PlannedSpawns<WalkItemKind>;
  readonly snapshot?: SpawnPlanSnapshot<WalkItemKind>;
  readonly slots?: ZoneSlotDelivery & {
    readonly purpose: "runtime-actual";
    readonly assignments: readonly SlotAssignment<WalkItemKind>[];
    readonly diagnostics: SlotDiagnostics;
    readonly input: ZoneSlotInput<WalkItemKind>;
  };
}

export interface ZonePlanningContext extends SpawnSearchContext {
  readonly observePlan?: (observation: ZonePlanObservation) => void;
}

// Plans the run's current zone: its spawns, each obstacle and lucky encounter drawn by the
// zone's weights. Last, each minor obstacle with skins picks its skin (pickSkin) from the spawns
// stream, after every spawn is placed, so the picks move no spawn.
export function planZoneWithContext(
  data: WalkData,
  geometry: Pick<
    RoadGeometry,
    | "cell"
    | "itemHeights"
    | "laneCount"
    | "lens"
    | "packBand"
    | "roadBottom"
    | "roadTop"
    | "sightLength"
    | "tallestPackBand"
  >,
  context: ZonePlanningContext,
  streams: PlannerStreams,
  walk: Walk,
): Walk {
  const { road, run } = walk;
  const length = zoneLength(data);
  // Each lane-blocking kind's drawn hit length, standing and moving, for the pack-fit gap.
  const withHitLengths = (quotas: SpawnQuota<WalkItemKind>[]) =>
    quotas.map((quota) =>
      !quota.blocksLane
        ? quota
        : {
            ...quota,
            hitLength: itemHeight(data, geometry, quota.kind, false),
            ...(quota.mover === undefined
              ? {}
              : {
                  mover: {
                    ...quota.mover,
                    hitLength:
                      quota.mover.motion.kind === "signature" &&
                      quota.mover.motion.profile.kind === "delayedTrail"
                        ? componentHitLength(geometry, quota.mover.motion.profile)
                        : itemHeight(data, geometry, quota.kind, true),
                  },
                }),
          },
    );
  const firstContact = firstContactSeconds(data, run);
  const plan = {
    cellInset: plannedCellInset(data, geometry),
    cellLength: geometry.cell.length,
    ...(firstContact === undefined ? {} : { firstContactSeconds: firstContact }),
    fixedKinds: [],
    laneCount: geometry.laneCount,
    laneInset: geometry.cell.inset,
    // The slowest pack's lane move sets the row spacing, so every pack fits every gap.
    laneMoveSeconds: read(data.tuning, "seconds", "laneMove") / slowestPackAgility(data),
    maxEmptyRows: read(data.tuning, "counts", "maxEmptyRows"),
    minOpenLanes: read(data.tuning, "counts", "openLanesPerRowMin"),
    minSpacing: read(data.tuning, "pixels", "spawnRowSpacing"),
    moverCaps: {
      darts: read(data.tuning, "counts", "maxDartMovers"),
      slowVehicles: read(data.tuning, "counts", "maxSlowVehicles"),
      total: read(data.tuning, "counts", "maxMovers"),
    },
    // The tallest pack's hit boxes, inside its outline by PART_INSET at each end.
    packHitLength: geometry.tallestPackBand - 2 * PART_INSET,
    packLength: geometry.tallestPackBand,
    // A Muddy pack's lane move, the slowest, spaces the path's lane changes: a puddle, a pothole
    // or a card may muddy the pack in any neighbourhood, and Muddy may last past its end.
    pathLaneMoveSeconds: read(data.tuning, "seconds", "laneMove") / slowestDebuffedAgility(data),
    // The path goes on from where the last zone's ends, or starts in the pack's lane.
    pathStart: road.path[road.path.length - 1]?.lane ?? road.control.target,
    reactionSeconds: read(data.tuning, "seconds", "pathReactionMargin"),
    riderFollowGap: read(data.tuning, "pixels", "riderFollowGap"),
    roadLength: geometry.roadBottom - geometry.roadTop,
    scrollSpeed: walkScrollSpeed(data, run),
    sightLength: geometry.sightLength,
    stepSeconds: STEP_SECONDS,
    zoneLength: length,
  };
  const zoneConfig = currentZone(data, run);
  const authored = zoneConfig.spawnSlots.counts[run.zoneIndex];
  if (authored === undefined) {
    throw new RangeError(`Missing slot counts for zone position ${run.zoneIndex}`);
  }
  const total = Math.round(
    modifiedStat(data.tuning, run.modifiers, "obstacleSpawns", slotCountTotal(authored)),
  );
  const active = apportionSlotCounts(total, authored);
  const catalogue: ZoneSlotKind<WalkItemKind>[] = [];
  for (const [pool, weights] of [
    ["encounter", obstacleWeights(data, run)],
    ["minor", minorObstacleWeights(data, run)],
  ] as const) {
    for (const [kind, weight] of weights) {
      const movement = zoneMovement(data, zoneConfig, kind);
      const role = slotRole(pool, movement);
      const blocking = blocksLane(data, kind);
      catalogue.push({
        footprint: footprintOf(data, kind),
        kind,
        movement,
        ...(blocking && movement !== null
          ? {
              movingHitLength:
                movement.signature?.kind === "delayedTrail"
                  ? componentHitLength(geometry, movement.signature)
                  : itemHeight(data, geometry, kind, true),
            }
          : {}),
        role,
        spec: {
          blocksLane: blocking,
          first: opensACard(data, kind),
          hazard: isObstacle(data, kind),
          ...(blocking ? { hitLength: itemHeight(data, geometry, kind, false) } : {}),
          ...(movement === null ? { footprint: footprintOf(data, kind) } : {}),
        },
        weight,
      });
    }
  }
  const guarantees = zoneSlotGuarantees(data, zoneConfig);
  assertGuaranteesMatchWeights(catalogue, guarantees);
  const input: ZoneSlotInput<WalkItemKind> = {
    actualRun: run,
    auxiliary: withHitLengths(auxiliarySpawnQuotas(data, streams, run)).map((quota) => ({
      ...quota,
      hazard: false,
    })),
    catalogue,
    config: {
      active,
      capacity: zoneConfig.spawnSlots.capacity,
      guarantees,
    },
    context: {
      coverageFirst: true,
      // The 90% floor is the runtime release rule; the search still prefers 100% delivery.
      delivery: "runtime-90",
      fairSources: true,
      limits: { ...SLOT_LIMITS, candidateChecks: 2 * SLOT_LIMITS.candidateChecks },
      runtimeSearch: "original-then-balanced",
      seed: context.seed,
      zoneIndex: context.zoneIndex,
    },
    geometry: {
      ...plan,
      maxEmptyRows: Number.isFinite(plan.maxEmptyRows) ? plan.maxEmptyRows : null,
    },
    tuning: data.tuning,
  };
  const result = replayZoneSlots(input);
  if (result.status === "unsupported") {
    throw new ZoneSlotPlanningError(input, result);
  }
  if (
    result.status === "partial" &&
    (result.partialAudit.status !== "valid" ||
      result.delivery.policy !== "runtime-90" ||
      result.partialAudit.delivery.configured !== result.delivery.configured ||
      result.partialAudit.delivery.delivered !== result.delivery.delivered ||
      result.delivery.configured !==
        slotCountTotal(input.config.active) +
          input.auxiliary.reduce((count, quota) => count + quota.count, 0) ||
      result.delivery.delivered < minimumSlotDelivery("runtime-90", result.delivery.configured))
  ) {
    throw new Error("Invalid runtime partial slot certificate");
  }
  context.observePlan?.({
    context: { seed: context.seed, zoneIndex: context.zoneIndex },
    plan: result.plan,
    planned: result.planned,
    slots: {
      ...(result.status === "complete"
        ? { active: result.activeAudit, status: "complete" }
        : { partialAudit: result.partialAudit, status: "partial" }),
      assignments: result.assignments,
      delivery: result.delivery,
      diagnostics: result.diagnostics,
      input,
      purpose: "runtime-actual",
    },
  });
  const planned = result.plan.quotas.map(({ count, kind, mover }) => ({
    count,
    kind,
    movement: mover?.movement ?? null,
  }));
  const { admission, events, herrings, path } = result.planned;
  const zone = currentZone(data, run).id;
  const pending = events.map((event): WalkSpawn => {
    const skin = isMinorObstacle(data, event.kind)
      ? pickSkin(data, streams.spawns, zone, event.kind)
      : undefined;
    return skin === undefined ? event : { ...event, skin };
  });
  return { road: { ...road, admission, herrings, path, pending, planned }, run };
}

// Direct planner callers have no session seed. Their deterministic repair namespace is explicit.
export function planZone(
  data: WalkData,
  geometry: Parameters<typeof planZoneWithContext>[1],
  streams: PlannerStreams,
  walk: Walk,
): Walk {
  return planZoneWithContext(
    data,
    geometry,
    { seed: 0, zoneIndex: walk.run.zoneIndex },
    streams,
    walk,
  );
}
