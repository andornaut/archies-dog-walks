import type { createSlotCandidateDomains, SlotCandidate } from "./slotCandidateDomains";
import type { PreparedSlotKind } from "./slotCandidates";
import type { SlotLaneEffect } from "./slotConfig";
import type {
  ConflictBlockers,
  ConstraintEntry,
  ConstraintOwner,
  ConstraintResult,
  createSlotConstraintState,
} from "./slotConstraintState";
import { SLOT_OMISSION_ATTEMPTS, SLOT_OMISSION_RESERVE, type SlotOmission } from "./slotDelivery";
import type { SlotPocketProof, SlotPocketSupportResult } from "./slotPocketSupport";
import { createSlotSolverSession, drainSlotSolver } from "./slotSolverSession";
import {
  createSlotWitnessConstruct,
  type SlotWitnessConstructPorts,
  type SlotWitnessRefutationAttestation,
} from "./slotWitnessConstruct";
import type { PlannedSpawns, SpawnPlan } from "./spawning";

export interface WitnessJob<Kind extends string> extends ConstraintOwner {
  readonly fixed: boolean;
  readonly guaranteed: boolean;
  readonly laneEffect: SlotLaneEffect;
  readonly optional?: true;
  readonly ordinal: number;
  readonly phase: "active";
  readonly total: number;
  columnPick(): number;
  preparations(): Iterable<PreparedSlotKind<Kind>>;
}
type ConstraintState<Kind extends string> = ReturnType<typeof createSlotConstraintState<Kind>>;
type Mark<Kind extends string> = ReturnType<ConstraintState<Kind>["checkpoint"]>;
type CandidateDomains<Kind extends string> = ReturnType<typeof createSlotCandidateDomains<Kind>>;
type Failure<Kind extends string> = Extract<ConstraintResult<Kind>, { accepted: false }>["failure"];
export interface WitnessSelection<Kind extends string> extends ConstraintEntry<Kind> {
  readonly candidate: SlotCandidate<Kind>;
  readonly job: WitnessJob<Kind>;
}
export interface WitnessOmission<Kind extends string> {
  readonly job: WitnessJob<Kind>;
  readonly reason: SlotOmission<Kind>["reason"];
}
export type WitnessResult<Kind extends string> =
  | {
      readonly status: "compatible";
      readonly witness: readonly ConstraintEntry<Kind>[];
      readonly selections: readonly WitnessSelection<Kind>[];
    }
  | {
      readonly status: "partial";
      readonly witness: readonly ConstraintEntry<Kind>[];
      readonly selections: readonly WitnessSelection<Kind>[];
      readonly omissions: readonly WitnessOmission<Kind>[];
    }
  | { readonly status: "blocked"; readonly failure?: Failure<Kind> }
  | { readonly status: "budget" };
export interface WitnessWork<Kind extends string> {
  readonly attestRefutation?: (
    state: ConstraintState<Kind>,
    proof: SlotPocketProof<SlotCandidate<Kind>>,
  ) => SlotWitnessRefutationAttestation;
  readonly anchor: () => boolean;
  readonly check: () => boolean;
  readonly certify?: (selections: readonly WitnessSelection<Kind>[]) => boolean;
  readonly certifyPartial?: (
    selections: readonly WitnessSelection<Kind>[],
    omissions: readonly WitnessOmission<Kind>[],
  ) => boolean;
  readonly minimumDelivery?: number;
  readonly ordinaryOrder?: "original" | "balanced";
  readonly coverageFirst?: boolean;
  readonly fairSources?: boolean;
  readonly originalDrawsFirst?: boolean;
  // Share of the current attempt's work allowance already used, from 0 to 1.
  readonly progress?: () => number;
  readonly propagate?: () => boolean;
  readonly rejected?: (candidate: SlotCandidate<Kind>, failure: Failure<Kind>) => void;
  readonly stopped?: () => boolean;
  readonly support?: (state: ConstraintState<Kind>) => SlotPocketSupportResult<SlotCandidate<Kind>>;
}

