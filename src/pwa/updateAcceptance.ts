import { createProgressState } from "@andornaut/game-kit/progressState";

// An explicitly accepted update waits for safe worker control and document navigation. The
// optional offer never borrows the newer-save requirement or background install activity.
export const acceptedUpdateProgress = createProgressState();
