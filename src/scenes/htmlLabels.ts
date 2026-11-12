import { focusTarget } from "@andornaut/game-kit/web/ui/dom/focusModality";
import { Core, type GameObjects, type Scene, Scenes } from "phaser";

import { SCREEN_CONFIG } from "../data/screen.ts";
import { pillKind } from "../hud/effectNames.ts";
import { type DomLabel, drawLabel, LABEL_ALIGN_DATA } from "../ui/dom/labelBlock.ts";
import { dimDrawn, setRampDimmed } from "../ui/dom/rampDim.ts";
import { deviceX, deviceY, gridTransform } from "../ui/domScale.ts";
import { PALETTE } from "../ui/palette.ts";
import { displayBitmapFont } from "../ui/phaser/displayText.ts";
import {
  GREY_PILL,
  type LabelNamePills,
  NAME_PILLS_DATA,
  pillColours,
} from "./effectNameColours.ts";
import { htmlPanelPlace } from "./questionPanel.ts";

// A scene's pixel text drawn in HTML over the canvas, where the canvas lays it out: each label
// in the body or title font, and its name pills, while the canvas draws the scene's art and takes
// its presses. The labels stay the scene's, which places, shows, hides, tints and moves them as
// ever (a refusal's shake and flash, a held card's enlarging); before each frame the HTML follows
// what changed, and the scene's camera draws them no more. The display lettering draws in its web
// font in the colour its bitmap font bakes in, both of whose variants share their glyphs.

// The fonts the HTML draws, by the bitmap fonts' keys in Phaser's cache, and the colour a
// display variant draws in, untinted on the canvas.
export const LABEL_FONTS: Readonly<
  Record<string, { readonly colour?: number; readonly font: DomLabel["font"] }>
> = {
  "font-body": { font: "body" },
  "font-display": { colour: PALETTE.yellow, font: "display" },
  "font-display-cream": { colour: PALETTE.cream, font: "display" },
  "font-title": { font: "title" },
};

export interface HtmlLabels {
  destroy(): void;
  // Draws the labels palette-dimmed under the pause menu (dimUnderPause in
  // src/scenes/questionPanel.ts), as the canvas dims the view under it, or as they were.
  setDimmed(dimmed: boolean): void;
  // While the scene is paused, whether the labels show anyway, under the pause menu; they take
  // no presses either way.
  setInert(inert: boolean): void;
  setShown(shown: boolean): void;
}

interface Mirrored {
  readonly element: HTMLElement;
  key: string;
}

// The label's place in the scene: its top-left corner through its containers, and whether it
// and every container round it show.
function placed(label: GameObjects.BitmapText): { shown: boolean; x: number; y: number } {
  let x = label.x - label.displayOriginX * label.scaleX;
  let y = label.y - label.displayOriginY * label.scaleY;
  let shown = label.visible && label.alpha > 0;
  for (let parent = label.parentContainer; parent !== null; parent = parent.parentContainer) {
    x += parent.x;
    y += parent.y;
    shown &&= parent.visible && parent.alpha > 0;
  }
  return { shown, x, y };
}

// The label as the HTML draws it: its lines, each from where Phaser starts its pen.
export function domLabel(
  label: GameObjects.BitmapText,
  face: NonNullable<(typeof LABEL_FONTS)[string]>,
  at: { x: number; y: number },
): DomLabel {
  const { characters, wrappedText } = label.getTextBounds(false);
  const text = label.maxWidth > 0 && wrappedText !== "" ? wrappedText : label.text;
  const pills = label.getData(NAME_PILLS_DATA) as LabelNamePills | undefined;
  // Phaser's align: 1 centres a block's lines on its widest, 2 sets them to its right. A label
  // its scene places about its middle itself says so (LABEL_ALIGN_DATA).
  const set = label.getData(LABEL_ALIGN_DATA) as DomLabel["align"] | undefined;
  const align =
    set ??
    (label.originX === 0.5 || label.align === 1
      ? "centre"
      : label.originX === 1 || label.align === 2
        ? "end"
        : "start");
  return {
    align,
    colour: face.colour ?? label.tintTopLeft,
    font: face.font,
    lines: text.split("\n").map((line, i) => {
      const first = characters.find((char) => char.line === i);
      return { pen: first === undefined ? 0 : first.x - first.glyph.xOffset, text: line };
    }),
    pills: pills?.grey === true ? "grey" : "colour",
    scale: label.scaleX,
    x: at.x,
    y: at.y,
  };
}

// Every bitmap text in list, through its containers, in display order.
function labelsIn(list: readonly GameObjects.GameObject[]): GameObjects.BitmapText[] {
  return list.flatMap((part) =>
    part.type === "BitmapText"
      ? [part as GameObjects.BitmapText]
      : part.type === "Container"
        ? labelsIn((part as GameObjects.Container).list)
        : [],
  );
}

