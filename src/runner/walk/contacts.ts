import { itemAt } from "@andornaut/game-kit/runtime/arrays";

import type { DogId } from "../../data/ids.ts";
import type { GameData } from "../../data/index.ts";
import { type Box, hitDog, type LanedBox, type PackBoxes, sweptHitDog } from "../collision.ts";
import { moverPlace, moverY } from "../movers.ts";
import { obstacleHitBoxes } from "../obstacleGeometry.ts";
import { signatureSweeps } from "../signaturePaths.ts";
import type { RoadGeometry } from "../walkGeometry.ts";
import type { WalkItem } from "../walkItems.ts";

function blendPack(
  alpha: number,
  before: PackBoxes<DogId>,
  after: PackBoxes<DogId>,
): PackBoxes<DogId> {
  const blend = <Part extends Box>(a: Part, b: Part): Part => ({
    ...b,
    bottom: a.bottom + (b.bottom - a.bottom) * alpha,
    left: a.left + (b.left - a.left) * alpha,
    right: a.right + (b.right - a.right) * alpha,
    top: a.top + (b.top - a.top) * alpha,
  });
  return {
    ...after,
    dogs: before.dogs.map((part, index) => blend(part, after.dogs[index] ?? part)),
    outline: blend(before.outline, after.outline),
    walker: blend(before.walker, after.walker),
  };
}

export function signatureContact(
  data: Pick<GameData, "encounters" | "minorObstacles">,
  geometry: RoadGeometry,
  before: PackBoxes<DogId>,
  after: PackBoxes<DogId>,
  travel: number,
  item: WalkItem,
): DogId | null {
  const { mover } = item;
  if (mover?.path.motion !== "signature") {
    return null;
  }
  const { path, since } = mover;
  const first = Math.max(0, since - travel);
  if (first === since) {
    return (
      obstacleHitBoxes(data, geometry, item)
        .map((box) => hitDog(after, box))
        .find((dog) => dog !== null) ?? null
    );
  }
  const at = (position: number, component: number): LanedBox => {
    const place = moverPlace(geometry.laneCount, path, position);
    const shown = {
      ...item,
      mover: { path, since: position },
      y: moverY(geometry.roadTop, item.height, place),
    };
    return itemAt(obstacleHitBoxes(data, geometry, shown), component);
  };
  const packAt = (position: number) =>
    blendPack((position - since + travel) / travel, before, after);
  const sweeps = signatureSweeps(path.route, first, since).sort((a, b) => a.start - b.start);
  for (const sweep of sweeps) {
    const dog = sweptHitDog(
      packAt(sweep.start),
      packAt(sweep.end),
      at(sweep.start, sweep.component),
      at(sweep.end, sweep.component),
    );
    if (dog !== null) {
      return dog;
    }
  }
  return null;
}
