// CLEANUP (added 2026-11-11): the HTML pause menu stays behind this switch until Art's
// before-and-after review of it passes; then HTML_UI_DEFAULT turns true, and once it has shipped,
// the switch and the canvas pause menu's mode in src/scenes/PauseScene.ts go.

// Whether the walk's pause menu draws in HTML over the canvas when the page names neither.
const HTML_UI_DEFAULT = false;

// The page's switch: ?ui=html draws the pause menu in HTML, ?ui=canvas on the canvas.
export function htmlUiOn(search: string): boolean {
  const ui = new URLSearchParams(search).get("ui");
  return ui === "html" ? true : ui === "canvas" ? false : HTML_UI_DEFAULT;
}
