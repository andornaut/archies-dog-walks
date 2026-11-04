import type { SpawnSlotRole } from "../data/types";
import { minimumSlotDelivery, type SlotDelivery } from "./slotDelivery";
import type { SlotPlacement } from "./slotFeasibility";
import type { AdmissionReport } from "./spawnAdmission";
import type { PlannedSpawns, SpawnPlan } from "./spawning";

export interface SlotAssignment<Kind extends string> {
  readonly auxiliary?: { readonly requestIndex: number; readonly memberIndex: number };
  readonly entry: SlotPlacement<Kind>;
  readonly key: string;
  readonly phase: "active" | "capacity";
  readonly binding: {
    readonly kind: Kind;
    readonly role: SpawnSlotRole | "auxiliaryFixed" | "auxiliaryMoving";
    readonly weight: number;
  };
  readonly role: SpawnSlotRole | "auxiliaryFixed" | "auxiliaryMoving";
}

export interface SlotMaterialisation<Kind extends string> {
  readonly plan: SpawnPlan<Kind>;
  readonly planned: PlannedSpawns<Kind> & { readonly admission: AdmissionReport<Kind> };
}
export interface SlotPartialMaterialisation<Kind extends string> {
  readonly plan: SpawnPlan<Kind>;
  readonly planned: PlannedSpawns<Kind> & {
    readonly admission: AdmissionReport<Kind> & { readonly delivery: SlotDelivery<Kind> };
  };
}

// Quotas bind selected kinds to slots; they are not a second configured per-kind budget.
export function materialiseSlotPlan<Kind extends string>(
  geometry: Omit<SpawnPlan<Kind>, "quotas">,
  path: PlannedSpawns<Kind>["path"],
  assignments: readonly SlotAssignment<Kind>[],
): SlotMaterialisation<Kind> {
  const entries = assignments.map(({ entry }) => entry);
  const byDistance = (a: SlotPlacement<Kind>["event"], b: SlotPlacement<Kind>["event"]) =>
    a.distance - b.distance || a.lane - b.lane;
  const events = entries
    .filter((entry) => !entry.herring)
    .map((entry) => entry.event)
    .sort(byDistance);
  const herrings = entries
    .filter((entry) => entry.herring)
    .map((entry) => entry.event)
    .sort(byDistance);
  const plan = { ...geometry, quotas: entries.map((entry) => entry.request) };
  const counts = new Map<
    string,
    {
      admitted: number;
      herrings: number;
      kind: Kind;
      movement: NonNullable<SlotPlacement<Kind>["event"]["mover"]>["movement"] | null;
      requested: number;
    }
  >();
  for (const entry of entries) {
    const movement = entry.event.mover?.movement ?? null;
    const key = `${entry.event.kind}:${movement}`;
    const count = counts.get(key) ?? {
      admitted: 0,
      herrings: 0,
      kind: entry.event.kind,
      movement,
      requested: 0,
    };
    count.requested++;
    if (entry.herring) {
      count.herrings++;
    } else {
      count.admitted++;
    }
    counts.set(key, count);
  }
  return {
    plan,
    planned: {
      admission: {
        capacity: { limits: [], rows: path.length },
        counts: [...counts.values()],
        placement: { missing: [], placed: entries.length, ratio: 1, requested: entries.length },
        rejections: [],
        substitutions: [],
      },
      events,
      herrings,
      path,
      visibility: entries.map((entry) => ({
        ...entry.trace,
        index: (entry.herring ? herrings : events).indexOf(entry.event),
        source: entry.herring ? "herrings" : "events",
      })),
    },
  };
}

export function materialisePartialSlotPlan<Kind extends string>(
  geometry: Omit<SpawnPlan<Kind>, "quotas">,
  path: PlannedSpawns<Kind>["path"],
  delivery: SlotDelivery<Kind>,
  assignments: readonly SlotAssignment<Kind>[],
): SlotPartialMaterialisation<Kind> {
  if (
    delivery.policy !== "runtime-90" ||
    delivery.delivered !== assignments.length ||
    delivery.required !== minimumSlotDelivery("runtime-90", delivery.configured) ||
    delivery.delivered < delivery.required ||
    delivery.configured !== delivery.delivered + delivery.omissions.length
  ) {
    throw new RangeError("Partial materialisation requires matching original delivery accounting");
  }
  const { plan, planned } = materialiseSlotPlan(geometry, path, assignments);
  return {
    plan,
    planned: {
      ...planned,
      admission: {
        ...planned.admission,
        delivery,
        placement: {
          // Omitted weighted jobs have no concrete selected kind; delivery retains every identity.
          missing: [],
          placed: delivery.delivered,
          ratio: delivery.configured === 0 ? 1 : delivery.delivered / delivery.configured,
          requested: delivery.configured,
        },
      },
    },
  };
}
