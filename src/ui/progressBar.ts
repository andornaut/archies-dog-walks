import type { ProgressBarStyle, ProgressMotion } from "@andornaut/game-kit/progress";
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
