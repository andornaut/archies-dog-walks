import type {
  createSlotCandidateDomains,
  SlotCandidate,
  SlotOwnerWallsToken,
} from "./slotCandidateDomains";
import {
  type ConstraintCheckpoint,
  type ConstraintOwner,
  type ConstraintResult,
  type createSlotConstructionState,
  type SlotPocketObligation,
  type SlotPocketOwner,
  slotPocketScopeMatches,
} from "./slotConstraintState";
import {
  checkSlotPocketSupport,
  type SlotPocketDomainStep,
  type SlotPocketProof,
  type SlotPocketRejection,
  type SlotPocketSupportPorts,
  type SlotPocketSupportResult,
} from "./slotPocketSupport";
import type { PlannedSpawns, SpawnPlan } from "./spawning";

export interface SlotPocketWork {
  readonly adviceLimit?: number;
  readonly anchor: () => boolean;
  readonly check: () => boolean;
  readonly propagate: () => boolean;
  readonly stopped: () => boolean;
}
type Domains<Kind extends string> = ReturnType<typeof createSlotCandidateDomains<Kind>>;
type State<Kind extends string> = ReturnType<typeof createSlotConstructionState<Kind>>;
type Rejection<Kind extends string> = Extract<ConstraintResult<Kind>, { accepted: false }>;
interface Mark {
  readonly context: object;
  readonly native: ConstraintCheckpoint;
}
class IncompletePocketCapture extends Error {}
class LocalPocketCutoff extends Error {}
export type SlotPocketRefutationAttestation =
  | { readonly dependencies: readonly ConstraintOwner[]; readonly status: "attested" }
  | { readonly status: "unknown" | "budget" };

