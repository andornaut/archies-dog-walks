import { randomStream } from "@andornaut/game-kit/random";

import type { PlannerStreams } from "./moverPlanning";

export interface SlotSeedContext {
  readonly seed: number;
  readonly zoneIndex: number;
}
export function slotRandom(context: SlotSeedContext, name: string) {
  return randomStream(context.seed, `slots-${context.zoneIndex}-${name}`);
}
export function slotMotionStreams(
  context: SlotSeedContext,
  slot: string,
  kind: string,
): PlannerStreams {
  return {
    movers: slotRandom(context, `${slot}-${kind}-motion`),
    spawns: slotRandom(context, `${slot}-${kind}-steps`),
  };
}
