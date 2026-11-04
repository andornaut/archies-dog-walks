import { COMPONENT_SILHOUETTES } from "../layout/obstacleArt.ts";
import { PART_INSET } from "../layout/packFormation.ts";
import type { LanedBox } from "./collision.ts";
import { facesLeft } from "./movers.ts";
import { drawnObstacleBox, type RoadLens } from "./obstacleBox.ts";
import { signatureComponentProgress, signaturePlace } from "./signaturePaths.ts";
import type { WalkItem } from "./walkItems.ts";

export function componentHitBoxes(
  geometry: { readonly cell: { readonly length: number }; readonly lens: RoadLens },
  item: WalkItem,
): LanedBox[] | undefined {
  const { mover } = item;
  if (mover?.path.motion !== "signature" || mover.path.route.profile.kind !== "delayedTrail") {
    return undefined;
  }
  const { route } = mover.path;
  const profile = route.profile;
  if (profile.kind !== "delayedTrail") {
    return undefined;
  }
  const silhouette = COMPONENT_SILHOUETTES[profile.spriteKey];
  if (silhouette === undefined) {
    throw new Error(`Missing component silhouette ${profile.spriteKey}`);
  }
  const leader = signaturePlace(route, mover.since);
  return route.componentDelays.map((_, component) => {
    const point = signaturePlace(route, mover.since, component);
    const feetY = item.y + item.height + point.y - leader.y;
    const x = (point.x + 0.5) * geometry.cell.length;
    const lanes = {
      left: point.x * geometry.cell.length,
      right: (point.x + 1) * geometry.cell.length,
    };
    const delayed = route.entryEnd + signatureComponentProgress(route, mover.since, component);
    const drawn = facesLeft(mover.path, delayed)
      ? { ...silhouette, left: -silhouette.right, right: -silhouette.left }
      : silhouette;
    return {
      ...drawnObstacleBox(geometry.lens, PART_INSET, [{ behind: 0, dx: 0, silhouette: drawn }], {
        feetY,
        x,
      }),
      lanes,
    };
  });
}
