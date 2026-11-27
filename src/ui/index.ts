// The public entry of src/ui/: modules outside it import only this file.
export { arrowheadPixels } from "./arrowhead.ts";
export { barTitleRoom } from "./barTitle.ts";
export { raisedLabelCapTop } from "./buttonGeometry.ts";
export { cardHeader, cardRowRects, type CardRowSpec } from "./cardRow.ts";
export { centredInkOffsets } from "./centredInkBlock.ts";
export { type CloseControl, closeControl, closeFace } from "./closeControl.ts";
export { MODAL_BRIGHTNESS, MODAL_DARKNESS } from "./dimArt.ts";
export { disabledArtKey, greyForDisabledTile, greysOnTile } from "./disabledArt.ts";
export {
  artPixel,
  type DeviceRect,
  deviceX,
  deviceY,
  type DomScale,
  domScale,
  exactDeviceX,
  exactDeviceY,
  fontPixel,
  frameRect,
  gridRect,
  gridTransform,
  gridX,
  gridY,
  scrollbarBoxes,
  sliceLengths,
  wholeArtPixels,
} from "./domScale.ts";
export { gridRects, type GridSpec, rectIndexAt } from "./grid.ts";
export { iconBesideLabel } from "./iconLabel.ts";
export {
  type ArtLook,
  type Badge,
  type ItemLook,
  type ItemTile,
  itemTile,
  itemTileLook,
  PLAIN_ITEM,
  type TileState,
  tileState,
} from "./interaction.ts";
export { helpCapDy } from "./labelHelpGap.ts";
export { type LineInk, lineInk } from "./lineInk.ts";
export { DISMISS_FOOTER_SPACE, dismissFooter } from "./modal/dismissFooter.ts";
export { modalActionWidth, modalFamilyWidth, modalRect, modalTitleLayout } from "./modal/layout.ts";
export { modalTitleInk } from "./modal/titleRole.ts";
export { cardTitleRow } from "./modal/titleRow.ts";
export type {
  CardAction,
  PanelButton,
  PanelMeasure,
  PanelNotePart,
  PanelText,
  QuestionPanelView,
} from "./modal/types.ts";
export { modalCardView, panelButton, panelTitle, titleLabelInk } from "./modal/view.ts";
export { MODAL } from "./modalGeometry.ts";
export {
  centredPillBacking,
  hasPill,
  inkWithPills,
  inPill,
  type LaidChar,
  laidPills,
  PILL_CLOSE,
  PILL_SPACE,
  pillDropUnderInk,
  pillGlyphAdvances,
  pillIndex,
  pillRiseOverCaps,
  pillRows,
} from "./namePills.ts";
export {
  type MenuContext,
  type MenuItem,
  menuItemLabel,
  menuItems,
  navigationMenuWidth,
  PAUSE_MENU_ITEMS,
  PAUSE_MENU_KEY_ORDER,
  type PauseMenuItem,
  pauseMenuItemLabel,
} from "./navigationMenu.ts";
export {
  PAGE_FRAME,
  PAGE_LAYOUT,
  PAGE_TITLE_ROW,
  pageBack,
  ROWS_PAGE_LAYOUT,
  stackRows,
} from "./pageLayout.ts";
export { colourFromHex, cssHex, NEUTRAL_RAMP, PALETTE } from "./palette.ts";
export { CARD_PANEL, PAPER_PANEL } from "./paperPanel.ts";
export {
  GLYPH_HEIGHT,
  glyphAdvance,
  LINE_HEIGHT,
  normalizePixelText,
  PIXEL_GLYPHS,
  pixelFontAtlas,
  plainMarks,
} from "./pixelFont.ts";
export { pixelEllipseSpans, pixelLinePoints, shadowRadiusX } from "./pixelShapes.ts";
export { GAME_PROGRESS, GAME_PROGRESS_STYLE, LOADING_TIMING } from "./progressBar.ts";
export { refusalRed, REFUSE, REFUSE_SHAKES, refuseOffset, refuseShakeSteps } from "./refuse.ts";
export { scrollbarRects, type ScrollbarSpec } from "./scrollbar.ts";
export { scrollPlace } from "./scrollPlace.ts";
export {
  BUTTON_COLOURS,
  GREYED,
  pictureBox,
  PLATE_LOOKS,
  type PlateKind,
  selectLook,
} from "./selection.ts";
export { SEPARATOR_BAND, separatorBetween } from "./separator.ts";
export { startupLoad, startupProgress } from "./startupProgress.ts";
export {
  BODY_ASCENT_ROWS,
  BODY_INK_ROWS,
  TEXT_SCALE,
  TEXT_STYLE,
  textOnLines,
  TITLE_CAP_ROWS,
} from "./textFit.ts";
export {
  TOP_BAR_FACE,
  TOP_BAR_MID,
  TOP_BAR_TRIM,
  TOP_BAR_WELL,
  topBarRects,
} from "./topBarTrim.ts";
export {
  pressedEffectWells,
  TOP_SECTION_CURRENCY_TEXT,
  topBarGlyphRect,
  type TopSectionButton,
  topSectionButtonAt,
  type TopSectionControl,
  topSectionCurrency,
  topSectionCurrencyText,
  topSectionLayout,
} from "./topSection.ts";
export {
  deviceFitOwned,
  logicalBackingBounds,
  logicalWorldPoint,
  ownDeviceFit,
  shownWorldRect,
  worldFit,
  worldViewBox,
  worldViewport,
} from "./worldFit.ts";
