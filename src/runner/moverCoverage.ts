import { nextChoiceAt } from "./approach.ts";
import { drawnLanes, moverPlace } from "./movers.ts";
import { nextShyChoiceAt } from "./shy.ts";
import { signaturePlace } from "./signaturePaths.ts";
import { slotFootprint } from "./slotConfig.ts";
import type { SlotPlacement } from "./slotFeasibility.ts";
import type { SpawnPlan } from "./spawning.ts";

// Credit body geometry at row arrival, independently of pack contact and swept reservations.
export function visibleMoverRows<Kind extends string>(
  geometry: Pick<SpawnPlan<string>, "cellLength" | "laneCount" | "laneInset" | "roadLength">,
  rows: readonly number[],
  entry: SlotPlacement<Kind>,
): number[] {
  const path = entry.event.mover;
  if (path === undefined || entry.herring || !entry.request.blocksLane) {
    return [];
  }
  const footprint = slotFootprint(entry.request);
  const height = entry.request.mover?.hitLength ?? footprint.rows * geometry.cellLength;
  const span = drawnLanes(footprint.lanes, path);
  const inset = geometry.laneInset / geometry.cellLength;
  const visible = (x: number, y: number) =>
    y > 0 &&
    y - height < geometry.roadLength &&
    x + span - inset > 0 &&
    x + inset < geometry.laneCount;
  // Future reactive choices are unknown. Credit their resolved prefix only.
  const unresolved =
    path.motion === "approach"
      ? nextChoiceAt(path)
      : path.motion === "shy"
        ? nextShyChoiceAt(path)
        : null;
  return rows.flatMap((distance, row) => {
    const since = distance - entry.event.distance;
    if (
      since < 0 ||
      distance >= entry.trace.nativeUntil ||
      (unresolved !== null && since >= unresolved)
    ) {
      return [];
    }
    if (path.motion === "signature") {
      return path.route.componentDelays.some((_, component) => {
        const point = signaturePlace(path.route, since, component);
        return visible(point.x, point.y);
      })
        ? [row]
        : [];
    }
    const point = moverPlace(geometry.laneCount, path, since);
    return point.solid && visible(point.lanePosition, point.travel) ? [row] : [];
  });
}
