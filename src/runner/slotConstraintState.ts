import type { PreparedSlotKind } from "./slotCandidates";
import type { SlotPlacement } from "./slotFeasibility";
import { type PlacementRejection, SpawnBoard } from "./spawnBoard";
import type { PlannedSpawns, SpawnPlan } from "./spawning";
import type { SpawnVisibilityTrace } from "./spawnVisibility";

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
// These native failures cannot be repaired by adding unrelated prefix entries.
const MONOTONE_RULES = new Set([
  "body",
  "cells",
  "open-lanes",
  "pack-gap",
  "rider-gap",
  "screen-cap",
  "wide-gap",
]);

function isMonotoneConflict(
  failure: Extract<ConstraintResult<string>, { accepted: false }>["failure"],
): boolean {
  return (
    failure.classification === "conflict" &&
    failure.owners.length > 0 &&
    MONOTONE_RULES.has(failure.rule)
  );
}
export type NegativeVisibilityLookup<Kind extends string> =
  | { readonly status: "miss" }
  | { readonly status: "budget" }
  | {
      readonly status: "blocked";
      readonly failure: Extract<ConstraintResult<Kind>, { accepted: false }>["failure"];
    };
// A compiled scope keeps its complete owner/source pools fixed. Rebind changed pools in a new scope.
export interface SlotPocketOwner extends ConstraintOwner {
  readonly phase: "active" | "capacity";
  preparations(): Iterable<PreparedSlotKind<string>>;
}
const pocketScopeBrand: unique symbol = Symbol("slot-pocket-scope");
export interface SlotPocketScope {
  readonly [pocketScopeBrand]: true;
}
interface PocketScopeRecord {
  readonly geometry: object;
  readonly path: object;
  readonly shape: string | undefined;
  readonly owners: readonly {
    owner: SlotPocketOwner;
    key: string;
    phase: SlotPocketOwner["phase"];
    preparations: SlotPocketOwner["preparations"];
  }[];
}
const pocketScopes = new WeakMap<SlotPocketScope, PocketScopeRecord>();
export function createSlotPocketScope(
  geometry: object,
  path: object,
  owners: readonly SlotPocketOwner[],
): SlotPocketScope {
  const scope = Object.freeze({ [pocketScopeBrand]: true as const });
  pocketScopes.set(scope, {
    geometry,
    owners: owners.map((owner) => ({
      key: owner.key,
      owner,
      phase: owner.phase,
      preparations: owner.preparations,
    })),
    path,
    shape: fingerprint([geometry, path]),
  });
  return scope;
}
export function slotPocketScopeMatches(
  scope: SlotPocketScope,
  geometry: object,
  path: object,
): boolean {
  const record = pocketScopes.get(scope);
  return (
    record !== undefined &&
    record.geometry === geometry &&
    record.path === path &&
    record.shape !== undefined &&
    record.shape === fingerprint([geometry, path]) &&
    new Set(record.owners.map((saved) => saved.key)).size === record.owners.length &&
    record.owners.every(
      ({ key, owner, phase, preparations }) =>
        owner.key === key && owner.phase === phase && owner.preparations === preparations,
    )
  );
}
export function slotPocketScopeOwner(
  scope: SlotPocketScope,
  owner: ConstraintOwner,
): SlotPocketOwner | undefined {
  const record = pocketScopes.get(scope)?.owners.find((saved) => saved.owner === owner);
  return record !== undefined &&
    record.owner.key === record.key &&
    record.owner.phase === record.phase &&
    record.owner.preparations === record.preparations
    ? record.owner
    : undefined;
}
export interface SlotPocketObligation {
  readonly scope: SlotPocketScope;
  readonly context: object;
  readonly row: number;
  readonly requiredWalls: number;
}
export type SlotPocketExplanation =
  | { readonly status: "clear" }
  | { readonly status: "obligation"; readonly obligation: SlotPocketObligation }
  | { readonly status: "unknown" }
  | { readonly status: "budget" }
  | {
      readonly status: "fatal";
      readonly failure: Extract<ConstraintResult<string>, { accepted: false }>["failure"];
    };

