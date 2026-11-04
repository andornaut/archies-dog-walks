import { describe, expect, it } from "vitest";

import { auditSlotPartialPlan, auditSlotPlan } from "./slotAudit";
import { prepareSlotKind, slotPlacementsAt } from "./slotCandidates";
import type { SlotConfiguration, SlotKind } from "./slotConfig";
import { createSlotConstructionState } from "./slotConstraintState";
import { minimumSlotDelivery, type SlotOmission } from "./slotDelivery";
import { slotMotionStreams } from "./slotEntropy";
import { makeSlotJobs } from "./slotJobs";
import { materialisePartialSlotPlan, type SlotAssignment } from "./slotPlan";
import { rowSpacing, type SpawnPlan, type SpawnQuota, zoneRows } from "./spawning";
import { auditSpawnPlan } from "./spawnValidation";

const geometry: Omit<SpawnPlan<string>, "quotas"> = {
  cellInset: 5,
  cellLength: 30,
  fixedKinds: [],
  laneCount: 5,
  laneInset: 5,
  laneMoveSeconds: 0.1,
  maxEmptyRows: Infinity,
  minOpenLanes: 2,
  minSpacing: 100,
  moverCaps: { darts: 1, slowVehicles: 1, total: 3 },
  packHitLength: 30,
  packLength: 30,
  pathLaneMoveSeconds: 0.1,
  pathStart: 4,
  reactionSeconds: 0,
  riderFollowGap: 30,
  roadLength: 100,
  scrollSpeed: 100,
  sightLength: 80,
  stepSeconds: 0.05,
  zoneLength: 2000,
};
const path = zoneRows(geometry, rowSpacing({ ...geometry, quotas: [] })).map((distance) => ({
  distance,
  lane: 4,
}));
const context = { seed: 7, zoneIndex: 0 };
const empty = { encounterFixed: 0, encounterMoving: 0, minorFixed: 0, minorMoving: 0 };
function fixture(optionalRole = false, extraKind = false) {
  const catalogue: SlotKind<string>[] = ["bench", ...(extraKind ? ["sign"] : [])].map((kind) => ({
    compile: () => ({ blocksLane: true, footprint: { lanes: 1, rows: 1 } }),
    footprint: { lanes: 1, rows: 1 },
    kind,
    role: "minorFixed",
    weight: 1,
  }));
  const configured = catalogue.length + Number(optionalRole);
  const config: SlotConfiguration<string> = {
    active: { ...empty, minorFixed: configured },
    capacity: { ...empty, minorFixed: configured },
    guarantees: catalogue.map(({ kind }) => ({ count: 1, kind, role: "minorFixed" })),
  };
  const auxiliary: SpawnQuota<string>[] = [
    {
      blocksLane: false,
      count: 10 - configured,
      kind: "tip",
      moversPassOver: true,
      moversRestOn: true,
    },
  ];
  const jobs = makeSlotJobs(catalogue, auxiliary, config);
  const bind = (omitted: ReadonlySet<string>) => {
    const state = createSlotConstructionState(geometry, path);
    const assignments: SlotAssignment<string>[] = [];
    const omissions: SlotOmission<string>[] = [];
    jobs.forEach((job, index) => {
      if (omitted.has(job.key)) {
        const kinds = [...new Set(job.sources.map(({ kind }) => kind))];
        omissions.push({
          ...(job.auxiliary ? { auxiliary: job.auxiliary } : {}),
          key: job.key,
          ...(kinds.length === 1 ? { kind: kinds[0]! } : {}),
          reason: "not-selected-within-allowance",
          role: job.role,
        });
        return;
      }
      const source = job.sources[0]!;
      const prepared = prepareSlotKind(
        slotMotionStreams(context, job.key, source.kind),
        geometry,
        source,
      );
      const row = index + 1;
      const entry = slotPlacementsAt(
        geometry,
        { distance: path[row]!.distance, lane: 0, row, slot: 0 },
        prepared,
      )[0]!;
      const committed = state.commit(job, entry);
      expect(committed.accepted).toBe(true);
      if (!committed.accepted) {
        throw new Error("Native fixture placement rejected");
      }
      assignments.push({
        ...(job.auxiliary ? { auxiliary: job.auxiliary } : {}),
        binding: { kind: source.kind, role: source.role, weight: source.weight },
        entry: committed.entry,
        key: job.key,
        phase: "active",
        role: job.role,
      });
    });
    expect(state.checkComplete().accepted).toBe(true);
    return { assignments, omissions };
  };
  return { auxiliary, bind, catalogue, config, jobs };
}