// One native transaction selects entries before independent materialisation audits.
export function createSlotWitnessSearch<Kind extends string>(
  geometry: Omit<SpawnPlan<Kind>, "quotas">,
  path: PlannedSpawns<Kind>["path"],
  domains: CandidateDomains<Kind>,
  jobs: readonly WitnessJob<Kind>[],
  work: WitnessWork<Kind>,
) {
  const byKey = new Map(jobs.map((job) => [job.key, job]));
  const construct = createSlotWitnessConstruct(geometry, path, jobs);
  function* steps(state: ConstraintState<Kind>): Generator<void, WitnessResult<Kind>, void> {
    let partialFailure: Failure<Kind> | undefined;
    let incumbent: Extract<WitnessResult<Kind>, { status: "partial" }> | undefined;
    let reserving = false;
    // The exploring pass yields to the reserve pass while no floor-meeting layout exists.
    const reserveDue = () =>
      !reserving &&
      incumbent === undefined &&
      work.minimumDelivery !== undefined &&
      work.progress !== undefined &&
      work.progress() * SLOT_OMISSION_RESERVE.denominator >= SLOT_OMISSION_RESERVE.numerator;
    const halted = () => partialFailure !== undefined || work.stopped?.() === true;
    const stopped = () => halted() || reserveDue();
    if (halted()) {
      return { status: "budget" };
    }
    if (
      work.minimumDelivery !== undefined &&
      (!Number.isSafeInteger(work.minimumDelivery) ||
        work.minimumDelivery < 0 ||
        work.minimumDelivery > jobs.length)
    ) {
      return {
        failure: { classification: "unattributed", owners: [], rule: "invalid-delivery-floor" },
        status: "blocked",
      };
    }
    if (state.entries().length !== 0) {
      return {
        failure: { classification: "unattributed", owners: [], rule: "unsupported-root" },
        status: "blocked",
      };
    }
    const root = state.checkpoint();
    const provenance = new WeakMap<object, SlotCandidate<Kind>>();
    // Runtime construction rejects a repeated test without native work while every owner of its
    // recorded conflict keeps its placement. Exact construction keeps native failures for its
    // pocket proofs and its negative visibility lookup.
    const reuse = work.minimumDelivery !== undefined;
    const conflicts = new Map<
      WitnessJob<Kind>,
      Map<SlotCandidate<Kind>, { blockers: ConflictBlockers<Kind>; failure: Failure<Kind> }>
    >();
    const charge = () => !stopped() && work.check() && !stopped();
    const propagate = () => !stopped() && (work.propagate?.() ?? true) && !stopped();
    const selections = (
      entries: readonly ConstraintEntry<Kind>[],
    ): readonly WitnessSelection<Kind>[] | undefined => {
      const selected: WitnessSelection<Kind>[] = [];
      for (const { entry, owner } of entries) {
        const job = byKey.get(owner.key),
          candidate = provenance.get(entry);
        if (job !== owner || candidate === undefined) {
          return undefined;
        }
        selected.push(Object.freeze({ candidate, entry, job, owner }));
      }
      return Object.freeze(selected);
    };
    try {
      const ports: SlotWitnessConstructPorts<Kind, Mark<Kind>> = {
        ...(work.minimumDelivery !== undefined || work.attestRefutation === undefined
          ? {}
          : {
              attestRefutation: (proof: SlotPocketProof<SlotCandidate<Kind>>) =>
                work.attestRefutation!(state, proof),
            }),
        candidates(job, prepared, order) {
          return (order.motionTier === undefined ? domains.sequence : domains.frontierSequence)(
            { anchor: work.anchor, check: charge, propagate },
            order,
            job.key,
            prepared,
          );
        },
        checkpoint: () => state.checkpoint(),
        complete() {
          if (!charge()) {
            return undefined;
          }
          const entries = state.entries();
          const present = new Set(entries.map(({ owner }) => owner));
          if (
            entries.length !== jobs.length ||
            present.size !== entries.length ||
            entries.some(({ owner }) => byKey.get(owner.key) !== owner) ||
            jobs.some((job) => !present.has(job))
          ) {
            return {
              accepted: false as const,
              failure: {
                classification: "unattributed" as const,
                owners: [],
                rule: "incomplete-composition",
              },
            };
          }
          const checked = state.checkComplete();
          if (!checked.accepted) {
            return checked;
          }
          const selected = selections(entries);
          if (selected === undefined) {
            return {
              accepted: false as const,
              failure: {
                classification: "unattributed" as const,
                owners: [],
                rule: "missing-selected-source",
              },
            };
          }
          if (work.certify !== undefined && !work.certify(selected)) {
            return undefined;
          }
          return stopped() ? undefined : checked;
        },
        entries: () => state.entries(),
        ...(work.coverageFirst === undefined ? {} : { coverageFirst: work.coverageFirst }),
        ...(work.fairSources === undefined ? {} : { fairSources: work.fairSources }),
        ...(work.originalDrawsFirst === undefined
          ? {}
          : { originalDrawsFirst: work.originalDrawsFirst }),
        laneClosure() {
          if (!charge()) {
            return undefined;
          }
          const checked = state.checkComplete();
          return stopped() ? undefined : checked;
        },
        ...(work.ordinaryOrder === undefined ? {} : { ordinaryOrder: work.ordinaryOrder }),
        motionTiers: (prepared) => domains.motionTiers({ propagate }, prepared),
        ...(work.minimumDelivery === undefined
          ? {}
          : {
              bestDelivery: () => incumbent?.selections.length,
              minimumDelivery: work.minimumDelivery,
              partial(omissions: readonly WitnessOmission<Kind>[]) {
                if (stopped()) {
                  return undefined;
                }
                const entries = state.entries();
                if (
                  entries.length < work.minimumDelivery! ||
                  entries.length >= jobs.length ||
                  entries.length <= (incumbent?.selections.length ?? -1)
                ) {
                  return false;
                }
                const present = new Set(entries.map(({ owner }) => owner));
                if (
                  present.size !== entries.length ||
                  entries.some(({ owner }) => byKey.get(owner.key) !== owner) ||
                  jobs.some((job) => job.guaranteed && !present.has(job))
                ) {
                  return false;
                }
                if (!charge()) {
                  return undefined;
                }
                const checked = state.checkComplete();
                if (!checked.accepted) {
                  if (checked.failure.classification === "unattributed") {
                    partialFailure = checked.failure;
                  }
                  return false;
                }
                const selected = selections(entries);
                if (selected === undefined) {
                  return false;
                }
                const reasons = new Map(omissions.map(({ job, reason }) => [job, reason]));
                const missing = Object.freeze(
                  jobs
                    .filter((job) => !present.has(job))
                    .map((job) =>
                      Object.freeze({
                        job,
                        reason: reasons.get(job) ?? ("not-selected-within-allowance" as const),
                      }),
                    ),
                );
                if (
                  missing.some(({ job }) => !job.optional || job.guaranteed) ||
                  work.certifyPartial === undefined ||
                  !work.certifyPartial(selected, missing)
                ) {
                  return stopped() ? undefined : false;
                }
                if (stopped()) {
                  return undefined;
                }
                incumbent = Object.freeze({
                  omissions: missing,
                  selections: selected,
                  status: "partial" as const,
                  witness: Object.freeze([...entries]),
                });
                return true;
              },
            }),
        preparations: (job) => job.preparations(),
        propagate,
        rejects(job, candidate) {
          const known = conflicts.get(job)?.get(candidate);
          return known !== undefined && state.blockersPlaced(known.blockers);
        },
        repairRow() {
          if (!charge()) {
            return { status: "budget" };
          }
          const row = state.openStretchRow();
          return stopped()
            ? { status: "budget" }
            : row === undefined
              ? { status: "none" }
              : { row, status: "row" };
        },
        restore(mark) {
          state.restore(mark);
        },
        stopped,
        support: () =>
          work.minimumDelivery === undefined
            ? (work.support?.(state) ?? { status: "unknown" })
            : { status: "unknown" },
        test(job, candidate): ConstraintResult<Kind> | undefined {
          if (stopped()) {
            return undefined;
          }
          const known = conflicts.get(job)?.get(candidate);
          if (known !== undefined) {
            if (state.blockersPlaced(known.blockers)) {
              return { accepted: false, failure: known.failure };
            }
            conflicts.get(job)!.delete(candidate);
          }
          let intrinsic = domains.cachedIntrinsic(candidate);
          if (intrinsic === undefined) {
            if (!charge()) {
              return undefined;
            }
            intrinsic = domains.intrinsic(candidate);
          }
          if (!intrinsic.accepted) {
            return {
              accepted: false,
              failure: { classification: "intrinsic", owners: [], rule: intrinsic.rule },
            };
          }
          if (!reuse) {
            const cached = state.lookupNegativeVisibility(
              propagate,
              intrinsic,
              job,
              candidate.entry,
            );
            if (cached.status === "budget") {
              return undefined;
            }
            if (cached.status === "blocked") {
              work.rejected?.(candidate, cached.failure);
              return { accepted: false, failure: cached.failure };
            }
          }
          if (!charge()) {
            return undefined;
          }
          const trial = state.commit(job, candidate.entry);
          if (trial.accepted) {
            provenance.set(trial.entry, candidate);
          } else {
            work.rejected?.(candidate, trial.failure);
            const blockers = reuse ? state.blockersOf(trial.failure) : undefined;
            if (blockers !== undefined) {
              let byCandidate = conflicts.get(job);
              if (byCandidate === undefined) {
                byCandidate = new Map();
                conflicts.set(job, byCandidate);
              }
              byCandidate.set(candidate, { blockers, failure: trial.failure });
            }
          }
          return trial;
        },
      };
      let result = yield* construct.begin({
        ...ports,
        omissionAttempts: SLOT_OMISSION_ATTEMPTS.explore,
      });
      if (!halted() && reserveDue()) {
        reserving = true;
        result = yield* construct.begin({
          ...ports,
          omissionAttempts: SLOT_OMISSION_ATTEMPTS.reserve,
        });
      }
      if (partialFailure !== undefined) {
        return { failure: partialFailure, status: "blocked" };
      }
      if (
        incumbent !== undefined &&
        result.status !== "compatible" &&
        !(result.status === "blocked" && result.failure.classification === "unattributed")
      ) {
        return incumbent;
      }
      if (stopped()) {
        return { status: "budget" };
      }
      if (result.status === "budget" || result.status === "blocked") {
        return result;
      }
      if (result.status !== "compatible") {
        return { status: "blocked" };
      }
      const selected = selections(result.witness);
      return selected === undefined
        ? {
            failure: {
              classification: "unattributed",
              owners: [],
              rule: "missing-selected-source",
            },
            status: "blocked",
          }
        : { selections: selected, status: "compatible", witness: result.witness };
    } finally {
      state.restore(root);
    }
  }
  return {
    solve: (state: ConstraintState<Kind>): WitnessResult<Kind> => drainSlotSolver(steps(state)),
    // A pending session exclusively owns the native state until completion or cancellation.
    // Slices suspend between DFS transitions; preparation and native calls remain atomic.
    start(state: ConstraintState<Kind>) {
      const session = createSlotSolverSession(steps(state));
      const expose = (progress: ReturnType<typeof session.advance>) => {
        if (progress.status !== "complete") {
          return progress;
        }
        return progress.result.status === "compatible" || progress.result.status === "partial"
          ? { ...progress, status: "complete" as const }
          : { ...progress, status: "unsupported" as const };
      };
      return {
        advance: (transitionAllowance: number) => expose(session.advance(transitionAllowance)),
        cancel: () => expose(session.cancel()),
      };
    },
  };
}
