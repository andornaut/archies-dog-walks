import type { ConflictAssignment } from "./slotConflictCertificates";
import type { ConstraintOwner, ConstraintResult } from "./slotConstraintState";

type Failure = Extract<ConstraintResult<string>, { accepted: false }>["failure"];
type Stop = { readonly status: "budget" } | { readonly failure: Failure; readonly status: "fatal" };
export interface SlotPocketObligation {
  readonly context: object;
  readonly requiredWalls: number;
  readonly row: number;
  readonly scope: object;
  readonly status: "obligation";
}
export interface SlotPocketValue<Value extends object> {
  readonly guaranteedWalls: number;
  readonly value: Value;
}
export type SlotPocketDomainStep<Value extends object> =
  | (SlotPocketValue<Value> & { readonly status: "candidate" })
  | { readonly status: "complete"; readonly token: object }
  | { readonly status: "progress" }
  | Stop;
export interface SlotPocketRejection {
  readonly failure: Failure;
  readonly status: "rejected";
  readonly token?: object;
}
export type SlotPocketTrial = { readonly status: "accepted" } | SlotPocketRejection | Stop;
export interface SlotPocketSupportPorts<Value extends object, Mark> {
  checkpoint(): Mark;
  // Native validation binds the complete row-supplier frontier, including proved zero-wall omissions.
  complete(
    row: number,
    owner: ConstraintOwner,
    values: readonly SlotPocketValue<Value>[],
    token: object,
  ): boolean | undefined;
  context(): object;
  domain(row: number, owner: ConstraintOwner): Iterable<SlotPocketDomainStep<Value>>;
  explain(): SlotPocketObligation | { readonly status: "clear" | "unknown" } | Stop;
  hard(
    context: object,
    owner: ConstraintOwner,
    value: Value,
    rejection: SlotPocketRejection,
  ): boolean | undefined;
  owners(remaining: readonly ConstraintOwner[]): boolean | undefined;
  propagate(): boolean;
  restore(mark: Mark): void;
  stopped(): boolean;
  support(): readonly ConflictAssignment[];
  test(owner: ConstraintOwner, value: Value): SlotPocketTrial;
}
interface Domain<Value extends object> {
  readonly owner: ConstraintOwner;
  readonly row: number;
  readonly token: object;
  readonly values: readonly SlotPocketValue<Value>[];
}
const proofBrand: unique symbol = Symbol("SlotPocketProof");
// A native adapter must attest the current premises before this conditional proof drives learning.
export interface SlotPocketProof<Value extends object> {
  readonly [proofBrand]: true;
  readonly context: object;
  readonly domains: readonly Domain<Value>[];
  readonly rejections: readonly {
    readonly context: object;
    readonly owner: ConstraintOwner;
    readonly rejection: SlotPocketRejection;
    readonly value: Value;
  }[];
  readonly remaining: readonly ConstraintOwner[];
  readonly scope: object;
  readonly support: readonly ConflictAssignment[];
}
export type SlotPocketSupportResult<Value extends object> =
  | { readonly proof: SlotPocketProof<Value>; readonly status: "refuted" }
  | { readonly status: "unknown" }
  | Stop;
const validMask = (mask: number) => Number.isSafeInteger(mask) && mask >= 0 && mask >>> 0 === mask;

