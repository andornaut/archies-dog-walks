import { insetRect, type Rect } from "@andornaut/game-kit/rect";
import type { GameObjects, Scene } from "phaser";

import { gameData } from "../data/index.ts";
import type { DetailCard, DetailPicture } from "../home/detail.ts";
import {
  DETAIL_WELL_KEY,
  type DetailArt,
  type DetailCardView,
  detailCardView,
  type DetailText,
} from "../home/detailCardView.ts";
import { cardTitleRow, HOME_LAYOUT } from "../home/homeLayout.ts";
import { barTitleLeft, barTitleRoom } from "../ui/barTitle.ts";
import { type CloseControl, closeControl } from "../ui/closeControl.ts";
import { hasPill } from "../ui/namePills.ts";
import { PALETTE } from "../ui/palette.ts";
import { addModalShade, drawFramedRect, drawRing } from "../ui/phaser/draw.ts";
import {
  addPixelText,
  inkSpan,
  pixelFontMetrics,
  placePixelText,
  setPixelText,
  withProbe,
} from "../ui/phaser/pixelText.ts";
import { AFFORD_OUTSET } from "../ui/selection.ts";
import { TEXT_SCALE } from "../ui/textFit.ts";
import { addNamePills } from "./effectNameColours.ts";
import { canvasDetailMeasure, measureModalTitle } from "./modalMeasure.ts";
import { playFirstTag } from "./sprites.ts";
import {
  addCloseButton,
  addLoopingFrame,
  addNineSlice,
  type IconButton,
  selectOuter,
  type SliceKey,
} from "./uiKit.ts";

// The home screen's drawing beyond its tiles: the gold outline on the Pet shop while the
// player can afford something in it, and the detail card that opens over the screen. Positions
// inside a piece are the art's, from the style guide.

// The ui-afford outline 2px outside rect, playing its glint tag, or holding its first frame
// with reduced motion; while the art is missing, an amber line in a plum keyline. A selected
// item never takes it: ui-select wins.
export function addAffordFrame(
  scene: Scene,
  parent: GameObjects.Container,
  rect: Rect,
  reducedMotion: boolean,
): void {
  const outer = selectOuter(rect, AFFORD_OUTSET);
  addLoopingFrame(scene, parent, { key: "ui-afford", outer, tag: "glint" }, reducedMotion, (g) => {
    drawRing(g, PALETTE.plum, outer, 1);
    drawRing(g, PALETTE.amber, insetRect(1, outer), 1);
  });
}

const CARD = HOME_LAYOUT.card;

// Every modal card's frame, in one layout: the ui-detail-card with no title bar, its title in
// plum on the card's title row (addCardTitle), and, for a card that closes, the close control in
// its top-right corner. close: whether that control shows pressed, or undefined for a card
// without one.
export function addModalCard(
  scene: Scene,
  parent: GameObjects.Container,
  card: Rect,
  title: string,
  close: { readonly pressed: boolean } | undefined,
): void {
  addDetailCard(scene, parent, card);
  const row = cardTitleRow(card);
  const label = addCardTitle(scene, card, title, close !== undefined, row.y + CARD.titleRow.titleY);
  parent.add(label);
  if (close !== undefined) {
    addCardClose(scene, parent, card, close.pressed);
  }
}

// A modal card's title, on any card's background: plum 2x title text, its capitals at capTop,
// each line's ink centred across the card with symmetric clearance for its close target.
export function addCardTitle(
  scene: Scene,
  card: Rect,
  title: string,
  closes: boolean,
  capTop: number,
): GameObjects.Container {
  const row = cardTitleRow(card);
  const close = closes ? closeControl(card) : undefined;
  const { linePitch, lines } = measureModalTitle(scene, barTitleRoom(row, close), title);
  const labels = scene.add.container(0, 0);
  lines.forEach((line, i) =>
    labels.add(titleOnRow(scene, row, close, line, capTop + i * linePitch)),
  );
  return labels;
}

function titleOnRow(
  scene: Scene,
  row: Rect,
  close: CloseControl | undefined,
  title: string,
  capTop: number,
): GameObjects.BitmapText {
  const label = addPixelText(scene, 0, 0, title, {
    colour: PALETTE.plum,
    font: "title",
    scale: TEXT_SCALE,
  });
  const ink = inkSpan(label);
  const x = barTitleLeft(row, close, ink.right - ink.left);
  placePixelText(label, x, capTop);
  return label;
}

// A framed page keeps its existing header clear of its tabs and scrolling content.
export function addFramedPageCard(
  scene: Scene,
  parent: GameObjects.Container,
  header: { capTop: number; close: CloseControl; row: Rect },
  card: Rect,
  title: string,
  pressed: boolean,
): void {
  addDetailCard(scene, parent, card);
  parent.add(titleOnRow(scene, header.row, header.close, title, header.capTop));
  addCloseButton(scene, parent, header.close, pressed);
}

// A modal card's close control in its top-right corner (closeControl), on any card's background.
export function addCardClose(
  scene: Scene,
  parent: GameObjects.Container,
  card: Rect,
  pressed: boolean,
): IconButton {
  return addCloseButton(scene, parent, closeControl(card), pressed);
}

