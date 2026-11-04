import type { ConstraintOwner, ConstraintResult } from "./slotConstraintState";

type Failure = Extract<ConstraintResult<string>, { accepted: false }>["failure"];
export interface ConflictAssignment {
  readonly owner: ConstraintOwner;
  readonly value: object;
}
const completeDomainBrand: unique symbol = Symbol("complete-slot-domain");
export interface CompleteSlotDomain<Preparation extends object> {
  readonly [completeDomainBrand]: true;
  readonly job: string;
  readonly preparations: readonly Preparation[];
}
export type DomainCertificateResult =
  | { readonly status: "blocked"; readonly failure: Failure }
  | { readonly status: "budget" }
  | { readonly status: "miss" };
// Borrowed live view: later projection of this job updates it in place.
export interface ConflictView {
  readonly excluded: ReadonlySet<string>;
  readonly owners: ReadonlySet<ConstraintOwner>;
  readonly rejected: ReadonlyMap<string, Failure>;
  readonly revision: number;
}
interface JobView {
  readonly excluded: Set<string>;
  readonly ownerCounts: Map<ConstraintOwner, number>;
  readonly owners: Set<ConstraintOwner>;
  readonly rejected: Map<string, Failure>;
  revision: number;
}
interface Certificate {
  active: boolean;
  readonly candidate: string;
  readonly failure: Failure;
  readonly job: string;
  readonly key: string;
  readonly support: readonly ConflictAssignment[];
  watch: ConflictAssignment | undefined;
}

// These native failures cannot be repaired by adding unrelated prefix entries.
const MONOTONE_RULES = new Set([
  "body",
  "cells",
  "open-lanes",
  "pack-gap",
  "rider-gap",
  "screen-cap",
  "wide-gap",
]);

export function isMonotoneConflict(failure: Failure): boolean {
  return (
    failure.classification === "conflict" &&
    failure.owners.length > 0 &&
    MONOTONE_RULES.has(failure.rule)
  );
}

export function createSlotConflictCertificates() {
  return createAssignmentCertificates(isMonotoneConflict);
}

interface DomainProofNode {
  readonly edges: Map<ConstraintOwner, Map<object, DomainProofNode>>;
  failure: Failure | undefined;
}