// Ports own native predicates and their charges. Local repair never certifies a full witness.
export function checkSlotPocketSupport<Value extends object, Mark>(
  ports: SlotPocketSupportPorts<Value, Mark>,
  scope: object,
  remaining: readonly ConstraintOwner[],
): SlotPocketSupportResult<Value> {
  if (ports.stopped()) {
    return { status: "budget" };
  }
  const root = ports.checkpoint();
  const domains = new Map<ConstraintOwner, Map<number, Domain<Value>>>();
  const rejections: SlotPocketProof<Value>["rejections"][number][] = [];
  const used = new Set<ConstraintOwner>();
  const tick = () => !ports.stopped() && ports.propagate() && !ports.stopped();
  function* domain(
    row: number,
    owner: ConstraintOwner,
  ): Generator<SlotPocketValue<Value> | Stop | { status: "progress" } | { status: "unknown" }> {
    const cached = domains.get(owner)?.get(row);
    if (cached !== undefined) {
      yield* cached.values;
      return;
    }
    if (!tick()) {
      yield { status: "budget" };
      return;
    }
    const values: SlotPocketValue<Value>[] = [];
    const source = ports.domain(row, owner);
    if (ports.stopped()) {
      yield { status: "budget" };
      return;
    }
    const cursor = source[Symbol.iterator]();
    let token: object | undefined;
    try {
      for (;;) {
        if (!tick()) {
          yield { status: "budget" };
          return;
        }
        const next = cursor.next();
        if (!next.done && next.value.status === "fatal") {
          yield next.value;
          return;
        }
        if (ports.stopped()) {
          yield { status: "budget" };
          return;
        }
        if (next.done) {
          break;
        }
        const step = next.value;
        if (step.status === "budget") {
          yield step;
          return;
        }
        if (token !== undefined) {
          yield { status: "unknown" };
          return;
        }
        if (step.status === "complete") {
          token = step.token;
        } else if (step.status === "progress") {
          yield step;
        } else if (
          step.status === "candidate" &&
          validMask(step.guaranteedWalls) &&
          step.guaranteedWalls !== 0
        ) {
          const value = Object.freeze({ guaranteedWalls: step.guaranteedWalls, value: step.value });
          values.push(value);
          yield value;
        } else {
          yield { status: "unknown" };
          return;
        }
      }
      if (token === undefined) {
        yield { status: "unknown" };
        return;
      }
      if (!tick()) {
        yield { status: "budget" };
        return;
      }
      const complete = ports.complete(row, owner, values, token);
      if (ports.stopped() || complete === undefined) {
        yield { status: "budget" };
        return;
      }
      if (!complete) {
        yield { status: "unknown" };
        return;
      }
      const result = Object.freeze({ owner, row, token, values: Object.freeze(values) });
      let rows = domains.get(owner);
      if (rows === undefined) {
        rows = new Map();
        domains.set(owner, rows);
      }
      rows.set(row, result);
    } finally {
      cursor.return?.();
    }
  }
  function* choices(
    row: number,
  ): Generator<
    (SlotPocketValue<Value> & { readonly owner: ConstraintOwner }) | Stop | { status: "unknown" }
  > {
    // Native progress rotates owners without adding a value or completing a frontier.
    const cursors: { owner: ConstraintOwner; cursor: ReturnType<typeof domain> }[] = [];
    try {
      for (const owner of remaining) {
        if (!tick()) {
          yield { status: "budget" };
          return;
        }
        if (!used.has(owner)) {
          cursors.push({ cursor: domain(row, owner), owner });
        }
      }
      while (cursors.length > 0) {
        for (let index = 0; index < cursors.length;) {
          if (!tick()) {
            yield { status: "budget" };
            return;
          }
          const current = cursors[index]!;
          const next = current.cursor.next();
          if (!next.done && "status" in next.value && next.value.status === "fatal") {
            yield next.value;
            return;
          }
          if (ports.stopped()) {
            yield { status: "budget" };
            return;
          }
          if (next.done) {
            cursors.splice(index, 1);
            continue;
          }
          const step = next.value;
          if ("status" in step) {
            if (step.status === "progress") {
              index++;
              continue;
            }
            yield step;
            return;
          }
          index++;
          yield { ...step, owner: current.owner };
        }
      }
    } finally {
      for (const { cursor } of cursors) {
        cursor.return(undefined);
      }
    }
  }
  const visit = (): { status: "refuted" } | { status: "unknown" } | Stop => {
    if (!tick()) {
      return { status: "budget" };
    }
    const context = ports.context();
    if (ports.stopped()) {
      return { status: "budget" };
    }
    const explanation = ports.explain();
    if (explanation.status === "fatal") {
      return explanation;
    }
    if (ports.stopped()) {
      return { status: "budget" };
    }
    if (explanation.status === "budget") {
      return explanation;
    }
    if (
      explanation.status !== "obligation" ||
      explanation.scope !== scope ||
      explanation.context !== context ||
      !validMask(explanation.requiredWalls) ||
      explanation.requiredWalls === 0
    ) {
      return { status: "unknown" };
    }
    const bit = explanation.requiredWalls & -explanation.requiredWalls;
    for (const choice of choices(explanation.row)) {
      if ("status" in choice) {
        return choice;
      }
      const { guaranteedWalls, owner, value } = choice;
      if ((guaranteedWalls & bit) === 0) {
        continue;
      }
      const before = ports.checkpoint();
      try {
        if (ports.stopped()) {
          return { status: "budget" };
        }
        const result = ports.test(owner, value);
        if (result.status === "fatal") {
          return result;
        }
        if (result.status === "rejected" && result.failure.classification === "unattributed") {
          return { failure: result.failure, status: "fatal" };
        }
        if (ports.stopped()) {
          return { status: "budget" };
        }
        if (result.status === "budget") {
          return result;
        }
        if (result.status === "rejected") {
          if (
            result.token === undefined ||
            result.failure.rule === "open-stretches" ||
            result.failure.rule === "reservation"
          ) {
            return { status: "unknown" };
          }
          if (!tick()) {
            return { status: "budget" };
          }
          const stable = ports.hard(context, owner, value, result);
          if (ports.stopped() || stable === undefined) {
            return { status: "budget" };
          }
          if (!stable) {
            return { status: "unknown" };
          }
          rejections.push(Object.freeze({ context, owner, rejection: result, value }));
        } else {
          used.add(owner);
          const following = visit();
          used.delete(owner);
          if (following.status !== "refuted") {
            return following;
          }
        }
      } finally {
        ports.restore(before);
      }
    }
    return { status: "refuted" };
  };
  try {
    if (!tick()) {
      return { status: "budget" };
    }
    const completeOwners = ports.owners(remaining);
    if (ports.stopped() || completeOwners === undefined) {
      return { status: "budget" };
    }
    if (!completeOwners) {
      return { status: "unknown" };
    }
    const context = ports.context();
    if (ports.stopped()) {
      return { status: "budget" };
    }
    const support: ConflictAssignment[] = [];
    const present = new Set<ConstraintOwner>();
    const entries = ports.support();
    if (ports.stopped()) {
      return { status: "budget" };
    }
    for (const { owner, value } of entries) {
      if (!tick()) {
        return { status: "budget" };
      }
      present.add(owner);
      support.push(Object.freeze({ owner, value }));
    }
    const distinct = new Set<ConstraintOwner>();
    for (const owner of remaining) {
      if (!tick()) {
        return { status: "budget" };
      }
      if (distinct.has(owner) || present.has(owner)) {
        return { status: "unknown" };
      }
      distinct.add(owner);
    }
    const result = visit();
    if (result.status !== "refuted") {
      return result;
    }
    if (ports.stopped()) {
      return { status: "budget" };
    }
    return {
      proof: Object.freeze<SlotPocketProof<Value>>({
        context,
        domains: Object.freeze([...domains.values()].flatMap((rows) => [...rows.values()])),
        [proofBrand]: true,
        rejections: Object.freeze(rejections),
        remaining: Object.freeze([...remaining]),
        scope,
        support: Object.freeze(support),
      }),
      status: "refuted",
    };
  } finally {
    ports.restore(root);
  }
}
