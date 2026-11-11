import { fillLine } from "@andornaut/game-kit/lines";
import type { Point, Rect } from "@andornaut/game-kit/rect";

import type { GameData } from "../data/types.ts";
import { type CloseControl, closeControl } from "../ui/closeControl.ts";
import { PALETTE } from "../ui/palette.ts";
import { TEXT_SCALE } from "../ui/textFit.ts";
import { BADGE_STRIP, BADGE_TEXT_COLOURS, type BadgeView } from "./badgesView.ts";
import type { DetailArt, DetailMeasure, DetailText } from "./detailCardView.ts";
import { MENU_TEXT_FIELDS } from "./menuText.ts";
import { MODAL, modalPanelWidth, modalRect } from "./modalLayout.ts";
import type { PageFill } from "./shopPageView.ts";
import { DETAIL_TEXT_WIDTH, detailPanel, detailTextTops, STATS_LAYOUT } from "./statsLayout.ts";

// A badge's card, the one every screen opens on a badge, laid out as one view both renderers
// draw: the canvas's (addBadgeDetail in src/scenes/badges.ts) and the HTML interface's
// (src/hud/dom/badgeCard.ts). Every rect and text origin is in game pixels.

export interface BadgeCardView {
  // The badge at 2x, its earned or locked frame.
  readonly art: readonly DetailArt[];
  readonly close: CloseControl;
  // CONFETTI behind an earned badge at the badge's scale, centred on the badge: playing once, or
  // holding its still frame under reduced motion; undefined for none.
  readonly confetti:
    { readonly at: Point; readonly scale: number; readonly still: boolean } | undefined;
  // The part of the screen dimmed under it.
  readonly dim: Rect;
  // A box in the badge's state's colour while its art is missing.
  readonly fills: readonly PageFill[];
  // The ui-panel the card is.
  readonly panel: Rect;
  // The name, the status, then the goal and the line, each line centred on the card.
  readonly texts: readonly DetailText[];
  readonly title: string;
}

// A one-shot effect's tag, played once, and the frame of it that holds still under reduced
// motion, counted from the tag's first.
export interface BurstEffect {
  readonly key: string;
  readonly stillFrame: number;
  readonly tag: string;
}

export const CONFETTI: BurstEffect = { key: "fx-confetti", stillFrame: 4, tag: "play" };

const DETAIL_TEXT = STATS_LAYOUT.detailText;
const BADGE_SIZE = BADGE_STRIP.badgeSize;
// The badge and its confetti are drawn at 2x, so the burst shows around the bigger badge.
const BADGE_SCALE = 2;

// The card over dim: the badge at 2x with its name, status, goal and line, and the close control
// in its corner. An earned badge bursts with confetti when burst is set, or with reduced motion
// shows a still frame of it.
export function badgeCardView(
  data: Pick<GameData, "menuText">,
  measure: Pick<DetailMeasure, "art" | "body" | "hasTag" | "inkWidth" | "title" | "wrapBody">,
  dim: Rect,
  card: { readonly badge: BadgeView; readonly burst: boolean; readonly reduced: boolean },
): BadgeCardView {
  const { badge, burst, reduced } = card;
  const words = data.menuText.stats;
  const wrap = (text: string) => measure.wrapBody(DETAIL_TEXT_WIDTH, text);
  const goal = wrap(badge.goal);
  const status = `${badge.earned ? words.badgeEarned : words.badgeLocked} (${words.badgeDifficulty[badge.tier]})`;
  const line = wrap(
    fillLine(MENU_TEXT_FIELDS.stats, words, "badgeLine", { line: badge.badgeLine }),
  );
  const fonts = { body: measure.body, title: measure.title };
  const width = modalPanelWidth(
    dim.width - 2 * MODAL.margin,
    Math.max(
      BADGE_SIZE * BADGE_SCALE + 2 * MODAL.pad,
      measure.inkWidth("title", badge.name) + 2 * MODAL.pad,
      ...[status, ...goal, ...line].map((shown) => measure.inkWidth("body", shown) + 2 * MODAL.pad),
    ),
  );
  const panel = modalRect(dim, undefined, {
    height: detailPanel(fonts, goal.length, line.length).height,
    width,
  });
  const tops = detailTextTops(fonts, goal.length);
  const centre = {
    x: Math.round(panel.x + panel.width / 2),
    y: Math.round(panel.y + DETAIL_TEXT.badgeY),
  };
  const tag = badge.earned ? "earned" : "locked";
  const size = measure.art(badge.art);
  const art: DetailArt[] = [];
  const fills: PageFill[] = [];
  const half = (BADGE_SIZE * BADGE_SCALE) / 2;
  if (size !== undefined && measure.hasTag(badge.art, tag)) {
    art.push({
      centre,
      holder: panel,
      key: badge.art,
      scale: BADGE_SCALE,
      sheet: { tag },
      size,
      x: centre.x - (size.width * BADGE_SCALE) / 2,
      y: centre.y - (size.height * BADGE_SCALE) / 2,
    });
  } else {
    fills.push({
      colour: badge.earned ? PALETTE.amber : PALETTE.grey,
      rect: { height: 2 * half, width: 2 * half, x: centre.x - half, y: centre.y - half },
    });
  }
  // An earned badge's card: a plum name and goal, a forest status, a dark brown line.
  const locked = BADGE_TEXT_COLOURS.locked;
  const colours = badge.earned
    ? { goal: PALETTE.plum, line: PALETTE.darkBrown, name: PALETTE.plum, status: PALETTE.forest }
    : {
        goal: PALETTE[locked.goal],
        line: PALETTE[locked.goal],
        name: PALETTE[locked.name],
        status: PALETTE[locked.status],
      };
  const centred = (
    capTop: number,
    lines: readonly string[],
    colour: number,
    font: "body" | "title" = "body",
  ): DetailText => ({
    align: "centre",
    capTop: panel.y + capTop,
    colour,
    font,
    lines,
    scale: TEXT_SCALE,
    x: panel.x + panel.width / 2,
  });
  return {
    art,
    close: closeControl(panel),
    confetti:
      badge.earned && (burst || reduced)
        ? { at: centre, scale: BADGE_SCALE, still: reduced }
        : undefined,
    dim,
    fills,
    panel,
    texts: [
      centred(DETAIL_TEXT.nameY, [badge.name], colours.name, "title"),
      centred(tops.status, [status], colours.status),
      centred(tops.goal, goal, colours.goal),
      centred(tops.line, line, colours.line),
    ],
    title: badge.name,
  };
}
