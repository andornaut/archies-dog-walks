// The public entry of src/layout/: modules outside it import only this file.
export { animationPhaseAt } from "./animationPhase.ts";
export {
  BUFF_POP,
  CARD_CHARMS_HEIGHT,
  cardCharmPlates,
  cardCharmWidth,
  charmByWalkerRect,
  charmOverRect,
  sparkleAt,
} from "./buffLayout.ts";
export {
  BUMP_FLASH,
  bumpBorder,
  bumpFlash,
  bumpFlashOn,
  bumpOverscan,
  type BumpSource,
  bumpWorldOffset,
  encounterFlashColour,
} from "./bumpFlash.ts";
export { burstWordPlace, COMIC_WORDS, type ComicGlyph, comicWordWidth } from "./comicWords.ts";
export { CROSS_STREET } from "./crossStreet.ts";
export { type DepthArt, type DepthDraw, depthDraw } from "./depthScale.ts";
export { graceAlpha } from "./graceBlink.ts";
export {
  contactDebuffBatch,
  ContactImpactFrame,
  contactImpacts,
  DEBUFF_GROUND,
  type DebuffHitEffect,
  DOG_REACTIONS,
  dogReaction,
  type FlashCue,
  HIT_ART,
  type HitEffect,
  hitEffects,
  type MotionStep,
  obstacleMotion,
  splashEffect,
  whiteFlash,
} from "./hitEffects.ts";
export { laneCentreXs, type LaneDirection, laneDividerXs, laneMask, moveLane } from "./lanes.ts";
export {
  COMPONENT_SILHOUETTES,
  hasObstacleArt,
  moverBodyArt,
  obstacleParts,
  obstacleSilhouette,
} from "./obstacleArt.ts";
export {
  COLLAR_HEIGHTS,
  DOG_SILHOUETTES,
  formationOrder,
  LANE_HALF_WIDTH,
  leashHand,
  PACK_DEPTH,
  PACK_FEET,
  PACK_SLOTS,
  packDogOf,
  packOnRoad,
  packOutline,
  type PackPlacement,
  packPlacements,
  type PackSprites,
  PART_INSET,
  type PartBox,
  type Silhouette,
  tallestPackLength,
  tautLeashLine,
  WALKER_HANDS,
  WALKER_SILHOUETTES,
} from "./packFormation.ts";
export {
  columnSpan,
  distanceAtY,
  lineColumn,
  project,
  type RoadCamera,
  type RoadProjection,
  roadProjection,
  roadXAt,
  rowScale,
  SCALE_STEPS,
  scaleAt,
  scaleAtY,
  screenXAt,
  screenYAt,
} from "./projection.ts";
export { ROAD_CAMERA, SCREEN_LAYOUT } from "./screen.ts";
export { MIN_TAP_SIZE, type ScreenLayout, walkerFootY, WIDE_BUTTON } from "./screenLayout.ts";
