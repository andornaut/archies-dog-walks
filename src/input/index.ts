// The public entry of src/input/: modules outside it import only this file.
export { exceedsTapDistance, type GestureAction, swipeDirection } from "./gestures.ts";
export { type HoldPress, moveHold, releaseHold, startHold, tickHold } from "./hold.ts";
export { holdRule, TILE_SLOP_PX } from "./holdRule.ts";
export {
  cardNumberForKey,
  type FocusDirection,
  focusDirectionForKey,
  isConfirmKey,
  isExitKey,
  isHelpKey,
  isMuteKey,
  isPauseKey,
  laneDirectionForKey,
  menuKeyActs,
  sceneKeyAllowed,
  walkKeyAction,
} from "./keyBindings.ts";
export { keyNumbersShown, noteKeyPress, withKeyNumber } from "./keyNumbers.ts";
export {
  dragScroll,
  isDragging,
  LIST_FLING,
  type ListScroll,
  listScroll,
  pageKeyScroll,
  pressScroll,
  releaseScroll,
  resizeScroll,
  scrollBy,
  scrollMax,
  type ScrollRule,
  scrollToShow,
  stepScroll,
  wheelScroll,
} from "./listScroll.ts";
export { followOnePress } from "./onePress.ts";
export { openGuard } from "./openGuard.ts";
export { screenArea } from "./outsideTap.ts";
export { walkPagePoint } from "./pageTap.ts";
export {
  idleTrack,
  type PointerPhase,
  type PointerSample,
  type PointerTrack,
  type Press,
  type PressMode,
  tickTrack,
  type TrackContext,
  trackPointer,
} from "./pointerTracking.ts";
export { tapGuardMs } from "./tapGuard.ts";
export { pressDown, pressUp, type TargetPress } from "./targetPress.ts";
export { lostTouches } from "./touches.ts";
