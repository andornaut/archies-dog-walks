import type { LoadingErrorView } from "../ui/dom/loadingError.ts";

// Game.pause leaves in-flight loader requests running. DOM Retry, mute and progress remain live,
// while scene clocks and the walk stay fixed until the visible error has recovered.
export function pauseLoadingError(
  game: { readonly isPaused: boolean; pause(): void; resume(): void },
  view: LoadingErrorView,
): LoadingErrorView {
  let visible = false;
  let resume = false;
  return {
    dispose() {
      view.dispose();
      // This boundary is disposed on game destruction, which must not resume the game.
      resume = false;
    },
    hide() {
      view.hide();
      visible = false;
      if (resume) {
        resume = false;
        game.resume();
      }
    },
    show(busy) {
      if (!visible) {
        visible = true;
        resume = !game.isPaused;
        if (resume) {
          game.pause();
        }
      }
      view.show(busy);
    },
  };
}
