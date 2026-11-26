import type { ProgressBarStyle } from "@andornaut/game-kit/runtime/progress";
import type { DomProgressTiming } from "@andornaut/game-kit/runtime/web/progress/dom/progressBar";

import { PROGRESS_BORDER } from "../data/index.ts";
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

// Every loading bar's timing: its travelling segment, a share of the track crossing it once a
// cycle, how long a finished measured load shows full, and how long it then fades out, reduced
// motion included.
export const LOADING_TIMING = {
  cycleMs: 1500,
  fadeMs: 150,
  fullMs: 250,
  segment: 0.25,
} as const satisfies DomProgressTiming;
