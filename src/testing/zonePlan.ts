import { vi } from "vitest";

import type { WalkItemKind } from "../runner/walkItems.ts";
import { planZoneWithContext } from "../runner/zonePlan.ts";
import * as slotInput from "../runner/zoneSlotInput.ts";
import { plannerStreams } from "./movers.ts";

type PlanArguments = Parameters<typeof planZoneWithContext>;

export function planZoneForSeed(
  data: PlanArguments[0],
  geometry: PlanArguments[1],
  seed: number,
  walk: PlanArguments[4],
) {
  return planZoneWithContext(
    data,
    geometry,
    { seed, zoneIndex: walk.run.zoneIndex },
    plannerStreams(seed),
    walk,
  );
}

// Capture the actual adapter's frozen requests without constructing a complete zone.
export function captureZoneInput(
  data: PlanArguments[0],
  geometry: PlanArguments[1],
  seed: number,
  walk: PlanArguments[4],
): slotInput.ZoneSlotInput<WalkItemKind> {
  const stop = new Error("Zone input captured");
  let captured: slotInput.ZoneSlotInput<WalkItemKind> | undefined;
  const spy = vi.spyOn(slotInput, "replayZoneSlots").mockImplementationOnce((input) => {
    captured = input as slotInput.ZoneSlotInput<WalkItemKind>;
    throw stop;
  });
  try {
    planZoneForSeed(data, geometry, seed, walk);
    throw new Error("Zone planning did not stop at input capture");
  } catch (error) {
    if (error !== stop) {
      throw error;
    }
  } finally {
    spy.mockRestore();
  }
  if (captured === undefined) {
    throw new Error("Zone input was not captured");
  }
  return captured;
}
