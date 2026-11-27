import { fillNames } from "@andornaut/game-kit/runtime/lines";

import { cardZoneKey } from "../assets/index.ts";
import type { DogId, EncounterId, UpgradeId, ZoneId } from "../data/ids.ts";
import type {
  CardOption,
  CardSource,
  Difficulty,
  Effect,
  GameData,
  UpgradeDuration,
} from "../data/index.ts";
import { type EffectSource, type RunState, walkingAmong } from "../state/index.ts";
import { type Cents, cents } from "../units.ts";
import {
  amountText,
  causeName,
  type Change,
  changeAmount,
  firedByText,
  heartsForgiven,
  isNamedCause,
} from "./causes.ts";
import { type ChoiceData, type ChoiceOutcome, outcomeOf } from "./choiceEffects.ts";
import { debuffLasting, upgradeDuration } from "./durations.ts";
import { baseMoneyCost, moneyAmount, moneyCost, targetDogs } from "./effects.ts";
import { cardEffectText, type CardTextContext, sentenceList, upgradeLine } from "./effectText.ts";
import { type ModifiedValue, modifierCause } from "./modified.ts";
import { type PathSide, pathSide, zoneById } from "./route.ts";

// What a card's view needs: ChoiceData, the upgrades a fork's paths carry, and the fork's
// title.
export type CardData = ChoiceData & Pick<GameData, "runText" | "upgrades">;

// A fork's path: the zone it leads to, the upgrade it carries or null for none, and what a path
// card shows of them.
interface PathView {
  readonly difficulty: Difficulty;
  readonly difficultyName: string;
  readonly side: PathSide;
  readonly upgrade: UpgradeId | null;
  readonly zone: ZoneId;
}

type OptionAvailability =
  { readonly enabled: false; readonly reason: "not enough money" } | { readonly enabled: true };

// One line of an option's enlarged view: one cause of one change the option would make,
// such as the base cost or a modifier. dog is the owner whose meter changes, or null for the
// money. text is the amount, empty on the line saying an owner fires you.
interface BreakdownLine {
  readonly dog: DogId | null;
  readonly name: string;
  readonly text: string;
}

export interface OptionView {
  // Key of the option's illustration in the art manifest's images.
  readonly art: string;
  readonly availability: OptionAvailability;
  // Every change the option would make, cause by cause. An option that targets a random
  // owner is shown for the first owner in the pack.
  readonly breakdown: readonly BreakdownLine[];
  readonly cost: Cents;
  // The dogs whose owners would fire you, as breakdown shows them.
  readonly fires: readonly DogId[];
  // Per-dog changes for a heart-only loss with actual forgiveness.
  readonly forgivenHearts?: readonly { readonly amount: number; readonly dog: DogId }[];
  // The option's position in the source's data; pass it to chooseOption.
  readonly index: number;
  readonly label: string;
  // Every value modifiers change in the option's changes, as the breakdown shows it: its cost
  // waived, a loss forgiven, a debuff shortened.
  readonly modified: readonly ModifiedValue[];
  // Set on a fork's path cards only: how long its upgrade lasts, which its plaque shows for a
  // price.
  readonly duration?: UpgradeDuration;
  // Set on a fork's path cards only.
  readonly path?: PathView;
  readonly text: string;
}

// Whether a card shows a plaque at its foot: an option that costs cash shows its price there,
// and a fork's path card how long its upgrade lasts. A free option, a path card with no upgrade
// and the Skip card have none.
export function hasPlaque(option: OptionView | undefined): option is OptionView {
  return (
    option !== undefined &&
    (option.path === undefined ? option.cost > 0 : option.path.upgrade !== null)
  );
}

// The most options a card shows.
export const MAX_CARD_OPTIONS = 3;

// What a card scene draws. skip is true when Hall pass offers a free Skip option; on a card
// that would then show more than MAX_CARD_OPTIONS, Skip takes the place of the option that
// costs the most hearts (see withoutCostliest).
export interface CardView {
  readonly affected: readonly DogId[];
  // The Skip option a modifier, such as Hall pass, offers: Skip options from 0 to 1.
  readonly modified: readonly ModifiedValue[];
  readonly options: readonly OptionView[];
  readonly skip: boolean;
  readonly source: CardSource;
  readonly title: string;
}

