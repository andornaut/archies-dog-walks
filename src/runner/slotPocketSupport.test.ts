import { describe, expect, it, vi } from "vitest";

import type { ConstraintOwner, ConstraintResult } from "./slotConstraintState";
import {
  checkSlotPocketSupport,
  type SlotPocketRejection,
  type SlotPocketSupportPorts,
  type SlotPocketTrial,
  type SlotPocketValue,
} from "./slotPocketSupport";

type Failure = Extract<ConstraintResult<string>, { accepted: false }>["failure"];
interface Value {
  readonly walls: number;
}
function fixture(masks: readonly (readonly number[])[]) {
  const scope = {};
  const initialContext = {};
  const initial: { owner: ConstraintOwner; value: Value } = {
    owner: { key: "pinned" },
    value: Object.freeze({ walls: 0 }),
  };
  let context = initialContext;
  let entries = [initial];
  const owners = masks.map((_, index) => ({ key: String(index) }));
  const values = new Map(
    owners.map((owner, index) => [owner, masks[index]!.map((walls) => Object.freeze({ walls }))]),
  );
  const tokens = new Map(owners.map((owner) => [owner, {}]));
  type Mark = { readonly context: object; readonly entries: typeof entries };
  const hard = new WeakMap<
    SlotPocketRejection,
    { readonly context: object; readonly owner: ConstraintOwner; readonly value: Value }
  >();
  const reject = (owner: ConstraintOwner, value: Value, rule = "cells") => {
    const rejection: SlotPocketRejection = {
      failure: { classification: "conflict", owners: [entries.at(-1)!.owner], rule },
      status: "rejected",
      token: {},
    };
    hard.set(rejection, { context, owner, value });
    return rejection;
  };
  const ports: SlotPocketSupportPorts<Value, Mark> = {
    checkpoint: () => ({ context, entries: [...entries] }),
    complete: vi.fn(
      (
        _row: number,
        owner: ConstraintOwner,
        emitted: readonly SlotPocketValue<Value>[],
        token: object,
      ) => {
        const expected = values.get(owner)!;
        return (
          tokens.get(owner) === token &&
          emitted.length === expected.length &&
          emitted.every(
            (item, index) =>
              item.value === expected[index] && item.guaranteedWalls === item.value.walls,
          )
        );
      },
    ),
    context: () => context,
    *domain(_row, owner) {
      for (const value of values.get(owner)!) {
        yield { guaranteedWalls: value.walls, status: "candidate", value };
      }
      yield { status: "complete", token: tokens.get(owner)! };
    },
    explain: () => {
      const filled = entries.reduce((mask, entry) => mask | entry.value.walls, 0);
      return filled === 3
        ? { status: "clear" }
        : { context, requiredWalls: 3 & ~filled, row: 0, scope, status: "obligation" };
    },
    hard: vi.fn((before, owner, value, rejection) => {
      const saved = hard.get(rejection);
      return (
        saved !== undefined &&
        saved.context === before &&
        saved.owner === owner &&
        saved.value === value
      );
    }),
    owners: (remaining) =>
      remaining.length === owners.length &&
      new Set(remaining).size === owners.length &&
      remaining.every((owner) => owners.includes(owner)),
    propagate: () => true,
    restore: (mark) => {
      context = mark.context;
      entries = [...mark.entries];
    },
    stopped: () => false,
    support: () => entries,
    test: vi.fn((owner: ConstraintOwner, value: Value): SlotPocketTrial => {
      entries.push({ owner, value });
      context = {};
      return { status: "accepted" };
    }),
  };
  const restored = () => {
    expect(entries).toEqual([initial]);
    expect(context).toBe(initialContext);
  };
  return { entries: () => entries, owners, ports, reject, restored, scope, values };
}

