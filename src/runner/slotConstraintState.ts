import type { SlotPlacement } from "./slotFeasibility.ts";
import { type PlacementRejection, SpawnBoard } from "./spawnBoard.ts";
import type { PlannedSpawns, SpawnPlan } from "./spawning.ts";
import type { SpawnVisibilityTrace } from "./spawnVisibility.ts";

export interface ConstraintOwner {
  readonly key: string;
}
export interface ConstraintEntry<Kind extends string> {
  readonly entry: SlotPlacement<Kind>;
  readonly owner: ConstraintOwner;
}
export type ConstraintResult<Kind extends string> =
  | { readonly accepted: true; readonly entry: SlotPlacement<Kind> }
  | {
      readonly accepted: false;
      readonly failure: {
        readonly classification: "intrinsic" | "conflict" | "unattributed";
        readonly owners: readonly ConstraintOwner[];
        readonly row?: number;
        readonly rule: string;
      };
    };
// An attributed failure of these rules persists while every attributed owner keeps its placement:
// each needs only the candidate and its owners, and visibility rejects on any same-kind contributor.
const HELD_RULES = new Set([
  "body",
  "cells",
  "kind-cap",
  "kind-entry",
  "kind-lane",
  "kind-row",
  "open-lanes",
  "pack-gap",
  "rider-gap",
  "screen-cap",
  "wide-gap",
]);

export type ConflictBlockers<Kind extends string> = readonly (readonly [
  ConstraintOwner,
  SlotPlacement<Kind>,
])[];

export type NegativeVisibilityLookup<Kind extends string> =
  | { readonly status: "miss" }
  | { readonly status: "budget" }
  | {
      readonly status: "blocked";
      readonly failure: Extract<ConstraintResult<Kind>, { accepted: false }>["failure"];
    };
interface IntrinsicAttestation {
  readonly entry: SlotPlacement<string>;
  readonly fingerprint: string;
  readonly scope: string;
  readonly visibility: SpawnVisibilityTrace;
}
const intrinsicAttestations = new WeakMap<object, IntrinsicAttestation>();
function fingerprint(value: unknown): string | undefined {
  try {
    return JSON.stringify(value, (_key, field: unknown) =>
      typeof field === "number" && !Number.isFinite(field) ? { numeric: String(field) } : field,
    );
  } catch {
    return undefined;
  }
}
const checkpointBrand: unique symbol = Symbol("ConstraintCheckpoint");
export interface ConstraintCheckpoint {
  readonly [checkpointBrand]: true;
}

function nativeSlotBoard<Kind extends string>(
  mode: "complete" | "partial",
  geometry: Omit<SpawnPlan<Kind>, "quotas">,
  path: PlannedSpawns<Kind>["path"],
) {
  return new SpawnBoard<Kind>(
    mode,
    { ...geometry, quotas: [] },
    path,
    (entry) => {
      const request = (entry as SlotPlacement<Kind>).request;
      return request?.count === 1 && entry.trace.memberIndex === 0 ? request : undefined;
    },
    [],
  );
}

function immutableEntry(entry: SlotPlacement<string>): boolean {
  return (
    Object.isFrozen(entry) &&
    Object.isFrozen(entry.event) &&
    Object.isFrozen(entry.trace) &&
    Object.isFrozen(entry.request) &&
    (entry.placement === undefined || Object.isFrozen(entry.placement)) &&
    (entry.trace.placement === undefined || Object.isFrozen(entry.trace.placement))
  );
}

// An accepted result attests its visibility prerequisite for negative visibility lookups unless
// attestVisibility is false, for a search that never looks them up.
export function createSlotIntrinsicProbe<Kind extends string>(
  geometry: Omit<SpawnPlan<Kind>, "quotas">,
  path: PlannedSpawns<Kind>["path"],
  attestVisibility = true,
) {
  const board = nativeSlotBoard("complete", geometry, path);
  const scope = fingerprint([geometry, path]);
  return (entry: SlotPlacement<Kind>) => {
    const result = board.checkIntrinsic(entry);
    if (attestVisibility && result.accepted && scope !== undefined && immutableEntry(entry)) {
      const visibility = board.visibilityPrerequisite(entry, entry.request);
      const snapshot = fingerprint(entry);
      if (visibility !== undefined && snapshot !== undefined) {
        intrinsicAttestations.set(result, { entry, fingerprint: snapshot, scope, visibility });
      }
    }
    return result;
  };
}

