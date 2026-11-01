import { itemAt } from "@andornaut/game-kit/arrays";

import { moverPlacements, sameMoverMotion } from "./moverPlanning";
import { type PlannedSpawns, quotaFootprint, type SpawnPlan } from "./spawning";
import { createRepairCandidates } from "./spawnRepairCandidates";
import { createRepairFeasibility, type RepairEntry as Entry } from "./spawnRepairFeasibility";
import { readRepairLedger, selectRepairLedger } from "./spawnRepairLedger";
import type { SpawnConstruction } from "./spawnSearch";
import { auditSpawnPlan, createSpawnAuditor, type SpawnAudit } from "./spawnValidation";

const AUDIT_LIMIT = 400;
const FEASIBILITY_LIMIT = 4096;
const EVALUATION_LIMIT = AUDIT_LIMIT + FEASIBILITY_LIMIT;
const SEARCH_NODE_LIMIT = EVALUATION_LIMIT - 1;
const TRANSACTION_NODE_LIMIT = 384;
const REQUEST_CANDIDATE_LIMIT = 32;
const BLOCKER_LIMIT = 5;

const identity = ({ trace }: Entry<string>) => `${trace.quotaIndex}:${trace.memberIndex}`;

// Repairs immutable selected proofs. Rejected branches never mutate masks, requests or random streams.
export function repairIncumbentSpawns<Kind extends string>(
  construction: SpawnConstruction,
  plan: SpawnPlan<Kind>,
  incumbent: PlannedSpawns<string>,
): PlannedSpawns<Kind> {
  const stats = {
    accepted: 0,
    auditedNodes: 0,
    candidates: 0,
    evaluatedNodes: 0,
    feasibilityNodes: 0,
    generatedPlacements: 0,
    stopReason: "alternatives-exhausted",
    transactions: 0,
    validationFailures: [] as string[],
  };
  let requestLimit = SEARCH_NODE_LIMIT;
  const { geometry, placements } = createRepairCandidates(
    plan,
    {
      exhausted: () => stats.evaluatedNodes >= requestLimit,
      generated: () => {
        stats.generatedPlacements++;
      },
    },
    construction,
  );
  const auditor = createSpawnAuditor(plan, incumbent.path);
  let entries = readRepairLedger(plan, incumbent);
  const selected = (ledger: readonly Entry<Kind>[]) =>
    selectRepairLedger(plan, incumbent, stats, ledger);
  const audit = (ledger: readonly Entry<Kind>[]): SpawnAudit | undefined => {
    if (stats.evaluatedNodes >= requestLimit || stats.auditedNodes >= AUDIT_LIMIT - 2) {
      return undefined;
    }
    stats.evaluatedNodes++;
    stats.auditedNodes++;
    return auditor.audit(selected(ledger));
  };
  const certify = (ledger: readonly Entry<Kind>[]): boolean => {
    if (stats.evaluatedNodes >= requestLimit || stats.auditedNodes >= AUDIT_LIMIT - 1) {
      return false;
    }
    stats.evaluatedNodes++;
    stats.auditedNodes++;
    const checked = auditSpawnPlan(plan, selected(ledger));
    const byId = new Map(ledger.map((entry) => [identity(entry), entry]));
    const retained =
      ledger.length === entries.length + 1 &&
      byId.size === ledger.length &&
      entries.every((old) => {
        const current = byId.get(identity(old));
        return (
          current !== undefined &&
          old.event.kind === current.event.kind &&
          old.herring === current.herring &&
          (old.event.mover === undefined
            ? current.event.mover === undefined
            : current.event.mover !== undefined &&
              sameMoverMotion(old.event.mover, current.event.mover))
        );
      });
    if (checked.status === "valid" && checked.validPlaced === ledger.length && retained) {
      return true;
    }
    stats.validationFailures.push(
      ...checked.violations,
      ...checked.missingCoverage,
      ...checked.findings.flatMap((finding) => finding.reasons),
      ...(retained ? [] : ["lost incumbent identity or movement"]),
    );
    return false;
  };
  const missing = () => {
    const present = new Set(entries.map(identity));
    return plan.quotas
      .flatMap((quota, quotaIndex) =>
        Array.from({ length: quota.count }, (_, memberIndex) => ({
          memberIndex,
          quotaIndex,
        })).filter((id) => !present.has(`${id.quotaIndex}:${id.memberIndex}`)),
      )
      .sort(
        (a, b) =>
          Number(plan.quotas[b.quotaIndex]?.mover?.motion.kind === "signature") -
            Number(plan.quotas[a.quotaIndex]?.mover?.motion.kind === "signature") ||
          a.quotaIndex - b.quotaIndex ||
          a.memberIndex - b.memberIndex,
      );
  };
  type Proposal = { target: Entry<Kind>; blockers: Entry<Kind>[]; revision: number };
  const alternatives = new Map<string, Proposal[]>();
  let revision = 0;
  let workRemaining = true;
  while (
    workRemaining &&
    stats.evaluatedNodes < SEARCH_NODE_LIMIT &&
    stats.feasibilityNodes < FEASIBILITY_LIMIT &&
    stats.auditedNodes < AUDIT_LIMIT - 1
  ) {
    workRemaining = false;
    const requests = missing();
    for (const [requestIndex, request] of requests.entries()) {
      if (stats.evaluatedNodes >= SEARCH_NODE_LIMIT) {
        break;
      }
      const remaining = SEARCH_NODE_LIMIT - stats.evaluatedNodes;
      const later = requests.length - requestIndex - 1;
      const reserved = Math.min(64, Math.floor(remaining / (later + 1)));
      requestLimit = SEARCH_NODE_LIMIT - reserved * later;
      const requestId = `${request.quotaIndex}:${request.memberIndex}`;
      const proposals = alternatives.get(requestId) ?? [];
      const discovered = alternatives.has(requestId);
      alternatives.set(requestId, proposals);
      let probed = 0;
      const probeEnd = stats.evaluatedNodes + Math.floor((requestLimit - stats.evaluatedNodes) / 2);
      for (const target of discovered ? [] : placements(request.quotaIndex, request.memberIndex)) {
        if (probed++ >= REQUEST_CANDIDATE_LIMIT || stats.evaluatedNodes >= probeEnd) {
          break;
        }
        stats.candidates++;
        const preview = selected([...entries, target]),
          checked = audit([...entries, target]);
        if (checked === undefined) {
          break;
        }
        if (checked.status === "valid") {
          if (certify([...entries, target])) {
            entries = [...entries, target];
            stats.accepted++;
            revision++;
          }
          break;
        }
        const blockers = entries.filter((e) =>
          checked.findings.some(
            (f) => f.reasons.length > 0 && preview[f.source][f.index] === e.event,
          ),
        );
        if (blockers.length === 0 || blockers.length > BLOCKER_LIMIT) {
          continue;
        }
        if (stats.evaluatedNodes >= requestLimit || stats.feasibilityNodes >= FEASIBILITY_LIMIT) {
          break;
        }
        const cleared = createRepairFeasibility("complete", plan, incumbent.path, entries).without(
          blockers.map(identity),
        );
        stats.evaluatedNodes++;
        stats.feasibilityNodes++;
        if (cleared.tryInsert(target)) {
          proposals.push({ blockers, revision, target });
        }
      }
      if (entries.some((e) => identity(e) === `${request.quotaIndex}:${request.memberIndex}`)) {
        continue;
      }
      proposals.sort((a, b) => a.blockers.length - b.blockers.length);
      const proposal = proposals.shift();
      if (proposals.length > 0) {
        workRemaining = true;
      }
      if (proposal !== undefined) {
        const { target } = proposal;
        const blockerIds = new Set(proposal.blockers.map(identity));
        const blockers = entries.filter((entry) => blockerIds.has(identity(entry)));
        stats.transactions++;
        if (stats.evaluatedNodes >= requestLimit) {
          break;
        }
        const transactionStart = stats.evaluatedNodes;
        const transactionEnd = Math.min(requestLimit, transactionStart + TRANSACTION_NODE_LIMIT);
        const evaluationEnd = transactionEnd - 1;
        const retained = entries.filter((e) => !blockers.includes(e));
        const transaction = createRepairFeasibility(
          "complete",
          plan,
          incumbent.path,
          entries,
        ).without(blockers.map(identity));
        const evaluate = (entry: Entry<Kind>): boolean | undefined => {
          if (
            stats.evaluatedNodes >= evaluationEnd ||
            stats.feasibilityNodes >= FEASIBILITY_LIMIT
          ) {
            return undefined;
          }
          stats.evaluatedNodes++;
          stats.feasibilityNodes++;
          return transaction.tryInsert(entry);
        };
        const initial = transaction.checkpoint();
        const targetFits = evaluate(target);
        if (targetFits !== true) {
          if (targetFits === false && proposal.revision === revision) {
            stats.validationFailures.push(`fast check rejected audited target ${identity(target)}`);
          }
          continue;
        }
        const mobility = (entry: Entry<Kind>): number => {
          const quota = itemAt(plan.quotas, entry.trace.quotaIndex!);
          const selection = entry.trace.placement?.selection;
          return entry.event.mover === undefined ||
            quota.mover === undefined ||
            selection === undefined
            ? plan.laneCount - quotaFootprint(quota).lanes + 1
            : moverPlacements(geometry, quota.mover, selection.draws, selection.lift).filter((p) =>
                sameMoverMotion(entry.event.mover!, p.path),
              ).length;
        };
        const ordered = [...blockers].sort(
          (a, b) =>
            Number(a.event.mover === undefined) - Number(b.event.mover === undefined) ||
            mobility(a) - mobility(b) ||
            (b.event.mover !== undefined && "steps" in b.event.mover
              ? b.event.mover.steps.length
              : 0) -
              (a.event.mover !== undefined && "steps" in a.event.mover
                ? a.event.mover.steps.length
                : 0) ||
            a.trace.quotaIndex! - b.trace.quotaIndex! ||
            a.trace.memberIndex! - b.trace.memberIndex!,
        );
        const visit = (
          ledger: readonly Entry<Kind>[],
          depth: number,
        ): Entry<Kind>[] | undefined => {
          if (depth === ordered.length) {
            return [...ledger];
          }
          if (
            stats.evaluatedNodes >= evaluationEnd ||
            stats.feasibilityNodes >= FEASIBILITY_LIMIT
          ) {
            return undefined;
          }
          const previous = itemAt(ordered, depth);
          const candidates = placements(
            previous.trace.quotaIndex!,
            previous.trace.memberIndex!,
            previous,
          );
          while (
            stats.evaluatedNodes < evaluationEnd &&
            stats.feasibilityNodes < FEASIBILITY_LIMIT
          ) {
            const candidate = candidates.next();
            if (candidate.done) {
              break;
            }
            const replacement = candidate.value;
            const checkpoint = transaction.checkpoint();
            if (evaluate(replacement) !== true) {
              continue;
            }
            const found = visit([...ledger, replacement], depth + 1);
            if (found !== undefined) {
              return found;
            }
            transaction.restore(checkpoint);
          }
          return undefined;
        };
        const repaired = visit([...retained, target], 0);
        if (repaired !== undefined && certify(repaired)) {
          entries = repaired;
          stats.accepted++;
          revision++;
          workRemaining = true;
          continue;
        }
        transaction.restore(initial);
        if (stats.evaluatedNodes >= SEARCH_NODE_LIMIT) {
          break;
        }
      }
    }
  }
  stats.stopReason =
    stats.feasibilityNodes >= FEASIBILITY_LIMIT
      ? "feasibility-budget"
      : stats.auditedNodes >= AUDIT_LIMIT - 1
        ? "audit-budget"
        : stats.evaluatedNodes >= SEARCH_NODE_LIMIT
          ? "evaluation-budget"
          : "alternatives-exhausted";
  stats.evaluatedNodes++;
  stats.auditedNodes++;
  const result = selected(entries);
  const certified = auditSpawnPlan(plan, result);
  if (certified.status !== "valid" || certified.validPlaced !== entries.length) {
    throw new Error("Repaired spawn tree failed final validation");
  }
  for (const entry of entries) {
    itemAt(construction.admitted, entry.trace.quotaIndex!)[entry.trace.memberIndex!] = true;
  }
  return result;
}
