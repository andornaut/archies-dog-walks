// CLEANUP (added 2026-11-02): remove if the source-traversal experiment is declined.
import type { SlotCandidate, SlotSequenceStep } from "./slotCandidateDomains";
import type { PreparedSlotKind } from "./slotCandidates";

export interface SlotSourceTraversalWork<Kind extends string> {
  candidates(source: PreparedSlotKind<Kind>): Iterable<SlotSequenceStep<Kind>>;
  // A value whose recorded rejection still holds is passed on without a scheduling charge.
  held?(candidate: SlotCandidate<Kind>): boolean;
  propagate(): boolean;
  stopped(): boolean;
}
export interface SlotSourceTraversalValue<Kind extends string> {
  readonly candidate: SlotCandidate<Kind>;
  readonly source: PreparedSlotKind<Kind>;
}
// Completion describes supplied continuations, not a native complete-domain certificate.
export type SlotSourceTraversalResult =
  | { readonly status: "complete" }
  | { readonly status: "stopped" }
  | Extract<SlotSequenceStep<string>, { readonly status: "budget" }>;

// Sources arrive in their original seeded weighted permutation. Each continuation
// owns its primary ordering and unsafe FIFO; neither may be shared across sources.
// Opening one source per round preserves laziness, not the sequential first-fit distribution.
export function* traverseSlotSources<Kind extends string>(
  work: SlotSourceTraversalWork<Kind>,
  sources: Iterable<PreparedSlotKind<Kind>>,
): Generator<SlotSourceTraversalValue<Kind>, SlotSourceTraversalResult, void> {
  if (work.stopped()) {
    return { status: "stopped" };
  }
  const outer = sources[Symbol.iterator]();
  const active: {
    readonly cursor: Iterator<SlotSequenceStep<Kind>>;
    readonly source: PreparedSlotKind<Kind>;
  }[] = [];
  let outerComplete = false;
  let failed = false;
  try {
    while (!outerComplete || active.length > 0) {
      if (work.stopped()) {
        return { status: "stopped" };
      }
      if (!outerComplete) {
        if (!work.propagate()) {
          return { kind: "propagation", status: "budget" };
        }
        if (work.stopped()) {
          return { status: "stopped" };
        }
        const next = outer.next();
        if (work.stopped()) {
          return { status: "stopped" };
        }
        outerComplete = next.done === true;
        if (!next.done) {
          active.push({
            cursor: work.candidates(next.value)[Symbol.iterator](),
            source: next.value,
          });
        }
      }
      for (let index = 0; index < active.length;) {
        if (work.stopped()) {
          return { status: "stopped" };
        }
        const current = active[index]!;
        const next = current.cursor.next();
        if (work.stopped()) {
          return { status: "stopped" };
        }
        if (
          next.done ||
          next.value.status === "budget" ||
          work.held?.(next.value.candidate) !== true
        ) {
          if (!work.propagate()) {
            return { kind: "propagation", status: "budget" };
          }
          if (work.stopped()) {
            return { status: "stopped" };
          }
        }
        if (next.done) {
          active.splice(index, 1);
          continue;
        }
        if (next.value.status === "budget") {
          return next.value;
        }
        if (next.value.candidate.prepared !== current.source) {
          throw new RangeError("Candidate belongs to another source continuation");
        }
        index++;
        yield { candidate: next.value.candidate, source: current.source };
      }
    }
    return { status: "complete" };
  } catch (error) {
    failed = true;
    throw error;
  } finally {
    let cleanupFailed = false;
    let cleanupError: unknown;
    const cursors: Iterator<unknown>[] = [...active.map(({ cursor }) => cursor)];
    if (!outerComplete) {
      cursors.push(outer);
    }
    for (const cursor of cursors) {
      try {
        cursor.return?.();
      } catch (error) {
        if (!cleanupFailed) {
          cleanupFailed = true;
          cleanupError = error;
        }
      }
    }
    if (!failed && cleanupFailed) {
      // eslint-disable-next-line no-unsafe-finally -- Report cleanup failure unless traversal already failed.
      throw cleanupError;
    }
  }
}
