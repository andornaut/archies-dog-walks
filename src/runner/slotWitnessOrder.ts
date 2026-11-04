import type { PreparedSlotKind } from "./slotCandidates.ts";
import type { WitnessJob } from "./slotWitnessSearch.ts";

// Static orders for witness construction. They order choices only, never native admission.

// A job's rows, nearest its ideal row (its ordinal's share of the path) first.
export function idealRowOrder(
  rowCount: number,
  job: Pick<WitnessJob<string>, "ordinal" | "total">,
): number[] {
  const ideal = Math.floor(((job.ordinal + 0.5) * rowCount) / Math.max(1, job.total));
  return Array.from({ length: rowCount }, (_, row) => row).sort(
    (a, b) => Math.abs(a - ideal) - Math.abs(b - ideal) || a - b,
  );
}

// A source's columns, rotated to start at the job's ordinal lane.
export function rotatedColumns(
  laneCount: number,
  job: Pick<WitnessJob<string>, "ordinal">,
  prepared: Pick<PreparedSlotKind<string>, "columns">,
): number[] {
  const rank = (lane: number) => (((lane - job.ordinal) % laneCount) + laneCount) % laneCount;
  return [...prepared.columns].sort((a, b) => rank(a) - rank(b));
}

// How hard a source's motion is to place: signature first, standing last.
export function motionRank(prepared: Pick<PreparedSlotKind<string>, "request">): number {
  switch (prepared.request.mover?.motion.kind) {
    case "signature":
      return 0;
    case "cross":
      return 1;
    case "approach":
      return 2;
    case "steps":
      return 3;
    case "ride":
      return 4;
    default:
      return 5;
  }
}

// Fixed, moving and nonblocking jobs interleaved in proportion to their counts, each stream in
// its original order, ties to the earlier job. Each step is charged; undefined when one is refused.
export function balancedJobOrder<Kind extends string>(
  charge: () => boolean,
  jobs: readonly WitnessJob<Kind>[],
): WitnessJob<Kind>[] | undefined {
  const streams = Array.from({ length: 3 }, () => ({
    jobs: [] as { readonly index: number; readonly job: WitnessJob<Kind> }[],
    used: 0,
  }));
  for (const [index, job] of jobs.entries()) {
    if (!charge()) {
      return undefined;
    }
    streams[job.laneEffect === "none" ? 2 : job.fixed ? 0 : 1]!.jobs.push({ index, job });
  }
  const ordered: WitnessJob<Kind>[] = [];
  while (ordered.length < jobs.length) {
    let chosen: (typeof streams)[number] | undefined;
    for (const stream of streams) {
      if (!charge()) {
        return undefined;
      }
      if (stream.used === stream.jobs.length) {
        continue;
      }
      const difference =
        chosen === undefined
          ? -1
          : (stream.used + 1) * chosen.jobs.length - (chosen.used + 1) * stream.jobs.length;
      if (
        difference < 0 ||
        (difference === 0 && stream.jobs[stream.used]!.index < chosen!.jobs[chosen!.used]!.index)
      ) {
        chosen = stream;
      }
    }
    if (!charge()) {
      return undefined;
    }
    ordered.push(chosen!.jobs[chosen!.used++]!.job);
  }
  return ordered;
}
