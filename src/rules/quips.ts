import { type Random, randomPick } from "@andornaut/game-kit/runtime/random";

import type { DogId } from "../data/ids.ts";
import type { GameData, QuipMoment } from "../data/index.ts";

// The owner of dog reacts with one of the lines in quips[dog][moment].
export interface QuipCue {
  readonly dog: DogId;
  readonly moment: QuipMoment;
}

// One of the owner's lines for the cue, drawn at random.
export function quipLine(data: Pick<GameData, "quips">, random: Random, cue: QuipCue): string {
  const lines = data.quips[cue.dog][cue.moment];
  return randomPick(random, lines);
}
