import { laneMask } from "../layout/lanes";
import { type PreparedSlotKind, slotPlacementsAt } from "./slotCandidates";
import { createSlotFeasibility, type SlotPlacement } from "./slotFeasibility";
import {
  blockingSpan,
  packFitsOnPath,
  PATH_HOLD_ROWS,
  pathReach,
  type PlannedSpawns,
  quotaFootprint,
  rowSpacing,
  type SpawnPlan,
} from "./spawning";

type Geometry<Kind extends string> = Omit<SpawnPlan<Kind>, "quotas">;
export interface GuaranteedPathSource<Kind extends string> {
  readonly ordinal: number;
  readonly total: number;
  readonly prepared: PreparedSlotKind<Kind>;
}
interface PathConstraint<Kind extends string> {
  readonly entry: SlotPlacement<Kind>;
  readonly blocked: Int32Array;
}
interface TransitionFact {
  readonly children: Map<number, TransitionFact>;
  value: boolean | undefined;
}
function createTransitionFact(): TransitionFact {
  return { children: new Map(), value: undefined };
}

function transitionFact(
  root: TransitionFact,
  create: boolean,
  keys: readonly number[],
): TransitionFact | undefined {
  let node = root;
  for (const key of keys) {
    let child = node.children.get(key);
    if (child === undefined) {
      if (!create) {
        return undefined;
      }
      child = createTransitionFact();
      node.children.set(key, child);
    }
    node = child;
  }
  return node;
}

interface PathFacts<Kind extends string> {
  readonly facts: TransitionFact;
  readonly reactions: WeakMap<PathConstraint<Kind>, PathFacts<Kind>>;
}
function createPathFacts<Kind extends string>(): PathFacts<Kind> {
  return { facts: createTransitionFact(), reactions: new WeakMap() };
}

function pathFactScope<Kind extends string>(
  root: PathFacts<Kind>,
  constraints: readonly PathConstraint<Kind>[],
): PathFacts<Kind> {
  let scope = root;
  for (const constraint of constraints) {
    if (
      !constraint.entry.request.blocksLane ||
      (constraint.entry.trace.placement?.stands.length ?? 0) < 2
    ) {
      continue;
    }
    let next = scope.reactions.get(constraint);
    if (next === undefined) {
      next = createPathFacts<Kind>();
      scope.reactions.set(constraint, next);
    }
    scope = next;
  }
  return scope;
}

// Contact windows keep every crossed lane clear. Continuous stand-pair reaction
// checks apply to each individual path change, exactly as packFitsOnPath does.
function constraint<Kind extends string>(
  geometry: Geometry<Kind>,
  rowCount: number,
  entry: SlotPlacement<Kind>,
): PathConstraint<Kind> {
  const blocked = new Int32Array(rowCount);
  if (!entry.herring && entry.request.blocksLane) {
    const block = entry.trace.placement?.block;
    const row = block?.row ?? entry.trace.row;
    const footprint = quotaFootprint(entry.request);
    const span = blockingSpan(
      { ...geometry, quotas: [] },
      rowSpacing({ ...geometry, quotas: [] }),
      row,
      block?.rows ?? footprint.rows,
    );
    const lanes = block?.lanes ?? { count: footprint.lanes, first: entry.event.lane };
    for (let index = Math.max(0, row); index <= Math.max(span.lastRow, span.lastGap); index++) {
      if (index < rowCount) {
        blocked[index] = laneMask(lanes.first, lanes.count);
      }
    }
  }
  const stop = entry.placement?.stop;
  if (stop !== undefined) {
    const row = entry.trace.placement!.block.row;
    if (row >= 0 && row < rowCount) {
      blocked[row] = (blocked[row] ?? 0) | laneMask(stop.first, stop.count);
    }
  }
  return { blocked, entry };
}

