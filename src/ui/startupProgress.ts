import { createProgressState } from "@andornaut/game-kit/runtime/progressState";

export const startupProgress = createProgressState();
export const startupLoad = startupProgress.begin();
