import { type Random, randomInt } from "@andornaut/game-kit/runtime/random";

import type { DogId, EncounterId, MinorObstacleId, UpgradeId } from "../data/ids.ts";
import type { CardSource, GameData } from "../data/index.ts";
import { type RunState, walkingAmong } from "../state/index.ts";
import { cents } from "../units.ts";
import { countOptionPick } from "./achievements.ts";
import {
  cardContent,
  type CardData,
  type CardView,
  effectCard,
  type ForkSource,
} from "./cardViews.ts";
import { type ChoiceData, type ChoiceOutcome, outcomeOf } from "./choiceEffects.ts";
import { forkPaths } from "./route.ts";

export {
  type CardData,
  cardFor,
  type CardView,
  firesText,
  forkCard,
  hasPlaque,
  MAX_CARD_OPTIONS,
  type OptionView,
} from "./cardViews.ts";
export { type ChoiceData, type ChoiceOutcome, outcomeChanges } from "./choiceEffects.ts";
export { type QuipCue, quipLine } from "./quips.ts";

// An option's index in the source's data (OptionView.index), or the Skip option.
export type Choice = number | "skip";

// An outcome that changes nothing.
function unchanged(state: RunState): ChoiceOutcome {
  return {
    fired: [],
    heartChanges: [],
    modified: [],
    moneyChanges: [],
    moneyDelta: cents(0),
    quips: [],
    spareTreat: null,
    state,
  };
}

// Opens a card: the walk waits in the card phase.
export function openCard(source: CardSource, state: RunState): RunState {
  return { ...state, phase: { kind: "card", source } };
}

// What count paths carry, in order: one path of a fork with more than one, drawn at random,
// carries none, so a fork with one path always offers an upgrade; the others carry upgrades
// drawn at random from those not yet picked this run, none twice, with at most one trade-off:
// a second trade-off drawn is set aside and another card drawn instead. The pool keeps
// upgradeDrawOrder's order, which the draws pick from by position.
export function offerUpgrades(
  data: Pick<GameData, "upgradeDrawOrder" | "upgrades">,
  random: Random,
  count: number,
  state: Pick<RunState, "upgradesPicked">,
): (UpgradeId | null)[] {
  const bare = count > 1 ? randomInt(random, 0, count) : -1;
  const wanted = bare < 0 ? count : count - 1;
  const pool = data.upgradeDrawOrder.filter((id) => !state.upgradesPicked.includes(id));
  const isTradeOff = (id: UpgradeId) => data.upgrades[id].kind === "tradeOff";
  const offered: UpgradeId[] = [];
  while (offered.length < wanted && pool.length > 0) {
    const [picked] = pool.splice(randomInt(random, 0, pool.length), 1);
    if (picked !== undefined && !(isTradeOff(picked) && offered.some(isTradeOff))) {
      offered.push(picked);
    }
  }
  if (offered.length < wanted) {
    throw new Error(`Fewer than ${wanted} upgrades are left in the pool`);
  }
  return bare < 0 ? offered : [...offered.slice(0, bare), null, ...offered.slice(bare)];
}

// The fork after the run's current zone: its paths are up to three zones not yet walked,
// drawn at random from forks, easiest on the left, each carrying an upgrade or none, drawn from
// upgrades (offerUpgrades).
export function offerFork(
  data: Pick<GameData, "upgradeDrawOrder" | "upgrades" | "world">,
  random: { readonly forks: Random; readonly upgrades: Random },
  state: RunState,
): ForkSource {
  const paths = forkPaths(data, random.forks, state.route);
  return {
    kind: "fork",
    paths,
    upgrades: offerUpgrades(data, random.upgrades, paths.length, state),
  };
}