function conditionedPath<Kind extends string>(
  facts: PathFacts<Kind>,
  geometry: Geometry<Kind>,
  original: PlannedSpawns<Kind>["path"],
  draws: readonly number[],
  constraints: readonly PathConstraint<Kind>[],
  charge: () => boolean,
): PlannedSpawns<Kind>["path"] | undefined {
  const plan = { ...geometry, quotas: [] };
  const reach = pathReach(plan);
  const lanes = geometry.laneCount;
  const width = lanes * PATH_HOLD_ROWS;
  const scope = pathFactScope(facts, constraints);
  const parents: Int32Array[] = [];
  let costs = new Float64Array(width).fill(Infinity);
  costs[geometry.pathStart * PATH_HOLD_ROWS] = 0;
  for (let row = 0; row < original.length; row++) {
    const previousRow = Math.max(0, row - 1);
    let previousBlocked = 0,
      currentBlocked = 0;
    for (const { blocked } of constraints) {
      previousBlocked |= blocked[previousRow] ?? 0;
      currentBlocked |= blocked[row] ?? 0;
    }
    const next = new Float64Array(width).fill(Infinity);
    const parent = new Int32Array(width).fill(-1);
    const tested = new Map<number, boolean>();
    for (let state = 0; state < width; state++) {
      if (!Number.isFinite(costs[state])) {
        continue;
      }
      const from = Math.floor(state / PATH_HOLD_ROWS);
      const held = (state % PATH_HOLD_ROWS) + 1;
      for (let to = 0; to < lanes; to++) {
        if (row === 0 && to !== geometry.pathStart) {
          continue;
        }
        if (from !== to && (held < PATH_HOLD_ROWS || Math.abs(from - to) > reach)) {
          continue;
        }
        const key = from * lanes + to;
        let allowed = tested.get(key);
        if (allowed === undefined) {
          const keys = [row, from, to, previousBlocked, currentBlocked];
          allowed = transitionFact(scope.facts, false, keys)?.value;
          if (allowed === undefined) {
            if (!charge()) {
              return undefined;
            }
            const swept = laneMask(Math.min(from, to), Math.abs(to - from) + 1);
            allowed = constraints.every(({ blocked, entry }) => {
              if (
                ((blocked[previousRow] ?? 0) & swept) !== 0 ||
                ((blocked[row] ?? 0) & (1 << to)) !== 0
              ) {
                return false;
              }
              if (from === to || !entry.request.blocksLane) {
                return true;
              }
              const stands = entry.trace.placement?.stands ?? [];
              const changes = [
                {
                  at: (original[previousRow]!.distance + original[row]!.distance) / 2,
                  from,
                  to,
                },
              ];
              return stands.every((stand, index) =>
                stands
                  .slice(index + 1)
                  .every((other) => packFitsOnPath(plan, changes, stand, other)),
              );
            });
            transitionFact(scope.facts, true, keys)!.value = allowed;
          }
          tested.set(key, allowed);
        }
        if (!allowed) {
          continue;
        }
        const heldNext = row === 0 ? 1 : from === to ? Math.min(PATH_HOLD_ROWS, held + 1) : 1;
        const target = to * PATH_HOLD_ROWS + heldNext - 1;
        const preference = (to - Math.floor((draws[row * 2 + 1] ?? 0) * lanes) + lanes) % lanes;
        const cost = costs[state]! + (to === original[row]!.lane ? 0 : 1) + preference * 0.000001;
        if (cost < next[target]!) {
          next[target] = cost;
          parent[target] = state;
        }
      }
    }
    parents.push(parent);
    costs = next;
  }
  let state = 0;
  for (let index = 1; index < width; index++) {
    if (costs[index]! < costs[state]!) {
      state = index;
    }
  }
  if (!Number.isFinite(costs[state])) {
    return undefined;
  }
  const result = [...original];
  for (let row = original.length - 1; row >= 0; row--) {
    result[row] = { distance: original[row]!.distance, lane: Math.floor(state / PATH_HOLD_ROWS) };
    state = parents[row]![state]!;
  }
  return result;
}

