import type { Point } from "@andornaut/game-kit/rect";
import type { BitmapFont } from "@andornaut/game-kit/text/bitmapFont";

import { type DomScale, gridX, gridY } from "../domScale.ts";
import type { PillColours } from "./labelBlock.ts";
import {
  blockPlace,
  displayGlyphs,
  type DomTextBlock,
  setBox,
  shownText,
  spokenText,
} from "./pixelLine.ts";
const ORIGIN = { x: 0, y: 0 };
const hex = (colour: number) => `#${colour.toString(16).padStart(6, "0")}`;
// One immutable text block. Shared font layout owns anchors, ink centring and name-pill bounds.
export function textBlock(
  doc: Document,
  input: {
    readonly bitmap: BitmapFont;
    readonly pillColours: PillColours;
  },
  block: DomTextBlock,
): {
  readonly element: HTMLElement;
  readonly ready: Promise<readonly string[]>;
  readonly place: (scale: DomScale, origin?: Point) => void;
} {
  const element = doc.createElement("div");
  element.className = "adw-lines";
  const first = blockPlace(input.bitmap, { dpr: 1, origin: ORIGIN, unit: 1 }, block);
  const pills = first.pills.map(({ index }) => {
    const pill = doc.createElement("span");
    pill.className = "adw-pill";
    pill.setAttribute("aria-hidden", "true");
    const colours = input.pillColours(index);
    if (colours !== undefined) {
      pill.style.backgroundColor = hex(colours.pill);
    }
    return pill;
  });
  const runs = first.runs.map((run) => {
    const span = doc.createElement("span");
    span.className = `adw-text adw-font-${block.font}`;
    span.setAttribute("aria-hidden", "true");
    if (block.font === "display") {
      span.append(...displayGlyphs(doc, run.text));
    } else {
      span.textContent = run.text;
    }
    const named = run.pill === undefined ? undefined : input.pillColours(run.pill);
    span.style.color = hex(named?.name ?? block.colour);
    return span;
  });
  const spoken = doc.createElement("span");
  spoken.className = "adw-spoken";
  spoken.textContent = `${block.lines.map((line) => spokenText(shownText(block.font, line))).join(" ")} `;
  element.append(...pills, ...runs, spoken);
  return {
    element,
    place(scale, origin = ORIGIN) {
      const place = blockPlace(input.bitmap, scale, block);
      const left = gridX(scale, origin.x);
      const top = gridY(scale, origin.y);
      place.pills.forEach(({ box }, i) => {
        const pill = pills[i]!;
        setBox(pill, { ...box, left: box.left - left, top: box.top - top });
        pill.style.setProperty("--adw-cut", `${place.cut}px`);
      });
      place.runs.forEach((run, i) => {
        const span = runs[i]!;
        Object.assign(span.style, {
          fontSize: `${place.fontSize}px`,
          left: `${run.left - left}px`,
          lineHeight: `${place.lineHeight}px`,
          top: `${run.top - top}px`,
        });
        if (block.font === "display") {
          span.style.setProperty("--adw-k", `${place.fontSize / 8}px`);
        }
      });
    },
    ready: Promise.resolve([]),
  };
}
