import type { DogId } from "../data/ids.ts";
import type { CardOption, GameData } from "../data/index.ts";
import { packDogs, type RunState } from "../state/index.ts";
import { type Cents, cents, type Hearts } from "../units.ts";
import type { CauseData, Change, HeartChange, MoneyChange } from "./causes.ts";
import { type EffectContext, resolveEffects } from "./effects.ts";
import type { ModifiedValue } from "./modified.ts";
import type { QuipCue } from "./quips.ts";
import { fireOwnersAtZero } from "./run.ts";
import { spendSpareTreat } from "./spareTreats.ts";

export type ChoiceData = CauseData & Pick<GameData, "dogs" | "homeText" | "tuning" | "world">;

// Everything a scene needs to animate a choice or an instant encounter without recomputing
// rules.
export interface ChoiceOutcome {
  readonly fired: readonly DogId[];
  // One per owner per effect that moved their meter, in order.
  readonly heartChanges: readonly HeartChange[];
  // One per money effect that moved the money, in order.
  readonly moneyChanges: readonly MoneyChange[];
  // The total of moneyChanges.
  readonly moneyDelta: Cents;
  // Every value modifiers changed, in order, such as a loss forgiven or a cost waived.
  readonly modified: readonly ModifiedValue[];
  readonly quips: readonly QuipCue[];
  // The spare treat given back to an owner the effects cost hearts, from a spareTreats modifier
  // such as the Fanny pack's, or null with none spent. It comes after heartChanges and before any
  // firing, and shows as its own moment, so outcomeChanges leaves it out.
  readonly spareTreat: HeartChange | null;
  readonly state: RunState;
}

// Every change an outcome made: its hearts, then its money.
export function outcomeChanges(outcome: ChoiceOutcome): Change[] {
  return [...outcome.heartChanges, ...outcome.moneyChanges];
}

function walkingHearts(state: RunState): Map<DogId, Hearts> {
  return new Map(
    state.pack.flatMap((slot) =>
      slot.status === "walking" ? [[slot.dog, slot.hearts] as const] : [],
    ),
  );
}

// Applies effects, then gives a held spare treat back to an owner they cost hearts, then owners
// at 0 hearts fire you; with no dogs left the run ends.
export function outcomeOf(
  data: ChoiceData,
  context: EffectContext,
  effects: CardOption["effects"],
  state: RunState,
): ChoiceOutcome {
  const applied = resolveEffects(data, context, effects, state);
  const spare = spendSpareTreat(data, applied.changes, applied.state);
  const firing = fireOwnersAtZero(spare.state);
  const next: RunState = {
    ...firing.state,
    phase:
      packDogs(firing.state).length === 0
        ? { kind: "ended", reason: "noDogs" }
        : { kind: "walking" },
  };
  const isHearts = (change: Change): change is HeartChange => change.kind === "hearts";
  const isMoney = (change: Change): change is MoneyChange => change.kind === "money";

  const before = walkingHearts(state);
  const quips = [
    ...[...walkingHearts(spare.state)].flatMap(([dog, after]): QuipCue[] => {
      const previous = before.get(dog);
      return previous === undefined || previous === after || firing.fired.includes(dog)
        ? []
        : [{ dog, moment: after > previous ? "happier" : "upset" }];
    }),
    ...firing.fired.map((dog): QuipCue => ({ dog, moment: "fired" })),
  ];
  return {
    fired: firing.fired,
    heartChanges: applied.changes.filter(isHearts),
    modified: applied.modified,
    moneyChanges: applied.changes.filter(isMoney),
    moneyDelta: cents(next.money - state.money),
    quips,
    spareTreat: spare.change,
    state: next,
  };
}