export function projectSlotWalls<Kind extends string>(
  step: () => boolean,
  geometry: Omit<SpawnPlan<Kind>, "quotas">,
  path: PlannedSpawns<Kind>["path"],
  row: number,
  entry: SlotPlacement<Kind>,
): number | undefined {
  if (!step()) {
    return undefined;
  }
  const board = nativeSlotBoard("partial", geometry, path);
  board.keep(entry);
  return board.guaranteedWalls(step, row);
}

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

export function createSlotIntrinsicProbe<Kind extends string>(
  geometry: Omit<SpawnPlan<Kind>, "quotas">,
  path: PlannedSpawns<Kind>["path"],
) {
  const board = nativeSlotBoard("complete", geometry, path);
  const scope = fingerprint([geometry, path]);
  return (entry: SlotPlacement<Kind>) => {
    const result = board.checkIntrinsic(entry);
    if (result.accepted && scope !== undefined && immutableEntry(entry)) {
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
  type NativePrefix = readonly (ConstraintEntry<Kind> & { readonly shape: string | undefined })[];
  const snapshotPrefix = (): NativePrefix =>
    ledger.map((saved) => ({ ...saved, shape: fingerprint(saved.entry) }));
  const failures = new WeakMap<
    Failure,
    {
      owner: ConstraintOwner;
      entry: SlotPlacement<Kind>;
      entryShape: string | undefined;
      failureShape: string | undefined;
      failureOwners: readonly ConstraintOwner[];
      prefix: NativePrefix;
      rejection: PlacementRejection | undefined;
      scope: SlotPocketScope;
      context: object;
    }
  >();
  let pocketCapture:
    | { readonly scope: SlotPocketScope; readonly context: object; readonly prefix: NativePrefix }
    | undefined;
  const obligations = new WeakMap<SlotPocketObligation, NativePrefix>();
  const samePrefix = (prefix: NativePrefix) =>
    prefix.length === ledger.length &&
    prefix.every(
      (saved, index) =>
        saved.owner === ledger[index]!.owner &&
        saved.entry === ledger[index]!.entry &&
        saved.shape !== undefined &&
        saved.shape === fingerprint(saved.entry),
    );

  let immutablePrefix = true;
  const owners = new Map<string, ConstraintOwner>();
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
    const result: ConstraintResult<Kind> = accepted
      ? { accepted: true, entry: bound }
      : failureOf(
          rejection ?? {
            classification: "unattributed",
            conflicts: [],
            rule: "unattributed",
          },
        );
    if (!result.accepted && pocketCapture !== undefined) {
      const capture = pocketCapture;
      if (
        immutablePrefix &&
        immutableEntry(entry) &&
        slotPocketScopeMatches(capture.scope, geometry, path) &&
        slotPocketScopeOwner(capture.scope, owner) !== undefined &&
        samePrefix(capture.prefix)
      ) {
        failures.set(result.failure, {
          context: capture.context,
          entry,
          entryShape: fingerprint(entry),
          failureOwners: result.failure.owners.slice(),
          failureShape: fingerprint(result.failure),
          owner,
          prefix: capture.prefix,
          rejection,
          scope: capture.scope,
        });
      }
    }
    return result;
  };
  const commit = (owner: ConstraintOwner, entry: SlotPlacement<Kind>): ConstraintResult<Kind> => {
    const result = probe(owner, entry);
    if (result.accepted) {
      board.keep(result.entry);
      owners.set(`${ledger.length}:0`, owner);
      ledger.push({ entry: result.entry, owner });
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
    additionStable(
      step: () => boolean,
      scope: SlotPocketScope,
      context: object,
      owner: ConstraintOwner,
      entry: SlotPlacement<Kind>,
      failure: Failure,
    ): boolean | undefined {
      if (!step()) {
        return undefined;
      }
      const saved = failures.get(failure);
      if (
        !slotPocketScopeMatches(scope, geometry, path) ||
        saved === undefined ||
        saved.owner !== owner ||
        saved.entry !== entry ||
        !samePrefix(saved.prefix) ||
        !immutablePrefix ||
        !immutableEntry(entry) ||
        saved.entryShape === undefined ||
        saved.entryShape !== fingerprint(entry) ||
        saved.failureShape !== fingerprint(failure) ||
        saved.failureOwners.length !== failure.owners.length ||
        saved.failureOwners.some((owner, index) => owner !== failure.owners[index])
      ) {
        return false;
      }
      if (saved.scope !== scope || saved.context !== context) {
        return false;
      }
      let stable: boolean | undefined = isMonotoneConflict(failure);
      if (!stable && failure.rule === "kind-row" && saved.rejection !== undefined) {
        stable = board.kindRowPair(step, entry, saved.rejection);
      }
      if (stable) {
        if (
          !slotPocketScopeMatches(scope, geometry, path) ||
          !samePrefix(saved.prefix) ||
          saved.entryShape !== fingerprint(entry)
        ) {
          return false;
        }
      }
      return stable;
    },
    attestsPocket(
      scope: SlotPocketScope,
      context: object,
      obligation: SlotPocketObligation,
    ): boolean {
      const prefix = obligations.get(obligation);
      return (
        prefix !== undefined &&
        obligation.scope === scope &&
        obligation.context === context &&
        slotPocketScopeMatches(scope, geometry, path) &&
        samePrefix(prefix)
      );
    },
    attestsPocketOwners(
      step: () => boolean,
      scope: SlotPocketScope,
      remaining: readonly ConstraintOwner[],
    ): boolean | undefined {
      if (!step()) {
        return undefined;
      }
      if (!slotPocketScopeMatches(scope, geometry, path)) {
        return false;
      }
      const record = pocketScopes.get(scope)!;
      const present = new Set<ConstraintOwner>();
      for (const { owner } of ledger) {
        if (!step()) {
          return undefined;
        }
        const known = slotPocketScopeOwner(scope, owner);
        if (known === undefined || known.phase !== "active") {
          return false;
        }
        present.add(owner);
      }
      const expected: ConstraintOwner[] = [];
      for (const saved of record.owners) {
        if (!step()) {
          return undefined;
        }
        if (saved.phase === "active" && !present.has(saved.owner)) {
          expected.push(saved.owner);
        }
      }
      return (
        remaining.length === expected.length &&
        new Set(remaining).size === remaining.length &&
        remaining.every((owner) => expected.includes(owner))
      );
    },
    capturePocket<T>(
      step: () => boolean,
      scope: SlotPocketScope,
      context: object,
      run: () => T,
    ):
      | { readonly result: T; readonly status: "captured" }
      | { readonly status: "unknown" }
      | { readonly status: "budget" } {
      if (!step()) {
        return { status: "budget" };
      }
      if (
        !slotPocketScopeMatches(scope, geometry, path) ||
        !immutablePrefix ||
        ledger.some((saved) => slotPocketScopeOwner(scope, saved.owner) === undefined)
      ) {
        return { status: "unknown" };
      }
      const previous = pocketCapture;
      pocketCapture = { context, prefix: snapshotPrefix(), scope };
      try {
        return { result: run(), status: "captured" };
      } finally {
        pocketCapture = previous;
      }
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
    explainPocket(
      step: () => boolean,
      scope: SlotPocketScope,
      context: object,
    ): SlotPocketExplanation {
      if (!step()) {
        return { status: "budget" };
      }
      if (!slotPocketScopeMatches(scope, geometry, path)) {
        return { status: "unknown" };
      }
      const result = complete();
      if (result.accepted) {
        return { status: "clear" };
      }
      if (result.failure.classification === "unattributed") {
        return { failure: result.failure, status: "fatal" };
      }
      if (
        !immutablePrefix ||
        ledger.some((saved) => slotPocketScopeOwner(scope, saved.owner) === undefined)
      ) {
        return { status: "unknown" };
      }
      const row = result.failure.row;
      if (result.failure.rule !== "open-stretches" || row === undefined) {
        return { status: "unknown" };
      }
      const required = board.requiredWalls(step, row);
      if (required.status === "budget") {
        return required;
      }
      if (required.mask === 0) {
        return { status: "unknown" };
      }
      const obligation = Object.freeze({ context, requiredWalls: required.mask, row, scope });
      obligations.set(obligation, snapshotPrefix());
      return { obligation, status: "obligation" };
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
      ledger.forEach(({ owner }, index) => {
        owners.set(`${index}:0`, owner);
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
