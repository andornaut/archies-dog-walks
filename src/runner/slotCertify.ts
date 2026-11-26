import { auditSlotPartialPlan, auditSlotPlan, type SlotAudit } from "./slotAudit.ts";
import type { SlotConfiguration, SlotKind } from "./slotConfig.ts";
import type { SlotOmission } from "./slotDelivery.ts";
import type { SlotJob } from "./slotJobs.ts";
import { materialiseSlotPlan, type SlotAssignment } from "./slotPlan.ts";
import type { SlotCertificate, SlotPlanningContext } from "./slotPlanner.ts";
import type { WitnessJob, WitnessOmission, WitnessSelection } from "./slotWitnessSearch.ts";
import type { PlannedSpawns, SpawnPlan, SpawnQuota } from "./spawning.ts";

export function createSlotCertification<Kind extends string>(
  context: SlotPlanningContext,
  geometry: Omit<SpawnPlan<Kind>, "quotas">,
  path: PlannedSpawns<Kind>["path"],
  catalogue: readonly SlotKind<Kind>[],
  auxiliary: readonly SpawnQuota<Kind>[],
  config: SlotConfiguration<Kind>,
  stats: { audits: number; certificateTemplates: number },
  originalJobs: readonly SlotJob<Kind>[],
  witnessJobs: readonly WitnessJob<Kind>[],
) {
  const witnessByKey = new Map(witnessJobs.map((job) => [job.key, job]));
  const sourceByKey = new Map(originalJobs.map((job) => [job.key, job]));
  const bind = (
    selected: readonly WitnessSelection<Kind>[],
  ): SlotAssignment<Kind>[] | undefined => {
    const ledger: SlotAssignment<Kind>[] = [];
    for (const value of selected) {
      const job = sourceByKey.get(value.job.key),
        source = value.candidate.prepared.source;
      if (
        job === undefined ||
        witnessByKey.get(job.key) !== value.job ||
        value.owner !== value.job ||
        !job.sources.includes(source) ||
        source.role !== job.role ||
        value.entry.trace.quotaIndex !== ledger.length ||
        value.entry.trace.memberIndex !== 0 ||
        value.entry.event !== value.candidate.entry.event ||
        value.entry.request !== value.candidate.entry.request ||
        value.entry.placement !== value.candidate.entry.placement
      ) {
        return undefined;
      }
      ledger.push({
        ...(job.auxiliary === undefined ? {} : { auxiliary: job.auxiliary }),
        binding: { kind: source.kind, role: source.role, weight: source.weight },
        entry: value.entry,
        key: job.key,
        phase: job.phase,
        role: job.role,
      });
    }
    return ledger;
  };
  const bindOmissions = (
    missing: readonly WitnessOmission<Kind>[],
  ): readonly SlotOmission<Kind>[] | undefined => {
    const omitted: SlotOmission<Kind>[] = [];
    for (const value of missing) {
      const job = sourceByKey.get(value.job.key);
      if (job === undefined || witnessByKey.get(job.key) !== value.job || job.guaranteed) {
        return undefined;
      }
      const kinds = new Set(job.sources.map((source) => source.kind));
      omitted.push(
        Object.freeze({
          ...(job.auxiliary === undefined ? {} : { auxiliary: job.auxiliary }),
          ...(kinds.size === 1 ? { kind: job.sources[0]!.kind } : {}),
          key: job.key,
          reason: value.reason,
          role: job.role,
        }),
      );
    }
    return Object.freeze(omitted);
  };
  const certifyPartial = (
    missing: readonly SlotOmission<Kind>[],
    ledger: readonly SlotAssignment<Kind>[],
  ) => {
    const audit = auditSlotPartialPlan(
      context,
      geometry,
      path,
      catalogue,
      auxiliary,
      config,
      missing,
      ledger,
    );
    stats.audits++;
    stats.certificateTemplates += audit.compiledTemplates;
    return audit;
  };
  const certify = (ledger: readonly SlotAssignment<Kind>[]) => {
    const audit = auditSlotPlan(
      context,
      geometry,
      path,
      catalogue,
      auxiliary,
      config,
      "active",
      ledger,
    );
    stats.audits++;
    stats.certificateTemplates += audit.compiledTemplates;
    return audit;
  };
  const certificate = (
    audit: SlotAudit,
    ledger: readonly SlotAssignment<Kind>[],
  ): SlotCertificate<Kind> => ({
    ...materialiseSlotPlan(geometry, path, ledger),
    assignments: ledger,
    audit,
    phase: "active",
  });

  return { bind, bindOmissions, certificate, certify, certifyPartial };
}
