// The public entry of src/road/: modules outside it import only this file.
export {
  type AmbientDeps,
  type AmbientFrame,
  clearAmbient,
  newPlace,
  placeAmbient,
  startAmbient,
  stepAmbient,
} from "./ambient.ts";
export {
  type Distraction,
  type DistractionDeps,
  newDistractionPlace,
  placeDistraction,
  startDistractions,
  stepDistractions,
} from "./distractions.ts";
export { herringNow } from "./herrings.ts";
export {
  anchorSprite,
  CARRIED_LIGHT_UP,
  carriedLightReach,
  distanceBehind,
  type LightAnchor,
  newAttachedLightPlaces,
  newLightPlaces,
  placeAttachedLights,
  placeVergeLights,
  POOL_LIGHT_UP,
  VERGE_LIGHT_LIMIT,
  type VergeLightFrame,
  type VergeLightStage,
} from "./lightPlaces.ts";
export {
  type BakedLight,
  bakeLight,
  LIGHT_ATTACHMENTS,
  LIGHTS,
  lightTextureKey,
} from "./lights.ts";
export { fadeIn, rowsHidden } from "./roadClip.ts";
export {
  drawRoad,
  type PixelImage,
  type RoadLook,
  roadLook,
  type RoadRaster,
  roadRaster,
  solidStrip,
  STRIP,
} from "./roadRaster.ts";
export {
  idleFrame,
  newRoadsidePlaces,
  placeRoadside,
  placeRoadsideLights,
  ROADSIDE,
  ROADSIDE_LIGHT_LIMIT,
  type RoadsideFrame,
  type RoadsideLights,
  type RoadsidePlace,
  type RoadsideStage,
} from "./roadsideProps.ts";
export { type KeptScenery, struckBy, struckNow } from "./struckScenery.ts";
export { goesToVerge, vergeNow } from "./vergeScenery.ts";
