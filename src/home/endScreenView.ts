import { itemAt } from "@andornaut/game-kit/runtime/arrays";
import { fillLine, wrapWords } from "@andornaut/game-kit/runtime/lines";
import type { Rect } from "@andornaut/game-kit/runtime/rect";
import type { TextFitStyle } from "@andornaut/game-kit/runtime/text/textFit";

import { ownerFaceKey, ZONE_PIPS_KEY } from "../assets/index.ts";
import type { AchievementId, DogId } from "../data/ids.ts";
import { BADGE_STRIP, type GameData, SCREEN_CONFIG } from "../data/index.ts";
import { type OwnerNameLine, signedShortDollarText } from "../presentation/index.ts";
import { walkLength } from "../rules/index.ts";
import type { LastWalk } from "../save/index.ts";
import {
  MODAL,
  modalActionWidth,
  PALETTE,
  type PanelButton,
  panelButton,
  type PanelText,
  TEXT_SCALE,
  textOnLines,
} from "../ui/index.ts";
import { celebrationTitle } from "./badgesView.ts";
import type {
  DetailArt,
  DetailFramed,
  DetailMeasure,
  DetailText,
} from "./details/detailCardView.ts";
import {
  END_LAYOUT,
  endBadgeRows,
  endPanelLayout,
  endResultsPlacement,
  grantedQuipLines,
  QUIP_LINES,
  quipCapsTop,
  quipNameBottom,
  quipNamePlace,
  quipTextY,
  sideTotalAmountY,
  sideTotalBand,
} from "./endLayout.ts";
import { type closingLines, type EarningsLine, pipTag, zonePips } from "./endView.ts";
import { MENU_TEXT_FIELDS } from "./menuText.ts";

// End results and controls in logical game pixels.

// What the view measures with beyond a detail card's: a label's width as Phaser bounds it and its
// ink's first and last columns from its left edge, in a font at a scale, and a closing line fitted
// onto up to lines lines in the bubble's room.
export interface EndMeasure extends DetailMeasure {
  readonly fitQuip: (style: TextFitStyle, text: string) => { lines: string[]; scale: number };
  readonly ownerName: (room: number, name: string) => readonly OwnerNameLine[];
  readonly span: (
    font: "body" | "title",
    scale: number,
    text: string,
  ) => { left: number; right: number; width: number };
}

// An owner's row's face in its well: the cheering face hops while badges burst in, unless the
// owner fired the player.
export interface EndFace {
  readonly key: string;
  readonly cheering: boolean;
  readonly dog: DogId;
  readonly fired: boolean;
  readonly x: number;
  readonly y: number;
}

// The results, in the results group's own game pixels: the canvas draws them in a container
// moved down offsetY, and the HTML at the same places moved down as far.
export interface EndResults {
  // The zone pips.
  readonly art: readonly DetailArt[];
  // TOTAL's band: its outline, fill and the lip under the fill.
  readonly band: ReturnType<typeof sideTotalBand>;
  // Each owner's speech bubble, a ui-quip frame.
  readonly bubbles: readonly Rect[];
  readonly faces: readonly EndFace[];
  // The pips' stand-ins while ui-zone-pips is missing.
  readonly framed: readonly DetailFramed[];
  // Each owner's full-size name, wrapped in its measured column under the well.
  readonly names: readonly PanelText[];
  // Original names preserve semantic spelling independently of visual wrapping.
  readonly ownerNames: readonly string[];
  readonly ownerRows: {
    readonly art: readonly DetailArt[];
    readonly contentHeight: number;
    readonly texts: readonly DetailText[];
    readonly viewport: Rect;
  };
  readonly panel: Rect;
  // The tan rule over the first owner's row.
  readonly rule: Rect;
  // The fixed breakdown and side-column text.
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
  // Back to title, the results screen's main next step: its label's content-sized primary,
  // centred in Start walk's slot (END_LAYOUT.backToTitle). The pages' Back is a separate role.
  readonly backToTitle: PanelButton;
  readonly offsetY: number;
  readonly results: EndResults;
  readonly strip: EndStrip | undefined;
}

type ClosingLines = ReturnType<typeof closingLines>;

