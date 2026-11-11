import { MODAL_DIM } from "@andornaut/game-kit/view/modalDim";

import { SLICES } from "../../data/layout.ts";
import { CONTROL_STATE_STYLE } from "./controlStateStyle.ts";
import { SETTINGS_STYLE } from "./settingsStyle.ts";

// The HTML interface's stylesheet. A screen's root is sized in device pixels and scaled onto the
// page's device grid (gridTransform), so its CSS px are device pixels. Lengths are the layer's
// custom properties, which uiLayer.ts sets in whole art pixels (--adw-slice-<n> for n art pixels,
// each artPixel device pixels), colours the palette's (--adw-<name>) and art the hashed files'
// URLs (--adw-<key>); parts are placed inline in device pixels. A frame's colour shows only while
// its art has not loaded.

const px = (n: 1 | 2 | 3 | 4 | 5 | 8) => `var(--adw-slice-${n})`;

// A nine-slice frame: the art cut by its SLICES, its edges drawn as wide as the layer's
// whole-device-pixel lengths for them.
export function nineSlice(
  key: "ui-button" | "ui-detail-card" | "ui-panel" | "ui-quip",
  art: string,
): string {
  const { bottom, left, right, top } = SLICES[key];
  const widths = [top, right, bottom, left].map((edge) => px(edge as 3 | 4 | 5 | 8)).join(" ");
  return `border-style:solid;border-color:transparent;border-width:${widths};
  border-image:var(--adw-${art}) ${top} ${right} ${bottom} ${left} fill / ${widths} stretch;
  background-clip:padding-box;image-rendering:pixelated`;
}

// The modal shade's alpha as the canvas blends it: WebGL takes a fill's alpha in whole 255ths,
// rounded down, so the HTML shade takes the same.
export const SHADE_ALPHA = Math.floor(MODAL_DIM.fallbackAlpha * 255) / 255;

// A scrollbar's part: the art's end caps (its SLICES top and bottom) drawn whole and its middle
// stretched, with no side slices.
function capsSlice(key: "ui-scroll-thumb" | "ui-scroll-track"): string {
  const { bottom, top } = SLICES[key];
  const widths = `${px(top as 3)} 0 ${px(bottom as 3)} 0`;
  return `position:absolute;box-sizing:border-box;border-style:solid;border-color:transparent;
  border-width:${widths};border-image:var(--adw-${key}) ${top} 0 ${bottom} 0 fill / ${widths} stretch;
  image-rendering:pixelated`;
}

// A box's outline less a square cut long at each corner, its edges on whole pixels so none is
// blended.
const cutCorners = (cut: string) =>
  [
    [cut, "0"],
    [`calc(100% - ${cut})`, "0"],
    [`calc(100% - ${cut})`, cut],
    ["100%", cut],
    ["100%", `calc(100% - ${cut})`],
    [`calc(100% - ${cut})`, `calc(100% - ${cut})`],
    [`calc(100% - ${cut})`, "100%"],
    [cut, "100%"],
    [cut, `calc(100% - ${cut})`],
    ["0", `calc(100% - ${cut})`],
    ["0", cut],
    [cut, cut],
  ]
    .map(([x, y]) => `${x} ${y}`)
    .join(",");

// The display letters' ink ring (the fill grown a pixel, 8-neighbour), then their dred shadow (the
// ring moved 1 and 2 pixels down and right, less what the fill and ring cover), each step
// --adw-k, a font pixel; the first listed paints on top, so the ring covers the shadow.
const DISPLAY_RING = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [-1, 0],
  [1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
] as const;
const DISPLAY_DROP = [
  [2, 0],
  [0, 2],
  [2, 1],
  [1, 2],
  [2, 2],
  [3, 1],
  [1, 3],
  [3, 2],
  [2, 3],
  [3, 3],
] as const;
const DISPLAY_SHADOW = [
  ...DISPLAY_RING.map(([x, y]) => [x, y, "var(--adw-ink)"] as const),
  ...DISPLAY_DROP.map(([x, y]) => [x, y, "var(--adw-darkRed)"] as const),
]
  .map(([x, y, colour]) => `calc(${x} * var(--adw-k)) calc(${y} * var(--adw-k)) 0 ${colour}`)
  .join(",");

