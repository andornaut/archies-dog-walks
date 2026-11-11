import { SLICES } from "../../data/layout.ts";

// The HTML interface's stylesheet. Lengths are the layer's custom properties, which uiLayer.ts
// sets in whole device pixels from domScale (--adw-slice-<n> for n game pixels), colours the
// palette's (--adw-<name>) and art the hashed files' URLs (--adw-<key>); parts are placed inline
// in snapped CSS px. A frame's colour shows only while its art has not loaded.

const px = (n: 1 | 2 | 3 | 4 | 5) => `var(--adw-slice-${n})`;

// A nine-slice frame: the art cut by its SLICES, its edges drawn as wide as the layer's
// whole-device-pixel lengths for them.
function nineSlice(key: "ui-button" | "ui-panel", art: string): string {
  const { bottom, left, right, top } = SLICES[key];
  const widths = [top, right, bottom, left].map((edge) => px(edge as 3 | 4 | 5)).join(" ");
  return `border-style:solid;border-color:transparent;border-width:${widths};
  border-image:var(--adw-${art}) ${top} ${right} ${bottom} ${left} fill / ${widths} stretch;
  background-clip:padding-box;image-rendering:pixelated`;
}

// A box's outline less a pixel at each corner.
const CUT_CORNERS = [
  `${px(1)} 0`,
  `calc(100% - ${px(1)}) 0`,
  `100% ${px(1)}`,
  `100% calc(100% - ${px(1)})`,
  `calc(100% - ${px(1)}) 100%`,
  `${px(1)} 100%`,
  `0 calc(100% - ${px(1)})`,
  `0 ${px(1)}`,
].join(",");

export const UI_STYLE = `
.adw-dialog{position:absolute;inset:0;pointer-events:none}
.adw-dialog[hidden]{display:none}
.adw-rim,.adw-panel,.adw-plate,.adw-button,.adw-close{position:absolute;box-sizing:border-box;pointer-events:auto}
/* The rim leaves out its corner pixels, following the panel's cut corners. */
.adw-rim{background:var(--adw-tan);clip-path:polygon(${CUT_CORNERS})}
.adw-panel{${nineSlice("ui-panel", "ui-panel")};background-color:var(--adw-cream)}
.adw-plate{background:var(--adw-tan)}
.adw-lines{position:absolute;left:0;top:0;margin:0;font:inherit}
.adw-text{position:absolute;margin:0;white-space:pre;line-height:normal;letter-spacing:0;
  font-kerning:normal;font-synthesis:none;font-variant-ligatures:none;font-weight:400;
  -webkit-font-smoothing:none;pointer-events:none}
.adw-font-body{font-family:"ADW Body"}
.adw-font-title{font-family:"ADW Title"}
.adw-button,.adw-close{margin:0;padding:0;border:0;background:none;color:inherit;font:inherit;
  cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent;outline:none}
.adw-face,.adw-close-face,.adw-close-glyph{position:absolute;box-sizing:border-box;pointer-events:none}
.adw-face{${nineSlice("ui-button", "ui-button-normal")};background-color:var(--adw-cream)}
.adw-button[data-pressed] .adw-face{border-image-source:var(--adw-ui-button-pressed)}
.adw-button.adw-go .adw-face{border-image-source:var(--adw-ui-button-go);background-color:var(--adw-green)}
.adw-button.adw-go[data-pressed] .adw-face{border-image-source:var(--adw-ui-button-go-pressed)}
.adw-button[data-pressed] .adw-text,.adw-close[data-pressed] .adw-close-glyph{transform:translateY(${px(2)})}
.adw-close-face{background:var(--adw-ui-icon-button-normal) 0 0/100% 100%;image-rendering:pixelated}
.adw-close[data-pressed] .adw-close-face{background-image:var(--adw-ui-icon-button-pressed)}
.adw-close-glyph{background:var(--adw-icon-close) 0 0/100% 100%;image-rendering:pixelated}
.adw-button:focus-visible .adw-face,.adw-close:focus-visible .adw-close-face{
  outline:${px(2)} solid var(--adw-cyan);outline-offset:${px(1)};
  box-shadow:0 0 0 ${px(1)} var(--adw-ink),0 0 0 calc(${px(1)} * 4) var(--adw-ink)}
/* fx-tap's 4 frames side by side, 60ms each; --adw-burst is the burst's snapped side. */
.adw-burst{position:absolute;pointer-events:none;background:var(--adw-fx-tap) 0 0/400% 100%;
  image-rendering:pixelated;animation:adw-burst 240ms steps(4) forwards}
@keyframes adw-burst{to{background-position-x:calc(var(--adw-burst) * -4)}}
`;
