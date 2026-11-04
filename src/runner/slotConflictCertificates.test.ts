import { describe, expect, it } from "vitest";

import {
  type ConflictAssignment,
  createSlotConflictCertificates,
  createSlotDomainCertificates,
} from "./slotConflictCertificates";

function select(
  store: ReturnType<typeof createSlotConflictCertificates>,
  prefix: readonly ConflictAssignment[],
) {
  const scope = {};
  expect(store.synchronise(() => true, scope, prefix)).toBe(true);
  return { scope, view: store.view(() => true, scope, "job")! };
}

describe("native conflict certificates", () => {
  it("requires exact owner assignments, restores matches and ignores unrelated prefix changes", () => {
    const store = createSlotConflictCertificates();
    const owner = { key: "wall" };
    const value = {};
    const other = { key: "other" };
    const prefix = [{ owner, value }];
    const failure = { classification: "conflict" as const, owners: [owner], rule: "cells" };
    const initial = select(store, prefix);
    expect(initial.view.rejected.size).toBe(0);
    store.learn(initial.scope, "job", "candidate", failure);
    expect(
      select(store, [...prefix, { owner: other, value: {} }]).view.rejected.get("candidate"),
    ).toBe(failure);
    expect(select(store, [{ owner, value: {} }]).view.rejected.size).toBe(0);
    expect(select(store, [{ owner: { ...owner }, value }]).view.rejected.size).toBe(0);
    const restored = select(store, prefix);
    expect(restored.view.rejected.get("candidate")).toBe(failure);
    store.learn(restored.scope, "job", "candidate", failure);
    expect(store.statistics().clauses).toBe(1);
    const before = store.statistics();
    expect(store.synchronise(() => false, restored.scope, prefix)).toBe(true);
    expect(store.statistics()).toEqual(before);
    const another = select(store, [...prefix, { owner: other, value: {} }]);
    store.view(() => true, another.scope, "another-job");
    store.learn(another.scope, "another-job", "other-candidate", {
      classification: "conflict",
      owners: [other],
      rule: "cells",
    });
    const updates = store.statistics().updates;
    const changed = select(store, [
      { owner, value: {} },
      { owner: other, value: {} },
    ]);
    expect(store.statistics().updates).toBe(updates + 1);
    expect(store.view(() => true, changed.scope, "another-job")?.rejected.size).toBe(0);
    expect(store.statistics().updates).toBe(updates + 2);
  });

  it("requires every implicated assignment and leaves interrupted synchronisation resumable", () => {
    const store = createSlotConflictCertificates();
    const a = { key: "a" };
    const b = { key: "b" };
    const prefix = [
      { owner: a, value: {} },
      { owner: b, value: {} },
    ];
    const failure = { classification: "conflict" as const, owners: [a, b], rule: "open-lanes" };
    const fallback = { classification: "conflict" as const, owners: [b], rule: "cells" };
    const initial = select(store, prefix);
    store.learn(initial.scope, "job", "candidate", failure);
    store.learn(initial.scope, "job", "candidate", fallback);
    expect(initial.view.rejected.get("candidate")).toBe(failure);
    const interrupted = {};
    expect(store.synchronise(() => true, interrupted, [])).toBe(true);
    expect(
      store.view(() => store.statistics().transitions === 0, interrupted, "job"),
    ).toBeUndefined();
    expect(store.statistics().transitions).toBe(1);
    expect(store.view(() => false, interrupted, "job")).toBeUndefined();
    const partial = select(store, prefix.slice(1));
    expect(partial.view.rejected.get("candidate")).toBe(fallback);
    expect(partial.view.owners).toEqual(new Set([b]));
    expect(select(store, prefix.slice(0, 1)).view.rejected.size).toBe(0);
    const restored = select(store, prefix);
    expect(restored.view.rejected.get("candidate")).toBe(failure);
    expect(store.view(() => true, restored.scope, "another-job")?.rejected.size).toBe(0);
    select(store, prefix.slice(1));
    const updates = store.statistics().updates;
    expect(select(store, [{ owner: b, value: {} }]).view.rejected.size).toBe(0);
    expect(store.statistics().updates).toBe(updates + 1);
  });

  it("never generalises prefix-sensitive or unknown failures", () => {
    const store = createSlotConflictCertificates();
    const owner = { key: "owner" };
    const initial = select(store, [{ owner, value: {} }]);
    for (const rule of ["future-witness-construction", "open-stretches", "reservation"]) {
      store.learn(initial.scope, "job", rule, {
        classification: "conflict",
        owners: [owner],
        rule,
      });
    }
    store.learn(initial.scope, "job", "unknown", {
      classification: "unattributed",
      owners: [],
      rule: "cells",
    });
    store.learn(initial.scope, "job", "missing", {
      classification: "conflict",
      owners: [{ key: "missing" }],
      rule: "cells",
    });
    expect(initial.view.rejected.size).toBe(0);
    expect(store.statistics().clauses).toBe(0);
  });
});

