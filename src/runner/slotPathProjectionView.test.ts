import { describe, expect, it, vi } from "vitest";

import { plannerStreams } from "../testing/movers";
import { createSlotCandidateDomains } from "./slotCandidateDomains";
import {
  createSlotPathProjection,
  prepareSlotKind,
  type SlotPathProjectionView,
  slotPlacementsAt,
} from "./slotCandidates";
import type { SlotKind } from "./slotConfig";
import { rowSpacing, type SpawnPlan, zoneRows } from "./spawning";

function fixture(blocksLane = true) {
  const caps = { darts: 1, slowVehicles: 1, total: 3 };
  const geometry: Omit<SpawnPlan<string>, "quotas"> = {
    cellInset: 5,
    cellLength: 30,
    fixedKinds: [],
    laneCount: 5,
    laneInset: 5,
    laneMoveSeconds: 0.1,
    maxEmptyRows: Infinity,
    minOpenLanes: 1,
    minSpacing: 100,
    moverCaps: caps,
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
  const footprint = { lanes: 1, rows: 1 };
  const source: SlotKind<string> = {
    compile: () => ({
      blocksLane,
      mover: {
        footprint,
        motion: {
          count: { max: 1, min: 1 },
          kind: "steps",
          sequences: [
            [{ lanes: 1, travel: 0 }],
            [{ lanes: 1, travel: 0 }],
            [{ lanes: -1, travel: 0 }],
          ],
          stepSeconds: 0.1,
        },
        movement: "step",
        variation: { delaySeconds: 0, lengthShare: 0, speedShare: 0 },
        warningSeconds: 0.1,
      },
    }),
    footprint,
    kind: "stepper",
    role: "minorMoving",
    weight: 1,
  };
  const path = zoneRows(geometry, rowSpacing({ ...geometry, quotas: [] })).map((distance) => ({
    distance,
    lane: 4,
  }));
  const prepared = prepareSlotKind(plannerStreams(3), geometry, source);
  const selected = prepared.placements.find((placement) => placement.lane === 1)!;
  const anchor = { distance: path[3]!.distance, lane: selected.lane, row: 3, slot: 0 };
  return { anchor, caps, footprint, geometry, path, prepared, selected, source };
}

const work = () => ({ check: vi.fn(() => true), propagate: vi.fn(() => true) });
function issued(
  projection: ReturnType<typeof createSlotPathProjection<string>>,
  prepared: ReturnType<typeof fixture>["prepared"],
  selected: ReturnType<typeof fixture>["selected"],
): SlotPathProjectionView<string> {
  const result = projection.view({ propagate: () => true }, prepared, new Set([selected]));
  expect(result.status).toBe("view");
  if (result.status !== "view") {
    throw Error("Native placement view was not issued");
  }
  return result.view;
}

describe("native path-projection placement views", () => {
  it("preserves original variants, repeated aliases and draws without warming the full catalogue", () => {
    const { anchor, geometry, path, prepared, selected } = fixture();
    const projection = createSlotPathProjection(geometry, path);
    const selectedRefs = new Set([selected]);
    const issueWork = work();
    const result = projection.view(issueWork, prepared, selectedRefs);
    expect(result.status).toBe("view");
    if (result.status !== "view") {
      throw Error("Missing view");
    }
    const secondWork = work();
    expect(projection.view(secondWork, prepared, selectedRefs).status).toBe("view");
    expect(issueWork.propagate.mock.calls.length - secondWork.propagate.mock.calls.length).toBe(
      prepared.placements.length,
    );
    const aliases = prepared.placements.filter((placement) => placement === selected);
    expect(aliases).toHaveLength(2);
    // One shape guard, one reference, two aliases and one ordering comparison.
    expect(secondWork.propagate).toHaveBeenCalledTimes(5);
    expect(issueWork.propagate).toHaveBeenCalledTimes(prepared.placements.length + 5);
    expect(prepared.placements.indexOf(selected)).toBeGreaterThan(0);
    selectedRefs.clear();
    const viewed = projection.at(work(), anchor, prepared, result.view);
    expect(viewed.status).toBe("entries");
    if (viewed.status !== "entries") {
      throw Error("Missing view entries");
    }
    const raw = slotPlacementsAt(geometry, anchor, prepared);
    expect(viewed.entries).toEqual(raw.filter((entry) => entry.placement === selected));
    expect(viewed.entries.length).toBe(aliases.length);
    expect(viewed.entries.length).toBeLessThan(raw.length);
    expect(viewed.entries[0]).toBe(viewed.entries[1]);
    expect(projection.statistics().indexedTemplates).toBe(aliases.length);
    const canonical = createSlotCandidateDomains(geometry, path).at("job", prepared, 3, 1);
    for (const entry of viewed.entries) {
      const candidate = canonical.find((value) => value.entry.placement === entry.placement)!;
      expect(candidate.prepared).toBe(prepared);
      expect(JSON.parse(candidate.id)[3]).toBe(prepared.placements.indexOf(selected));
      expect(candidate.multiplicity).toBe(aliases.length);
      expect(entry.request).toBe(prepared.request);
      expect(entry.trace.requestedDraws).toBe(prepared.draws);
    }
    const fullWork = work(),
      baselineWork = work();
    const full = projection.at(fullWork, anchor, prepared);
    const baseline = createSlotPathProjection(geometry, path).at(baselineWork, anchor, prepared);
    expect(full).toEqual(baseline);
    expect(fullWork.check.mock.calls.length).toBe(baselineWork.check.mock.calls.length);
    expect(fullWork.propagate.mock.calls.length).toBe(baselineWork.propagate.mock.calls.length);
    expect(projection.statistics().indexedTemplates).toBe(
      prepared.placements.length + aliases.length,
    );
  });

  it("guards empty views afresh without indexing aliases or trusting a declared set size", () => {
    const { geometry, path, prepared, selected, source } = fixture();
    const projection = createSlotPathProjection(geometry, path);
    const empty = new Set<typeof selected>();
    const first = work();
    expect(projection.view(first, prepared, empty)).toEqual({ status: "empty-view" });
    expect(first.propagate).toHaveBeenCalledOnce();
    expect(projection.statistics().indexedTemplates).toBe(0);
    const nonempty = work();
    expect(projection.view(nonempty, prepared, new Set([selected])).status).toBe("view");
    expect(nonempty.propagate).toHaveBeenCalledTimes(prepared.placements.length + 5);
    const falseSize = new Set([selected]);
    Object.defineProperty(falseSize, "size", { value: 0 });
    expect(projection.view(work(), prepared, falseSize).status).toBe("view");
    expect(projection.view(work(), { ...prepared }, empty)).toEqual({ status: "unknown" });
    expect(projection.view({ propagate: () => false }, prepared, empty)).toEqual({
      kind: "propagation",
      status: "budget",
    });
    const compile = source.compile;
    try {
      Reflect.set(source, "compile", () => compile(plannerStreams(3)));
      expect(projection.view(work(), prepared, empty)).toEqual({ status: "unknown" });
    } finally {
      Reflect.set(source, "compile", compile);
    }
    expect(projection.view(work(), prepared, empty)).toEqual({ status: "empty-view" });
    const lane = path[0]!.lane;
    try {
      path[0]!.lane = 3;
      expect(projection.view(work(), prepared, empty)).toEqual({ status: "unknown" });
    } finally {
      path[0]!.lane = lane;
    }
    const restored = work();
    expect(projection.view(restored, prepared, empty)).toEqual({ status: "empty-view" });
    expect(restored.propagate).toHaveBeenCalledOnce();
  });

  it("orders interleaved alias selections by their original catalogue ordinals", () => {
    const { anchor, geometry, path, prepared, selected } = fixture();
    const later = prepared.placements.find(
      (placement, ordinal) =>
        placement !== selected &&
        placement.lane === selected.lane &&
        ordinal > prepared.placements.indexOf(selected),
    )!;
    expect(later).toBeDefined();
    const projection = createSlotPathProjection(geometry, path);
    const refs = new Set([later, selected]);
    const firstWork = work();
    const first = projection.view(firstWork, prepared, refs);
    const warmWork = work();
    const warm = projection.view(warmWork, prepared, refs);
    expect(first.status).toBe("view");
    expect(warm.status).toBe("view");
    expect(firstWork.propagate.mock.calls.length - warmWork.propagate.mock.calls.length).toBe(
      prepared.placements.length,
    );
    if (warm.status !== "view") {
      throw Error("Missing interleaved view");
    }
    const result = projection.at(work(), anchor, prepared, warm.view);
    expect(result).toEqual({
      entries: slotPlacementsAt(geometry, anchor, prepared).filter((entry) =>
        refs.has(entry.placement!),
      ),
      status: "entries",
    });
  });

  it("rejects foreign membership and invalidated source or original context without issuing new authority", () => {
    const { anchor, caps, footprint, geometry, path, prepared, selected, source } = fixture();
    const projection = createSlotPathProjection(geometry, path);
    const view = issued(projection, prepared, selected);
    const foreign = prepareSlotKind(plannerStreams(3), geometry, source);
    expect(projection.view(work(), prepared, new Set([foreign.placements[0]!]))).toEqual({
      status: "unknown",
    });
    expect(projection.view(work(), { ...prepared }, new Set([selected]))).toEqual({
      status: "unknown",
    });
    expect(projection.at(work(), anchor, foreign, view)).toEqual({ status: "unavailable" });
    expect(createSlotPathProjection(geometry, path).at(work(), anchor, prepared, view)).toEqual({
      status: "unavailable",
    });
    expect(projection.at(work(), anchor, prepared, { ...view })).toEqual({ status: "unavailable" });
    const originalCompile = source.compile;
    Object.defineProperty(source, "compile", { value: () => originalCompile(plannerStreams(3)) });
    expect(projection.view(work(), prepared, new Set([selected]))).toEqual({ status: "unknown" });
    Object.defineProperty(source, "compile", { value: originalCompile });
    footprint.rows++;
    expect(projection.at(work(), anchor, prepared, view)).toEqual({ status: "unavailable" });
    expect(projection.view(work(), prepared, new Set([selected]))).toEqual({ status: "unknown" });
    footprint.rows--;
    path[0]!.lane = 3;
    expect(projection.at(work(), anchor, prepared, view)).toEqual({ status: "unavailable" });
    expect(projection.view(work(), prepared, new Set([selected]))).toEqual({ status: "unknown" });
    const beforeRegistration = createSlotPathProjection(geometry, path);
    caps.total++;
    expect(beforeRegistration.view(work(), prepared, new Set([selected]))).toEqual({
      status: "unknown",
    });
  });

  it("retains spent work on interruption and resumes only the independent view catalogue", () => {
    const { anchor, geometry, path, prepared, selected } = fixture();
    const projection = createSlotPathProjection(geometry, path);
    expect(projection.view({ propagate: () => false }, prepared, new Set([selected]))).toEqual({
      kind: "propagation",
      status: "budget",
    });
    expect(projection.statistics().indexedTemplates).toBe(0);
    let issuance = 0;
    expect(
      projection.view({ propagate: () => ++issuance <= 2 }, prepared, new Set([selected])),
    ).toEqual({
      kind: "propagation",
      status: "budget",
    });
    expect(issuance).toBe(3);
    const retryWork = work();
    expect(projection.view(retryWork, prepared, new Set([selected])).status).toBe("view");
    const warmIssueWork = work();
    const ready = projection.view(warmIssueWork, prepared, new Set([selected]));
    expect(ready.status).toBe("view");
    expect(retryWork.propagate.mock.calls.length - warmIssueWork.propagate.mock.calls.length).toBe(
      prepared.placements.length,
    );
    if (ready.status !== "view") {
      throw Error("Missing resumed view");
    }
    const view = ready.view;
    expect(projection.at({ check: () => false }, anchor, prepared, view)).toEqual({
      kind: "candidateChecks",
      status: "budget",
    });
    let claims = 0;
    expect(
      projection.at({ check: () => true, propagate: () => ++claims <= 1 }, anchor, prepared, view),
    ).toEqual({ kind: "propagation", status: "budget" });
    expect(claims).toBe(2);
    expect(projection.statistics().indexedTemplates).toBe(1);
    const resumed = projection.at(work(), anchor, prepared, view);
    expect(resumed.status).toBe("entries");
    const count = prepared.placements.filter((placement) => placement === selected).length;
    expect(projection.statistics().indexedTemplates).toBe(count);
    const warmWork = work();
    expect(projection.at(warmWork, anchor, prepared, view)).toEqual(resumed);
    expect(warmWork.check).toHaveBeenCalledTimes(1);
    expect(projection.statistics().indexedTemplates).toBe(count);
    expect(projection.at(work(), anchor, prepared).status).toBe("entries");
    expect(projection.statistics().indexedTemplates).toBe(prepared.placements.length + count);
  });

  it("applies nonblocking fast-path translation only to view members", () => {
    const { anchor, geometry, path, prepared, selected } = fixture(false);
    const projection = createSlotPathProjection(geometry, path);
    const result = projection.at(work(), anchor, prepared, issued(projection, prepared, selected));
    expect(result.status).toBe("entries");
    if (result.status !== "entries") {
      throw Error("Missing nonblocking view entries");
    }
    const full = slotPlacementsAt(geometry, anchor, prepared);
    expect(result.entries).toEqual(full.filter((entry) => entry.placement === selected));
    expect(result.entries.length).toBeLessThan(full.length);
    expect(projection.at(work(), anchor, prepared)).toEqual({ entries: full, status: "entries" });
    expect(projection.statistics().indexedTemplates).toBe(0);
  });
});
