// The public entry of src/assets/: modules outside it import only this file.
export { type ArtFileMap, artFileUrl } from "./artUrl.ts";
export { animationSpecs, type AsepriteSheet } from "./asepriteAnimations.ts";
export {
  ATLAS_GROUPS,
  type AtlasGroup,
  atlasGroupOf,
  filtersLinear,
  pageGroupOf,
  steppedBases,
} from "./atlasGroups.ts";
export {
  asepriteSheetOf,
  ATLAS_DIR,
  type AtlasFrame,
  type AtlasManifest,
  atlasPageKey,
  type AtlasTexture,
  BASE_FRAME,
  type FrameTrim,
  packAtlasManifest,
  unpackAtlasManifest,
} from "./atlasManifest.ts";
export { cardGreyPath, remapCardGrey, SKIP_CARD_ART } from "./cardArt.ts";
export { DEPTH_STEPS, splitDepthKey } from "./depthSteps.ts";
export {
  DOM_CHOICE_CARD_ART,
  DOM_DISABLED_ART_KEYS,
  DOM_SHEET_DIR,
  DOM_SHEET_KEYS,
  DOM_SHEETS,
  DOM_STYLE_ART,
  domArtFileUrl,
  domArtPath,
  type DomCopySuffix,
  type DomSheet,
  domSheetImagePath,
  domSheetJsonPath,
} from "./domArt.ts";
export { remapToGrey } from "./greyRamp.ts";
export { paletteColour } from "./housePalette.ts";
export {
  debuffIconKey,
  gearSmallIconKey,
  hudGearIconKey,
  hudPerkIconKey,
  hudUpgradeIconKey,
  perkIconKey,
  SQUIRREL_ICON_KEY,
  upgradeIconKey,
} from "./iconKeys.ts";
export { isPlainObject, parseOrThrow, record } from "./jsonSchema.ts";
export {
  type AssetManifest,
  type FontAsset,
  type ImageAsset,
  parseManifest,
  type SoundAsset,
  type SpriteAnchor,
  type SpriteAsset,
} from "./manifest.ts";
export { usesPhaserArt } from "./phaserArt.ts";
export { spriteAnchor } from "./spriteAnchor.ts";
export {
  AMBIENT_VARIANTS,
  backdropKey,
  badgeKey,
  cardFrameTag,
  cardZoneKey,
  depthVariantKey,
  DETAIL_WELL_KEY,
  DIFFICULTY_KEY,
  DOG_FRAME_SIDES,
  dogCardTag,
  dogFaceKey,
  dogPortraitKey,
  dogSpriteKey,
  encounterSpriteKey,
  FLAT_ENCOUNTERS,
  gearDropSpriteKey,
  gearIconKey,
  GROUND_UI_KEYS,
  type HasArt,
  IDLE_TAG,
  kebabCase,
  LOADING_ART,
  minorObstacleSpriteKey,
  MOVER_SPRITE_KEYS,
  moverBodyTag,
  MOVING_TAGS,
  ownerCardFaceKey,
  ownerFaceKey,
  prizeMoverTag,
  PULL_ART,
  ROAD_HIT_SIZE,
  ROAD_SPRITE_SIZE,
  roadStartKey,
  roadTileKey,
  SKUNK_CLOUD_KEY,
  STANDING_TAGS,
  standsOnGround,
  UNMEASURED_PREFIXES,
  walkerPortraitKey,
  WARNING_ARROW_KEY,
  WARNING_DOWN_TAG,
  WARNING_KEY,
  WARNING_TAG,
  WARNING_UP_TAG,
  WARNING_WANDER_KEY,
  ZONE_CELEBRATION_ART,
  ZONE_PIPS_KEY,
  zoneIconKey,
  zonePipTag,
} from "./spriteKeys.ts";