const BREAKDOWN = END_LAYOUT.breakdown;
const SIDE = END_LAYOUT.side;
const QUIPS = END_LAYOUT.quips;
// This anchor retains the vertical results clearance; the action measures its own width.
const BACK_TO_TITLE = END_LAYOUT.backToTitle;

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
  const ownerNames = closing.map((quip) =>
    measure.ownerName(QUIPS.name.room, data.dogs[quip.dog].owner.name),
  );
  const owners = closing.map((quip, i) => ({
    fired: quip.fired,
    nameBottom: quipNameBottom(fonts, { fired: quip.fired, lines: 1 }, ownerNames[i]!),
  }));
  const badgeRows = endBadgeRows(fonts, lines.length, owners, earned.length);
  const wanted = closing.map((quip, i) => ({
    ...owners[i]!,
    lines: Math.min(QUIP_LINES, measure.fitQuip(textOnLines(QUIP_LINES), quip.text).lines.length),
  }));
  const quipLines = grantedQuipLines(fonts, badgeRows, lines.length, wanted);
  const quipRows = owners.map((owner, i) => {
    const text = { fired: owner.fired, lines: itemAt(quipLines, i) };
    return { ...text, nameBottom: quipNameBottom(fonts, text, ownerNames[i]!) };
  });
  const layout = endPanelLayout(fonts, lines.length, quipRows);
  const { panel, rows } = layout;
  const placement = endResultsPlacement(badgeRows, layout);

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
  const ownerArt: DetailArt[] = [];
  const ownerTexts: DetailText[] = [];
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
      key: ownerFaceKey(data, quip.dog),
      x: QUIPS.face.x,
      y: row + QUIPS.face.y,
    });
    const bubble = { height: bubbleHeight, width: QUIPS.bubble.width, x: QUIPS.bubble.x, y: row };
    bubbles.push(bubble);
    if (tailSize !== undefined) {
      // Its middle down where the canvas draws it, beside its face, whole art pixels from the
      // bubble's snapped corner, so it stays level with the face at every scale.
      const y = row + QUIPS.tail.y;
      ownerArt.push({
        centre: { x: QUIPS.tail.x + tailSize.width / 2, y: y + tailSize.height / 2 },
        flipX: true,
        holder: { x: bubble.x, y: bubble.y },
        key: QUIP_TAIL_KEY,
        right: bubble,
        scale: 1,
        size: tailSize,
        x: QUIPS.tail.x,
        y,
      });
    }
    const owner = data.dogs[quip.dog].owner.name;
    ownerNames[i]!.forEach((line, j) => {
      const place = quipNamePlace(fonts, itemAt(quipRows, i), line.ink, j);
      names.push({
        capTop: row + place.capTop,
        centre: "ink",
        centreX: place.centreX,
        colour: PALETTE.rust,
        font: "body",
        line: 0,
        scale: TEXT_SCALE,
        text: line.text,
      });
    });
    const quipRow = itemAt(quipRows, i);
    if (quip.fired) {
      const header = fillLine(MENU_TEXT_FIELDS.end, words, "firedYou", { owner });
      ownerTexts.push(
        line(QUIPS.textX, row + quipCapsTop(fonts, quipRow), header, PALETTE.darkRed, {
          font: "title",
        }),
      );
    }
    const fitted = measure.fitQuip(textOnLines(quipRow.lines), quip.text);
    ownerTexts.push({
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
        title: wrapWords(
          (line) => measure.inkWidth("title", line),
          placement.strip.width - 2 * MODAL.pad,
          celebrationTitle(data, earned.length),
        ).map((text, line): PanelText => ({
          capTop:
            placement.strip.y + BADGE_STRIP.titleY + line * measure.title.lineHeight * TEXT_SCALE,
          centre: "ink",
          centreX: placement.strip.x + placement.strip.width / 2,
          colour: PALETTE.plum,
          font: "title",
          line,
          scale: TEXT_SCALE,
          text,
        })),
      }
    : undefined;

  const backWidth = modalActionWidth(measure.inkWidth("title", words.headHome));
  const backToTitle = panelButton(
    measure,
    {
      ...BACK_TO_TITLE,
      width: backWidth,
      x: BACK_TO_TITLE.x + (BACK_TO_TITLE.width - backWidth) / 2,
    },
    true,
    words.headHome,
  );

  return {
    backToTitle,
    offsetY: placement.offsetY,
    results: {
      art,
      band,
      bubbles,
      faces,
      framed,
      names,
      ownerNames: closing.map((quip) => data.dogs[quip.dog].owner.name),
      ownerRows: { ...placement.ownerRows, art: ownerArt, texts: ownerTexts },
      panel: { ...panel, height: placement.panel.height },
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