// Taking a fork's path takes its upgrade, if it carries one, then adds its zone to the route, as
// the next zone walked.
function takePath(
  data: CardData,
  state: RunState,
  source: ForkSource,
  choice: Choice,
): ChoiceOutcome {
  const zone = choice === "skip" ? undefined : source.paths[choice];
  const upgrade = choice === "skip" ? undefined : source.upgrades[choice];
  if (zone === undefined || upgrade === undefined) {
    throw new RangeError(`Path ${choice} is not on the fork`);
  }
  if (upgrade === null) {
    return unchanged({ ...state, phase: { kind: "walking" }, route: [...state.route, zone] });
  }
  const outcome = outcomeOf(
    data,
    { affected: [], source: { kind: "upgrade", upgrade } },
    data.upgrades[upgrade].effects,
    state,
  );
  const { route, upgradesPicked } = outcome.state;
  return {
    ...outcome,
    state: {
      ...outcome.state,
      route: [...route, zone],
      upgradesPicked: [...upgradesPicked, upgrade],
    },
  };
}

// Applies the chosen option. Owners at 0 hearts fire you; with no dogs left the run ends. The
// pick counts one toward the option's picks; a Skip counts toward none. A fork's path takes its
// upgrade and sets the next zone. Throws for a disabled option or an ended run.
export function chooseOption(
  data: CardData,
  state: RunState,
  card: CardView,
  choice: Choice,
): ChoiceOutcome {
  if (state.phase.kind === "ended") {
    throw new Error("The run has ended");
  }
  if (card.source.kind === "fork") {
    return takePath(data, state, card.source, choice);
  }
  const view = effectCard(data, state, card.source);
  if (choice === "skip") {
    if (!view.skip) {
      throw new Error("This card has no Skip option");
    }
    const skipped: RunState = {
      ...state,
      cardsThisZone: state.cardsThisZone + 1,
      phase: { kind: "walking" },
      skipUsed: true,
    };
    return {
      fired: [],
      heartChanges: [],
      modified: [],
      moneyChanges: [],
      moneyDelta: cents(0),
      quips: [],
      spareTreat: null,
      state: skipped,
    };
  }
  const option = view.options.find(({ index }) => index === choice);
  const content = cardContent(data, card.source)[choice];
  if (option === undefined || content === undefined) {
    throw new RangeError(`Option ${choice} is not on the ${view.title} card`);
  }
  if (!option.availability.enabled) {
    throw new Error(`${option.label} is disabled: ${option.availability.reason}`);
  }
  const outcome = outcomeOf(
    data,
    { affected: view.affected, source: content.source },
    content.option.effects,
    state,
  );
  const counted = { ...outcome.state, cardsThisZone: state.cardsThisZone + 1 };
  return { ...outcome, state: countOptionPick(card.source.encounter, content.option.id, counted) };
}

// Applies the effects of a lucky find or a contact obstacle as it is touched, to the dogs it
// caught, with the same outcome events as a card choice. Throws for an encounter with no
// effects on contact or an ended run.
export function applyInstantEncounter(
  data: ChoiceData,
  state: RunState,
  encounter: EncounterId,
  caught: readonly DogId[],
): ChoiceOutcome {
  const { name, resolution } = data.encounters[encounter];
  if (resolution.kind !== "instant" && resolution.kind !== "contact") {
    throw new Error(`${name} has no effects on contact`);
  }
  if (state.phase.kind === "ended") {
    throw new Error("The run has ended");
  }
  const affected = walkingAmong(state, caught);
  const source = { encounter, kind: "instant" } as const;
  return outcomeOf(data, { affected, source }, resolution.effects, state);
}

// Applies a minor obstacle's contact effects to the dogs it caught, as applyInstantEncounter
// applies a contact obstacle's.
export function applyMinorContact(
  data: ChoiceData,
  state: RunState,
  obstacle: MinorObstacleId,
  caught: readonly DogId[],
): ChoiceOutcome {
  const { contact } = data.minorObstacles[obstacle];
  if (contact === undefined) {
    throw new Error(`${obstacle} has no effects on contact`);
  }
  if (state.phase.kind === "ended") {
    throw new Error("The run has ended");
  }
  const affected = walkingAmong(state, caught);
  const source = { kind: "minor", obstacle } as const;
  return outcomeOf(data, { affected, source }, contact.effects, state);
}
