import {
  indeterminateSegment,
  type ProgressBarStyle,
  type ProgressMotion,
} from "@andornaut/game-kit/progress";
import type { Rect } from "@andornaut/game-kit/rect";
import type { DomProgressTiming } from "@andornaut/game-kit/web/progress/dom/progressBar";

import { PROGRESS_BORDER } from "../data/layout.ts";
import { PALETTE } from "./palette.ts";

export const GAME_PROGRESS = {
  border: PROGRESS_BORDER,
  colours: { border: "ink", fill: ["yellow", "amber"], track: "darkSlate" },
} as const;

export const GAME_PROGRESS_STYLE: ProgressBarStyle = {
  border: GAME_PROGRESS.border,
  fills: GAME_PROGRESS.colours.fill.map((colour) => PALETTE[colour]),
  frame: PALETTE[GAME_PROGRESS.colours.border],
  track: PALETTE[GAME_PROGRESS.colours.track],
};

// A loading bar's travelling segment, a share of the track crossing it once a cycle, and how
// long a finished measured load shows full: the kit's defaults.
export const LOADING_TIMING: DomProgressTiming = { cycleMs: 1500, fullMs: 250, segment: 0.25 };
export const LOADING_MOTION: ProgressMotion = {
  cycleMs: LOADING_TIMING.cycleMs,
  segment: LOADING_TIMING.segment,
};

// The custom property holding the DOM bar's step count, which main.css reads.
export const LOADING_STEPS_PROPERTY = "--loading-bar-steps";

// The DOM bar's timing on frame, and its travel's steps, so it moves as the canvas bar does: its
// segment the whole pixels drawProgressDisplay draws, stepping one pixel at a time from just
// outside the track's left edge to just outside its right.
export function domLoadingTiming(frame: Rect): { steps: number; timing: DomProgressTiming } {
  const track = frame.width - 2 * GAME_PROGRESS.border;
  // Halfway through a cycle the segment lies wholly inside the track, at its full width.
  const { width } = indeterminateSegment(LOADING_MOTION, track, LOADING_MOTION.cycleMs / 2);
  return { steps: track + width, timing: { ...LOADING_TIMING, segment: width / track } };
}
