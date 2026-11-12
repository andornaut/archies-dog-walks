import type { LoaderWatch } from "@andornaut/game-kit/load/phaser/watchLoader";

// The loader events stopOnceRetried follows: Phaser's complete event.
interface CompletingLoader {
  isLoading(): boolean;
  off(event: "complete", listener: () => void): unknown;
  on(event: "complete", listener: () => void): unknown;
}

// Calls stop once watch has no failed file left to retry: now if none is, else once a retry
// round's run (the kit's RETRY_ROUNDS_MS after a failure) completes with every file loaded or,
// after its last round, given up, which the next launch loads again. recovered runs as each of
// those runs completes, to take in what it loaded. The rounds run on the watch's timer and the
// loader's file events, never on the game loop, so they wake no sleeping loop.
export function stopOnceRetried(
  load: CompletingLoader,
  watch: Pick<LoaderWatch<string>, "failures">,
  done: { recovered(): void; stop(): void },
): void {
  const settled = () => watch.failures().length === 0 && !load.isLoading();
  if (settled()) {
    done.stop();
    return;
  }
  const complete = () => {
    done.recovered();
    if (settled()) {
      load.off("complete", complete);
      done.stop();
    }
  };
  load.on("complete", complete);
}
