// The Cheats modal laid out as it stands, free of Phaser and the DOM: its rows in the spec's order
// (gameplay/cheats.md), each row's place in the scrolling body, and what a press on it does. The
// HTML interface (src/hud/dom/cheats.ts) draws it. Every rect and text origin is in game pixels.
import { fillLine } from "@andornaut/game-kit/runtime/lines";
import type { Rect } from "@andornaut/game-kit/runtime/rect";

import { SETTINGS_CARD, SHOP_PAGE } from "../data/layout.ts";
import type { DebuffId, GameData, GearId, MenuText, UpgradeId, ZoneId } from "../data/types.ts";
import { MENU_TEXT_FIELDS } from "../home/menuText.ts";
import { dollarText } from "../presentation/currency.ts";
import { BUTTON_SIZE } from "../ui/buttonGeometry.ts";
import { dismissFooter } from "../ui/modal/dismissFooter.ts";
import { MODAL, modalFamilyWidth, modalRect } from "../ui/modal/layout.ts";
import type { PanelButton, PanelMeasure, PanelText, QuestionPanelView } from "../ui/modal/types.ts";
import { modalCardView, panelButton } from "../ui/modal/view.ts";
import { PALETTE } from "../ui/palette.ts";
import { GREYED, selectLook } from "../ui/selection.ts";
import { TEXT_SCALE } from "../ui/textFit.ts";
import type { Cents } from "../units.ts";
import { BANK_GRANTS, type NextWalk, type OwnGrant, type Speed, WALK_GRANT } from "./cheats.ts";

// What a press on a row or button does.
export type CheatAction =
  | { readonly amount: Cents; readonly kind: "addBank" }
  | { readonly debuff: DebuffId; readonly kind: "debuff" }
  | { readonly grant: OwnGrant; readonly kind: "own" }
  | { readonly kind: "addMoney" }
  | { readonly kind: "copyRunLink" }
  | { readonly kind: "finishZone" }
  | { readonly kind: "fpsCounter" }
  | { readonly kind: "invincible" }
  | { readonly kind: "pocket" }
  | { readonly kind: "refillHearts" }
  | { readonly kind: "resetSave" }
  | { readonly kind: "showTips" }
  | { readonly kind: "speed" }
  | { readonly kind: "startAt" }
  | { readonly kind: "upgrade"; readonly upgrade: UpgradeId }
  | { readonly kind: "upgrades" };

// One full-width row: a group's heading, the divider before the actions that are no cheats, an
// On/Off switch, a picker that a press moves to its next choice, the seed's field, an action
// button, or up to two compact Add buttons.
export type CheatRow =
  | { readonly kind: "divider" }
  | { readonly kind: "heading"; readonly text: string }
  | {
      readonly action: CheatAction;
      readonly enabled: boolean;
      readonly kind: "picker" | "switch";
      readonly label: string;
      readonly on?: boolean;
      readonly value: string;
    }
  | {
      readonly enabled: boolean;
      readonly kind: "seed";
      readonly label: string;
      // What the empty field shows: a random seed.
      readonly placeholder: string;
      readonly value: string;
    }
  | {
      readonly buttons: readonly {
        readonly action: CheatAction;
        readonly enabled: boolean;
        readonly label: string;
      }[];
      // Compact Add buttons, two to a row, or one full-width action.
      readonly compact: boolean;
      readonly kind: "buttons";
    };

// Where the modal opened and what it shows: the walk's state there, or undefined on the Start
// screen.
export interface CheatsState {
  readonly fpsCounter: boolean;
  readonly linkCopied: boolean;
  readonly next: NextWalk;
  readonly walk:
    { readonly canFinish: boolean; readonly upgradesLeft: readonly UpgradeId[] } | undefined;
}

type CheatsData = Pick<
  GameData,
  "debuffs" | "shopGear" | "upgradeDrawOrder" | "upgrades" | "world"
>;

function zoneName(data: Pick<GameData, "world">, zone: ZoneId | null): string {
  const zones = data.world.zones;
  return (zone === null ? zones[0] : zones.find(({ id }) => id === zone))?.name ?? "";
}