// A nine-slice in parent, or the rect framed in code while its art is missing.
function addFramedSlice(
  scene: Scene,
  parent: GameObjects.Container,
  key: SliceKey,
  rect: Rect,
  colours: { border: number; fill: number },
): void {
  const slice = addNineSlice(scene, key, rect);
  if (slice !== undefined) {
    parent.add(slice);
    return;
  }
  const g = scene.add.graphics();
  drawFramedRect(g, colours, rect);
  parent.add(g);
}

// The ui-detail-card over card, or a framed cream card while the art is missing. The detail
// cards, the shop, settings and the purchase confirm all wear it (addModalCard).
function addDetailCard(scene: Scene, parent: GameObjects.Container, card: Rect): void {
  addFramedSlice(scene, parent, "ui-detail-card", card, {
    border: PALETTE.darkBrown,
    fill: PALETTE.cream,
  });
}

// The detail card's well the picture sits in.
export { DETAIL_WELL_KEY };

// The detail card's well at rect's top-left, or a framed grey box while its art is missing.
export function addDetailWell(scene: Scene, parent: GameObjects.Container, rect: Rect): void {
  if (scene.textures.exists(DETAIL_WELL_KEY)) {
    parent.add(scene.add.image(rect.x, rect.y, DETAIL_WELL_KEY).setOrigin(0));
    return;
  }
  const g = scene.add.graphics();
  drawFramedRect(g, { border: PALETTE.plum, fill: PALETTE.grey }, rect);
  parent.add(g);
}

// A detail card's art: an image, or a sheet's tag's first frame, or its default frame.
function addDetailArt(scene: Scene, art: DetailArt): GameObjects.Image {
  const { key, scale, sheet, x, y } = art;
  if (sheet?.tag === undefined) {
    return scene.add.image(x, y, key).setOrigin(0).setScale(scale);
  }
  const sprite = scene.add.sprite(x, y, key).setOrigin(0).setScale(scale);
  playFirstTag(sprite, key, [sheet.tag]);
  return sprite;
}

// The detail card's view, measured on scene's fonts and art.
export function detailView(
  scene: Scene,
  dim: Rect,
  detail: Parameters<typeof detailCardView>[3],
): DetailCardView {
  return detailCardView(gameData, canvasDetailMeasure(scene), dim, detail);
}

// The detail card's framed boxes, art and text in parent, as its view lays them out.
export function addDetailContent(
  scene: Scene,
  parent: GameObjects.Container,
  view: DetailCardView,
): void {
  for (const box of view.framed) {
    const g = scene.add.graphics();
    drawFramedRect(g, { border: box.border, fill: box.fill }, box.rect);
    parent.add(g);
  }
  parent.add(view.art.map((art) => addDetailArt(scene, art)));
  for (const text of view.texts) {
    addDetailText(scene, parent, text);
  }
}

// A view's text as labels, in parent when given: left-aligned with its pen at x, or each line
// centred there as a label with originX 0.5, each effect's name in its pill, and each span in a
// colour of its own drawn again over its place in the line, measured from the line's start
// through the span, since a trailing space has no width.
export function addDetailText(
  scene: Scene,
  parent: GameObjects.Container | undefined,
  text: DetailText,
): GameObjects.BitmapText[] {
  const scale = text.scale ?? TEXT_SCALE;
  const centred = text.align === "centre";
  const style = { colour: text.colour, scale, ...(centred ? { originX: 0.5 } : {}) };
  const pitch = pixelFontMetrics(scene, "body").lineHeight * scale;
  const labels = centred
    ? text.lines.map((line, i) => addPixelText(scene, text.x, text.capTop + i * pitch, line, style))
    : [addPixelText(scene, text.x, text.capTop, text.lines.join("\n"), style)];
  const spans = text.spans ?? [];
  const line = text.lines[0] ?? "";
  withProbe(scene, style, (probe) => {
    const widthOf = (shown: string) => {
      setPixelText(probe, shown);
      return probe.width;
    };
    const left = Math.round(text.x) - (centred ? widthOf(line) / 2 : 0);
    let before = "";
    for (const span of spans) {
      if (span.colour !== text.colour) {
        const x = left + widthOf(before + span.text) - widthOf(span.text);
        labels.push(
          addPixelText(scene, x, text.capTop, span.text, {
            ...style,
            colour: span.colour,
            originX: 0,
          }),
        );
      }
      before += span.text;
    }
  });
  parent?.add(labels);
  if (text.lines.some(hasPill)) {
    addNamePills(labels);
  }
  return labels;
}

// A held dog's, walker's or gear item's detail card over a dim layer, laid out by its view
// (detailCardView). Returns the card's rect, so a tap outside it or on its close control closes
// it. dim is the part of the screen dimmed under it (overlayRegion on a home page).
export function drawDetailCard(
  scene: Scene,
  parent: GameObjects.Container,
  dim: Rect,
  closePressed: boolean,
  card: DetailCard,
  picture: DetailPicture,
  kind: "dog" | "gear" | "walker",
): Rect {
  const view = detailView(scene, dim, { card, kind, picture });
  drawDetailCardView(scene, parent, dim, closePressed, view);
  return view.card.panel;
}

// A detail card's view over a dim layer over dim, its close control shown pressed or not.
export function drawDetailCardView(
  scene: Scene,
  parent: GameObjects.Container,
  dim: Rect,
  closePressed: boolean,
  view: DetailCardView,
): void {
  parent.add(addModalShade(scene, dim));
  addModalCard(scene, parent, view.card.panel, view.title, { pressed: closePressed });
  addDetailContent(scene, parent, view);
}