export function createSlotDomainCertificates<Preparation extends object>() {
  const domains = new WeakMap<CompleteSlotDomain<Preparation>, DomainProofNode>();
  const identities = new WeakMap<ConstraintOwner, number>();
  const difficulty = new WeakMap<CompleteSlotDomain<Preparation>, number>();
  const stats = {
    branches: 0,
    clauses: 0,
    contexts: 0,
    domains: 0,
    hits: 0,
    lookups: 0,
    recorded: 0,
  };
  let serial = 0;
  let current: object | undefined;
  let assignments = new Map<ConstraintOwner, object>();
  const node = (): DomainProofNode => ({ edges: new Map(), failure: undefined });
  const owned = (domain: CompleteSlotDomain<Preparation>) => {
    const root = domains.get(domain);
    if (root === undefined) {
      throw new RangeError("Complete domain belongs to another search");
    }
    return root;
  };
  const synchronise = (
    step: () => boolean,
    scope: object,
    prefix: () => readonly ConflictAssignment[],
  ) => {
    if (scope === current) {
      return true;
    }
    if (!step()) {
      return false;
    }
    // One context build is bounded by the planner's slot limit.
    const next = new Map<ConstraintOwner, object>();
    for (const { owner, value } of prefix()) {
      next.set(owner, value);
      if (!identities.has(owner)) {
        identities.set(owner, serial++);
      }
    }
    assignments = next;
    current = scope;
    stats.contexts++;
    return true;
  };
  const find = (step: () => boolean, root: DomainProofNode): DomainCertificateResult => {
    if (root.failure !== undefined) {
      stats.hits++;
      return { failure: root.failure, status: "blocked" };
    }
    for (const [owner, values] of root.edges) {
      if (!step()) {
        return { status: "budget" };
      }
      stats.branches++;
      const value = assignments.get(owner);
      const child = value === undefined ? undefined : values.get(value);
      if (child !== undefined) {
        const result = find(step, child);
        if (result.status !== "miss") {
          return result;
        }
      }
    }
    return { status: "miss" };
  };
  return {
    difficulty(domain: CompleteSlotDomain<Preparation>): number {
      owned(domain);
      return difficulty.get(domain)!;
    },
    domain(job: string, preparations: readonly Preparation[]): CompleteSlotDomain<Preparation> {
      const domain = Object.freeze<CompleteSlotDomain<Preparation>>({
        [completeDomainBrand]: true,
        job,
        preparations: Object.freeze([...preparations]),
      });
      domains.set(domain, node());
      difficulty.set(domain, 0);
      stats.domains++;
      return domain;
    },
    lookup(
      step: () => boolean,
      scope: object,
      prefix: () => readonly ConflictAssignment[],
      domain: CompleteSlotDomain<Preparation>,
    ): DomainCertificateResult {
      const root = owned(domain);
      if (root.failure === undefined && root.edges.size === 0) {
        return { status: "miss" };
      }
      stats.lookups++;
      return synchronise(step, scope, prefix) ? find(step, root) : { status: "budget" };
    },
    // Call only after this whole frozen domain exhausted intrinsic/monotone rejections.
    recordCompleteWipeout(
      step: () => boolean,
      scope: object,
      prefix: () => readonly ConflictAssignment[],
      domain: CompleteSlotDomain<Preparation>,
      owners: readonly ConstraintOwner[],
    ): boolean {
      let root = owned(domain);
      if (!synchronise(step, scope, prefix)) {
        return false;
      }
      const unique = [...new Set(owners)];
      if (unique.some((owner) => !assignments.has(owner))) {
        throw new RangeError("Complete domain proof refers to an absent owner");
      }
      // Precharge support ordering and edge insertion before publishing any proof.
      for (let offset = 0; offset < unique.length * 2 + 1; offset++) {
        if (!step()) {
          return false;
        }
      }
      unique.sort((a, b) => identities.get(a)! - identities.get(b)!);
      const wasEmpty = root.edges.size === 0 && root.failure === undefined;
      for (const owner of unique) {
        let values = root.edges.get(owner);
        if (values === undefined) {
          values = new Map();
          root.edges.set(owner, values);
        }
        const value = assignments.get(owner)!;
        let child = values.get(value);
        if (child === undefined) {
          child = node();
          values.set(value, child);
        }
        root = child;
      }
      if (root.failure === undefined) {
        root.failure = {
          classification: unique.length === 0 ? "intrinsic" : "conflict",
          owners: unique,
          rule: "forward-domain",
        };
        stats.clauses++;
        difficulty.set(domain, difficulty.get(domain)! + 1);
        if (wasEmpty) {
          stats.recorded++;
        }
      }
      return true;
    },
    statistics() {
      return { ...stats };
    },
  };
}