function pocketName(
  data: Pick<GameData, "shopGear">,
  words: MenuText["cheats"],
  pocket: GearId | null | undefined,
): string {
  if (pocket === undefined) {
    return words.pocketPicked;
  }
  return pocket === null ? words.pocketNone : data.shopGear[pocket].name;
}

// The rows, in the spec's order: This walk, Next walk and Start screen, the divider, then the
// actions that are no cheats. Rows that do not apply where the modal opened stay, disabled.
export function cheatRows(
  data: CheatsData,
  words: Pick<MenuText, "cheats" | "settings">,
  state: CheatsState,
): CheatRow[] {
  const text = words.cheats;
  const { next, walk } = state;
  const inWalk = walk !== undefined;
  const home = !inWalk;
  const fields = MENU_TEXT_FIELDS.cheats;
  const addLabel = (amount: Cents) => fillLine(fields, text, "add", { cash: dollarText(amount) });
  const action = (label: string, enabled: boolean, act: CheatAction): CheatRow => ({
    buttons: [{ action: act, enabled, label }],
    compact: false,
    kind: "buttons",
  });
  const adds = BANK_GRANTS.map((amount) => ({
    action: { amount, kind: "addBank" } as const,
    enabled: home,
    label: addLabel(amount),
  }));
  const upgrades = data.upgradeDrawOrder.map((upgrade) =>
    action(
      fillLine(fields, text, "grantUpgrade", { upgrade: data.upgrades[upgrade].name }),
      walk?.upgradesLeft.includes(upgrade) ?? false,
      { kind: "upgrade", upgrade },
    ),
  );
  const debuffs = (Object.keys(data.debuffs) as DebuffId[]).map((debuff) =>
    action(fillLine(fields, text, "applyDebuff", { debuff: data.debuffs[debuff].name }), inWalk, {
      debuff,
      kind: "debuff",
    }),
  );
  const switchRow = (label: string, on: boolean, enabled: boolean, act: CheatAction): CheatRow => ({
    action: act,
    enabled,
    kind: "switch",
    label,
    on,
    value: on ? words.settings.on : words.settings.off,
  });
  const picker = (label: string, value: string, act: CheatAction): CheatRow => ({
    action: act,
    enabled: home,
    kind: "picker",
    label,
    value,
  });
  const owns: readonly [string, OwnGrant][] = [
    [text.unlockWalkers, "walkers"],
    [text.ownDogs, "dogs"],
    [text.ownDogSlots, "dogSlots"],
    [text.ownGear, "gear"],
    [text.unlockAll, "all"],
  ];
  return [
    { kind: "heading", text: text.groups.thisWalk },
    {
      buttons: [
        {
          action: { kind: "addMoney" },
          enabled: inWalk,
          label: addLabel(WALK_GRANT),
        },
      ],
      compact: true,
      kind: "buttons",
    },
    action(text.refillHearts, inWalk, { kind: "refillHearts" }),
    ...upgrades,
    action(text.grantAllUpgrades, (walk?.upgradesLeft.length ?? 0) > 0, { kind: "upgrades" }),
    ...debuffs,
    action(text.finishZone, walk?.canFinish ?? false, { kind: "finishZone" }),
    { kind: "heading", text: text.groups.nextWalk },
    picker(text.startAt, zoneName(data, next.start), { kind: "startAt" }),
    {
      enabled: home,
      kind: "seed",
      label: text.seed,
      placeholder: text.seedRandom,
      value: next.seed === null ? "" : String(next.seed),
    },
    action(state.linkCopied ? text.linkCopied : text.copyRunLink, home, { kind: "copyRunLink" }),
    picker(text.pocket, pocketName(data, text, next.pocket), { kind: "pocket" }),
    switchRow(text.invincible, next.invincible, home, { kind: "invincible" }),
    picker(text.speed, text.speeds[next.speed satisfies Speed], { kind: "speed" }),
    { kind: "heading", text: text.groups.startScreen },
    { buttons: adds.slice(0, 2), compact: true, kind: "buttons" },
    { buttons: adds.slice(2), compact: true, kind: "buttons" },
    ...owns.map(([label, grant]) => action(label, home, { grant, kind: "own" })),
    { kind: "divider" },
    { kind: "heading", text: text.groups.other },
    switchRow(text.fpsCounter, state.fpsCounter, true, { kind: "fpsCounter" }),
    action(text.showTips, true, { kind: "showTips" }),
    action(text.resetSave, true, { kind: "resetSave" }),
  ];
}

