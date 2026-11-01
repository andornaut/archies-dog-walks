import { itemAt } from "@andornaut/game-kit/arrays";

import type { AdmissionReport } from "./spawnAdmission";
import type { PlannedSpawns, SpawnEvent, SpawnPlan } from "./spawning";
import type { RepairEntry as Entry } from "./spawnRepairFeasibility";

export function readRepairLedger<Kind extends string>(
  plan: SpawnPlan<Kind>,
  incumbent: PlannedSpawns<string>,
): Entry<Kind>[] {
  return incumbent.visibility.map((trace) => {
    if (trace.quotaIndex === undefined || trace.memberIndex === undefined) {
      throw new Error("Missing incumbent request identity");
    }
    const quota = itemAt(plan.quotas, trace.quotaIndex),
      event = itemAt(incumbent[trace.source], trace.index);
    if (event.kind !== quota.kind) {
      throw new Error("Incumbent kind differs from its request");
    }
    return { event: { ...event, kind: quota.kind }, herring: trace.source === "herrings", trace };
  });
}

export function selectRepairLedger<Kind extends string>(
  plan: SpawnPlan<Kind>,
  incumbent: PlannedSpawns<string>,
  stats: NonNullable<AdmissionReport<Kind>["repair"]>,
  ledger: readonly Entry<Kind>[],
): PlannedSpawns<Kind> {
  const byDistance = (a: SpawnEvent<Kind>, b: SpawnEvent<Kind>) =>
    a.distance - b.distance || a.lane - b.lane;
  const events = ledger
    .filter((e) => !e.herring)
    .map((e) => e.event)
    .sort(byDistance);
  const herrings = ledger
    .filter((e) => e.herring)
    .map((e) => e.event)
    .sort(byDistance);
  const counts = plan.quotas
    .map((q) => ({
      admitted: 0,
      herrings: 0,
      kind: q.kind,
      movement: q.mover?.movement ?? null,
      requested: plan.quotas
        .filter((other) => other.kind === q.kind && other.mover?.movement === q.mover?.movement)
        .reduce((sum, other) => sum + other.count, 0),
    }))
    .filter(
      (count, index, all) =>
        all.findIndex((other) => other.kind === count.kind && other.movement === count.movement) ===
        index,
    );
  for (const entry of ledger) {
    const count = counts.find(
      (c) => c.kind === entry.event.kind && c.movement === (entry.event.mover?.movement ?? null),
    )!;
    if (entry.herring) {
      count.herrings++;
    } else {
      count.admitted++;
    }
  }
  return {
    admission: {
      capacity: incumbent.admission.capacity,
      counts,
      rejections: incumbent.admission.rejections.flatMap((rejection) => {
        const kind =
          plan.quotas.find((q) => q.kind === rejection.kind)?.kind ??
          plan.fixedKinds.find((q) => q.kind === rejection.kind)?.kind;
        return kind === undefined ? [] : [{ ...rejection, kind }];
      }),
      repair: { ...stats },
      substitutions: [],
    },
    events,
    herrings,
    path: incumbent.path,
    visibility: ledger.map(({ event, herring, trace }) => ({
      ...trace,
      index: (herring ? herrings : events).indexOf(event),
      source: herring ? "herrings" : "events",
    })),
  };
}
