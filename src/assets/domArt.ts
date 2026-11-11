// The art the HTML interface draws (src/ui/dom/, src/hud/dom/), by key. CSS loads whole files, so
// a build writes each key's own files beside the atlas that packs it for the canvas, and the
// service worker precaches them with the rest of the hashed art.
export const DOM_ART_KEYS: ReadonlySet<string> = new Set([
  "fx-tap",
  "icon-close",
  "ui-button-disabled",
  "ui-button-go",
  "ui-button-go-disabled",
  "ui-button-go-pressed",
  "ui-button-normal",
  "ui-button-pressed",
  "ui-button-secondary",
  "ui-button-secondary-pressed",
  "ui-detail-card",
  "ui-icon-button-normal",
  "ui-icon-button-pressed",
  "ui-panel",
]);
