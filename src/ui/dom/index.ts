// The public entry of src/ui/dom/: modules outside it import only this file.
export { bindGameAction, bindRecoveryHold, registerScenePointer } from "./actionBinding.ts";
export {
  type DomArtSource,
  imageArt,
  imageNineSlice,
  sheetArt,
  type SheetArtPlace,
  sheetNineSlice,
} from "./artElements.ts";
export { type BodyScroll, bodyScrollbarPart } from "./bodyScrollbar.ts";
export {
  contentSeparatorPart,
  createContentSeparator,
  placeContentSeparator,
} from "./contentSeparator.ts";
export { createControlGlyph } from "./controlGlyph.ts";
export { cutDomArt } from "./domCuts.ts";
export { type LoadingBar, mountDomLoadingBar } from "./domLoadingBar.ts";
export {
  cutFrameProperties,
  placeFormRows,
  placeSwitchState,
  rowIcon,
  switchFrames,
} from "./formRows.ts";
export { mountFpsCounter } from "./fpsCounter.ts";
export { createGameButton, createGameFormRow } from "./gameButton.ts";
export { mountLaunchFailure } from "./launchFailure.ts";
export { type LoadingErrorView, mountLoadingError } from "./loadingError.ts";
export {
  guardNativeInput,
  mountModalLifecycle,
  type NativeGesture,
  revealPaint,
} from "./modalLifecycle.ts";
export { mountMuteControl } from "./muteControl.ts";
export {
  type CloseLabel,
  type DomQuestionPanel,
  type DomQuestionPanelInput,
} from "./nativeSurface.ts";
export { addTapBurst, artUrls, bindDialogKeys } from "./nativeSurfaceEffects.ts";
export {
  createNativeTopSection,
  type NativeTopSection,
  type NativeTopSectionConfig,
} from "./nativeTopSection.ts";
export { bindPanelFeedback, createPanelButton, type PanelPress } from "./panelButton.ts";
export {
  colourBox,
  type DomBox,
  type DomPart,
  fillPart,
  framedBoxPart,
  framedPart,
  framelessView,
  gridBoxPart,
  gridFillPart,
  panelFramePart,
  ringPart,
} from "./parts.ts";
export {
  backedTextPlaces,
  boundsAdvance,
  capRows,
  createTextLine,
  type DomTextBlock,
  type DomTextLine,
  inkEnd,
  namePillBoxes,
  placeBackedText,
  placeBox,
  placeFrame,
  placeText,
  setBox,
  shownText,
  spokenText,
  textPlace,
} from "./pixelLine.ts";
export { dimDrawn, followModalUnderlay, setRampDimmed } from "./rampDim.ts";
export { REFUSAL_RED, refusalPlaying, refuse } from "./refusal.ts";
export type { RequiredAsset } from "./requiredAssets.ts";
export { mountRoadBanner } from "./roadBanner.ts";
export {
  type DomSheetEntry,
  type DomSheetJson,
  loadedSheet,
  loadSheet,
  playingFrame,
  type SheetFrame,
  sheetFrame,
  sheetTagFrames,
  type TagFrame,
} from "./sheetFrames.ts";
export { type PillColours, textBlock } from "./textBlock.ts";
export { mountUiLayer, setUiLayer, type UiLayer, uiLayer } from "./uiLayer.ts";
