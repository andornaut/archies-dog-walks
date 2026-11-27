// The home layout API combines the screen projection with the layout of its text and cards.
export {
  CARD_TEXT_ROOM,
  cardTextRooms,
  detailCardLayout,
  detailCardRect,
  detailOwner,
  detailOwnerHeight,
  type DetailRow,
} from "./details/detailCardLayout.ts";
export {
  HOME_BAR_BUTTONS,
  HOME_LAYOUT,
  type HomeBarButton,
  homeBarButtons,
  homeBarShown,
  sectionFill,
  tileFace,
} from "./homeGeometry.ts";
export { SPEECH_ROOM, speechBubbleHeight, speechPads } from "./speechLayout.ts";
export { DOG_TILE_TEXT_ROOM, slotSignText, TILE_STRIP_EDGE, tileStrip } from "./tileText.ts";
export { updateModalLayout, updateModalText } from "./updateModalLayout.ts";