interface SourcedOption {
  readonly option: CardOption;
  readonly source: EffectSource;
}

// The options of an encounter that opens a card. Throws for an instant encounter.
function encounterOptions(
  data: Pick<GameData, "encounters">,
  id: EncounterId,
): readonly CardOption[] {
  const { name, resolution } = data.encounters[id];
  if (resolution.kind !== "card") {
    throw new Error(`${name} opens no card: it applies on contact`);
  }
  return resolution.options;
}

type EncounterCardSource = Extract<CardSource, { readonly kind: "encounter" }>;
export type ForkSource = Extract<CardSource, { readonly kind: "fork" }>;

// An encounter card's options.
export function cardContent(
  data: ChoiceData,
  source: EncounterCardSource,
): readonly SourcedOption[] {
  return encounterOptions(data, source.encounter).map((option, index) => ({
    option,
    source: { encounter: source.encounter, kind: "encounter", option: index },
  }));
}

function causeLines(data: ChoiceData, changes: readonly Change[]): BreakdownLine[] {
  return changes.flatMap((change) =>
    change.causes.flatMap((cause) =>
      // A meter held at 0 is said by the firing line instead. No card's change starts with a
      // cause left unnamed (isNamedCause).
      !isNamedCause(cause) ||
      (change.kind === "hearts" && cause.kind === "limit" && cause.bound === "min")
        ? []
        : [
            {
              dog: change.dog,
              name: causeName(data, change, cause),
              text: amountText(change.kind, cause.amount),
            },
          ],
    ),
  );
}

// The changes an option would make, cause by cause: the hearts, a spare treat given back, a line
// for each owner who would fire you, then the money.
function breakdownOf(
  data: ChoiceData,
  outcome: Pick<ChoiceOutcome, "fired" | "heartChanges" | "moneyChanges" | "spareTreat">,
): BreakdownLine[] {
  return [
    ...causeLines(data, outcome.heartChanges),
    ...causeLines(data, outcome.spareTreat === null ? [] : [outcome.spareTreat]),
    ...outcome.fired.map((dog) => ({ dog, name: firedByText(data, dog), text: "" })),
    ...causeLines(data, outcome.moneyChanges),
  ];
}

// "Fires Jason": the owners an option would fire, by their dogs.
export function firesText(
  data: Pick<GameData, "dogs" | "homeText" | "runText">,
  dogs: readonly DogId[],
): string {
  const owners = sentenceList(
    data.homeText.sentenceList,
    dogs.map((dog) => data.dogs[dog].owner.name),
  );
  return fillNames(data.runText.card.fires, { owners });
}

// A fork's card: one free path card per path, left to right, each naming its zone, with the
// zone's difficulty, and the upgrade the path carries: its effect, how long it lasts, and the
// changes it would make now; or the card's noUpgrade line for a path with none.
export function forkCard(data: CardData, state: RunState, source: ForkSource): CardView {
  const options = source.paths.map((id, index): OptionView => {
    const zone = zoneById(data, id);
    const upgrade = source.upgrades[index];
    if (upgrade === undefined) {
      throw new Error("A fork says on every path whether it carries an upgrade");
    }
    const path = {
      difficulty: zone.difficulty,
      difficultyName: zone.difficultyName,
      side: pathSide(index, source.paths.length),
      upgrade,
      zone: id,
    };
    const shared = {
      art: cardZoneKey(zone),
      availability: { enabled: true },
      cost: cents(0),
      index,
      label: zone.name,
      path,
    } as const;
    if (upgrade === null) {
      return {
        ...shared,
        breakdown: [],
        fires: [],
        modified: [],
        text: data.runText.card.noUpgrade,
      };
    }
    const card = data.upgrades[upgrade];
    const { effects } = card;
    const preview = outcomeOf(
      data,
      { affected: [], source: { kind: "upgrade", upgrade } },
      effects,
      state,
    );
    return {
      ...shared,
      breakdown: breakdownOf(data, preview),
      duration: upgradeDuration(card),
      fires: preview.fired,
      modified: preview.modified,
      text: `${card.name}: ${upgradeLine(data.tuning, "effect", card)}`,
    };
  });
  return {
    affected: [],
    modified: [],
    options,
    skip: false,
    source,
    title: data.runText.card.forkTitle,
  };
}

