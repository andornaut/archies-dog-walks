import type { ScrollRule } from "@andornaut/game-kit/input/listScroll";

export {
  dragScroll,
  isDragging,
  type ListScroll,
  listScroll,
  pageKeyScroll,
  pressScroll,
  releaseScroll,
  resizeScroll,
  scrollBy,
  scrollMax,
  type ScrollRule,
  scrollTo,
  scrollToShow,
  stepScroll,
  wheelScroll,
} from "@andornaut/game-kit/input/listScroll";

// The fling and wheel; the slop is the game's tap distance.
export const LIST_FLING: Omit<ScrollRule, "dragSlopPx"> = {
  decayMs: 325,
  flingWindowMs: 100,
  stopPxPerMs: 0.02,
  wheelScale: 0.5,
};
