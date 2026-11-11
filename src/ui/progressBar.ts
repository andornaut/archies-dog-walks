import type { ProgressBarStyle } from "@andornaut/game-kit/progress";

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