function createAssignmentCertificates(accept: (failure: Failure) => boolean) {
  const assignments = new Map<ConstraintOwner, object>();
  const index = new Map<string, Map<ConstraintOwner, Map<object, Set<Certificate>>>>();
  const dependents = new Map<ConstraintOwner, Set<string>>();
  const dirty = new Set<string>();
  const matched = new Map<string, Map<ConstraintOwner, object>>();
  const active = new Map<string, Map<string, Map<string, Certificate>>>();
  const certificates = new Set<string>();
  const identities = new WeakMap<object, number>();
  const views = new Map<string, JobView>();
  const stats = {
    clauses: 0,
    invalidations: 0,
    lookups: 0,
    projections: 0,
    reads: 0,
    supportChecks: 0,
    transitions: 0,
    updates: 0,
    views: 0,
    watchSkips: 0,
  };
  let context: object | undefined;
  let identity = 0;
  const numberOf = (value: object) => {
    let found = identities.get(value);
    if (found === undefined) {
      found = identity++;
      identities.set(value, found);
    }
    return found;
  };
  const viewOf = (job: string): JobView => {
    let view = views.get(job);
    if (view === undefined) {
      view = {
        excluded: new Set(),
        ownerCounts: new Map(),
        owners: new Set(),
        rejected: new Map(),
        revision: 0,
      };
      views.set(job, view);
      stats.views++;
    }
    return view;
  };
  const replace = (job: string, candidate: string, failure: Failure | undefined) => {
    const view = viewOf(job);
    const previous = view.rejected.get(candidate);
    if (previous === failure) {
      return;
    }
    for (const owner of previous?.owners ?? []) {
      const count = view.ownerCounts.get(owner)! - 1;
      if (count === 0) {
        view.ownerCounts.delete(owner);
        view.owners.delete(owner);
      } else {
        view.ownerCounts.set(owner, count);
      }
    }
    if (failure === undefined) {
      view.excluded.delete(candidate);
      view.rejected.delete(candidate);
    } else {
      view.excluded.add(candidate);
      view.rejected.set(candidate, failure);
      for (const owner of failure.owners) {
        view.ownerCounts.set(owner, (view.ownerCounts.get(owner) ?? 0) + 1);
        view.owners.add(owner);
      }
    }
    view.revision++;
  };
  const link = (certificate: Certificate, support: ConflictAssignment) => {
    const values = index.get(certificate.job)!.get(support.owner)!;
    let matching = values.get(support.value);
    if (matching === undefined) {
      matching = new Set();
      values.set(support.value, matching);
    }
    matching.add(certificate);
  };
  const unlink = (certificate: Certificate, support: ConflictAssignment) => {
    index.get(certificate.job)!.get(support.owner)!.get(support.value)!.delete(certificate);
  };
  const unmatched = (certificate: Certificate) =>
    certificate.support.find(({ owner, value }) => {
      stats.supportChecks++;
      return assignments.get(owner) !== value;
    });
  const activate = (certificate: Certificate) => {
    certificate.active = true;
    certificate.watch = undefined;
    certificate.support.forEach((support) => link(certificate, support));
    let job = active.get(certificate.job);
    if (job === undefined) {
      job = new Map();
      active.set(certificate.job, job);
    }
    let matches = job.get(certificate.candidate);
    if (matches === undefined) {
      matches = new Map();
      job.set(certificate.candidate, matches);
    }
    matches.set(certificate.key, certificate);
    replace(certificate.job, certificate.candidate, matches.values().next().value!.failure);
  };
  const deactivate = (certificate: Certificate) => {
    certificate.support.forEach((support) => unlink(certificate, support));
    certificate.active = false;
    const job = active.get(certificate.job)!;
    const matches = job.get(certificate.candidate)!;
    matches.delete(certificate.key);
    replace(certificate.job, certificate.candidate, matches.values().next().value?.failure);
    if (matches.size === 0) {
      job.delete(certificate.candidate);
    }
    if (job.size === 0) {
      active.delete(certificate.job);
    }
    const watch = unmatched(certificate);
    if (watch === undefined) {
      throw new RangeError("A removed conflict support must be unmatched");
    }
    certificate.watch = watch;
    link(certificate, watch);
  };
  const change = (
    step: () => boolean,
    job: string,
    owner: ConstraintOwner,
    value: object,
    adding: boolean,
  ) => {
    const matching = [...(index.get(job)?.get(owner)?.get(value) ?? [])];
    if (matching.length === 0) {
      return true;
    }
    // Guard event inspection and complete support checks before changing any watch.
    for (const certificate of matching) {
      if (!step()) {
        return false;
      }
      if (certificate.active !== adding) {
        for (let offset = 0; offset < certificate.support.length; offset++) {
          if (!step()) {
            return false;
          }
        }
      }
    }
    for (const certificate of matching) {
      if (certificate.active === adding) {
        stats.watchSkips++;
        continue;
      }
      stats.updates++;
      if (certificate.active) {
        deactivate(certificate);
        continue;
      }
      unlink(certificate, certificate.watch!);
      const watch = unmatched(certificate);
      if (watch === undefined) {
        activate(certificate);
      } else {
        certificate.watch = watch;
        link(certificate, watch);
      }
    }
    return true;
  };
  return {
    learn(scope: object, job: string, candidate: string, failure: Failure) {
      if (scope !== context || dirty.has(job) || !matched.has(job)) {
        throw new RangeError("Conflict context is not synchronised");
      }
      if (!accept(failure)) {
        return;
      }
      const support = [...new Set(failure.owners)].map((owner) => ({
        owner,
        value: assignments.get(owner),
      }));
      if (support.some(({ value }) => value === undefined)) {
        return;
      }
      const key = JSON.stringify([
        candidate,
        support
          .map(({ owner, value }) => [numberOf(owner), numberOf(value!)])
          .sort((a, b) => a[0]! - b[0]!),
      ]);
      if (certificates.has(key)) {
        return;
      }
      certificates.add(key);
      const certificate: Certificate = {
        active: false,
        candidate,
        failure,
        job,
        key,
        support: support.map(({ owner, value }) => ({ owner, value: value! })),
        watch: undefined,
      };
      let owners = index.get(job);
      if (owners === undefined) {
        owners = new Map();
        index.set(job, owners);
      }
      const current = matched.get(job)!;
      for (const { owner } of support) {
        let values = owners.get(owner);
        if (values === undefined) {
          values = new Map();
          owners.set(owner, values);
          let jobs = dependents.get(owner);
          if (jobs === undefined) {
            jobs = new Set();
            dependents.set(owner, jobs);
          }
          jobs.add(job);
          current.set(owner, assignments.get(owner)!);
        }
      }
      activate(certificate);
      stats.clauses++;
    },
    statistics() {
      return { ...stats };
    },
    synchronise(
      step: () => boolean,
      scope: object,
      prefix: readonly ConflictAssignment[],
    ): boolean {
      if (scope === context) {
        return true;
      }
      context = undefined;
      stats.lookups++;
      if (!step()) {
        return false;
      }
      const next = new Map(prefix.map(({ owner, value }) => [owner, value]));
      const affected = new Set<string>();
      for (const owner of new Set([...assignments.keys(), ...next.keys()])) {
        if (assignments.get(owner) !== next.get(owner)) {
          for (const job of dependents.get(owner) ?? []) {
            if (!dirty.has(job)) {
              affected.add(job);
            }
          }
        }
      }
      for (let offset = 0; offset < affected.size; offset++) {
        if (!step()) {
          return false;
        }
      }
      for (const job of affected) {
        dirty.add(job);
        stats.invalidations++;
      }
      assignments.clear();
      for (const [owner, value] of next) {
        assignments.set(owner, value);
      }
      context = scope;
      return true;
    },
    view(step: () => boolean, scope: object, job: string): ConflictView | undefined {
      stats.reads++;
      if (scope !== context) {
        throw new RangeError("Conflict context is not synchronised");
      }
      if (matched.has(job) && !dirty.has(job)) {
        return viewOf(job);
      }
      dirty.add(job);
      stats.projections++;
      if (!step()) {
        return undefined;
      }
      let current = matched.get(job);
      if (current === undefined) {
        current = new Map();
        matched.set(job, current);
      }
      for (const owner of index.get(job)?.keys() ?? []) {
        const before = current.get(owner);
        const after = assignments.get(owner);
        if (before === after) {
          continue;
        }
        if (before !== undefined) {
          if (!step()) {
            return undefined;
          }
          if (!change(step, job, owner, before, false)) {
            return undefined;
          }
          current.delete(owner);
          stats.transitions++;
        }
        if (after !== undefined) {
          if (!step()) {
            return undefined;
          }
          if (!change(step, job, owner, after, true)) {
            return undefined;
          }
          current.set(owner, after);
          stats.transitions++;
        }
      }
      dirty.delete(job);
      return viewOf(job);
    },
  };
}
