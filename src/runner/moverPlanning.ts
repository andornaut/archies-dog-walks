import { crossPlacements } from "./crossPlacements.ts";
import { EVEN_DRAWS } from "./moverDraws.ts";
import type {
  MoverDraws,
  MoverGeometry,
  MoverPlacement,
  MoverPlacementWork,
  MoverSpec,
  PlacementContext,
} from "./moverModel.ts";
import { ridePlacements } from "./ridePlacements.ts";
import { signaturePlacements } from "./signaturePlacements.ts";
import { approachPlacements, stepsPlacements } from "./standingPlacements.ts";

// One mover's placements, at its draws. A dart's start is lifted that share of the way from its
// drawn share up to the highest that shows its cue; other movers have no lift.
export function moverPlacements(
  geometry: MoverGeometry,
  spec: MoverSpec,
  draws: MoverDraws = EVEN_DRAWS,
  lift = 0,
): MoverPlacement[] {
  return moverPlacementsWithWork(undefined, geometry, spec, draws, lift);
}

export function moverPlacementsWithWork(
  work: MoverPlacementWork | undefined,
  geometry: MoverGeometry,
  spec: MoverSpec,
  draws: MoverDraws = EVEN_DRAWS,
  lift = 0,
): MoverPlacement[] {
  const context: PlacementContext = { draws, geometry, spec, work };
  const { motion } = spec;
  switch (motion.kind) {
    case "signature":
      return signaturePlacements(context, motion.profile);
    case "approach":
      return approachPlacements(context, motion);
    case "cross":
      return crossPlacements(context, motion, lift);
    case "ride":
      return ridePlacements(context, motion);
    default:
      return stepsPlacements(context, motion);
  }
}
