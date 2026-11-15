import type { BitmapFont } from "@andornaut/game-kit/text/bitmapFont";

import { BUTTON_SIZE } from "../../ui/buttonGeometry.ts";
import { createTextLine, placeFrame, placeText, setBox } from "../../ui/dom/pixelLine.ts";
import { artPixel, type DomScale, gridRect } from "../../ui/domScale.ts";
import { PALETTE } from "../../ui/palette.ts";
import { BUTTON_COLOURS } from "../../ui/selection.ts";
import { HOME_LAYOUT } from "../homeLayout.ts";
export interface NativeStartControl {
  readonly element: HTMLButtonElement;
  place(
    scale: DomScale,
    state: {
      readonly down: boolean;
      readonly waiting: boolean;
      readonly refusing: boolean;
      readonly x: number;
      readonly y: number;
    },
  ): void;
}
// The published button skin supplies chrome; the home controller supplies only state and copy.
export function createStartControl(
  doc: Document,
  title: BitmapFont,
  input: {
    readonly ready: boolean;
    readonly label: string;
    readonly loading: string;
    readonly waitingAlpha: number;
  },
): NativeStartControl {
  const element = doc.createElement("button");
  element.type = "button";
  element.className = `adw-button adw-go${input.ready ? "" : " adw-disabled"}`;
  element.setAttribute("aria-disabled", String(!input.ready));
  element.style.position = "absolute";
  element.style.pointerEvents = "auto";
  const face = doc.createElement("span");
  face.className = "adw-face";
  element.append(face);
  const rect = HOME_LAYOUT.startButton;
  const text = {
    capTop: rect.y + HOME_LAYOUT.startLabel.readyY + (input.ready ? 0 : BUTTON_SIZE.press),
    centre: "advance",
    centreX: rect.x + rect.width / 2,
    colour: PALETTE[BUTTON_COLOURS[input.ready ? "primary" : "disabled"].label],
    font: "title",
    scale: HOME_LAYOUT.startLabel.scale,
    text: input.label,
  } as const;
  const label = createTextLine(doc, text);
  label.setAttribute("aria-hidden", "true");
  element.append(label);
  let key = "";
  return {
    element,
    place: (scale, state) => {
      const next = [
        scale.unit,
        scale.dpr,
        scale.origin.x,
        scale.origin.y,
        state.down,
        state.waiting,
        state.refusing,
        state.x,
        state.y,
      ].join(":");
      if (next === key) {
        return;
      }
      key = next;
      const words = state.waiting ? input.loading : input.label;
      label.textContent = words.toUpperCase();
      element.setAttribute("aria-label", words);
      element.toggleAttribute("data-pressed", state.down && input.ready);
      element.style.opacity = String(state.waiting ? input.waitingAlpha : 1);
      const box = gridRect(scale, rect);
      const pixel = artPixel(scale);
      setBox(element, {
        ...box,
        left: box.left + Math.round(state.x) * pixel,
        top: box.top + Math.round(state.y) * pixel,
      });
      placeFrame(scale, rect, face, rect);
      placeText(title, scale, rect, label, {
        ...text,
        colour: state.refusing ? PALETTE.red : text.colour,
        text: words,
      });
    },
  };
}
