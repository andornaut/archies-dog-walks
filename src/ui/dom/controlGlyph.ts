export type ControlGlyph = "close" | "exit" | "menu" | "pause" | "sound-off" | "sound-on";

interface GlyphPath {
  readonly d: string;
  readonly fill?: "currentColor";
  readonly stroke?: "none";
}

const SPEAKER: GlyphPath = {
  d: "M2 6h2l3-3v10l-3-3H2z",
  fill: "currentColor",
  stroke: "none",
};

const PATHS: Readonly<Record<ControlGlyph, readonly GlyphPath[]>> = {
  close: [{ d: "M3.5 3.5l9 9m0-9-9 9" }],
  exit: [{ d: "M6 3H2.5v10H6M6 8h7.5m-3-3 3 3-3 3" }],
  menu: [{ d: "M2.5 4h11m-11 4h11m-11 4h11" }],
  pause: [{ d: "M4 3h3v10H4zM9 3h3v10H9z", fill: "currentColor", stroke: "none" }],
  "sound-off": [SPEAKER, { d: "M10 6l4 4m0-4-4 4" }],
  "sound-on": [SPEAKER, { d: "M9 5.5q2.5 2.5 0 5m2-7.5q5 5 0 10" }],
};

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

// The owning button supplies its accessible name, colour and existing glyph placement.
export function createControlGlyph(document: Document, glyph: ControlGlyph): SVGSVGElement {
  const svg = document.createElementNS(SVG_NAMESPACE, "svg");
  for (const [name, value] of Object.entries({
    "aria-hidden": "true",
    fill: "none",
    focusable: "false",
    height: "16",
    stroke: "currentColor",
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
    "stroke-width": "1.5",
    viewBox: "0 0 16 16",
    width: "16",
  })) {
    svg.setAttribute(name, value);
  }
  for (const shape of PATHS[glyph]) {
    const path = document.createElementNS(SVG_NAMESPACE, "path");
    path.setAttribute("d", shape.d);
    if (shape.fill !== undefined) {
      path.setAttribute("fill", shape.fill);
    }
    if (shape.stroke !== undefined) {
      path.setAttribute("stroke", shape.stroke);
    }
    svg.append(path);
  }
  return svg;
}
