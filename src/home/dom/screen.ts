import type { Rect } from "@andornaut/game-kit/rect";
import type { BitmapFont } from "@andornaut/game-kit/text/bitmapFont";

import { SCREEN_CONFIG } from "../../data/screen.ts";
import { fillPart } from "../../hud/dom/shopPage.ts";
import type { DomArtSource } from "../../ui/dom/artElements.ts";
import { createTextLine, placeText, setBox, spokenText } from "../../ui/dom/pixelLine.ts";
import {
  deviceX,
  deviceY,
  type DomScale,
  gridRect,
  gridTransform,
  gridX,
  gridY,
} from "../../ui/domScale.ts";
import type { PanelText } from "../../ui/modal/types.ts";
import { PALETTE } from "../../ui/palette.ts";
import { HOME_LAYOUT } from "../homeLayout.ts";
import type { Sections } from "../sections.ts";
import type { HomeSelectionView } from "../selectionView.ts";
import type { slotSign } from "../slotSign.ts";
import type { HomeSpeechView } from "../speechView.ts";
import { createHomeFocus } from "./focus.ts";
import { createGearBadge } from "./gearBadge.ts";
import { createHomeSections } from "./sections.ts";
import {
  createHomeSelection,
  type NativeHomeSelection,
  type SelectionMotion,
} from "./selections.ts";
import { createSlotSign } from "./slotSign.ts";
import { createHomeSpeech } from "./speech.ts";
import { createStartControl, type NativeStartControl } from "./startControl.ts";
export interface NativeHomeSource extends DomArtSource {
  readonly hasArt: (key: string) => boolean;
  readonly imageSize: (key: string) => {
    readonly width: number;
    readonly height: number;
  };
  readonly isSheet: (key: string) => boolean;
  readonly disabledKey: (key: string) => string;
}
export interface NativeHomeView {
  readonly element: HTMLElement;
  readonly controls: ReadonlyMap<string, HTMLButtonElement>;
  readonly selections: ReadonlyMap<string, NativeHomeSelection>;
  readonly start: NativeStartControl;
  readonly speech: ReturnType<typeof createHomeSpeech>;
  readonly slot: ReturnType<typeof createSlotSign> | undefined;
  readonly gearBadge: ReturnType<typeof createGearBadge> | undefined;
  readonly ready: Promise<readonly string[]>;
  place(scale: DomScale, motion: (id: string) => SelectionMotion): void;
  dispose(): void;
}
// The home picker is drawn from its immutable view, independently of world actors and cameras.
export function createNativeHomeView(
  doc: Document,
  source: NativeHomeSource,
  fonts: {
    readonly body: BitmapFont;
    readonly title: BitmapFont;
  },
  context: {
    readonly platePadding: number;
    readonly pillColours: (index: number) =>
      | {
          readonly name: number;
          readonly pill: number;
        }
      | undefined;
  },
  snapshot: {
    readonly sections: Sections;
    readonly bonus: string | null;
    readonly selections: readonly HomeSelectionView[];
    readonly speech: HomeSpeechView;
    readonly bubbleInteractive: boolean;
    readonly streetSign: string;
    readonly slot:
      | {
          readonly sign: NonNullable<ReturnType<typeof slotSign>>;
          readonly crop: Rect;
        }
      | undefined;
    readonly gearBadge:
      | {
          readonly rect: Rect;
          readonly key: string;
          readonly scale: number;
          readonly fallback: PanelText;
        }
      | undefined;
    readonly focus:
      | {
          readonly rect: Rect;
          readonly outset: number;
        }
      | undefined;
    readonly start: {
      readonly ready: boolean;
      readonly label: string;
      readonly loading: string;
      readonly waitingAlpha: number;
    };
  },
): NativeHomeView {
  const element = doc.createElement("div");
  element.className = "adw-dialog";
  const divider = fillPart(doc, {
    colour: PALETTE.plum,
    rect: {
      height: 1,
      width: SCREEN_CONFIG.width,
      x: 0,
      y: HOME_LAYOUT.gateBar.y + HOME_LAYOUT.gateBar.height - 1,
    },
  });
  element.append(divider.element);
  const sections = createHomeSections(doc, source, fonts.title, snapshot);
  element.append(sections.element);
  const selections = new Map(
    snapshot.selections.map((tile) => [
      tile.id,
      createHomeSelection(doc, source, fonts, context.platePadding, tile),
    ]),
  );
  element.append(...[...selections.values()].map(({ element }) => element));
  const controls = new Map([...selections].map(([id, view]) => [id, view.element]));
  const speech = createHomeSpeech(doc, source, fonts, context.pillColours, snapshot.speech);
  const speechControl = doc.createElement(snapshot.bubbleInteractive ? "button" : "div");
  if (snapshot.bubbleInteractive) {
    (speechControl as HTMLButtonElement).type = "button";
  }
  speechControl.className = "adw-button";
  speechControl.style.position = "absolute";
  speechControl.style.pointerEvents = snapshot.bubbleInteractive ? "auto" : "none";
  speechControl.setAttribute("aria-label", snapshot.speech.lines.map(spokenText).join(" "));
  speechControl.append(speech.element);
  element.append(speechControl);
  if (snapshot.bubbleInteractive) {
    controls.set("bubble", speechControl as HTMLButtonElement);
  }
  const start = createStartControl(doc, fonts.title, snapshot.start);
  element.append(start.element);
  controls.set("start", start.element);
  const slot =
    snapshot.slot === undefined
      ? undefined
      : createSlotSign(doc, source, fonts.body, snapshot.slot.crop, snapshot.slot.sign);
  if (slot !== undefined) {
    element.append(slot.element);
    controls.set("slotSign", slot.element);
  }
  const gearBadge =
    snapshot.gearBadge === undefined
      ? undefined
      : createGearBadge(doc, source, fonts.title, snapshot.gearBadge);
  if (gearBadge !== undefined) {
    element.append(gearBadge.element);
  }
  const focus = createHomeFocus(doc, snapshot.focus);
  element.append(focus.element);
  const signLine = {
    capTop: HOME_LAYOUT.streetSign.y,
    centre: "advance",
    centreX: HOME_LAYOUT.streetSign.x,
    colour: PALETTE.white,
    font: "title",
    scale: 1,
    text: snapshot.streetSign,
  } as const;
  const sign = createTextLine(doc, signLine);
  element.append(sign);
  let frameKey = "";
  return {
    controls,
    dispose: () => {
      element.remove();
    },
    element,
    gearBadge,
    place: (scale, motion) => {
      const key = [scale.unit, scale.dpr, scale.origin.x, scale.origin.y].join(":");
      if (key !== frameKey) {
        frameKey = key;
        element.style.width = `${deviceX(scale, SCREEN_CONFIG.width)}px`;
        element.style.height = `${deviceY(scale, SCREEN_CONFIG.height)}px`;
        element.style.transform = gridTransform(scale);
        divider.place(scale);
        sections.place(scale);
        focus.place(scale);
        placeText(fonts.title, scale, { x: 0, y: 0 }, sign, signLine);
        setBox(speechControl, gridRect(scale, snapshot.speech.rect));
        const speechX = gridX(scale, snapshot.speech.rect.x);
        const speechY = gridY(scale, snapshot.speech.rect.y);
        speech.element.style.transform = `translate(${-speechX}px,${-speechY}px)`;
      }
      speech.place(scale);
      for (const [id, control] of selections) {
        control.place(scale, motion(id));
      }
    },
    ready: Promise.all([
      sections.ready,
      speech.ready,
      ...(slot === undefined ? [] : [slot.ready]),
      ...(gearBadge === undefined ? [] : [gearBadge.ready]),
      ...[...selections.values()].map(({ ready }) => ready),
    ]).then((groups) => [...new Set(groups.flat())]),
    selections,
    slot,
    speech,
    start,
  };
}