// scene's labels in HTML until the scene shuts down: shown while the scene runs and shows, and
// hidden while it is paused or hidden (the walk's cards under the pause menu). With a title, a
// dialog it names for a screen reader, focused as it shows; with none, lettering another dialog
// names (a celebration's headline), which a screen reader skips. Returns undefined where the
// canvas must draw them: the page's switch is off, or its fonts are not ready.
export function addHtmlLabels(scene: Scene, title: string | undefined): HtmlLabels | undefined {
  const place = htmlPanelPlace(scene);
  const display = displayBitmapFont(scene);
  if (place === undefined) {
    return undefined;
  }
  const fonts = { ...place.fonts, ...(display === undefined ? {} : { display }) };
  const { layer } = place;
  const doc = layer.element.ownerDocument;
  const dialog = doc.createElement("div");
  dialog.className = "adw-dialog adw-passive";
  if (title === undefined) {
    dialog.setAttribute("aria-hidden", "true");
  } else {
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-label", title);
    dialog.tabIndex = -1;
  }
  dialog.hidden = true;
  layer.element.append(dialog);

  const mirrored = new Map<GameObjects.BitmapText, Mirrored>();
  // Shown while the scene is paused, under the pause menu, and drawn dimmed there.
  let shownPaused = false;
  let dimmed = false;
  const camera = scene.cameras.main;
  let placedAt = "";
  const sync = () => {
    const scale = layer.scale();
    const hidden = !scene.sys.isVisible() || (!scene.sys.isActive() && !shownPaused);
    if (hidden !== dialog.hidden) {
      dialog.hidden = hidden;
      // Focus starts on the dialog itself as it shows, as on every HTML panel, with a ring only
      // after keyboard input.
      if (!hidden && title !== undefined) {
        focusTarget(dialog);
      } else if (dialog.contains(doc.activeElement)) {
        (doc.activeElement as HTMLElement).blur();
      }
    }
    const frame = [scale.dpr, scale.unit, scale.origin.x, scale.origin.y].join();
    if (frame !== placedAt) {
      placedAt = frame;
      // The screen's root in device pixels on the device grid.
      dialog.style.width = `${deviceX(scale, SCREEN_CONFIG.width)}px`;
      dialog.style.height = `${deviceY(scale, SCREEN_CONFIG.height)}px`;
      dialog.style.transform = gridTransform(scale);
    }
    const seen = new Set<GameObjects.BitmapText>();
    for (const label of labelsIn(scene.children.list)) {
      const face = LABEL_FONTS[label.font];
      const bitmap = face === undefined ? undefined : fonts[face.font];
      if (face === undefined || bitmap === undefined || !label.active) {
        continue;
      }
      seen.add(label);
      let entry = mirrored.get(label);
      if (entry === undefined) {
        // The canvas draws it no more, nor its pills.
        camera.ignore(label);
        const pills = label.getData(NAME_PILLS_DATA) as LabelNamePills | undefined;
        if (pills !== undefined) {
          camera.ignore(pills.graphics);
        }
        const element = doc.createElement("p");
        element.className = "adw-lines";
        dialog.append(element);
        entry = { element, key: "" };
        mirrored.set(label, entry);
      }
      const at = placed(label);
      const view = domLabel(label, face, at);
      const key = JSON.stringify([frame, at.shown, view]);
      if (key === entry.key) {
        continue;
      }
      entry.key = key;
      entry.element.hidden = !at.shown;
      drawLabel(
        doc,
        {
          bitmap,
          grey: PALETTE[GREY_PILL],
          pillColours: (index) => {
            const kind = pillKind(index);
            return kind === undefined ? undefined : pillColours(kind);
          },
          scale,
        },
        entry.element,
        view,
      );
      dimDrawn(entry.element, dimmed);
    }
    for (const [label, { element }] of mirrored) {
      if (!seen.has(label)) {
        element.remove();
        mirrored.delete(label);
      }
    }
  };
  sync();
  scene.game.events.on(Core.Events.PRE_RENDER, sync);
  const destroy = () => {
    scene.game.events.off(Core.Events.PRE_RENDER, sync);
    scene.events.off(Scenes.Events.SHUTDOWN, destroy);
    if (dialog.contains(doc.activeElement)) {
      (doc.activeElement as HTMLElement).blur();
    }
    dialog.remove();
  };
  scene.events.once(Scenes.Events.SHUTDOWN, destroy);
  return {
    destroy,
    setDimmed: (next) => {
      dimmed = next;
      setRampDimmed(dialog, next);
    },
    setInert: (inert) => {
      if (!inert) {
        shownPaused = false;
      }
    },
    setShown: (shown) => {
      shownPaused = shown;
      sync();
    },
  };
}
