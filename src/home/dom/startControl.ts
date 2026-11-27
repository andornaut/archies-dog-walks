import type { BitmapFont } from "@andornaut/game-kit/runtime/text/bitmapFont";

import {
  createGameButton,
  createTextLine,
  placeFrame,
  placeText,
  REFUSAL_RED,
  setBox,
  shownText,
} from "../../ui/dom/index.ts";
import {
  actionLabelCapTop,
  artPixel,
  BUTTON_COLOURS,
  type DomScale,
  gridRect,
  lineInk,
  PALETTE,
} from "../../ui/index.ts";
import { HOME_LAYOUT } from "../index.ts";
export interface NativeStartControl {
  readonly element: HTMLButtonElement;
  dispose(): void;
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
// The standard button skin (gameButton.css) supplies chrome; the home controller supplies only
// state and copy.
export function createStartControl(
  doc: Document,
  title: BitmapFont,
  input: {
    readonly activate: () => void;
    readonly focused?: boolean;
    readonly label: string;
    readonly loading: string;
    readonly unavailable: string | undefined;
    readonly waitingAlpha: number;
  },
): NativeStartControl {
  const ready = input.unavailable === undefined;
  const rect = HOME_LAYOUT.startButton;
  const text = {
    capTop: rect.y + HOME_LAYOUT.startLabel.readyY,
    centre: "ink",
    centreX: rect.x + rect.width / 2,
    colour: PALETTE[BUTTON_COLOURS[ready ? "primary" : "disabled"].label],
    font: "title",
    projection: "layout",
    scale: HOME_LAYOUT.startLabel.scale,
    text: input.label,
  } as const;
  const label = createTextLine(doc, text);
  const button = createGameButton(doc, {
    appearance: { role: "primary" },
    content: { icon: label, kind: "icon", name: input.label },
    getAction: () => ({ activate: input.activate }),
    getState: () => ({
      availability:
        input.unavailable === undefined
          ? { kind: "available" }
          : { kind: "unavailable", reason: input.unavailable },
    }),
    onUnavailable: input.activate,
  });
  const { element, face } = button;
  element.style.pointerEvents = "auto";
  element.toggleAttribute("data-picker-focused", input.focused === true);
  let words = input.label;
  let key = "";
  return {
    dispose: button.dispose,
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
      const nextWords = state.waiting ? input.loading : input.label;
      if (nextWords !== words) {
        words = nextWords;
        label.textContent = words.toUpperCase();
        button.setContent({ icon: label, kind: "icon", name: words });
      }
      button.setPressed(state.down && ready);
      element.style.opacity = String(state.waiting ? input.waitingAlpha : 1);
      element.toggleAttribute(REFUSAL_RED, state.refusing);
      const box = gridRect(scale, rect);
      const pixel = artPixel(scale);
      setBox(element, box);
      placeFrame(scale, rect, face, rect);
      face.style.left = `${Math.round(state.x) * pixel}px`;
      face.style.top = `${Math.round(state.y) * pixel}px`;
      const ink = lineInk(title, shownText("title", words), text.scale);
      placeText(title, scale, rect, label, {
        ...text,
        capTop: actionLabelCapTop(rect, { rows: ink.bottom - ink.top, top: ink.top }),
        text: words,
      });
    },
  };
}