describe("complete guaranteed-domain certificates", () => {
  it("binds a whole frozen domain and exact owner assignments without cross-profile reuse", () => {
    const store = createSlotDomainCertificates();
    const profile = {};
    const preparations = [profile];
    const domain = store.domain("job", preparations);
    preparations.push({});
    expect(domain.preparations).toHaveLength(1);
    expect(domain.preparations[0]).toBe(profile);
    const owner = { key: "actual" };
    const value = {};
    const prefix = [{ owner, value }];
    const scope = {};
    expect(
      store.lookup(
        () => true,
        scope,
        () => prefix,
        domain,
      ),
    ).toEqual({ status: "miss" });
    expect(
      store.recordCompleteWipeout(
        () => true,
        scope,
        () => prefix,
        domain,
        [owner],
      ),
    ).toBe(true);
    expect(
      store.lookup(
        () => true,
        {},
        () => [...prefix, { owner: { key: "other" }, value: {} }],
        domain,
      ),
    ).toMatchObject({
      failure: { owners: [owner], rule: "forward-domain" },
      status: "blocked",
    });
    expect(
      store.lookup(
        () => true,
        {},
        () => [{ owner, value: {} }],
        domain,
      ),
    ).toEqual({ status: "miss" });
    expect(
      store.lookup(
        () => true,
        {},
        () => prefix,
        store.domain("job", [{}]),
      ),
    ).toEqual({ status: "miss" });
    expect(
      store.lookup(
        () => true,
        scope,
        () => prefix,
        domain,
      ).status,
    ).toBe("blocked");
    const foreign = createSlotDomainCertificates().domain("job", [profile]);
    expect(() =>
      store.lookup(
        () => true,
        {},
        () => prefix,
        foreign,
      ),
    ).toThrow(RangeError);
  });

  it("finds an exact matching conjunction without activating unrelated proofs", () => {
    const store = createSlotDomainCertificates();
    const domain = store.domain("job", [{}]);
    const a = { key: "a" };
    const b = { key: "b" };
    const c = { key: "c" };
    const first = [
      { owner: a, value: {} },
      { owner: b, value: {} },
    ];
    const second = [
      { owner: a, value: {} },
      { owner: c, value: {} },
    ];
    for (const prefix of [first, second]) {
      expect(
        store.recordCompleteWipeout(
          () => true,
          {},
          () => prefix,
          domain,
          prefix.map(({ owner }) => owner),
        ),
      ).toBe(true);
    }
    expect(
      store.lookup(
        () => true,
        {},
        () => [first[0]!, second[1]!],
        domain,
      ),
    ).toEqual({ status: "miss" });
    expect(
      store.lookup(
        () => true,
        {},
        () => [...second].reverse(),
        domain,
      ),
    ).toMatchObject({ failure: { owners: [a, c] }, status: "blocked" });
    expect(
      store.lookup(
        () => true,
        {},
        () => first,
        domain,
      ),
    ).toMatchObject({ failure: { owners: [a, b] }, status: "blocked" });
    expect(store.statistics()).toMatchObject({ clauses: 2, domains: 1, recorded: 1 });
    expect(store.difficulty(domain)).toBe(2);
    expect(
      store.recordCompleteWipeout(
        () => true,
        {},
        () => first,
        domain,
        [a, b],
      ),
    ).toBe(true);
    expect(store.difficulty(domain)).toBe(2);
  });

  it("never turns interrupted bookkeeping or absent support into a complete-domain proof", () => {
    const store = createSlotDomainCertificates();
    const domain = store.domain("job", [{}]);
    const owner = { key: "owner" };
    const prefix = [{ owner, value: {} }];
    let charges = 0;
    expect(
      store.recordCompleteWipeout(
        () => ++charges <= 2,
        {},
        () => prefix,
        domain,
        [owner],
      ),
    ).toBe(false);
    expect(charges).toBe(3);
    expect(
      store.lookup(
        () => true,
        {},
        () => prefix,
        domain,
      ),
    ).toEqual({ status: "miss" });
    expect(() =>
      store.recordCompleteWipeout(
        () => true,
        {},
        () => prefix,
        domain,
        [{ key: "absent" }],
      ),
    ).toThrow(RangeError);
    expect(
      store.lookup(
        () => true,
        {},
        () => prefix,
        domain,
      ),
    ).toEqual({ status: "miss" });
    expect(
      store.recordCompleteWipeout(
        () => true,
        {},
        () => prefix,
        domain,
        [owner],
      ),
    ).toBe(true);
    expect(
      store.lookup(
        () => false,
        {},
        () => prefix,
        domain,
      ),
    ).toEqual({ status: "budget" });
    expect(
      store.lookup(
        () => true,
        {},
        () => prefix,
        domain,
      ).status,
    ).toBe("blocked");
  });
});