export const UI_STYLE = `
.adw-dialog{position:absolute;left:0;top:0;transform-origin:0 0;pointer-events:none;outline:none}
.adw-dialog[hidden]{display:none}
.adw-rim,.adw-panel,.adw-card,.adw-plate,.adw-button,.adw-close{position:absolute;box-sizing:border-box;
  pointer-events:auto}
/* The rim leaves out its corner pixels, following the panel's cut corners. */
.adw-rim{background:var(--adw-tan);clip-path:polygon(${cutCorners(px(1))})}
.adw-panel{${nineSlice("ui-panel", "ui-panel")};background-color:var(--adw-cream)}
.adw-card{${nineSlice("ui-detail-card", "ui-detail-card")};background-color:var(--adw-cream)}
.adw-plate{background:var(--adw-tan)}
/* A panel that takes no presses: every press goes through to the canvas. */
.adw-dialog.adw-passive *,.adw-dialog.adw-inert *{pointer-events:none}
/* A detail card's framed boxes, art and name pills; --adw-cut is a pill's snapped corner. */
.adw-framed,.adw-art,.adw-pill{position:absolute;box-sizing:border-box;pointer-events:none}
.adw-art{background-repeat:no-repeat;background-size:100% 100%;image-rendering:pixelated}
.adw-pill{clip-path:polygon(${cutCorners("var(--adw-cut)")})}
/* Text only a screen reader reads. */
.adw-spoken{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
.adw-lines{position:absolute;left:0;top:0;margin:0;font:inherit}
.adw-text{position:absolute;margin:0;white-space:pre;letter-spacing:0;
  font-kerning:normal;font-synthesis:none;font-variant-ligatures:none;font-weight:400;
  -webkit-font-smoothing:none;pointer-events:none}
.adw-font-body{font-family:"ADW Body"}
.adw-font-title{font-family:"ADW Title"}
.adw-font-display{font-family:"ADW Display";text-shadow:${DISPLAY_SHADOW}}
.adw-button,.adw-close{margin:0;padding:0;border:0;background:none;color:inherit;font:inherit;
  cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent;outline:none}
.adw-face,.adw-close-face,.adw-close-glyph{position:absolute;box-sizing:border-box;pointer-events:none}
.adw-face{${nineSlice("ui-button", "ui-button-normal")};background-color:var(--adw-cream)}
.adw-button[data-pressed] .adw-face{border-image-source:var(--adw-ui-button-pressed)}
.adw-button.adw-go .adw-face{border-image-source:var(--adw-ui-button-go);background-color:var(--adw-green)}
.adw-button.adw-go[data-pressed] .adw-face{border-image-source:var(--adw-ui-button-go-pressed)}
.adw-button.adw-secondary .adw-face{border-image-source:var(--adw-ui-button-secondary)}
.adw-button.adw-secondary[data-pressed] .adw-face{
  border-image-source:var(--adw-ui-button-secondary-pressed)}
.adw-button[data-pressed] .adw-text,.adw-close[data-pressed] .adw-close-glyph{transform:translateY(${px(2)})}
.adw-close-face{background:var(--adw-ui-icon-button-normal) 0 0/100% 100%;image-rendering:pixelated}
.adw-close[data-pressed] .adw-close-face{background-image:var(--adw-ui-icon-button-pressed)}
.adw-close-glyph{background:var(--adw-icon-close) 0 0/100% 100%;image-rendering:pixelated}
/* A keyboard focus only: a cyan band in ink keylines inside the control's face, clear of the gap
   and the next control. */
.adw-button:focus-visible .adw-face::after,.adw-close:focus-visible .adw-close-face::after{
  content:"";position:absolute;inset:${px(1)};border:${px(2)} solid var(--adw-cyan);
  box-shadow:0 0 0 ${px(1)} var(--adw-ink),inset 0 0 0 ${px(1)} var(--adw-ink)}
/* The shade under a modal panel: ink at the canvas's modal shade's alpha, blended as it blends. */
.adw-shade{position:absolute;pointer-events:none;background:var(--adw-ink);opacity:${SHADE_ALPHA}}
/* A list's view: its content clipped to it and moved up by its scroll. */
.adw-clip,.adw-scrolled{position:absolute;pointer-events:none}
.adw-clip{overflow:hidden}
.adw-scroll-track{${capsSlice("ui-scroll-track")}}
.adw-scroll-thumb{${capsSlice("ui-scroll-thumb")}}
/* fx-tap's 4 frames side by side, 60ms each; --adw-burst is the burst's snapped side. */
.adw-burst{position:absolute;pointer-events:none;background:var(--adw-fx-tap) 0 0/400% 100%;
  image-rendering:pixelated;animation:adw-burst 240ms steps(4) forwards}
@keyframes adw-burst{to{background-position-x:calc(var(--adw-burst) * -4)}}
${SETTINGS_STYLE}

${CONTROL_STATE_STYLE}`;
