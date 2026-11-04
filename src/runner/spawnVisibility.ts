import type { MoverDraws } from "./moverModel.ts";
import type { MoverVisibilityProof } from "./moverPlanning.ts";
import type { SpawnRejection } from "./spawnAdmission.ts";
import type { FeasibilityObserver } from "./spawnFeasibilityDiagnostics.ts";

// Distances are cumulative road scroll. A reservation covers one logical obstacle,
// including its cue and any scenery left after contact.
export interface SpawnVisibility {
  readonly entry: number;
  readonly until: number;
  readonly kind: string;
  readonly lane: number;
  readonly row: number;
}

export interface SpawnVisibilityTrace extends SpawnVisibility {
  readonly hazard: boolean;
  readonly index: number;
  readonly memberIndex?: number;
  readonly nativeUntil: number;
  readonly placement?: MoverVisibilityProof;
  readonly quotaIndex?: number;
  readonly requestedDraws?: MoverDraws;
  readonly source: "events" | "herrings";
}

export function visibilityRejection(
  entrySpacing: number,
  planned: readonly SpawnVisibility[],
  incoming: SpawnVisibility,
  onFailure?: FeasibilityObserver,
): SpawnRejection | undefined {
  const same = planned.filter((other) => other.kind === incoming.kind);
  const overlapping = same.filter(
    (other) => other.entry < incoming.until && incoming.entry < other.until,
  );
  if (overlapping.some((other) => other.row === incoming.row)) {
    onFailure?.({
      contributors: overlapping.filter((other) => other.row === incoming.row),
      rule: "kind-row",
    });
    return "kind-row";
  }
  if (overlapping.some((other) => other.lane === incoming.lane)) {
    onFailure?.({
      contributors: overlapping.filter((other) => other.lane === incoming.lane),
      rule: "kind-lane",
    });
    return "kind-lane";
  }
  if (
    overlapping.some(
      (other) => Math.abs(Math.max(0, other.entry) - Math.max(0, incoming.entry)) < entrySpacing,
    )
  ) {
    onFailure?.({
      contributors: overlapping.filter(
        (other) => Math.abs(Math.max(0, other.entry) - Math.max(0, incoming.entry)) < entrySpacing,
      ),
      rule: "kind-entry",
    });
    return "kind-entry";
  }
  const moments = [incoming.entry, ...overlapping.map((other) => other.entry)];
  if (
    moments.some(
      (moment) =>
        moment >= incoming.entry &&
        moment < incoming.until &&
        overlapping.filter((other) => other.entry <= moment && moment < other.until).length >= 2,
    )
  ) {
    if (onFailure !== undefined) {
      const moment = moments.find(
        (moment) =>
          moment >= incoming.entry &&
          moment < incoming.until &&
          overlapping.filter((other) => other.entry <= moment && moment < other.until).length >= 2,
      )!;
      onFailure({
        contributors: overlapping.filter((other) => other.entry <= moment && moment < other.until),
        moment,
        rule: "kind-cap",
      });
    }
    return "kind-cap";
  }
  return undefined;
}
