import type { SlotCandidate, SlotSequenceStep } from "./slotCandidateDomains.ts";
import type { PreparedSlotKind } from "./slotCandidates.ts";
import { SLOT_ROW_PRESSURE } from "./slotDelivery.ts";
import { traverseSlotSources } from "./slotSourceTraversal.ts";
import type {
  Choice,
  Option,
  SlotWitnessBudget,
  SlotWitnessConstructPorts,
  SourceScan,
} from "./slotWitnessConstructTypes.ts";
import type { createWitnessCoverage } from "./slotWitnessCoverage.ts";
import type { createWitnessJobOrdering } from "./slotWitnessJobOrder.ts";
import type { WitnessJob } from "./slotWitnessSearch.ts";
import { quotaFootprint } from "./spawning.ts";

// Candidate scans retain each source cursor until its deferred branches have been explored.
export function createWitnessSourceOptions<Kind extends string>(
  ports: Pick<
    SlotWitnessConstructPorts<Kind, unknown>,
    "candidates" | "motionTiers" | "propagate" | "rejects" | "stopped"
  >,
  budget: SlotWitnessBudget,
  coverage: Pick<
    ReturnType<typeof createWitnessCoverage<Kind>>,
    "anchorsFor" | "coversLeading" | "movingCoverageRows"
  >,
  ordering: Pick<ReturnType<typeof createWitnessJobOrdering<Kind>>, "columnOrder">,
) {
  const { charge, exhaust, stopped } = budget;
  const { anchorsFor, coversLeading, movingCoverageRows } = coverage;
  const { columnOrder } = ordering;
  function* options(
    scan: SourceScan<Kind>,
    seen: Set<string>,
    job: WitnessJob<Kind>,
    prepared: Iterable<PreparedSlotKind<Kind>>,
  ): Generator<Choice<Kind>> {
    if (stopped()) {
      return;
    }
    const { columns, deferred, pressure, repairRow, rows } = scan;
    const quietRows = scan.coverage?.leading;
    const covering = scan.coverage?.filter === "anchored";
    const filtered = scan.coverage !== undefined && scan.coverage.filter !== "open";
    const eligible = (candidate: SlotCandidate<Kind>) =>
      !filtered || coversLeading(candidate, quietRows!);
    const deferredIds = new Set<string>();
    // The caller supplies the frozen weighted kind order.
    for (const source of prepared) {
      if (filtered && (source.herring || !source.request.blocksLane)) {
        continue;
      }
      const sourceColumns = covering
        ? source.columns
        : (columns?.get(source) ?? columnOrder(job, source));
      const preferredRow =
        repairRow !== undefined &&
        source.request.blocksLane &&
        source.request.mover === undefined &&
        rows.includes(repairRow)
          ? repairRow
          : undefined;
      let sourceRows =
        preferredRow === undefined
          ? rows
          : [preferredRow, ...rows.filter((row) => row !== preferredRow)];
      if (covering && quietRows !== undefined && source.request.mover === undefined) {
        const anchors = anchorsFor(quotaFootprint(source.request).rows);
        if (anchors === undefined) {
          return;
        }
        const ordered: number[] = [];
        const seenRows = new Set<number>();
        for (const leading of quietRows) {
          if (!charge()) {
            return;
          }
          if (anchors.has(leading) && !seenRows.has(leading)) {
            seenRows.add(leading);
            ordered.push(leading);
          }
        }
        for (const leading of quietRows) {
          if (!charge()) {
            return;
          }
          for (const row of anchors.get(leading) ?? []) {
            if (!charge()) {
              return;
            }
            if (!seenRows.has(row)) {
              seenRows.add(row);
              ordered.push(row);
            }
          }
        }
        sourceRows = ordered;
      }
      if (quietRows !== undefined) {
        const hinted = movingCoverageRows(ports, quietRows, sourceRows, source);
        if (hinted === undefined) {
          exhaust();
          return;
        }
        sourceRows = hinted;
      }
      const frontiers = ports.motionTiers(source);
      if (frontiers.status === "budget") {
        exhaust();
        return;
      }
      const tiers = frontiers.status === "tiers" ? frontiers.tiers : [undefined];
      let fallback = false;
      for (let index = 0; index < tiers.length || fallback; index++) {
        const motionTier: number | undefined = fallback ? undefined : tiers[index];
        fallback = false;
        if (stopped()) {
          return;
        }
        let emptyTier = false;
        // Each source keeps its own row order; a pressured row waits behind the untried rows.
        const queue = [...sourceRows];
        const ordered = pressure !== undefined && !covering && quietRows === undefined;
        while (queue.length > 0) {
          const open = ordered
            ? queue.findIndex(
                (row) => (pressure.rejections.get(row) ?? 0) < SLOT_ROW_PRESSURE.rejections,
              )
            : 0;
          const row = queue.splice(Math.max(0, open), 1)[0]!;
          if (stopped()) {
            return;
          }
          if (covering && !source.request.blocksLane) {
            continue;
          }
          const candidates = ports.candidates(job, source, {
            columnStart: 0,
            columns: sourceColumns,
            ...(motionTier === undefined ? {} : { motionTier }),
            rows: [row],
          });
          if (stopped()) {
            return;
          }
          for (const step of candidates) {
            if (stopped()) {
              return;
            }
            if (step.status === "budget") {
              exhaust();
              return;
            }
            if (step.status === "empty-tier") {
              emptyTier = true;
              break;
            }
            if (step.status === "unavailable") {
              fallback = motionTier !== undefined;
              break;
            }
            if (!seen.has(step.candidate.id)) {
              const useful = eligible(step.candidate);
              if (stopped()) {
                return;
              }
              if (useful) {
                seen.add(step.candidate.id);
                pressure?.rows.set(step.candidate, row);
                yield { option: { candidate: step.candidate, job }, status: "candidate" };
              } else if (deferred !== undefined && !deferredIds.has(step.candidate.id)) {
                if (!charge()) {
                  return;
                }
                deferredIds.add(step.candidate.id);
                deferred.push({ candidate: step.candidate, job });
              }
            }
          }
          if (stopped()) {
            return;
          }
          if (emptyTier || fallback) {
            break;
          }
        }
        if (motionTier !== undefined) {
          // Drain unsafe values from this draw tuple before opening later retry tuples.
          yield { status: "tier-end" };
        }
        if (motionTier === undefined) {
          break;
        }
      }
      if (stopped()) {
        return;
      }
      // Suspend the source until its deferred branches have been explored.
      yield { status: "source-end" };
    }
  }
  // Opens each job's sources progressively in their weighted order (traverseSlotSources).
  function* sourceOptions(
    scan: SourceScan<Kind>,
    job: WitnessJob<Kind>,
    prepared: Iterable<PreparedSlotKind<Kind>>,
  ): Generator<Choice<Kind>> {
    if (stopped()) {
      return;
    }
    const seen = new Set<string>();
    const pending = new WeakMap<
      PreparedSlotKind<Kind>,
      Extract<Choice<Kind>, { status: "candidate" }>
    >();
    const cursor = traverseSlotSources(
      {
        *candidates(source): Generator<SlotSequenceStep<Kind>> {
          const deferred: Option<Kind>[] = [];
          for (const choice of options(scan, seen, job, [source])) {
            if (choice.status === "source-end" || choice.status === "tier-end") {
              for (const option of deferred) {
                pending.set(source, {
                  continuation: {
                    defer: () => {
                      throw new Error("Unsafe fallback cannot be deferred again");
                    },
                    preferClear: false,
                  },
                  option,
                  status: "candidate",
                });
                yield { candidate: option.candidate, status: "candidate" };
              }
              deferred.length = 0;
            } else {
              pending.set(source, {
                continuation: { defer: () => deferred.push(choice.option), preferClear: true },
                option: choice.option,
                status: "candidate",
              });
              yield { candidate: choice.option.candidate, status: "candidate" };
            }
          }
        },
        held: (candidate) => ports.rejects(job, candidate),
        propagate: ports.propagate,
        stopped,
      },
      prepared,
    );
    try {
      for (;;) {
        const next = cursor.next();
        if (next.done) {
          if (next.value.status !== "complete") {
            exhaust();
          }
          return;
        }
        const choice = pending.get(next.value.source);
        if (choice === undefined || choice.option.candidate !== next.value.candidate) {
          throw new Error("Missing source continuation candidate");
        }
        yield choice;
      }
    } finally {
      cursor.return({ status: "stopped" });
    }
  }
  return sourceOptions;
}