// The card for a source, with each option's text, cost, breakdown and whether the player can
// pick it. An option the player cannot afford is disabled; every card keeps a free option.
// Throws for an instant encounter, which opens no card.
export function cardFor(data: CardData, state: RunState, source: CardSource): CardView {
  return source.kind === "fork" ? forkCard(data, state, source) : effectCard(data, state, source);
}

export function effectCard(
  data: ChoiceData,
  state: RunState,
  source: EncounterCardSource,
): CardView {
  const options = cardContent(data, source);
  const title = data.encounters[source.encounter].name;
  const affected = walkingAmong(state, source.affected);
  const skipBy =
    data.encounters[source.encounter].kind === "obstacle" && !state.skipUsed
      ? state.skipPass
      : null;
  const skip = skipBy !== null;
  const views = options.map(({ option, source: effectSource }, index): OptionView => {
    const preview = outcomeOf(data, { affected, source: effectSource }, option.effects, state);
    const textContext: CardTextContext = {
      dogs: (target) => targetDogs(data, { affected }, state, target),
      forgiven: (dog) =>
        preview.heartChanges.some((change) => change.dog === dog && heartsForgiven(change) > 0),
      money: (effect) => moneyAmount(data, state, effect),
      seconds: (debuff) =>
        debuffLasting(data.tuning, data.debuffs[debuff].seconds, state).secondsLeft,
    };
    const cost = moneyCost(data, state, option.effects);
    const effect = option.effects[0];
    const heartOnly = option.effects.length === 1 && effect?.kind === "hearts" && effect.amount < 0;
    const forgiven = heartOnly && preview.heartChanges.some((change) => heartsForgiven(change) > 0);
    return {
      art: option.art,
      availability:
        cost <= state.money ? { enabled: true } : { enabled: false, reason: "not enough money" },
      breakdown: breakdownOf(data, preview),
      cost,
      fires: preview.fired,
      ...(forgiven && {
        forgivenHearts: preview.heartChanges.map((change) => ({
          amount: changeAmount(change),
          dog: change.dog,
        })),
      }),
      index,
      label: option.name,
      modified: preview.modified,
      text: cardEffectText(data, textContext, option.effects),
    };
  });
  return {
    affected,
    modified:
      skipBy === null
        ? []
        : [{ after: 1, before: 0, by: [modifierCause(1, skipBy)], subject: { kind: "skip" } }],
    options:
      skip && views.length >= MAX_CARD_OPTIONS
        ? withoutCostliest((view) => {
            const effects = options[view.index]?.option.effects ?? [];
            return [baseHeartsCost(effects), baseMoneyCost(data, effects)];
          }, views)
        : views,
    skip,
    source,
    title,
  };
}

// The hearts an option's effects would take from each owner they reach, before Second chance
// forgives any.
function baseHeartsCost(effects: readonly Effect[]): number {
  return effects.reduce(
    (total, effect) =>
      effect.kind === "hearts" && effect.amount < 0 ? total - effect.amount : total,
    0,
  );
}

// Drops the option Skip takes the place of: the one that costs the most hearts, the most
// expensive of those before a free card waives it if they tie, and the first one if they tie on
// both, keeping the others in order. costs gives an option's hearts, then its money.
function withoutCostliest(
  costs: (option: OptionView) => readonly [number, number],
  options: readonly OptionView[],
): OptionView[] {
  const costlier = (option: OptionView, than: OptionView): boolean => {
    const [hearts, money] = costs(option);
    const [thanHearts, thanMoney] = costs(than);
    return hearts > thanHearts || (hearts === thanHearts && money > thanMoney);
  };
  const costliest = options.reduce((most, option) => (costlier(option, most) ? option : most));
  return options.filter((option) => option !== costliest);
}
