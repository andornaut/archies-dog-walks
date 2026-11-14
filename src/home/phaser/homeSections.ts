import type { Rect } from "@andornaut/game-kit/rect";
import type { GameObjects, Scene } from "phaser";

import { playTag } from "../../scenes/sprites.ts";
import { addBodyText, addGraphicsIn, addNineSlice } from "../../scenes/uiKit.ts";
import { PALETTE } from "../../ui/palette.ts";
import { drawRing, fillRect } from "../../ui/phaser/draw.ts";
import { HOME_LAYOUT, sectionFill } from "../homeLayout.ts";
import type { Section, SectionId, Sections, SectionState } from "../sections.ts";

interface SectionContext {
  readonly scene: Scene;
  readonly root: GameObjects.Container;
}
const SECTION_IDS: readonly SectionId[] = ["walker", "dogs", "pocket"];
const SECTION_RECTS = HOME_LAYOUT.sections;
const SECTION_FILL_KEYS = HOME_LAYOUT.sectionFillKeys;
const SECTION_FRAME = HOME_LAYOUT.sectionFrame;
const BAND_TEXT = HOME_LAYOUT.bandText;
const HEART_KEY = "ui-heart";

export function renderHomeSections(
  context: SectionContext,
  snapshot: { readonly sections: Sections; readonly bonus: string | null },
): void {
  for (const id of SECTION_IDS) {
    const note = drawSection(context, id, SECTION_RECTS[id], snapshot.sections[id]);
    if (id === "dogs") {
      drawPackBonus(context, SECTION_RECTS[id], note, snapshot.bonus);
    }
  }
  drawSectionFills(context, snapshot.sections);
}

function drawSectionFills(context: SectionContext, sections: Sections): void {
  const { root, scene } = context;
  for (const id of SECTION_IDS) {
    const key = SECTION_FILL_KEYS[id];
    const rect = sectionFill(SECTION_RECTS[id]);
    if (sections[id].state === "complete") {
      fillRect(addGraphicsIn(scene, root), PALETTE[HOME_LAYOUT.sectionSelectedFill], rect);
    } else if (scene.textures.exists(key)) {
      root.add(scene.add.tileSprite(rect.x, rect.y, rect.width, rect.height, key).setOrigin(0));
    } else {
      fillRect(addGraphicsIn(scene, root), PALETTE[HOME_LAYOUT.sectionLooks[id].fill], rect);
    }
  }
}

function drawPackBonus(
  context: SectionContext,
  rect: Rect,
  note: GameObjects.BitmapText | null,
  line: string | null,
): void {
  const { root, scene } = context;
  if (line === null) {
    return;
  }
  const { countGap, gap, heartInk, rise, scale } = HOME_LAYOUT.bonus;
  const y = rect.y + BAND_TEXT.y;
  const countLeft = note === null ? rect.x + rect.width - BAND_TEXT.inset : note.x - note.width;
  const heartLeft = countLeft - countGap - heartInk * scale;
  if (scene.textures.exists(HEART_KEY)) {
    const heart = scene.add
      .sprite(heartLeft, y - rise, HEART_KEY)
      .setOrigin(0)
      .setScale(scale);
    playTag(heart, HEART_KEY, "full");
    root.add(heart);
  }
  addBodyText(scene, root, { x: heartLeft - gap, y }, line, {
    colour: PALETTE.ink,
    font: "title",
    originX: 1,
  });
}

function drawSection(
  context: SectionContext,
  id: SectionId,
  rect: Rect,
  section: Section,
): GameObjects.BitmapText | null {
  const { root, scene } = context;
  const tag = section.state === "complete" ? "complete" : HOME_LAYOUT.sectionLooks[id].neutralTag;
  const frame = addNineSlice(scene, "ui-section", rect, tag);
  if (frame === undefined) {
    drawSectionFrame(context, id, rect, section.state);
  } else {
    root.add(frame);
  }
  const lit = section.state === "complete";
  const y = rect.y + BAND_TEXT.y;
  addBodyText(scene, root, { x: rect.x + BAND_TEXT.inset, y }, section.heading, {
    colour: lit ? PALETTE.ink : PALETTE[HOME_LAYOUT.sectionLooks[id].heading],
    font: "title",
  });
  const right = rect.x + rect.width - BAND_TEXT.inset;
  if (section.note === "") {
    return null;
  }
  return addBodyText(scene, root, { x: right, y }, section.note, {
    colour: lit ? PALETTE.ink : PALETTE[HOME_LAYOUT.sectionLooks[id].note],
    font: "title",
    originX: 1,
  });
}

function drawSectionFrame(
  context: SectionContext,
  id: SectionId,
  rect: Rect,
  state: SectionState,
): void {
  const { root, scene } = context;
  const g = addGraphicsIn(scene, root);
  const lit = state === "complete";
  const { band, edge } = SECTION_FRAME;
  drawRing(g, PALETTE.plum, rect, 1);
  const width = rect.width - edge * 2;
  fillRect(g, lit ? PALETTE.amber : PALETTE[HOME_LAYOUT.sectionLooks[id].neutral], {
    height: band,
    width,
    x: rect.x + edge,
    y: rect.y + edge,
  });
  fillRect(g, PALETTE.plum, {
    height: 1,
    width,
    x: rect.x + edge,
    y: rect.y + edge + band,
  });
}
