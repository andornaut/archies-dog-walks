import { COMPONENT_SILHOUETTES } from "../layout/obstacleArt";
import { PART_INSET } from "../layout/packFormation";
import type { LanedBox } from "./collision";
import { facesLeft } from "./movers";
import { drawnObstacleBox, type RoadLens } from "./obstacleBox";
import { signatureComponentProgress, signaturePlace } from "./signaturePaths";
import type { WalkItem } from "./walkItems";

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
