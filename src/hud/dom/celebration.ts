import type { Point, Rect } from "@andornaut/game-kit/runtime/rect";
import type { BitmapFont } from "@andornaut/game-kit/runtime/text/bitmapFont";

import { BADGE_STRIP } from "../../data/index.ts";
import { textPart } from "../../home/dom/index.ts";
import { type BadgeView, panelBadgeStrip, stripUnderClose } from "../../home/index.ts";
import {
  boundsAdvance,
  capRows,
  createTextLine,
  type DomPart,
  type DomQuestionPanel,
  type DomQuestionPanelInput,
  framelessView,
  panelFramePart,
  placeText,
  setBox,
  shownText,
  type UiLayer,
} from "../../ui/dom/index.ts";
import {
  artPixel,
  deviceX,
  type DomScale,
  exactDeviceX,
  fontPixel,
  frameRect,
  gridX,
  type PanelText,
  type QuestionPanelView,
  TEXT_SCALE,
  wholeArtPixels,
} from "../../ui/index.ts";
import {
  CELEBRATION_LAYOUT,
  celebrationHeadlineView,
  type CentredRow,
  type DottedRule,
  type ZoneCelebrationView,
} from "../index.ts";
import { confettiPart, type DomBadgeCardInput } from "./badgeCard.ts";
import { artPart, type DomDetailCardInput } from "./detailCard.ts";
import { showQuestionPanel } from "./questionPanel.ts";

// Native celebration surfaces share the scene-owned animation clock and world actor layer.

type Shared = Pick<DomDetailCardInput, "artUrl" | "fonts" | "loadSheet" | "pillColours"> &
  Pick<DomQuestionPanelInput, "closeLabel" | "onPaint" | "toGame">;

const ORIGIN = { x: 0, y: 0 } as const;

// The celebrations' frames take no presses, which go through to the canvas.
const FRAMES = { "ui-panel": "plate", "ui-quip": "quip" } as const;

// The rule's dots, an art pixel each, step art pixels apart, as many as fit between the snapped
// frame's sides inset art pixels in, centred there, on the frame's art-pixel grid.
function rulePart(doc: Document, frame: Rect, rule: DottedRule): DomPart {
  const element = doc.createElement("div");
  element.className = "adw-rule";
  return {
    element,
    place: (scale) => {
      const pixel = artPixel(scale);
      const box = frameRect(scale, frame);
      const room = box.width / pixel - 2 * rule.inset;
      const dots = Math.max(1, Math.floor((room - 1) / rule.step) + 1);
      const spare = room - 1 - (dots - 1) * rule.step;
      element.style.setProperty("--adw-step", `${rule.step * pixel}px`);
      setBox(element, {
        height: pixel,
        left: box.left + (rule.inset + Math.floor(spare / 2)) * pixel,
        top: box.top + (rule.y - frame.y) * pixel,
        width: ((dots - 1) * rule.step + 1) * pixel,
      });
    },
  };
}

// An info line: its icons and runs of text side by side, each gap art pixels after the one
// before, the whole centred on its centre x in the widths the HTML draws them, its start on the
// art pixel nearest where that puts it. Each icon's corner is on the art-pixel grid, rounded to
// whole art pixels where the text before it is not.
function rowPart(doc: Document, input: Shared, row: CentredRow): DomPart[] {
  const { body } = input.fonts;
  // Each item's device left at a scale, from the row's.
  const lefts = (scale: DomScale): number[] => {
    const pixel = artPixel(scale);
    const widths = row.items.map((item) =>
      "art" in item
        ? item.art.size.width * item.art.scale * pixel
        : boundsAdvance(body, shownText("body", item.text.lines[0] ?? "")) *
          fontPixel(scale, item.text.scale ?? TEXT_SCALE),
    );
    const total = row.items.reduce((sum, item, i) => sum + item.gap * pixel + (widths[i] ?? 0), 0);
    let left = wholeArtPixels(scale, exactDeviceX(scale, row.centreX) - total / 2);
    return row.items.map((item, i) => {
      left += item.gap * pixel;
      const at = "art" in item ? wholeArtPixels(scale, left) : left;
      left += widths[i] ?? 0;
      return at;
    });
  };
  return row.items.map((item, i) => {
    // From where each part places itself: art its corner on the grid, text its pen's column.
    const shift = (scale: DomScale) =>
      (lefts(scale)[i] ?? 0) -
      ("art" in item ? gridX(scale, item.art.x) : deviceX(scale, item.text.x));
    return "art" in item
      ? artPart(doc, input, item.art, shift)
      : textPart(doc, input, item.text, shift);
  });
}

