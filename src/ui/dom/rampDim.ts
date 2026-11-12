import { artUrl } from "../../assets/artFiles.ts";
import { DOM_DIM_ART_KEYS, DOM_STYLE_ART } from "../../assets/domArt.ts";
import { dimArtPath, dimColour } from "../dimArt.ts";
import { PALETTE } from "../palette.ts";

// HTML drawn palette-dimmed, as the canvas's modal dim draws the frozen view under the pause
// menu (addRampDim in src/ui/phaser/rampDim.ts), never shaded: every colour moved down its ramp
// (dimColour) and every picture drawn from its dimmed copy (DOM_DIM_ART_KEYS). A dimmed element
// sets the layer's custom properties over its own subtree, the palette's colours and the frames
// the stylesheet names, dimmed, and its subtree's own colours and pictures are dimmed in place,
// each put back as it is undimmed.

// The data attribute holding the URL of a picture's dimmed copy (artPart).
export const DIM_ART_ATTRIBUTE = "data-dim-art";

const hex = (colour: number) => `#${colour.toString(16).padStart(6, "0")}`;

// The layer's custom properties a dimmed element sets over its subtree.
function dimProperties(): (readonly [string, string])[] {
  const colours = Object.entries(PALETTE).map(([name, colour]): readonly [string, string] => [
    `--adw-${name}`,
    hex(dimColour(colour)),
  ]);
  const frames = DOM_STYLE_ART.filter(([, key]) => DOM_DIM_ART_KEYS.has(key)).map(
    ([kind, key]): readonly [string, string] => [
      `--adw-${key}`,
      `url("${artUrl(dimArtPath(kind, key))}")`,
    ],
  );
  return [...colours, ...frames];
}

// A CSS colour as an element's style gives it back (#rrggbb, or rgb(r, g, b) once the browser
// has read it), dimmed; anything else, as an empty or inherited colour, as it is.
export function dimCss(css: string): string {
  const channels = /^#([0-9a-f]{6})$/i.exec(css)?.[1];
  if (channels !== undefined) {
    return hex(dimColour(Number.parseInt(channels, 16)));
  }
  const rgb = /^rgb\((\d+), ?(\d+), ?(\d+)\)$/.exec(css);
  if (rgb === null) {
    return css;
  }
  const [red, green, blue] = rgb.slice(1).map(Number);
  return hex(dimColour(((red ?? 0) << 16) | ((green ?? 0) << 8) | (blue ?? 0)));
}

type Inline = Pick<CSSStyleDeclaration, "backgroundColor" | "backgroundImage" | "color">;

// Each dimmed element's own colours and picture as they were before it was dimmed.
const undimmed = new WeakMap<HTMLElement, Inline>();

// element and each element under it dimmed or put back: its own text and fill colours, and its
// picture where it has a dimmed copy. An element already so is left as it is, so a part drawn
// again while its dialog is dimmed is dimmed by calling this again.
function dimInline(element: HTMLElement, dimmed: boolean): void {
  const saved = undimmed.get(element);
  if (dimmed && saved === undefined) {
    const { backgroundColor, backgroundImage, color } = element.style;
    undimmed.set(element, { backgroundColor, backgroundImage, color });
    const art = element.getAttribute(DIM_ART_ATTRIBUTE);
    Object.assign(element.style, {
      backgroundColor: dimCss(backgroundColor),
      ...(art === null ? {} : { backgroundImage: `url("${art}")` }),
      color: dimCss(color),
    });
  } else if (!dimmed && saved !== undefined) {
    undimmed.delete(element);
    Object.assign(element.style, saved);
  }
  for (const child of element.children) {
    dimInline(child as HTMLElement, dimmed);
  }
}

// root and everything under it drawn palette-dimmed, or as it was.
export function setRampDimmed(root: HTMLElement, dimmed: boolean): void {
  for (const [name, value] of dimProperties()) {
    root.style.setProperty(name, dimmed ? value : "");
  }
  dimInline(root, dimmed);
}

// A part drawn again under root while it is dimmed, dimmed with it.
export function dimDrawn(element: HTMLElement, dimmed: boolean): void {
  if (dimmed) {
    dimInline(element, true);
  }
}
