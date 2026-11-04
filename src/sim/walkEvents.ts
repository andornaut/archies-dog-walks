import type { ZoneId } from "../data/types.ts";
import type { SlotPlanningFailure } from "../runner/slotPlanner.ts";
import type { AdmissionReport } from "../runner/spawnAdmission.ts";
import { SpawnPlanningError, type SpawnPlanSnapshot } from "../runner/spawnSearch.ts";
import type { SpawnAudit } from "../runner/spawnValidation.ts";
import type { Walk, WalkStep } from "../runner/walk.ts";
import type { WalkItemKind } from "../runner/walkItems.ts";
import type { ZoneSlotDelivery } from "../runner/zonePlan.ts";
import { type ZoneSlotInput, ZoneSlotPlanningError } from "../runner/zoneSlotInput.ts";
import type { RunState } from "../state/runState.ts";

export type PlanningFailure =
  | {
      readonly kind: "quota";
      readonly message: string;
      readonly seed: number;
      readonly snapshot: SpawnPlanSnapshot;
    }
  | {
      readonly input: ZoneSlotInput<string>;
      readonly kind: "slots";
      readonly message: string;
      readonly purpose: "runtime-actual";
      readonly result: SlotPlanningFailure<string>;
      readonly seed: number;
    };

export function capturePlanningFailure(
  seed: number,
  play: () => void,
): PlanningFailure | undefined {
  try {
    play();
    return undefined;
  } catch (error) {
    if (error instanceof ZoneSlotPlanningError) {
      return {
        input: error.input,
        kind: "slots",
        message: error.message,
        purpose: "runtime-actual",
        result: error.result,
        seed,
      };
    }
    if (!(error instanceof SpawnPlanningError)) {
      throw error;
    }
    return { kind: "quota", message: error.message, seed, snapshot: error.snapshot };
  }
}

export interface SpawnFlow {
  admitted: number;
  departed: number;
  encountered: number;
  generated: number;
  herrings: number;
  passed: number;
  requested: number;
  touched: number;
  valid: number | null;
}

// Generated means dispatched from pending by the runner. Encountered counts native bump,
// contact, card-hit, immune-contact and collection outcomes, not side exits or placements.
export interface ZoneWalkEvents {
  admission?: AdmissionReport<WalkItemKind>;
  audit?: SpawnAudit;
  // Runtime configured counts retain original jobs, including unselected optional jobs.
  // Per-kind requests describe selected kinds and known omissions only.
  readonly configured: number;
  readonly slots?: ZoneSlotDelivery;
  readonly herringRendering: "not-simulated";
  readonly modifiers: RunState["modifiers"];
  readonly route: RunState["route"];
  readonly seed: number;
  readonly kinds: Partial<Record<WalkItemKind, SpawnFlow>>;
  readonly position: number;
  validation: SpawnAudit["status"];
  readonly zone: ZoneId;
}

function flow(events: ZoneWalkEvents, kind: WalkItemKind): SpawnFlow {
  return (events.kinds[kind] ??= {
    admitted: 0,
    departed: 0,
    encountered: 0,
    generated: 0,
    herrings: 0,
    passed: 0,
    requested: 0,
    touched: 0,
    valid: null,
  });
}

export function plannedWalkEvents(
  seed: number,
  run: Pick<RunState, "modifiers" | "route" | "zoneIndex">,
  zone: ZoneId,
  road: {
    readonly slots?: ZoneSlotDelivery;
    readonly herrings: readonly { readonly kind: WalkItemKind }[];
    readonly pending: readonly { readonly kind: WalkItemKind }[];
    readonly planned: readonly { readonly count: number; readonly kind: WalkItemKind }[];
  },
): ZoneWalkEvents {
  const events: ZoneWalkEvents = {
    configured:
      road.slots?.delivery.configured ?? road.planned.reduce((sum, { count }) => sum + count, 0),
    ...(road.slots === undefined ? {} : { slots: road.slots }),
    herringRendering: "not-simulated",
    kinds: {},
    modifiers: run.modifiers,
    position: run.zoneIndex + 1,
    route: [...run.route],
    seed,
    validation: "unverified",
    zone,
  };
  for (const { count, kind } of road.planned) {
    flow(events, kind).requested += count;
  }
  for (const omission of road.slots?.delivery.omissions ?? []) {
    if (omission.kind !== undefined) {
      flow(events, omission.kind).requested += 1;
    }
  }
  for (const { kind } of road.pending) {
    flow(events, kind).admitted += 1;
  }
  for (const { kind } of road.herrings) {
    flow(events, kind).admitted += 1;
    flow(events, kind).herrings += 1;
  }
  return events;
}