// Native headline, plate or bubble and action; the scene retains the world celebration actors.
export function showZoneCelebration(
  layer: UiLayer,
  input: Shared & {
    headline?: { font: BitmapFont; text: { title: string; subtitle: string } };
    label: string;
    press: () => void;
    view: ZoneCelebrationView;
  },
): DomQuestionPanel {
  const doc = layer.element.ownerDocument;
  const { view } = input;
  const parts = [
    ...(input.headline === undefined
      ? []
      : zoneHeadlineParts(doc, input.headline.font, input.headline.text)),
    panelFramePart(doc, FRAMES[view.frame.key], view.frame.rect),
    ...(view.rule === undefined ? [] : [rulePart(doc, view.frame.rect, view.rule)]),
    ...view.art.map((art) => artPart(doc, input, art)),
    ...view.texts.map((text) => textPart(doc, input, text)),
    ...view.rows.flatMap((row) => rowPart(doc, input, row)),
  ];
  return showQuestionPanel(layer, {
    close: null,
    closeLabel: input.closeLabel,
    fonts: input.fonts,
    label: input.label,
    ...(input.onPaint === undefined ? {} : { onPaint: input.onPaint }),
    numberKeys: false,
    parts,
    presses: [input.press],
    toGame: input.toGame,
    view: framelessView(view.frame.rect, {
      buttons: [view.button],
      covered: [view.frame.rect, view.button.hit],
    }),
  });
}

// What a badge celebration draws in HTML over the panel the canvas draws: its title, the badges'
// names, the close control in its corner and Nice! under it.
export interface BadgeCelebrationView {
  readonly button: QuestionPanelView["buttons"][number];
  readonly names: readonly Parameters<typeof textPart>[2][];
  readonly panel: Rect;
  readonly title: readonly PanelText[];
  readonly titleExtraHeight?: number;
}

export interface BadgeStripParts {
  readonly parts: readonly DomPart[];
  burst(index: number): void;
  destroy(): void;
  setPop(index: number, scale: number): void;
}

// The scene owns its existing pop tweens and delayed burst callbacks; parts only render their values.
export function badgeStripParts(
  doc: Document,
  input: Shared & Pick<DomBadgeCardInput, "everyFrame" | "now">,
  view: {
    readonly badges: readonly BadgeView[];
    readonly closes: boolean;
    readonly panel: Rect;
    readonly reduced: boolean;
    readonly rows: number;
    readonly titleExtraHeight?: number;
  },
): BadgeStripParts {
  const rect = view.closes ? stripUnderClose(view.panel, view.titleExtraHeight) : view.panel;
  const strip = panelBadgeStrip(rect, view.rows, view.badges.length);
  const badges = view.badges.flatMap((badge, i) => {
    const slot = strip.slots[i];
    if (slot === undefined) {
      return [];
    }
    const centre: Point = { x: slot.centreX, y: rect.y + slot.top + BADGE_STRIP.badgeSize / 2 };
    const picture = artPart(doc, input, {
      centre,
      holder: rect,
      key: badge.art,
      scale: 1,
      sheet: { tag: badge.earned ? "earned" : "locked" },
      size: { height: BADGE_STRIP.badgeSize, width: BADGE_STRIP.badgeSize },
      x: centre.x,
      y: centre.y,
    });
    picture.element.style.transformOrigin = "center";
    const confetti = confettiPart(
      doc,
      input,
      rect,
      { at: centre, scale: 1, still: view.reduced },
      Number.POSITIVE_INFINITY,
    );
    return [{ confetti, picture }];
  });
  return {
    burst: (index) => badges[index]?.confetti.start(),
    destroy: () => {
      for (const badge of badges) {
        badge.confetti.stop();
      }
    },
    parts: [
      panelFramePart(doc, "plate", view.panel),
      ...badges.flatMap(({ confetti, picture }) => [confetti, picture]),
    ],
    setPop: (index, scale) => {
      const badge = badges[index];
      if (badge !== undefined) {
        badge.picture.element.style.transform = `scale(${scale})`;
      }
    },
  };
}

export function zoneHeadlineParts(
  doc: Document,
  font: BitmapFont,
  text: { readonly title: string; readonly subtitle: string },
): DomPart[] {
  return celebrationHeadlineView(font, text).map((line) => {
    const top = Math.min(
      ...[...line.text].flatMap((char) => {
        const glyph = font.glyphs.get(char);
        return glyph !== undefined && glyph.width > 0 ? [glyph.yOffset] : [];
      }),
    );
    const placed = {
      capTop: line.inkTop + (capRows(font, "display") - top) * line.scale,
      centre: "ink",
      centreX: CELEBRATION_LAYOUT.centreX,
      colour: line.colour,
      font: "display",
      scale: line.scale,
      text: line.text,
    } as const;
    const element = createTextLine(doc, placed);
    element.setAttribute("aria-hidden", "true");
    return { element, place: (scale) => placeText(font, scale, ORIGIN, element, placed) };
  });
}
