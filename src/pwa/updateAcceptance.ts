import { createProgressState } from "@andornaut/game-kit/runtime/progressState";

// Update now's wait for the game's save and the reload into the staged build. The prompt never
// borrows the newer-save requirement or background staging.
export const acceptedUpdateProgress = createProgressState();
