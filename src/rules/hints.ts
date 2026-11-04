import { fillNames } from "@andornaut/game-kit/lines";
import { keysOf } from "@andornaut/game-kit/records";

import type { GameData, HintId, HintTrigger } from "../data/types.ts";
import { read } from "./units.ts";

function matches(trigger: HintTrigger, event: HintTrigger): boolean {
  if (trigger.kind === "encounter") {
    return event.kind === "encounter" && event.encounter === trigger.encounter;
  }
  return event.kind === trigger.kind;
}

// The low-hearts hint jumps ahead of every waiting hint, so it shows before the first firing.
const QUEUE_JUMPING_TRIGGERS: ReadonlySet<HintTrigger["kind"]> = new Set(["firedOwner"]);

export function hintJumpsQueue(data: Pick<GameData, "hints">, id: HintId): boolean {
  return QUEUE_JUMPING_TRIGGERS.has(data.hints[id].trigger.kind);
}

// A hint's text with its {bumpHearts}, the hearts a bump costs, and {treatHearts}, the hearts
// a treat gives, filled from the tuning.
export function hintText(data: Pick<GameData, "hints" | "tuning">, id: HintId): string {
  return fillNames(data.hints[id].text, {
    bumpHearts: String(read(data.tuning, "hearts", "bump")),
    treatHearts: String(read(data.tuning, "hearts", "treat")),
  });
}

// The first-time hint to show for an event: the first in the data whose trigger matches and
// that has not been shown, or null.
export function hintFor(
  data: Pick<GameData, "hints" | "tuning">,
  shownHintIds: readonly HintId[],
  event: HintTrigger,
): { readonly id: HintId; readonly text: string } | null {
  const id = keysOf(data.hints).find(
    (candidate) =>
      !shownHintIds.includes(candidate) && matches(data.hints[candidate].trigger, event),
  );
  return id === undefined ? null : { id, text: hintText(data, id) };
}