describe("necessary pocket support", () => {
  it("does not refute a narrowed remaining-owner set", () => {
    const test = fixture([[1], [2]]);
    expect(checkSlotPocketSupport(test.ports, test.scope, test.owners.slice(0, 1))).toEqual({
      status: "unknown",
    });
    expect(test.ports.complete).not.toHaveBeenCalled();
    expect(test.ports.test).not.toHaveBeenCalled();
    test.restored();
  });

  it("does not reuse an obligation from another scope", () => {
    const test = fixture([[1], [2]]);
    const explain = test.ports.explain;
    test.ports.explain = () => ({ ...explain(), scope: {} });
    expect(checkSlotPocketSupport(test.ports, test.scope, test.owners)).toEqual({
      status: "unknown",
    });
    expect(test.ports.complete).not.toHaveBeenCalled();
    expect(test.ports.test).not.toHaveBeenCalled();
    test.restored();
  });

  it.each(["missing", "narrowed"])("does not refute a %s domain frontier", (kind) => {
    const test = fixture([[2, 1]]);
    const fixtureDomain = test.ports.domain;
    test.ports.domain = function* (_row, owner) {
      const steps = [...fixtureDomain(0, owner)];
      yield* kind === "missing" ? steps.slice(0, -1) : steps.slice(1);
    };
    expect(checkSlotPocketSupport(test.ports, test.scope, test.owners)).toEqual({
      status: "unknown",
    });
    expect(test.ports.test).toHaveBeenCalledTimes(1);
    test.restored();
  });

  it.each([0, 1])("stops after normal EOF following %i yielded values", (yielded) => {
    const test = fixture([[1], [2]]);
    let stopped = false;
    test.ports.stopped = () => stopped;
    test.ports.test = vi.fn((owner, value) => test.reject(owner, value));
    test.ports.domain = function* (_row, owner) {
      if (yielded === 1) {
        const value = test.values.get(owner)![0]!;
        yield { guaranteedWalls: value.walls, status: "candidate", value };
      }
      stopped = true;
    };
    expect(checkSlotPocketSupport(test.ports, test.scope, test.owners)).toEqual({
      status: "budget",
    });
    expect(test.ports.complete).not.toHaveBeenCalled();
    expect(test.ports.test).toHaveBeenCalledTimes(yielded);
    test.restored();
  });

  it.each(["candidate", "progress"] as const)(
    "rotates a %s step before draining its owner",
    (kind) => {
      const test = fixture([[2], [3]]);
      const closed = new Set<ConstraintOwner>();
      let tailRead = false;
      test.ports.domain = function* (_row, owner) {
        try {
          const value = test.values.get(owner)![0]!;
          yield kind === "progress" && owner === test.owners[0]
            ? { status: "progress" }
            : { guaranteedWalls: value.walls, status: "candidate", value };
          if (owner === test.owners[0]) {
            tailRead = true;
            throw new Error("The unused frontier must not consume more work");
          }
        } finally {
          closed.add(owner);
        }
      };
      const result = checkSlotPocketSupport(test.ports, test.scope, test.owners);
      expect(result).toEqual({ status: "unknown" });
      expect(result).not.toHaveProperty("proof");
      expect(test.ports.test).toHaveBeenCalledTimes(1);
      expect(test.ports.complete).not.toHaveBeenCalled();
      expect(tailRead).toBe(false);
      expect(closed).toEqual(new Set(test.owners));
      test.restored();
    },
  );

  it("does not admit a zero-wall candidate as supplier proof", () => {
    const test = fixture([[0]]);
    expect(checkSlotPocketSupport(test.ports, test.scope, test.owners)).toEqual({
      status: "unknown",
    });
    expect(test.ports.complete).not.toHaveBeenCalled();
    expect(test.ports.test).not.toHaveBeenCalled();
    test.restored();
  });

  it("does not treat progress followed by EOF as an attested empty frontier", () => {
    const test = fixture([[]]);
    test.ports.domain = function* () {
      yield { status: "progress" };
    };
    expect(checkSlotPocketSupport(test.ports, test.scope, test.owners)).toEqual({
      status: "unknown",
    });
    expect(test.ports.complete).not.toHaveBeenCalled();
    expect(test.ports.test).not.toHaveBeenCalled();
    test.restored();
  });

  it("does not let one owner supply two incompatible values", () => {
    const test = fixture([[1, 2]]);
    const result = checkSlotPocketSupport(test.ports, test.scope, test.owners);
    expect(result.status).toBe("refuted");
    if (result.status !== "refuted") {
      throw new Error("Expected a complete owner-capacity contradiction");
    }
    expect(result.proof.scope).toBe(test.scope);
    expect(result.proof.support).toEqual(test.entries());
    expect(result.proof.remaining[0]).toBe(test.owners[0]);
    expect(test.ports.test).toHaveBeenCalledTimes(1);
    test.restored();
  });

  it.each([false, true])("returns UNKNOWN for a surviving repair: %s", (repair) => {
    const test = fixture([[1], [2]]);
    const commit = test.ports.test;
    test.ports.test = vi.fn((owner, value) =>
      test.entries().length > 1 && !repair ? test.reject(owner, value) : commit(owner, value),
    );
    const result = checkSlotPocketSupport(test.ports, test.scope, test.owners);
    expect(result.status).toBe(repair ? "unknown" : "refuted");
    expect(test.ports.hard).toHaveBeenCalledTimes(repair ? 0 : 1);
    test.restored();
  });

  it.each(["open-stretches", "reservation"])("does not close a branch on %s", (rule) => {
    const test = fixture([[1], [2]]);
    test.ports.test = (owner, value) => test.reject(owner, value, rule);
    expect(checkSlotPocketSupport(test.ports, test.scope, test.owners)).toEqual({
      status: "unknown",
    });
    expect(test.ports.hard).not.toHaveBeenCalled();
    test.restored();
  });

  it.each(["budget", "fatal"] as const)("restores an accepted trial after %s", (status) => {
    const test = fixture([[1], [2]]);
    const explain = test.ports.explain;
    const failure: Failure = { classification: "unattributed", owners: [], rule: "native" };
    test.ports.explain = () =>
      test.entries().length === 1
        ? explain()
        : status === "budget"
          ? { status }
          : { failure, status };
    const result = checkSlotPocketSupport(test.ports, test.scope, test.owners);
    expect(result.status).toBe(status);
    if (result.status === "fatal") {
      expect(result.failure).toBe(failure);
    }
    test.restored();
  });
});