const { compact, gap, stackGap } = BUTTON_SIZE;
const ROW = SETTINGS_CARD.row;
// A heading's and the divider's heights.
const HEADING_HEIGHT = 24;
const DIVIDER_HEIGHT = 8;
// The body's scrollbar: the Pet shop's, its track's right edge the frame's 8 px margin in from
// the panel's.
const SCROLLBAR = SHOP_PAGE.scrollbar;
const SCROLLBAR_INSET = 8;
// Between the rows' right edge and the scrollbar's track.
const SCROLL_GAP = 4;

function rowHeight(row: CheatRow): number {
  switch (row.kind) {
    case "divider":
      return DIVIDER_HEIGHT;
    case "heading":
      return HEADING_HEIGHT;
    default:
      return compact.height;
  }
}

export interface CheatsLayout {
  readonly panel: Rect;
  // Each row's rect, top to bottom, as unscrolled.
  readonly rows: readonly Rect[];
  readonly contentHeight: number;
  // The scrollbar's track's left edge and the spec scrollbarRects reads.
  readonly scrollbar: Omit<typeof SCROLLBAR, "x"> & { readonly x: number };
  // Only the rows scroll, inside this rect.
  readonly viewport: Rect;
}

// The Large card, as tall as the screen less its margins, its title row at the top, its Close
// at the bottom, and the rows stacked in the body between, a list's gap apart.
export function cheatsLayout(
  screen: { readonly height: number; readonly width: number },
  rows: readonly CheatRow[],
): CheatsLayout {
  const width = modalFamilyWidth(screen.width - 2 * MODAL.margin, "large");
  const height = screen.height - 2 * MODAL.margin;
  const panel = modalRect({ ...screen, x: 0, y: 0 }, undefined, { height, width });
  const trackX = panel.x + panel.width - SCROLLBAR_INSET - SCROLLBAR.trackWidth;
  const x = panel.x + MODAL.pad;
  const top = panel.y + MODAL.header;
  const bottom = panel.y + panel.height - MODAL.pad - compact.height - MODAL.gap;
  const rowWidth = trackX - SCROLL_GAP - x;
  let y = top;
  const rects = rows.map((row) => {
    const rect = { height: rowHeight(row), width: rowWidth, x, y };
    y += rect.height + stackGap;
    return rect;
  });
  return {
    contentHeight: Math.max(0, y - stackGap - top),
    panel,
    rows: rects,
    scrollbar: { ...SCROLLBAR, x: trackX },
    viewport: { height: bottom - top, width: trackX + SCROLLBAR.trackWidth - x, x, y: top },
  };
}

// art: the Settings switch, right-aligned in its row.
const SWITCH = ROW.switch;

export interface CheatRowView {
  readonly action?: CheatAction;
  readonly buttons: readonly (PanelButton & { readonly action: CheatAction })[];
  readonly enabled: boolean;
  // A switch or picker row's face, in its colour.
  readonly face: number | undefined;
  readonly kind: CheatRow["kind"];
  // What a screen reader reads it by.
  readonly label: string;
  // The seed's field's text while empty.
  readonly placeholder: string;
  readonly rect: Rect;
  // The switch's place and whether it is on.
  readonly switch?: { readonly on: boolean; readonly x: number; readonly y: number };
  // The seed's field, right of its label.
  readonly field?: Rect;
  readonly texts: readonly PanelText[];
  readonly value: string;
}

export interface CheatsView {
  readonly card: QuestionPanelView;
  readonly layout: CheatsLayout;
  readonly rows: readonly CheatRowView[];
}

