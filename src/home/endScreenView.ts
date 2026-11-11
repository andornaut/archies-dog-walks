import { itemAt } from "@andornaut/game-kit/arrays";
import { fillLine } from "@andornaut/game-kit/lines";
import type { Rect } from "@andornaut/game-kit/rect";
import type { TextFitStyle } from "@andornaut/game-kit/text/textFit";

import { ZONE_PIPS_KEY } from "../assets/spriteKeys.ts";
import { BADGE_STRIP } from "../data/layout.ts";
import { SCREEN_CONFIG } from "../data/screen.ts";
import type { AchievementId, DogId, GameData } from "../data/types.ts";
import { pipTag } from "../hud/hudView.ts";
import { type PanelButton, type PanelText, panelTitle } from "../hud/questionPanelView.ts";
import { walkLength } from "../rules/route.ts";
import type { LastWalk } from "../save/schema.ts";
import { PALETTE } from "../ui/palette.ts";
import { BUTTON_COLOURS } from "../ui/selection.ts";
import { TEXT_SCALE, textOnLines } from "../ui/textFit.ts";
import { celebrationTitle } from "./badgesView.ts";
import type { DetailArt, DetailFramed, DetailMeasure, DetailText } from "./detailCardView.ts";
import {
  END_LAYOUT,
  endBadgeRows,
  endPanelLayout,
  endResultsPlacement,
  grantedQuipLines,
  QUIP_LINES,
  quipCapsTop,
  quipNameX,
  quipTextY,
  sideTotalAmountY,
  sideTotalBand,
} from "./endLayout.ts";
import { type closingLines, type EarningsLine, zonePips } from "./endView.ts";
import { signedShortDollarText } from "./home.ts";
import { MENU_TEXT_FIELDS } from "./menuText.ts";

// The End screen laid out as one view both renderers draw: the canvas's (src/scenes/EndScene.ts)
// and the HTML interface's (src/hud/dom/endScreen.ts). The canvas alone draws the results
// panel, its wells, TOTAL's band and the rule, the faces, the ribbon and the badge strip's panel
// and badges; the view says where. Every rect and text origin is in game pixels.

// What the view measures with beyond a detail card's: a label's width as Phaser bounds it and its
// ink's first and last columns from its left edge, in a font at a scale, and a closing line fitted
// onto up to lines lines in the bubble's room.
export interface EndMeasure extends DetailMeasure {
  readonly fitQuip: (style: TextFitStyle, text: string) => { lines: string[]; scale: number };
  readonly span: (
    font: "body" | "title",
    scale: number,
    text: string,
  ) => { left: number; right: number; width: number };
}

// An owner's row's face in its well: the cheering face hops while badges burst in, unless the
// owner fired the player.
export interface EndFace {
  readonly cheering: boolean;
  readonly dog: DogId;
  readonly fired: boolean;
  readonly x: number;
  readonly y: number;
}

// The results, in the results group's own game pixels: the canvas draws them in a container
// moved down offsetY, and the HTML at the same places moved down as far.
export interface EndResults {
  // The zone pips, and each bubble's tail pointing right at its face.
  readonly art: readonly DetailArt[];
  // TOTAL's band: its outline, fill and the lip under the fill.
  readonly band: ReturnType<typeof sideTotalBand>;
  // Each owner's speech bubble, a ui-quip frame.
  readonly bubbles: readonly Rect[];
  readonly faces: readonly EndFace[];
  // The pips' stand-ins while ui-zone-pips is missing.
  readonly framed: readonly DetailFramed[];
  // Each owner's name under their well, at 1x, its ink centred there.
  readonly names: readonly PanelText[];
  readonly panel: Rect;
  // The tan rule over the first owner's row.
  readonly rule: Rect;
  // The breakdown, the side column and each row's header and closing line.
  readonly texts: readonly DetailText[];
  // The outcome's title in the display lettering, centred across the screen.
  readonly title: { readonly capTop: number; readonly centreX: number; readonly text: string };
  readonly wells: readonly Rect[];
}

// The badges just earned: the panel the canvas draws them in, its rows, its title and their
// names.
export interface EndStrip {
  readonly names: readonly DetailText[];
  readonly panel: Rect;
  readonly rows: number;
  readonly title: readonly PanelText[];
}

export interface EndScreenView {
  // Back to title, Start walk's size, its label on Start walk's caps.
  readonly button: PanelButton;
  readonly offsetY: number;
  readonly results: EndResults;
  readonly strip: EndStrip | undefined;
}

