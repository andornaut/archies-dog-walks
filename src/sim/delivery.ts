import type { GameData, MovementKind, ZoneId } from "../data/types.ts";
import { itemCategory, opensACard, type WalkItemKind } from "../runner/walkItems.ts";
import type { ZoneSlotDelivery } from "../runner/zonePlan.ts";

// Selected kind quotas and original runtime totals remain separate when jobs are omitted.

// What the counts read of a zone's plan, the road as planZone leaves it: each quota's kind,
// count and movement, null standing still, and each placed spawn's kind and movement, with no
// mover standing still.
export interface ZonePlanView {
  readonly slots?: ZoneSlotDelivery;
  readonly pending: readonly {
    readonly kind: WalkItemKind;
    readonly mover?: { readonly movement: MovementKind };
  }[];
  readonly planned: readonly {
    readonly count: number;
    readonly kind: WalkItemKind;
    readonly movement: MovementKind | null;
  }[];
}

// Gear drops are their own group. Minor obstacles are split by how they move: standing still,
// darting across, riding in a lane, or anything else (hopping or stalking). Obstacles that are
// encounters split into those that open a card and those that do not (contact and pull
// obstacles).
export const DELIVERY_GROUPS = [
  "tips",
  "treats",
  "lucky",
  "drops",
  "minorStatic",
  "minorDart",
  "minorRider",
  "minorOther",
  "card",
  "noCard",
] as const;

export type DeliveryGroup = (typeof DELIVERY_GROUPS)[number];

export interface Delivered {
  placed: number;
  planned: number;
}

// One zone's counts, or, summed, every plan of a zone at a walk position: plans counts them.
// position is 1 for the walk's first zone.
export interface ZoneDelivery {
  readonly runtime?: {
    readonly completePlans: number;
    readonly configured: number;
    readonly delivered: number;
    readonly omitted: number;
    readonly partialPlans: number;
  };
  readonly groups: Record<DeliveryGroup, Delivered>;
  readonly kinds: Partial<Record<WalkItemKind, Delivered>>;
  readonly plans: number;
  readonly position: number;
  readonly zone: ZoneId;
}

type DeliveryData = Pick<GameData, "encounters" | "minorObstacles">;

function deliveryGroup(
  data: DeliveryData,
  kind: WalkItemKind,
  movement: MovementKind | null,
): DeliveryGroup {
  const category = itemCategory(data, kind);
  if (category === "tip" || category === "treat") {
    return `${category}s`;
  }
  if (category === "lucky") {
    return "lucky";
  }
  if (category === "gear") {
    return "drops";
  }
  if (category === "obstacle") {
    return opensACard(data, kind) ? "card" : "noCard";
  }
  if (movement === null) {
    return "minorStatic";
  }
  if (movement === "dart" || movement === "dive" || movement === "stopAndGoAcross") {
    return "minorDart";
  }
  return movement === "inLane" || movement === "merge" ? "minorRider" : "minorOther";
}

function noGroups(): Record<DeliveryGroup, Delivered> {
  return Object.fromEntries(
    DELIVERY_GROUPS.map((group) => [group, { placed: 0, planned: 0 }]),
  ) as Record<DeliveryGroup, Delivered>;
}

function addTo<Key extends string>(
  counts: Partial<Record<Key, Delivered>>,
  key: Key,
  placed: number,
  planned: number,
): void {
  const count = counts[key] ?? { placed: 0, planned: 0 };
  count.placed += placed;
  count.planned += planned;
  counts[key] = count;
}

// The counts of one zone's plan, read from the road planZone left: a kind under the group of the
// movement it was planned or placed with, so a mover planned that stood still instead counts as
// planned moving and placed standing.
export function zoneDelivery(
  data: DeliveryData,
  position: number,
  zone: ZoneId,
  plan: ZonePlanView,
): ZoneDelivery {
  const groups = noGroups();
  const kinds: Partial<Record<WalkItemKind, Delivered>> = {};
  for (const quota of plan.planned) {
    addTo(groups, deliveryGroup(data, quota.kind, quota.movement), 0, quota.count);
    addTo(kinds, quota.kind, 0, quota.count);
  }
  for (const spawn of plan.pending) {
    addTo(groups, deliveryGroup(data, spawn.kind, spawn.mover?.movement ?? null), 1, 0);
    addTo(kinds, spawn.kind, 1, 0);
  }
  return {
    groups,
    kinds,
    plans: 1,
    position,
    ...(plan.slots === undefined
      ? {}
      : {
          runtime: {
            completePlans: Number(plan.slots.status === "complete"),
            configured: plan.slots.delivery.configured,
            delivered: plan.slots.delivery.delivered,
            omitted: plan.slots.delivery.omissions.length,
            partialPlans: Number(plan.slots.status === "partial"),
          },
        }),
    zone,
  };
}

// The deliveries summed by walk position and zone, in walk position then zone id order.
export function sumDeliveries(deliveries: readonly ZoneDelivery[]): ZoneDelivery[] {
  const sums = new Map<string, ZoneDelivery>();
  for (const delivery of deliveries) {
    const key = `${delivery.position} ${delivery.zone}`;
    const sum: ZoneDelivery = sums.get(key) ?? {
      groups: noGroups(),
      kinds: {},
      plans: 0,
      position: delivery.position,
      zone: delivery.zone,
    };
    for (const group of DELIVERY_GROUPS) {
      addTo(sum.groups, group, delivery.groups[group].placed, delivery.groups[group].planned);
    }
    for (const [kind, count] of Object.entries(delivery.kinds) as [WalkItemKind, Delivered][]) {
      addTo(sum.kinds, kind, count.placed, count.planned);
    }
    const runtime = delivery.runtime;
    sums.set(key, {
      ...sum,
      plans: sum.plans + delivery.plans,
      ...(runtime === undefined
        ? {}
        : {
            runtime: {
              completePlans: (sum.runtime?.completePlans ?? 0) + runtime.completePlans,
              configured: (sum.runtime?.configured ?? 0) + runtime.configured,
              delivered: (sum.runtime?.delivered ?? 0) + runtime.delivered,
              omitted: (sum.runtime?.omitted ?? 0) + runtime.omitted,
              partialPlans: (sum.runtime?.partialPlans ?? 0) + runtime.partialPlans,
            },
          }),
    });
  }
  return [...sums.values()].sort((a, b) => a.position - b.position || a.zone.localeCompare(b.zone));
}
