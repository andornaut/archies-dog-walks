// The public entry of src/help/: modules outside it import only this file.
export { helpActionForKey, helpActionForPointer } from "./helpInput.ts";
export { dotRects, HELP_LAYOUT, type HelpActionBounds, helpPager } from "./helpLayout.ts";
export { applyHelpAction, type HelpAction } from "./helpPaging.ts";
export {
  type DragLoop,
  type DragMoment,
  dragMomentAt,
  type HelpPicture,
  helpPicture,
  packStillFrames,
  type PictureStrip,
  stillDragMoment,
  stripViewports,
  TOUCH_DRAG,
} from "./helpPictures.ts";
export { closeHelp, startWalkOpensHelp } from "./helpSeen.ts";
export {
  HELP_DOTS,
  type HelpButton,
  type HelpMeasure,
  type HelpView,
  helpView,
} from "./helpView.ts";