type ClosingLines = ReturnType<typeof closingLines>;

const BREAKDOWN = END_LAYOUT.breakdown;
const SIDE = END_LAYOUT.side;
const QUIPS = END_LAYOUT.quips;
const BUTTON = END_LAYOUT.button;

// The bubble's tail, drawn flipped to point right at the face.
export const QUIP_TAIL_KEY = "ui-quip-tail";

const SCREEN_MIDDLE = SCREEN_CONFIG.width / 2;

// art: ui-zone-pips' frame, for the stand-in boxes.
const PIP = { height: 8, width: 18 } as const;

// Money gained in forest and lost in darkRed, each with its sign, on the cream panel.
function amountColour(amount: number): number {
  if (amount === 0) {
    return PALETTE.plum;
  }
  return amount > 0 ? PALETTE.forest : PALETTE.darkRed;
}

// A one-line 2x text, left-aligned at x or ending at x (right).
function line(
  x: number,
  capTop: number,
  text: string,
  colour: number,
  options: Pick<DetailText, "align" | "font"> = {},
): DetailText {
  return { capTop, colour, lines: [text], x, ...options };
}

// The End screen for walk, its breakdown lines, its owners' closing lines (picked once and shared
// by both renderers) and the badges it earned, whose names in the strip the caller sets out
// (badgeCelebrationNames).
export function endScreenView(
  data: Pick<GameData, "dogs" | "menuText" | "world">,
  measure: EndMeasure,
  input: {
    readonly closing: ClosingLines;
    readonly earned: readonly AchievementId[];
    readonly lines: readonly EarningsLine[];
    readonly stripNames: (strip: Rect, rows: number) => readonly DetailText[];
    readonly walk: LastWalk;
  },
): EndScreenView {
  const { closing, earned, lines, walk } = input;
  const fonts = { body: measure.body, title: measure.title };
  const words = data.menuText.end;
  // The badges wrap onto a second row while the panel, every closing line on one line, has room
  // above it; a closing line wraps onto a second line while the panel has room for it.
  const badgeRows = endBadgeRows(fonts, lines.length, closing, earned.length);
  const wanted = closing.map((quip) => ({
    fired: quip.fired,
    lines: Math.min(QUIP_LINES, measure.fitQuip(textOnLines(QUIP_LINES), quip.text).lines.length),
  }));
  const quipLines = grantedQuipLines(fonts, badgeRows, lines.length, wanted);
  const quipRows = closing.map(({ fired }, i) => ({ fired, lines: itemAt(quipLines, i) }));
  const { panel, rows } = endPanelLayout(fonts, lines.length, quipRows);
  const placement = endResultsPlacement(badgeRows, panel);

  const texts: DetailText[] = [];
  // Each amount in the short form from a thousand dollars, its label clear of it.
  lines.forEach((earning, i) => {
    const y = BREAKDOWN.top + i * BREAKDOWN.pitch;
    const amount = signedShortDollarText(earning.amount);
    texts.push(
      line(BREAKDOWN.amountRight, y, amount, amountColour(earning.amount), { align: "right" }),
      line(BREAKDOWN.label, y, earning.label, PALETTE.plum),
    );
  });

  // The route: a pip a zone, the zones walked of the walk's, then the walk's total under them in
  // the body font beside TOTAL in the title font, their capitals ending on one row, on its band.
  texts.push(line(SIDE.x, BREAKDOWN.top, words.zonesWalked, PALETTE.plum));
  const art: DetailArt[] = [];
  const framed: DetailFramed[] = [];
  const pipsSize = measure.art(ZONE_PIPS_KEY);
  const first = { x: SIDE.x, y: SIDE.pipsY };
  zonePips(walkLength(data), walk).forEach((pip, i) => {
    const x = SIDE.x + i * SIDE.pipPitch;
    const tag = pipTag(data, { state: pip, zone: walk.route[i] ?? null });
    if (pipsSize !== undefined && measure.hasTag(ZONE_PIPS_KEY, tag)) {
      // Each pip whole art pixels along from the first.
      art.push({
        holder: first,
        key: ZONE_PIPS_KEY,
        scale: 1,
        sheet: { tag },
        size: pipsSize,
        x,
        y: SIDE.pipsY,
      });
    } else {
      const colour = pip === "todo" ? PALETTE.grey : PALETTE.forest;
      framed.push({ border: colour, fill: colour, rect: { ...PIP, x, y: SIDE.pipsY } });
    }
  });
  const zones = `${walk.zonesFinished}/${walkLength(data)}`;
  texts.push(line(SIDE.right, SIDE.pipsY, zones, PALETTE.plum, { align: "right" }));
  const total = signedShortDollarText(walk.earnedCents);
  const { band: look } = SIDE;
  texts.push(
    line(SIDE.right, sideTotalAmountY(fonts.body, fonts.title), total, PALETTE[look.text.amount], {
      align: "right",
    }),
    line(SIDE.x, SIDE.totalY, words.total, PALETTE[look.text.label], { font: "title" }),
  );
  const amount = measure.span("body", TEXT_SCALE, total);
  const band = sideTotalBand(fonts.body, fonts.title, SIDE.right - amount.width + amount.right);

  // Each owner's row: their face in its well, their bubble with its tail pointing at it, their
  // name under the well, and a fired row's header over its closing line.
  const celebrating = earned.length > 0;
  const bubbles: Rect[] = [];
  const faces: EndFace[] = [];
  const names: PanelText[] = [];
  const wells: Rect[] = [];
  const tailSize = measure.art(QUIP_TAIL_KEY);
  closing.forEach((quip, i) => {
    const { bubble: bubbleHeight, top: row } = itemAt(rows, i);
    const { well } = QUIPS;
    wells.push({ height: well.size, width: well.size, x: well.x, y: row + well.y });
    faces.push({
      cheering: celebrating && !quip.fired,
      dog: quip.dog,
      fired: quip.fired,
      x: QUIPS.face.x,
      y: row + QUIPS.face.y,
    });
    const bubble = { height: bubbleHeight, width: QUIPS.bubble.width, x: QUIPS.bubble.x, y: row };
    bubbles.push(bubble);
    if (tailSize !== undefined) {
      art.push({
        flipX: true,
        holder: { x: bubble.x, y: bubble.y },
        key: QUIP_TAIL_KEY,
        right: bubble,
        scale: 1,
        size: tailSize,
        x: QUIPS.tail.x,
        y: row + QUIPS.tail.y,
      });
    }
    const owner = data.dogs[quip.dog].owner.name;
    const nameInk = measure.span("body", 1, owner);
    const inkWidth = nameInk.right - nameInk.left;
    names.push({
      capTop: row + QUIPS.nameY,
      centre: "ink",
      centreX: quipNameX(inkWidth) + inkWidth / 2,
      colour: PALETTE.rust,
      font: "body",
      line: 0,
      scale: 1,
      text: owner,
    });
    const quipRow = itemAt(quipRows, i);
    if (quip.fired) {
      const header = fillLine(MENU_TEXT_FIELDS.end, words, "firedYou", { owner });
      texts.push(
        line(QUIPS.textX, row + quipCapsTop(fonts, quipRow), header, PALETTE.darkRed, {
          font: "title",
        }),
      );
    }
    const fitted = measure.fitQuip(textOnLines(quipRow.lines), quip.text);
    texts.push({
      capTop: row + quipTextY(fonts, quipRow),
      colour: PALETTE.plum,
      lines: fitted.lines,
      scale: fitted.scale,
      x: QUIPS.textX,
    });
  });
  const quipsTop = rows[0]?.top ?? 0;
  const { rule } = QUIPS;

  const strip = celebrating
    ? {
        names: input.stripNames(placement.strip, badgeRows),
        panel: placement.strip,
        rows: badgeRows,
        title: panelTitle(
          measure,
          placement.strip,
          placement.strip.y + BADGE_STRIP.titleY,
          celebrationTitle(data, earned.length),
          false,
        ),
      }
    : undefined;

  const { buttonLabel } = END_LAYOUT;
  const button: PanelButton = {
    hit: BUTTON,
    label: words.headHome,
    primary: true,
    rect: BUTTON,
    text: {
      capTop: BUTTON.y + buttonLabel.readyY,
      centre: "advance",
      centreX: BUTTON.x + BUTTON.width / 2,
      colour: PALETTE[BUTTON_COLOURS.primary.label],
      font: "title",
      line: 0,
      scale: buttonLabel.scale,
      text: words.headHome,
    },
  };

  return {
    button,
    offsetY: placement.offsetY,
    results: {
      art,
      band,
      bubbles,
      faces,
      framed,
      names,
      panel,
      rule: { height: 1, width: rule.width, x: rule.x, y: quipsTop - rule.above },
      texts,
      title: {
        capTop: END_LAYOUT.titleY,
        centreX: SCREEN_MIDDLE,
        text: words.titles[walk.outcome],
      },
      wells,
    },
    strip,
  };
}
