import type { ZoneId } from "../data/types";
import type { AdmissionReport } from "../runner/spawnAdmission";
import { SpawnPlanningError, type SpawnPlanSnapshot } from "../runner/spawnSearch";
import type { SpawnAudit } from "../runner/spawnValidation";
import type { Walk, WalkStep } from "../runner/walk";
import type { WalkItemKind } from "../runner/walkItems";
import type { RunState } from "../state/runState";

export interface PlanningFailure {
  readonly message: string;
  readonly seed: number;
  readonly snapshot: SpawnPlanSnapshot;
}

export function capturePlanningFailure(
  seed: number,
  play: () => void,
): PlanningFailure | undefined {
  try {
    play();
    return undefined;
  } catch (error) {
    if (!(error instanceof SpawnPlanningError)) {
      throw error;
    }
    return { message: error.message, seed, snapshot: error.snapshot };
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
  // Configured is the frozen effective quota total after modifiers and weighted selection;
  // requested per kind partitions that same denominator, before any omission or herring.
  readonly configured: number;
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
    readonly herrings: readonly { readonly kind: WalkItemKind }[];
    readonly pending: readonly { readonly kind: WalkItemKind }[];
    readonly planned: readonly { readonly count: number; readonly kind: WalkItemKind }[];
  },
): ZoneWalkEvents {
  const events: ZoneWalkEvents = {
    configured: road.planned.reduce((sum, { count }) => sum + count, 0),
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

export function recordWalkEvents(events: ZoneWalkEvents, before: Walk, step: WalkStep): void {
  const pending = new Set(step.walk.road.pending);
  for (const event of before.road.pending) {
    if (!pending.has(event)) {
      flow(events, event.kind).generated += 1;
    }
  }
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
    flow(events, item.kind).touched += 1;
  }
  for (const item of encountered.values()) {
    flow(events, item.kind).encountered += 1;
  }
  for (const card of step.encounterHits) {
    flow(events, card.encounter).encountered += 1;
    flow(events, card.encounter).touched += 1;
  }
  for (const item of step.passed) {
    flow(events, item.kind).passed += 1;
  }
  const remaining = new Set(step.walk.road.items.map(({ id }) => id));
  for (const item of before.road.items) {
    if (!remaining.has(item.id)) {
      flow(events, item.kind).departed += 1;
    }
  }
}
