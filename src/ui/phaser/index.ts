// The public entry of src/ui/phaser/: modules outside it import only this file.
export { addDisplayText, displayBitmapFont, hasDisplayFont } from "./displayText.ts";
export {
  addFilledRect,
  CREAM_PANEL_COLOURS,
  drawFramedRect,
  drawPixelLine,
  drawRing,
  drawShadow,
  fillRect,
  shadowFrame,
  uploadShadowFrames,
} from "./draw.ts";
export {
  addPillGlyphs,
  addPixelText,
  fitPixelText,
  type FontRole,
  inkSpan,
  labelInkWidth,
  pixelBitmapFont,
  pixelFontMetrics,
  type PixelTextStyle,
  placePixelText,
  registerFallbackPixelFont,
  setPixelText,
  withProbe,
  wrapPixelText,
} from "./pixelText.ts";
export { fitWorldCamera, setWorldViewport } from "./worldCamera.ts";
