import { Core, type GameObjects, type Scene, Scenes } from "phaser";

import { SCREEN_CONFIG } from "../data/screen.ts";
import { pillKind } from "../hud/effectNames.ts";
import { type DomLabel, drawLabel } from "../ui/dom/labelBlock.ts";
import { deviceX, deviceY, gridTransform } from "../ui/domScale.ts";
import { PALETTE } from "../ui/palette.ts";
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
// what changed, and the scene's camera draws them no more. Labels in another font, such as the
// display font's art lettering, stay on the canvas.

// The bitmap fonts the HTML draws, by their keys in Phaser's cache.
const FONTS = { "font-body": "body", "font-title": "title" } as const;

export interface HtmlLabels {
  destroy(): void;
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
function domLabel(
  label: GameObjects.BitmapText,
  font: DomLabel["font"],
  at: { x: number; y: number },
): DomLabel {
  const { characters, wrappedText } = label.getTextBounds(false);
  const text = label.maxWidth > 0 && wrappedText !== "" ? wrappedText : label.text;
  const pills = label.getData(NAME_PILLS_DATA) as LabelNamePills | undefined;
  return {
    colour: label.tintTopLeft,
    font,
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

// scene's labels in HTML, named title for a screen reader, until the scene shuts down: shown
// while the scene runs and shows, and hidden while it is paused or hidden (the walk's cards under
// the pause menu). Returns undefined where the canvas must draw them: the page's switch is off,
// or its fonts are not ready.
export function addHtmlLabels(scene: Scene, title: string): HtmlLabels | undefined {
  const place = htmlPanelPlace(scene);
  if (place === undefined) {
    return undefined;
  }
  const { layer } = place;
  const doc = layer.element.ownerDocument;
  const dialog = doc.createElement("div");
  dialog.className = "adw-dialog adw-passive";
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-label", title);
  dialog.tabIndex = -1;
  dialog.hidden = true;
  layer.element.append(dialog);

  const mirrored = new Map<GameObjects.BitmapText, Mirrored>();
  const camera = scene.cameras.main;
  let placedAt = "";
  const sync = () => {
    const scale = layer.scale();
    const hidden = !scene.sys.isActive() || !scene.sys.isVisible();
    if (hidden !== dialog.hidden) {
      dialog.hidden = hidden;
      // Focus starts on the dialog itself as it shows, as on every HTML panel.
      if (!hidden) {
        dialog.focus({ preventScroll: true });
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
      const font = FONTS[label.font as keyof typeof FONTS] as DomLabel["font"] | undefined;
      const bitmap = font === undefined ? undefined : place.fonts[font];
      if (font === undefined || bitmap === undefined || !label.active) {
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
      const view = domLabel(label, font, at);
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
  return { destroy };
}
