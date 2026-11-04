export type SlotSolverProgress<Result> =
  | { readonly status: "pending" }
  | { readonly result: Result; readonly status: "complete" }
  | { readonly status: "cancelled" };

// A transition may call atomic native operations. This allowance does not bound elapsed time.
export function createSlotSolverSession<Result>(steps: Generator<void, Result, void>) {
  let terminal: Exclude<SlotSolverProgress<Result>, { status: "pending" }> | undefined;
  let failed = false;
  let error: unknown;
  return {
    advance(transitionAllowance: number): SlotSolverProgress<Result> {
      if (!Number.isSafeInteger(transitionAllowance) || transitionAllowance <= 0) {
        throw new RangeError("A solver slice requires a positive integer transition allowance");
      }
      if (failed) {
        throw error;
      }
      if (terminal !== undefined) {
        return terminal;
      }
      try {
        for (let used = 0; used < transitionAllowance; used++) {
          const next = steps.next();
          if (next.done) {
            terminal = { result: next.value, status: "complete" };
            return terminal;
          }
        }
        return { status: "pending" };
      } catch (caught) {
        // Generator unwinding owns restoration, including errors from native callbacks.
        failed = true;
        error = caught;
        throw caught;
      }
    },
    cancel(): SlotSolverProgress<Result> {
      if (failed) {
        throw error;
      }
      if (terminal === undefined) {
        terminal = { status: "cancelled" };
        try {
          steps.return(undefined as never);
        } catch (caught) {
          failed = true;
          error = caught;
          throw caught;
        }
      }
      return terminal;
    },
  };
}

export function drainSlotSolver<Result>(steps: Generator<void, Result, void>): Result {
  const session = createSlotSolverSession(steps);
  for (;;) {
    const progress = session.advance(1024);
    if (progress.status === "complete") {
      return progress.result;
    }
  }
}
