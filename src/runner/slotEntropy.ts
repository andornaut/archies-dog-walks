import { randomStream } from "@andornaut/game-kit/runtime/random";

import type { MoverStreams } from "./moverModel.ts";

export interface SlotSeedContext {
  readonly seed: number;
  readonly zoneIndex: number;
}

// The planner's streams are named from the seed by zone and purpose, so a draw added for one
// purpose never shifts another's. The slot search's are slots-<zone>-<purpose>; the zone's
// requests outside it, such as its lucky finds, gear drops and skins, draw from
// zone-<zone>-<purpose>.
export function slotRandom(context: SlotSeedContext, name: string) {
  return randomStream(context.seed, `slots-${context.zoneIndex}-${name}`);
}
export function zoneRandom(context: SlotSeedContext, purpose: string) {
  return randomStream(context.seed, `zone-${context.zoneIndex}-${purpose}`);
}
// The streams of one kind's mover in one slot.
export function slotMotionStreams(
  context: SlotSeedContext,
  slot: string,
  kind: string,
): MoverStreams {
  return {
    draws: slotRandom(context, `${slot}-${kind}-draws`),
    hops: slotRandom(context, `${slot}-${kind}-hops`),
    steps: slotRandom(context, `${slot}-${kind}-steps`),
  };
}
