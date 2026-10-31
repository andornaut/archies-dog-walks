import { createProgressState } from "@andornaut/game-kit/progressState";

export const startupProgress = createProgressState();
export const startupLoad = startupProgress.begin();
