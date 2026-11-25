import type { SlotPlacement } from "./slotFeasibility.ts";
import { type PlacementRejection, SpawnBoard } from "./spawnBoard.ts";
import type { PlannedSpawns, SpawnPlan } from "./spawning.ts";

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

export function createSlotIntrinsicProbe<Kind extends string>(
  geometry: Omit<SpawnPlan<Kind>, "quotas">,
  path: PlannedSpawns<Kind>["path"],
) {
  const board = nativeSlotBoard("complete", geometry, path);
  return (entry: SlotPlacement<Kind>) => board.checkIntrinsic(entry);
}

function createNativeSlotState<Kind extends string>(
  mode: "complete" | "partial",
  geometry: Omit<SpawnPlan<Kind>, "quotas">,
  path: PlannedSpawns<Kind>["path"],
  prefix: readonly ConstraintEntry<Kind>[] = [],
) {
  const board = nativeSlotBoard(mode, geometry, path);
  let ledger: ConstraintEntry<Kind>[] = [];
  type Failure = Extract<ConstraintResult<Kind>, { accepted: false }>["failure"];
  const owners = new Map<string, ConstraintOwner>();
  // Each placed owner's unbound source entry, for conflict blockers that outlive a restore.
  const sources = new WeakMap<SlotPlacement<Kind>, SlotPlacement<Kind>>();
  const placed = new Map<ConstraintOwner, SlotPlacement<Kind>>();
  const checkpoints = new WeakMap<
    ConstraintCheckpoint,
    {
      readonly entries: readonly ConstraintEntry<Kind>[];
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
        restore: board.save(),
      });
      return mark;
    },
    commit,
    entries(): readonly ConstraintEntry<Kind>[] {
      return ledger.slice();
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
      owners.clear();
      placed.clear();
      ledger.forEach(({ entry, owner }, index) => {
        owners.set(`${index}:0`, owner);
        placed.set(owner, sources.get(entry)!);
      });
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