// A line of title text centred down a row, from left or, right-aligned, ending at right.
function rowText(
  measure: PanelMeasure,
  colour: number,
  rect: Rect,
  text: string,
  at: { readonly left: number } | { readonly right: number },
): PanelText {
  const { capTop, lineHeight } = measure.title;
  const caps = Math.round(rect.y + rect.height / 2 + (capTop - lineHeight / 2) * TEXT_SCALE);
  const ink = measure.inkWidth("title", text);
  return {
    capTop: caps,
    centre: "left" in at ? "left" : "ink",
    centreX: "left" in at ? at.left : at.right - ink / 2,
    colour,
    font: "title",
    line: 0,
    scale: TEXT_SCALE,
    text,
  };
}

function rowView(measure: PanelMeasure, row: CheatRow, rect: Rect): CheatRowView {
  const plain = {
    buttons: [],
    enabled: true,
    face: undefined,
    kind: row.kind,
    placeholder: "",
    rect,
    value: "",
  };
  switch (row.kind) {
    case "divider":
      return { ...plain, label: "", texts: [] };
    case "heading":
      return {
        ...plain,
        label: row.text,
        texts: [rowText(measure, PALETTE.plum, rect, row.text, { left: rect.x })],
      };
    case "buttons": {
      const count = row.buttons.length;
      const full = !row.compact;
      const span = full ? rect.width : count * compact.width + (count - 1) * gap;
      const left = rect.x + (rect.width - span) / 2;
      const buttons = row.buttons.map((button, i) => {
        const face = full ? rect : { ...compact, x: left + i * (compact.width + gap), y: rect.y };
        return {
          ...panelButton(measure, face, false, button.label),
          action: button.action,
          available: button.enabled,
        };
      });
      return {
        ...plain,
        buttons,
        label: row.buttons.map(({ label }) => label).join(", "),
        texts: [],
      };
    }
    default: {
      const look = row.enabled ? selectLook("normal") : { ...selectLook("normal"), ...GREYED };
      const colour = PALETTE[look.text];
      const right = rect.x + rect.width - ROW.pad;
      const label = rowText(measure, colour, rect, row.label, { left: rect.x + ROW.pad });
      const base = {
        ...plain,
        enabled: row.enabled,
        face: PALETTE[look.face],
        label: row.label,
        value: row.value,
      };
      if (row.kind === "seed") {
        const width = Math.round(rect.width / 2);
        return {
          ...base,
          field: {
            height: compact.height - 2 * ROW.pad,
            width,
            x: right - width,
            y: rect.y + ROW.pad,
          },
          placeholder: row.placeholder,
          texts: [label],
        };
      }
      if (row.kind === "picker") {
        return {
          ...base,
          action: row.action,
          texts: [label, rowText(measure, colour, rect, row.value, { right })],
        };
      }
      const switchX = right - SWITCH.width;
      return {
        ...base,
        action: row.action,
        switch: {
          on: row.on ?? false,
          x: switchX,
          y: rect.y + Math.round((rect.height - SWITCH.height) / 2),
        },
        texts: [label, rowText(measure, colour, rect, row.value, { right: switchX - ROW.pad })],
      };
    }
  }
}

// The modal as it stands: the card with its title, close control and primary Close, and each
// row's view as unscrolled.
export function cheatsView(
  measure: PanelMeasure,
  context: {
    readonly data: CheatsData;
    readonly screen: { readonly height: number; readonly width: number };
    readonly words: Pick<MenuText, "cheats" | "common" | "settings">;
  },
  state: CheatsState,
): CheatsView {
  const { data, screen, words } = context;
  const rows = cheatRows(data, words, state);
  const layout = cheatsLayout(screen, rows);
  return {
    card: {
      ...modalCardView(measure, layout.panel, words.cheats.title, []),
      footer: dismissFooter(measure, { label: words.common.close, primary: true }, layout.panel),
    },
    layout,
    rows: rows.map((row, i) => rowView(measure, row, layout.rows[i] ?? layout.viewport)),
  };
}