// One compiled scope owns the complete canonical registry and its fixed preparation methods.
export function createSlotPocketAdapter<Kind extends string>(
  work: SlotPocketWork,
  geometry: Omit<SpawnPlan<Kind>, "quotas">,
  path: PlannedSpawns<Kind>["path"],
  domains: Domains<Kind>,
  owners: readonly SlotPocketOwner[],
) {
  const registry = Object.freeze([...owners]);
  const scope = domains.pocketScope(registry);
  const allowance = work.adviceLimit;
  const validAllowance =
    allowance === undefined || (Number.isSafeInteger(allowance) && allowance >= 0);
  let remainingAllowance = allowance;
  const issued = new WeakMap<
    SlotPocketProof<SlotCandidate<Kind>>,
    { readonly obligation: SlotPocketObligation; readonly state: State<Kind> }
  >();
  let exhausted = false;
  const stopped = () => {
    exhausted ||= work.stopped();
    return exhausted;
  };
  const charge = (step: () => boolean) => () => {
    if (stopped()) {
      return false;
    }
    exhausted ||= !step();
    return !stopped();
  };
  const sharedWork = {
    anchor: charge(work.anchor),
    check: charge(work.check),
    propagate: charge(work.propagate),
    stopped,
  };
  // An explicit optional allowance belongs to this adapter, never to each visited branch.
  const nativeWork = {
    ...sharedWork,
    propagate: () => {
      if (stopped()) {
        return false;
      }
      if (remainingAllowance !== undefined) {
        if (remainingAllowance === 0) {
          throw new LocalPocketCutoff();
        }
        remainingAllowance--;
      }
      return sharedWork.propagate();
    },
  };
  return {
    attestRefutation(
      state: State<Kind>,
      proof: SlotPocketProof<SlotCandidate<Kind>>,
    ): SlotPocketRefutationAttestation {
      if (stopped()) {
        return { status: "budget" };
      }
      const saved = issued.get(proof);
      if (
        saved === undefined ||
        saved.state !== state ||
        !validAllowance ||
        remainingAllowance === 0
      ) {
        return { status: "unknown" };
      }
      try {
        if (!nativeWork.propagate()) {
          return { status: "budget" };
        }
        if (proof.scope !== scope || !state.attestsPocket(scope, proof.context, saved.obligation)) {
          return { status: "unknown" };
        }
        const current = state.entries();
        if (current.length !== proof.support.length) {
          return { status: "unknown" };
        }
        for (const [index, assignment] of proof.support.entries()) {
          if (!nativeWork.propagate()) {
            return { status: "budget" };
          }
          if (
            assignment.owner !== current[index]!.owner ||
            assignment.value !== current[index]!.entry
          ) {
            return { status: "unknown" };
          }
        }
        const owners = state.attestsPocketOwners(nativeWork.propagate, scope, proof.remaining);
        if (owners === undefined || stopped()) {
          return { status: "budget" };
        }
        if (!owners) {
          return { status: "unknown" };
        }
        for (const domain of proof.domains) {
          const complete = domains.attestOwnerWalls(
            nativeWork,
            scope,
            domain.row,
            domain.owner,
            domain.values,
            domain.token as SlotOwnerWallsToken,
          );
          if (complete === undefined || stopped()) {
            return { status: "budget" };
          }
          if (!complete) {
            return { status: "unknown" };
          }
        }
        return {
          dependencies: Object.freeze(proof.support.map(({ owner }) => owner)),
          status: "attested",
        };
      } catch (error) {
        if (error instanceof LocalPocketCutoff) {
          return { status: stopped() ? "budget" : "unknown" };
        }
        throw error;
      }
    },
    check(
      state: State<Kind>,
      phase: "active" | "capacity",
    ): SlotPocketSupportResult<SlotCandidate<Kind>> {
      if (stopped()) {
        return { status: "budget" };
      }
      if (phase !== "active") {
        return { status: "unknown" };
      }
      if (!validAllowance || remainingAllowance === 0) {
        return { status: "unknown" };
      }
      const root = state.checkpoint();
      let context: object = {};
      const tokens = new WeakMap<object, SlotOwnerWallsToken>();
      const obligations = new WeakMap<object, SlotPocketObligation>();
      const trials = new WeakMap<
        object,
        {
          readonly context: object;
          readonly owner: ConstraintOwner;
          readonly rejection: Rejection<Kind>;
          readonly value: SlotCandidate<Kind>;
        }
      >();
      const ports: SlotPocketSupportPorts<SlotCandidate<Kind>, Mark> = {
        checkpoint: () => ({ context, native: state.checkpoint() }),
        complete(row, owner, values, token) {
          const nativeToken = tokens.get(token);
          return (
            nativeToken !== undefined &&
            domains.attestOwnerWalls(nativeWork, scope, row, owner, values, nativeToken)
          );
        },
        context: () => context,
        *domain(row, owner): Generator<SlotPocketDomainStep<SlotCandidate<Kind>>> {
          for (const step of domains.completeOwnerWalls(nativeWork, scope, row, owner)) {
            if (step.status === "unknown") {
              return;
            }
            if (step.status === "complete") {
              tokens.set(step.token, step.token);
            }
            yield step;
          }
        },
        explain() {
          const previous = obligations.get(context);
          if (previous !== undefined) {
            if (!nativeWork.propagate()) {
              return { status: "budget" };
            }
            return state.attestsPocket(scope, context, previous)
              ? { ...previous, status: "obligation" }
              : { status: "unknown" };
          }
          if (!nativeWork.check()) {
            return { status: "budget" };
          }
          const result = state.explainPocket(nativeWork.propagate, scope, context);
          if (result.status !== "obligation") {
            return result;
          }
          if (!nativeWork.propagate()) {
            return { status: "budget" };
          }
          if (!state.attestsPocket(scope, context, result.obligation)) {
            return { status: "unknown" };
          }
          obligations.set(context, result.obligation);
          return { ...result.obligation, status: "obligation" };
        },
        hard(trialContext, owner, value, rejection) {
          const trial = rejection.token === undefined ? undefined : trials.get(rejection.token);
          if (
            trial === undefined ||
            trial.context !== trialContext ||
            trial.context !== context ||
            trial.owner !== owner ||
            trial.value !== value ||
            trial.rejection.failure !== rejection.failure
          ) {
            return false;
          }
          return state.additionStable(
            nativeWork.propagate,
            scope,
            context,
            owner,
            value.entry,
            trial.rejection.failure,
          );
        },
        owners: (remaining) => state.attestsPocketOwners(nativeWork.propagate, scope, remaining),
        propagate: nativeWork.propagate,
        restore(mark) {
          state.restore(mark.native);
          context = mark.context;
        },
        stopped,
        support: () => state.entries().map(({ entry, owner }) => ({ owner, value: entry })),
        test(owner, value) {
          const captured = state.capturePocket(nativeWork.propagate, scope, context, () =>
            nativeWork.check() ? state.commit(owner, value.entry) : undefined,
          );
          if (captured.status === "budget") {
            return captured;
          }
          if (captured.status !== "captured") {
            throw new IncompletePocketCapture();
          }
          const result = captured.result;
          if (result === undefined) {
            return { status: "budget" };
          }
          if (result.accepted) {
            context = {};
            return { status: "accepted" };
          }
          const token = Object.freeze({});
          trials.set(token, { context, owner, rejection: result, value });
          Object.freeze(result.failure.owners);
          const rejection: SlotPocketRejection = Object.freeze({
            failure: Object.freeze(result.failure),
            status: "rejected",
            token,
          });
          return rejection;
        },
      };
      try {
        // Refutation under zero future reservation also refutes the more constrained caller state.
        state.reserveCells(0);
        if (!nativeWork.propagate()) {
          return { status: "budget" };
        }
        if (!slotPocketScopeMatches(scope, geometry, path)) {
          return { status: "unknown" };
        }
        const explanation = ports.explain();
        if (explanation.status === "fatal" || explanation.status === "budget") {
          return explanation;
        }
        if (stopped()) {
          return { status: "budget" };
        }
        if (explanation.status !== "obligation") {
          return { status: "unknown" };
        }
        const present = new Set(state.entries().map(({ owner }) => owner));
        const remaining = registry.filter(
          (owner) => owner.phase === "active" && !present.has(owner),
        );
        const result = checkSlotPocketSupport(ports, scope, remaining);
        if (result.status === "refuted") {
          const obligation = obligations.get(result.proof.context);
          if (!nativeWork.propagate()) {
            return { status: "budget" };
          }
          if (
            obligation === undefined ||
            !state.attestsPocket(scope, result.proof.context, obligation)
          ) {
            return { status: "unknown" };
          }
          issued.set(result.proof, { obligation, state });
        }
        return result;
      } catch (error) {
        if (error instanceof IncompletePocketCapture || error instanceof LocalPocketCutoff) {
          return { status: stopped() ? "budget" : "unknown" };
        }
        throw error;
      } finally {
        state.restore(root);
      }
    },
  };
}