// Witnesses constrain only the initial path. They do not reserve or commit obstacle
// anchors; the normal complete fitter and final audit still certify every placement.
export function guaranteeCompatiblePath<Kind extends string>(
  geometry: Geometry<Kind>,
  original: PlannedSpawns<Kind>["path"],
  draws: readonly number[],
  sources: readonly GuaranteedPathSource<Kind>[],
  work: { readonly anchor: () => boolean; readonly check: () => boolean },
): { readonly path: PlannedSpawns<Kind>["path"]; readonly failedKind?: Kind } {
  let exhausted = false;
  const charge = () => {
    if (exhausted || !work.check()) {
      exhausted = true;
      return false;
    }
    return true;
  };
  const witnesses = new Map<GuaranteedPathSource<Kind>, SlotPlacement<Kind>>();
  const missing: GuaranteedPathSource<Kind>[] = [];
  const board = createSlotFeasibility(geometry, original);
  function* candidates(source: GuaranteedPathSource<Kind>) {
    const ideal = Math.floor(
      ((source.ordinal + 0.5) * original.length) / Math.max(1, source.total),
    );
    const rows = Array.from({ length: original.length }, (_, row) => row).sort(
      (a, b) => Math.abs(a - ideal) - Math.abs(b - ideal) || a - b,
    );
    for (const row of rows) {
      for (const lane of source.prepared.columns) {
        if (exhausted || !work.anchor()) {
          exhausted = true;
          return;
        }
        yield* slotPlacementsAt(
          geometry,
          {
            distance: original[row]!.distance,
            lane,
            row,
            slot: 0,
          },
          source.prepared,
        );
      }
    }
  }
  for (const source of sources) {
    let witness: SlotPlacement<Kind> | undefined;
    for (const entry of candidates(source)) {
      if (!charge()) {
        return { failedKind: source.prepared.source.kind, path: original };
      }
      if (board.probe(entry).accepted) {
        witness = entry;
        break;
      }
    }
    if (witness === undefined) {
      missing.push(source);
    } else {
      witnesses.set(source, witness);
    }
  }
  if (missing.length === 0) {
    return { path: original };
  }
  let path = original;
  // One immutable geometry/path context owns completed facts; reaction pairs retain identity.
  const facts = createPathFacts<Kind>();
  // Already compatible anchors are hints, not immutable path reservations.
  const constraints: PathConstraint<Kind>[] = [];
  for (const source of missing) {
    let found = false;
    for (const entry of candidates(source)) {
      const pending = [...constraints, constraint(geometry, original.length, entry)];
      const candidate = conditionedPath(facts, geometry, original, draws, pending, charge);
      if (candidate === undefined) {
        if (exhausted) {
          break;
        }
        continue;
      }
      const proposed = createSlotFeasibility(geometry, candidate);
      if (!charge()) {
        break;
      }
      if (!proposed.probe(entry).accepted) {
        continue;
      }
      // Recheck complete profiles. An uncommitted hint may use another native anchor.
      let compatible = true;
      const rebound = new Map<GuaranteedPathSource<Kind>, SlotPlacement<Kind>>();
      for (const [previousSource, witness] of witnesses) {
        if (!charge()) {
          compatible = false;
          break;
        }
        if (proposed.probe(witness).accepted) {
          continue;
        }
        let replacement: SlotPlacement<Kind> | undefined;
        for (const alternative of candidates(previousSource)) {
          if (!charge()) {
            break;
          }
          if (proposed.probe(alternative).accepted) {
            replacement = alternative;
            break;
          }
        }
        if (replacement === undefined) {
          compatible = false;
          break;
        }
        rebound.set(previousSource, replacement);
      }
      if (!compatible) {
        continue;
      }
      constraints.push(pending[pending.length - 1]!);
      for (const [previousSource, replacement] of rebound) {
        witnesses.set(previousSource, replacement);
      }
      witnesses.set(source, entry);
      path = candidate;
      found = true;
      break;
    }
    if (!found) {
      return { failedKind: source.prepared.source.kind, path: original };
    }
  }
  return { path };
}