export function attachSpawnAudit(events: ZoneWalkEvents, audit: SpawnAudit): void {
  events.audit = audit;
  events.validation = audit.status;
  for (const [kind, count] of Object.entries(events.kinds)) {
    if (count !== undefined) {
      count.valid =
        audit.missingCoverage.length > 0
          ? null
          : audit.counts
              .filter((entry) => entry.kind === kind)
              .reduce((sum, entry) => sum + entry.validPlaced, 0);
    }
  }
}

export function recordWalkEvents(
  origins: Map<number, ZoneWalkEvents>,
  events: ZoneWalkEvents,
  before: Walk,
  step: WalkStep,
): void {
  const pending = new Set(step.walk.road.pending);
  const dispatched = before.road.pending.filter((event) => !pending.has(event));
  const allocated = step.walk.road.nextItemId - before.road.nextItemId;
  if (allocated !== dispatched.length) {
    throw new Error(
      `Simulator dispatch identity mismatch: ${allocated} ids for ${dispatched.length} events`,
    );
  }
  for (let id = before.road.nextItemId; id < step.walk.road.nextItemId; id++) {
    if (origins.has(id)) {
      throw new Error(`Duplicate simulated item id ${id}`);
    }
    origins.set(id, events);
  }
  // stepWalk allocates ids in due-event order, once for every dispatched event.
  const arrived = dispatched.map((event, index) => ({
    id: before.road.nextItemId + index,
    kind: event.kind,
  }));
  for (const item of arrived) {
    flow(events, item.kind).generated += 1;
  }
  const owner = (item: { readonly id: number; readonly kind: WalkItemKind }) => {
    const origin = origins.get(item.id);
    if (origin === undefined) {
      throw new Error(`Missing simulated origin for item ${item.id} (${item.kind})`);
    }
    return flow(origin, item.kind);
  };
  const touched = new Map(
    [
      ...step.bumps.filter(({ dodged }) => !dodged),
      ...step.contacts,
      ...step.instants,
      ...step.tips,
      ...step.treats,
      ...step.found,
      ...step.collected.map((item) => ({ item })),
    ].map(({ item }) => [item.id, item]),
  );
  const encountered = new Map(touched);
  for (const { item } of step.bumps) {
    encountered.set(item.id, item);
  }
  for (const { item, value } of step.modified) {
    if (value.subject.kind === "immune") {
      encountered.set(item.id, item);
    }
  }
  for (const item of touched.values()) {
    owner(item).touched += 1;
  }
  for (const item of encountered.values()) {
    owner(item).encountered += 1;
  }
  const encounterItems = step.encounterItems ?? [];
  if (encounterItems.length !== step.encounterHits.length) {
    throw new Error("Missing native card-hit item identities in simulator step");
  }
  for (const [index, item] of encounterItems.entries()) {
    if (item.kind !== step.encounterHits[index]?.encounter) {
      throw new Error(`Card-hit identity kind mismatch for item ${item.id}`);
    }
    owner(item).encountered += 1;
    owner(item).touched += 1;
  }
  for (const item of step.passed) {
    owner(item).passed += 1;
  }
  const remaining = new Set(step.walk.road.items.map(({ id }) => id));
  for (const item of [...before.road.items, ...arrived]) {
    if (!remaining.has(item.id)) {
      owner(item).departed += 1;
      origins.delete(item.id);
    }
  }
}
