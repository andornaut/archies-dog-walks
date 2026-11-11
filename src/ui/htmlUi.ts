// CLEANUP (added 2026-11-11): the switch keeps the canvas interface reachable while screens move
// to HTML; it and the canvas modes it selects go once every screen draws in HTML.

// Whether the screens that have moved draw in HTML over the canvas when the page names neither.
const HTML_UI_DEFAULT = true;

// The page's switch: ?ui=html draws them in HTML, ?ui=canvas on the canvas.
export function htmlUiOn(search: string): boolean {
  const ui = new URLSearchParams(search).get("ui");
  return ui === "html" ? true : ui === "canvas" ? false : HTML_UI_DEFAULT;
}