function createNativeSlotState<Kind extends string>(
  mode: "complete" | "partial",
  geometry: Omit<SpawnPlan<Kind>, "quotas">,
  path: PlannedSpawns<Kind>["path"],
  prefix: readonly ConstraintEntry<Kind>[] = [],
) {
  const board = nativeSlotBoard(mode, geometry, path);
  const scope = fingerprint([geometry, path]);
  const visibilityStats = {
    attempts: 0,
    budgetExits: 0,
    coldBypasses: 0,
    fingerprintBytes: 0,
    hits: 0,
    lookups: 0,
    misses: 0,
  };
  let ledger: ConstraintEntry<Kind>[] = [];
  type Failure = Extract<ConstraintResult<Kind>, { accepted: false }>["failure"];
  let immutablePrefix = true;
  const owners = new Map<string, ConstraintOwner>();
  // Each placed owner's unbound source entry, for conflict blockers that outlive a restore.
  const sources = new WeakMap<SlotPlacement<Kind>, SlotPlacement<Kind>>();
  const placed = new Map<ConstraintOwner, SlotPlacement<Kind>>();
  const checkpoints = new WeakMap<
    ConstraintCheckpoint,
    {
      readonly entries: readonly ConstraintEntry<Kind>[];
      readonly immutablePrefix: boolean;
      readonly restore: () => void;
    }
  >();
  const failureOf = (
    failure: PlacementRejection,
  ): Extract<ConstraintResult<Kind>, { accepted: false }> => {
    const resolved = failure.conflicts.map((id) => owners.get(id));
    const known =
      failure.classification === "conflict" &&
      resolved.length > 0 &&
      resolved.every((owner) => owner !== undefined);
    return {
      accepted: false,
      failure: {
        ...(failure.witness?.row === undefined ? {} : { row: failure.witness.row }),
        classification:
          failure.classification === "intrinsic"
            ? "intrinsic"
            : known
              ? "conflict"
              : "unattributed",
        owners: known ? [...new Set(resolved as ConstraintOwner[])] : [],
        rule: failure.rule,
      },
    };
  };
  const probe = (owner: ConstraintOwner, entry: SlotPlacement<Kind>): ConstraintResult<Kind> => {
    if (ledger.some((saved) => saved.owner === owner || saved.owner.key === owner.key)) {
      return {
        accepted: false,
        failure: { classification: "intrinsic", owners: [], rule: "duplicate-owner" },
      };
    }
    const bound = Object.freeze({
      ...entry,
      trace: Object.freeze({ ...entry.trace, quotaIndex: ledger.length }),
    });
    let rejection: PlacementRejection | undefined;
    const accepted = board.probe(bound, (failure) => {
      rejection ??= failure;
    });
    return accepted
      ? { accepted: true, entry: bound }
      : failureOf(
          rejection ?? {
            classification: "unattributed",
            conflicts: [],
            rule: "unattributed",
          },
        );
  };
  const commit = (owner: ConstraintOwner, entry: SlotPlacement<Kind>): ConstraintResult<Kind> => {
    const result = probe(owner, entry);
    if (result.accepted) {
      board.keep(result.entry);
      owners.set(`${ledger.length}:0`, owner);
      ledger.push({ entry: result.entry, owner });
      sources.set(result.entry, entry);
      placed.set(owner, entry);
      immutablePrefix &&= immutableEntry(entry);
    }
    return result;
  };
  for (const { entry, owner } of prefix) {
    const result = commit(owner, entry);
    if (!result.accepted) {
      throw new Error(`Invalid constraint prefix: ${result.failure.rule}`);
    }
  }
  const complete = ():
    { readonly accepted: true } | Extract<ConstraintResult<Kind>, { accepted: false }> => {
    let rejection: PlacementRejection | undefined;
    return board.checkComplete((failure) => {
      rejection ??= failure;
    })
      ? { accepted: true }
      : failureOf(
          rejection ?? { classification: "unattributed", conflicts: [], rule: "unattributed" },
        );
  };
  return {
    // The placements a held-rule conflict depends on, or undefined for any other failure.
    blockersOf(failure: Failure): ConflictBlockers<Kind> | undefined {
      if (
        failure.classification !== "conflict" ||
        failure.owners.length === 0 ||
        !HELD_RULES.has(failure.rule)
      ) {
        return undefined;
      }
      const blockers: [ConstraintOwner, SlotPlacement<Kind>][] = [];
      for (const owner of failure.owners) {
        const entry = placed.get(owner);
        if (entry === undefined) {
          return undefined;
        }
        blockers.push([owner, entry]);
      }
      return Object.freeze(blockers);
    },
    blockersPlaced(blockers: ConflictBlockers<Kind>): boolean {
      return blockers.every(([owner, entry]) => placed.get(owner) === entry);
    },
    checkComplete: complete,
    checkpoint(): ConstraintCheckpoint {
      const mark: ConstraintCheckpoint = { [checkpointBrand]: true };
      checkpoints.set(mark, {
        entries: ledger.slice(),
        immutablePrefix,
        restore: board.save(),
      });
      return mark;
    },
    commit,
    entries(): readonly ConstraintEntry<Kind>[] {
      return ledger.slice();
    },
    lookupNegativeVisibility(
      step: () => boolean,
      proof: ReturnType<ReturnType<typeof createSlotIntrinsicProbe<Kind>>>,
      owner: ConstraintOwner,
      entry: SlotPlacement<Kind>,
    ): NegativeVisibilityLookup<Kind> {
      visibilityStats.attempts++;
      if (!board.hasNegativeVisibilityIndex()) {
        visibilityStats.coldBypasses++;
        visibilityStats.misses++;
        return { status: "miss" };
      }
      if (!step()) {
        visibilityStats.budgetExits++;
        return { status: "budget" };
      }
      visibilityStats.lookups++;
      const attestation = intrinsicAttestations.get(proof);
      const miss = (): NegativeVisibilityLookup<Kind> => {
        visibilityStats.misses++;
        return { status: "miss" };
      };
      if (
        !immutablePrefix ||
        !proof.accepted ||
        attestation === undefined ||
        attestation.entry !== entry ||
        attestation.scope !== scope ||
        ledger.some((saved) => saved.owner.key === owner.key)
      ) {
        return miss();
      }
      const snapshot = fingerprint(entry);
      visibilityStats.fingerprintBytes += snapshot?.length ?? 0;
      if (snapshot !== attestation.fingerprint) {
        return miss();
      }
      const failure = board.lookupNegativeVisibility(attestation.visibility);
      if (failure === undefined) {
        return miss();
      }
      visibilityStats.hits++;
      return { failure: failureOf(failure).failure, status: "blocked" };
    },
    openStretchRow(): number | undefined {
      return board.openStretchRow();
    },
    probe,
    restore(mark: ConstraintCheckpoint): void {
      const saved = checkpoints.get(mark);
      if (saved === undefined) {
        throw new RangeError("Checkpoint belongs to another constraint state");
      }
      saved.restore();
      ledger = [...saved.entries];
      immutablePrefix = saved.immutablePrefix;
      owners.clear();
      placed.clear();
      ledger.forEach(({ entry, owner }, index) => {
        owners.set(`${index}:0`, owner);
        placed.set(owner, sources.get(entry)!);
      });
    },
    visibilityStatistics() {
      return { ...visibilityStats };
    },
  };
}

// Strict states require every inserted prefix to satisfy complete lane clearance.
export function createSlotConstraintState<Kind extends string>(
  geometry: Omit<SpawnPlan<Kind>, "quotas">,
  path: PlannedSpawns<Kind>["path"],
  prefix: readonly ConstraintEntry<Kind>[] = [],
) {
  return createNativeSlotState("complete", geometry, path, prefix);
}

// Construction defers only nonmonotone stretch checks until explicit boundaries.
export function createSlotConstructionState<Kind extends string>(
  geometry: Omit<SpawnPlan<Kind>, "quotas">,
  path: PlannedSpawns<Kind>["path"],
  prefix: readonly ConstraintEntry<Kind>[] = [],
) {
  return createNativeSlotState("partial", geometry, path, prefix);
}
