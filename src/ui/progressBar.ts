import type { ProgressBarStyle } from "@andornaut/game-kit/progress";

import { PALETTE } from "./palette";

export const GAME_PROGRESS = {
  border: 1,
  colours: { border: "ink", fill: ["yellow", "amber"], track: "darkSlate" },
} as const;

export const GAME_PROGRESS_STYLE: ProgressBarStyle = {
  border: GAME_PROGRESS.border,
  fills: GAME_PROGRESS.colours.fill.map((colour) => PALETTE[colour]),
  frame: PALETTE[GAME_PROGRESS.colours.border],
  track: PALETTE[GAME_PROGRESS.colours.track],
};
