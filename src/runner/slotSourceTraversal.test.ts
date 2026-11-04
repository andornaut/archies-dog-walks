import { describe, expect, it, vi } from "vitest";

import {
  createSlotCandidateDomains,
  type SlotCandidate,
  type SlotSequenceStep,
} from "./slotCandidateDomains";
import { prepareSlotKind } from "./slotCandidates";
import { traverseSlotSources } from "./slotSourceTraversal";
import { rowSpacing, type SpawnPlan, zoneRows } from "./spawning";

const geometry: Omit<SpawnPlan<string>, "quotas"> = {
  cellInset: 0,
  cellLength: 10,
  fixedKinds: [],
  laneCount: 5,
  laneInset: 0,
  laneMoveSeconds: 0.1,
  maxEmptyRows: Infinity,
  minOpenLanes: 2,
  minSpacing: 20,
  moverCaps: { darts: 6, slowVehicles: 4, total: 10 },
  packHitLength: 10,
  packLength: 10,
  pathLaneMoveSeconds: 0.3,
  pathStart: 2,
  reactionSeconds: 0.5,
  riderFollowGap: 10,
  roadLength: 100,
  scrollSpeed: 100,
  sightLength: 90,
  stepSeconds: 1 / 60,
  zoneLength: 1000,
};
function fixture() {
  const draws = { movers: vi.fn(() => 0), spawns: vi.fn(() => 0) };
  const sources = ["first", "second", "third"].map((kind) =>
    prepareSlotKind(draws, geometry, {
      compile: () => ({ blocksLane: false, footprint: { lanes: 1, rows: 1 } }),
      footprint: { lanes: 1, rows: 1 },
      kind,
      role: "minorFixed",
      weight: 1,
    }),
  );
  const path = zoneRows(geometry, rowSpacing({ ...geometry, quotas: [] })).map((distance) => ({
    distance,
    lane: 2,
  }));
  const domains = createSlotCandidateDomains(geometry, path);
  const values = sources.map((source, index) =>
    [0, 1, 2].map((row) => domains.at("job", source, row + index, 0)[0]!),
  );
  return { draws, sources, values };
}
function collect<Kind extends string>(cursor: ReturnType<typeof traverseSlotSources<Kind>>) {
  const values: SlotCandidate<Kind>[] = [];
  for (;;) {
    const next = cursor.next();
    if (next.done) {
      return { result: next.value, values };
    }
    values.push(next.value.candidate);
  }
}

describe("fair weighted-source traversal prototype", () => {
  it("opens sources progressively in the supplied permutation and retains each exact ordered multiset", () => {
    const test = fixture();
    const opened: string[] = [],
      closed: string[] = [];
    let providers = 0;
    function* sources() {
      for (const source of test.sources) {
        providers++;
        yield source;
      }
    }
    // This source-local continuation already places its unsafe FIFO after primary values.
    const fifo = [
      test.values[0]![0]!,
      test.values[0]![1]!,
      test.values[0]![0]!,
      test.values[0]![2]!,
    ];
    const ordered = [fifo, test.values[1]!, test.values[2]!];
    const work = {
      *candidates(source: (typeof test.sources)[number]): Generator<SlotSequenceStep<string>> {
        opened.push(source.source.kind);
        try {
          for (const candidate of ordered[test.sources.indexOf(source)]!) {
            yield { candidate, status: "candidate" };
          }
        } finally {
          closed.push(source.source.kind);
        }
      },
      propagate: vi.fn(() => true),
      stopped: () => false,
    };
    const before = [test.draws.movers.mock.calls.length, test.draws.spawns.mock.calls.length];
    const cursor = traverseSlotSources(work, sources());
    const first = cursor.next();
    if (first.done) {
      throw Error("Expected first source candidate");
    }
    expect(first.value.candidate).toBe(fifo[0]);
    expect(first.value.source).toBe(test.sources[0]);
    expect(providers).toBe(1);
    expect(opened).toEqual(["first"]);
    const rest = collect(cursor);
    const emitted = [fifo[0]!, ...rest.values];
    expect(rest.result).toEqual({ status: "complete" });
    expect(emitted.slice(0, 6)).toEqual([
      fifo[0],
      fifo[1],
      ordered[1]![0],
      fifo[2],
      ordered[1]![1],
      ordered[2]![0],
    ]);
    for (const [index, source] of test.sources.entries()) {
      const actual = emitted.filter((candidate) => candidate.prepared === source);
      expect(actual).toHaveLength(ordered[index]!.length);
      actual.forEach((candidate, offset) => expect(candidate).toBe(ordered[index]![offset]));
    }
    expect(closed.sort()).toEqual(["first", "second", "third"]);
    expect([test.draws.movers.mock.calls.length, test.draws.spawns.mock.calls.length]).toEqual(
      before,
    );
  });

  it.each(["cancel", "stop", "budget"] as const)(
    "closes all opened continuations on %s without promoting partial work to EOF",
    (reason) => {
      const test = fixture();
      let stopped = false,
        charged = true,
        outerClosed = false;
      const closed: string[] = [];
      function* sources() {
        try {
          yield* test.sources;
        } finally {
          outerClosed = true;
        }
      }
      const cursor = traverseSlotSources(
        {
          *candidates(source) {
            try {
              for (const candidate of test.values[test.sources.indexOf(source)]!) {
                yield { candidate, status: "candidate" as const };
              }
            } finally {
              closed.push(source.source.kind);
            }
          },
          propagate: () => charged,
          stopped: () => stopped,
        },
        sources(),
      );
      for (let count = 0; count < 3; count++) {
        expect(cursor.next().done).toBe(false);
      }
      if (reason === "cancel") {
        cursor.return({ status: "stopped" });
      } else {
        stopped = reason === "stop";
        charged = reason !== "budget";
        expect(cursor.next()).toEqual({
          done: true,
          value:
            reason === "stop" ? { status: "stopped" } : { kind: "propagation", status: "budget" },
        });
      }
      expect(outerClosed).toBe(true);
      expect(closed.sort()).toEqual(["first", "second"]);
    },
  );

  it("retains a native budget result and closes every continuation even when cleanup throws", () => {
    const test = fixture();
    const closed: string[] = [];
    const budget = { kind: "anchors" as const, status: "budget" as const };
    const result = collect(
      traverseSlotSources(
        {
          *candidates(source) {
            try {
              if (source === test.sources[1]) {
                yield budget;
              } else {
                yield* test.values[test.sources.indexOf(source)]!.map((candidate) => ({
                  candidate,
                  status: "candidate" as const,
                }));
              }
            } finally {
              closed.push(source.source.kind);
            }
          },
          propagate: () => true,
          stopped: () => false,
        },
        test.sources,
      ),
    );
    expect(result.result).toBe(budget);
    expect(closed.sort()).toEqual(["first", "second"]);
    closed.length = 0;
    const cursor = traverseSlotSources(
      {
        *candidates(source) {
          try {
            yield* test.values[test.sources.indexOf(source)]!.map((candidate) => ({
              candidate,
              status: "candidate" as const,
            }));
          } finally {
            closed.push(source.source.kind);
            // eslint-disable-next-line no-unsafe-finally -- Exercise iterator cleanup failure during cancellation.
            throw Error(source.source.kind);
          }
        },
        propagate: () => true,
        stopped: () => false,
      },
      test.sources,
    );
    for (let count = 0; count < 3; count++) {
      cursor.next();
    }
    expect(() => cursor.return({ status: "stopped" })).toThrow("first");
    expect(closed.sort()).toEqual(["first", "second"]);
  });
});