describe("independent partial slot certificates", () => {
  it("keeps original totals and native insertion identity after an optional middle reward omission", () => {
    const f = fixture();
    const { assignments, omissions } = f.bind(new Set([f.jobs[5]!.key]));
    const audit = auditSlotPartialPlan(
      context,
      geometry,
      path,
      f.catalogue,
      f.auxiliary,
      f.config,
      omissions,
      assignments,
    );
    expect(audit.status).toBe("valid");
    expect(audit.delivery).toMatchObject({
      configured: 10,
      configuredByRole: { auxiliaryFixed: 9 },
      delivered: 9,
      deliveredByRole: { auxiliaryFixed: 8 },
      required: 9,
    });
    expect(audit.geometry).toMatchObject({ placed: 9, requested: 9, validPlaced: 9 });
    expect(assignments.map(({ entry }) => entry.trace.quotaIndex)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8,
    ]);
    expect(
      auditSlotPlan(
        context,
        geometry,
        path,
        f.catalogue,
        f.auxiliary,
        f.config,
        "active",
        assignments,
      ).status,
    ).toBe("invalid");
    const materialised = materialisePartialSlotPlan(geometry, path, audit.delivery, assignments);
    expect(materialised.planned.admission.placement).toMatchObject({
      placed: 9,
      ratio: 0.9,
      requested: 10,
    });
    expect(materialised.planned.admission.delivery.omissions).toEqual(omissions);
    expect(auditSpawnPlan(materialised.plan, materialised.planned).validPlaced).toBe(9);
  });

  it("protects the dedicated guaranteed owner even when another retained job supplies its logical kind", () => {
    const f = fixture(true);
    const { assignments, omissions } = f.bind(new Set([f.jobs[0]!.key]));
    const audit = auditSlotPartialPlan(
      context,
      geometry,
      path,
      f.catalogue,
      f.auxiliary,
      f.config,
      omissions,
      assignments,
    );
    expect(audit.status).toBe("invalid");
    expect(audit.failure).toBe("ineligible");
    expect(audit.violations).toContain(`protected-owner:${f.jobs[0]!.key}`);
    expect(audit.geometry.status).toBe("valid");
  });

  it("rejects invented weighted kinds, unknown identities and retained profile downgrades", () => {
    const f = fixture(true, true);
    const optional = f.jobs.find((job) => !job.guaranteed && !job.auxiliary)!;
    const { assignments, omissions } = f.bind(new Set([optional.key]));
    expect(
      auditSlotPartialPlan(
        context,
        geometry,
        path,
        f.catalogue,
        f.auxiliary,
        f.config,
        omissions,
        assignments,
      ).status,
    ).toBe("valid");
    const forged = auditSlotPartialPlan(
      context,
      geometry,
      path,
      f.catalogue,
      f.auxiliary,
      f.config,
      [{ ...omissions[0]!, kind: "bench" }],
      assignments,
    );
    expect(forged.failure).toBe("invariant");
    expect(forged.violations).toContain("omitted-job-kind");
    const unknown = auditSlotPartialPlan(
      context,
      geometry,
      path,
      f.catalogue,
      f.auxiliary,
      f.config,
      [{ ...omissions[0]!, key: "unknown" }],
      assignments,
    );
    expect(unknown.violations).toContain("unknown-omitted-job");
    const unknownSelected = auditSlotPartialPlan(
      context,
      geometry,
      path,
      f.catalogue,
      f.auxiliary,
      f.config,
      omissions,
      [{ ...assignments[0]!, key: "unknown" }, ...assignments.slice(1)],
    );
    expect(unknownSelected.status).toBe("invalid");
    expect(unknownSelected.violations).toContain("unknown-selected-job");
    const duplicate = auditSlotPartialPlan(
      context,
      geometry,
      path,
      f.catalogue,
      f.auxiliary,
      f.config,
      [...omissions, ...omissions],
      assignments,
    );
    expect(duplicate.status).toBe("invalid");
    expect(duplicate.violations).toContain("duplicate-omitted-job");
    const wrongRole = auditSlotPartialPlan(
      context,
      geometry,
      path,
      f.catalogue,
      f.auxiliary,
      f.config,
      omissions,
      [
        {
          ...assignments[0]!,
          binding: { ...assignments[0]!.binding, role: "encounterFixed" },
          role: "encounterFixed",
        },
        ...assignments.slice(1),
      ],
    );
    expect(wrongRole.status).toBe("invalid");
    expect(wrongRole.failure).toBe("invariant");
    const [first, ...rest] = assignments;
    const changed = {
      ...first!,
      entry: { ...first!.entry, request: { ...first!.entry.request, blocksLane: false } },
    };
    const downgraded = auditSlotPartialPlan(
      context,
      geometry,
      path,
      f.catalogue,
      f.auxiliary,
      f.config,
      omissions,
      [changed, ...rest],
    );
    expect(downgraded.failure).toBe("invariant");
    expect(downgraded.violations).toContain("slot-profile-binding");
  });

  it("requires the rational delivery floor and complete quiet coverage", () => {
    expect(minimumSlotDelivery("runtime-90", 236)).toBe(213);
    expect(minimumSlotDelivery("exact", 236)).toBe(236);
    const f = fixture();
    const { assignments, omissions } = f.bind(new Set([f.jobs[8]!.key, f.jobs[9]!.key]));
    const short = auditSlotPartialPlan(
      context,
      geometry,
      path,
      f.catalogue,
      f.auxiliary,
      f.config,
      omissions,
      assignments,
    );
    expect(short.failure).toBe("ineligible");
    expect(short.violations).toContain("delivery-floor");
    expect(() => materialisePartialSlotPlan(geometry, path, short.delivery, assignments)).toThrow(
      RangeError,
    );
    const quiet = auditSlotPartialPlan(
      context,
      { ...geometry, maxEmptyRows: 0 },
      path,
      f.catalogue,
      f.auxiliary,
      f.config,
      omissions,
      assignments,
    );
    expect(quiet.violations).toContain("quiet-row-coverage");
  });
});
