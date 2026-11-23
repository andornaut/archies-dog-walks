// The Cheats modal laid out as it stands, free of Phaser and the DOM: its rows in the spec's order
// (gameplay/cheats.md), each row's place in the scrolling body, and what a press on it does. The
// HTML interface (src/hud/dom/cheats.ts) draws it. Every rect and text origin is in game pixels.
import { fillLine, wrapWords } from "@andornaut/game-kit/runtime/lines";
import type { Rect } from "@andornaut/game-kit/runtime/rect";

import { SETTINGS_CARD, SHOP_PAGE } from "../data/layout.ts";
import type { DebuffId, GameData, MenuText, UpgradeId, ZoneId } from "../data/types.ts";
import { MENU_TEXT_FIELDS } from "../home/menuText.ts";
import { SWITCH_STATE_GAP } from "../home/settings.ts";
import { dollarText } from "../presentation/currency.ts";
import { BUTTON_SIZE } from "../ui/buttonGeometry.ts";
import { dismissFooter } from "../ui/modal/dismissFooter.ts";
import { MODAL, modalActionWidth } from "../ui/modal/layout.ts";
import type { PanelButton, PanelMeasure, PanelText, QuestionPanelView } from "../ui/modal/types.ts";
import { modalCardView, panelButton } from "../ui/modal/view.ts";
import { PALETTE } from "../ui/palette.ts";
import { BUTTON_LIP_PX, GREYED, selectLook } from "../ui/selection.ts";
import { MODAL_TITLE_SCALE, TEXT_SCALE } from "../ui/textFit.ts";
import type { Cents } from "../units.ts";
import { BANK_GRANTS, type NextWalk, type OwnGrant, startZones } from "./cheats.ts";

// What a press on a row or button does.
export type CheatAction =
  | { readonly amount: Cents; readonly kind: "addBank" }
  | { readonly debuff: DebuffId; readonly kind: "debuff" }
  | { readonly grant: OwnGrant; readonly kind: "own" }
  | { readonly kind: "addMoney" }
  | { readonly kind: "copyRunLink" }
  | { readonly kind: "finishZone" }
  | { readonly kind: "invincible" }
  | { readonly kind: "pocket" }
  | { readonly kind: "refillHearts" }
  | { readonly kind: "resetSave" }
  | { readonly kind: "speed" }
  | { readonly kind: "startAt"; readonly zone: ZoneId }
  | { readonly kind: "upgrade"; readonly upgrade: UpgradeId }
  | { readonly kind: "upgrades" };

interface CheatButton {
  readonly action: CheatAction;
  readonly enabled: boolean;
  readonly label: string;
  readonly selected?: boolean;
}

type CheatLine =
  | { readonly kind: "divider"; readonly section?: boolean }
  | { readonly kind: "heading"; readonly text: string }
  | {
      readonly action: CheatAction;
      readonly enabled: boolean;
      readonly kind: "switch";
      readonly label: string;
      readonly on: boolean;
      readonly value: string;
    }
  | {
      readonly buttons: readonly CheatButton[];
      readonly kind: "buttons";
      readonly layout: "compact" | "full" | "pair";
    };

export type CheatRow =
  | CheatLine
  | {
      readonly kind: "columns";
      readonly groups: readonly {
        readonly label: string;
        readonly buttons: readonly CheatButton[];
      }[];
    };

// Where the modal opened and what it shows: the walk's state there, or undefined on the Start
// screen.
export interface CheatsState {
  readonly canResetSave: boolean;
  readonly linkCopied: boolean;
  readonly next: NextWalk;
  readonly walk:
    { readonly canFinish: boolean; readonly upgradesLeft: readonly UpgradeId[] } | undefined;
}

type CheatsData = Pick<GameData, "debuffs" | "upgradeDrawOrder" | "upgrades" | "world">;

// The rows in display order; actions unavailable in the current context remain visible.
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
    kind: "buttons",
    layout: "full",
  });
  const adds = BANK_GRANTS.map((amount) => ({
    action: { amount, kind: "addBank" } as const,
    enabled: home,
    label: addLabel(amount),
  }));
  const switchRow = (label: string, on: boolean, enabled: boolean, act: CheatAction): CheatRow => ({
    action: act,
    enabled,
    kind: "switch",
    label,
    on,
    value: on ? words.settings.on : words.settings.off,
  });
  const owns: readonly [string, OwnGrant][] = [
    [text.unlockWalkers, "walkers"],
    [text.ownDogSlots, "dogSlots"],
    [text.ownDogs, "dogs"],
    [text.ownGear, "gear"],
  ];
  const zones = startZones(data);
  const selected = next.start ?? zones[0];
  const choices = zones.map((zone): CheatButton => ({
    action: { kind: "startAt", zone },
    enabled: home,
    label: data.world.zones.find(({ id }) => id === zone)!.name,
    selected: selected === zone,
  }));
  const zoneRows = Array.from({ length: Math.ceil(choices.length / 2) }, (_, i): CheatRow => ({
    buttons: choices.slice(2 * i, 2 * i + 2),
    kind: "buttons",
    layout: "pair",
  }));
  return [
    { kind: "heading", text: text.groups.nextWalk },
    switchRow(text.invincible, next.invincible, home, { kind: "invincible" }),
    { kind: "divider" },
    { kind: "heading", text: text.startAt },
    ...zoneRows,
    { kind: "divider", section: true },
    {
      groups: [
        {
          buttons: owns.map(([label, grant]) => ({
            action: { grant, kind: "own" },
            enabled: home,
            label,
          })),
          label: text.groups.unlocks,
        },
        { buttons: adds, label: text.groups.money },
      ],
      kind: "columns",
    },
    { kind: "divider" },
    action(text.resetSave, state.canResetSave, { kind: "resetSave" }),
  ];
}

const { compact, stackGap } = BUTTON_SIZE;
const ROW = SETTINGS_CARD.row;
const PANEL_WIDTH = 344;
const SIDE_INSET = 8;
const HEADING_HEIGHT = 24;
const TOGGLE_HEIGHT = 48;
const COLUMN_GAP = 16;
const SECTION_GAP = 16;
const DIVIDER_HEIGHT = 8;
const SCROLLBAR = SHOP_PAGE.scrollbar;
const SCROLL_GAP = 4;

export interface CheatsLayout {
  readonly panel: Rect;
  readonly contentHeight: number;
  readonly scrollbar: Omit<typeof SCROLLBAR, "x"> & { readonly x: number };
  readonly viewport: Rect;
}

function columnsOf(rect: Rect): readonly [Rect, Rect] {
  const width = Math.floor((rect.width - COLUMN_GAP) / 2);
  return [
    { ...rect, width },
    { ...rect, width: rect.width - COLUMN_GAP - width, x: rect.x + width + COLUMN_GAP },
  ];
}

function rowButtons(
  measure: PanelMeasure,
  row: Extract<CheatLine, { kind: "buttons" }>,
  rect: Rect,
): CheatButtonView[] {
  const cols = row.layout === "pair" ? columnsOf(rect) : [rect];
  const available = row.buttons.map((item, i) => {
    const column = cols[i]!;
    const preferred = modalActionWidth(measure.inkWidth("title", item.label));
    const width = row.layout === "compact" ? Math.min(column.width, preferred) : column.width;
    const x = column.x + (column.width - width) / 2;
    const measureLine = (text: string) => measure.inkWidth("title", text);
    const longest = Math.max(...item.label.split(/\s+/u).map(measureLine));
    if (longest > width - 2 * MODAL.rowGap) {
      throw new RangeError("Cheats label word exceeds its full-size button room");
    }
    const room = Math.max(width - 2 * MODAL.gap, longest);
    const lines = wrapWords(measureLine, room, item.label);
    const pitch = measure.title.lineHeight * TEXT_SCALE;
    const inks = lines.map((line, i) => {
      const ink = measure.titleInk(line);
      return {
        bottom: i * pitch + (ink.bottom * TEXT_SCALE) / MODAL_TITLE_SCALE,
        top: i * pitch + (ink.top * TEXT_SCALE) / MODAL_TITLE_SCALE,
      };
    });
    const top = Math.min(...inks.map((ink) => ink.top));
    const bottom = Math.max(...inks.map((ink) => ink.bottom));
    return { block: bottom - top, item, lines, pitch, top, width, x };
  });
  const height = Math.max(
    compact.height,
    rect.height,
    ...available.map(({ block }) => block + BUTTON_LIP_PX + 2 * MODAL.rowGap),
  );
  return available.map(({ block, item, lines, pitch, top, width, x }) => {
    const face = { height, width, x, y: rect.y };
    const button = panelButton(measure, face, false, item.label);
    const capTop = rect.y + Math.floor((height - BUTTON_LIP_PX - block) / 2) - top;
    return {
      ...button,
      action: item.action,
      available: item.enabled,
      lines: lines.map((text, i) => ({
        ...button.text,
        capTop: capTop + i * pitch,
        centre: "ink",
        text,
      })),
      ...(item.selected === undefined ? {} : { selected: item.selected }),
    };
  });
}

function placeRows(
  measure: PanelMeasure,
  area: Pick<Rect, "width" | "x" | "y">,
  rows: readonly CheatRow[],
): { contentHeight: number; rows: CheatRowView[] } {
  let y = area.y;
  const placed: CheatRowView[] = [];
  for (const [i, row] of rows.entries()) {
    const rect = { height: 0, width: area.width, x: area.x, y };
    if (row.kind === "columns") {
      const columns = columnsOf(rect);
      const stackTop = y + HEADING_HEIGHT + stackGap;
      const columnRows = row.groups.map(({ buttons, label }, index) => {
        const width = columns[index]!.width;
        return {
          buttons: buttons.map(
            (button) => ({ buttons: [button], kind: "buttons", layout: "full" }) as const,
          ),
          label,
          width,
        };
      });
      const height = Math.max(
        compact.height,
        ...columnRows.flatMap(({ buttons, width }) =>
          buttons.map((button) => rowButtons(measure, button, { ...rect, width })[0]!.rect.height),
        ),
      );
      columnRows.forEach(({ buttons, label }, index) => {
        const column = columns[index]!;
        placed.push(
          rowView(measure, { kind: "heading", text: label }, { ...column, height: HEADING_HEIGHT }),
        );
        buttons.forEach((button, rowIndex) => {
          placed.push(
            rowView(measure, button, {
              ...column,
              height,
              y: stackTop + rowIndex * (height + stackGap),
            }),
          );
        });
      });
      y =
        stackTop +
        Math.max(...columnRows.map(({ buttons }) => buttons.length)) * (height + stackGap);
    } else {
      const view = rowView(measure, row, rect);
      placed.push(view);
      const adjacentToggle = row.kind === "switch" && rows[i + 1]?.kind === "switch";
      y += view.rect.height + (adjacentToggle ? 0 : stackGap);
    }
  }
  return { contentHeight: Math.max(0, y - stackGap - area.y), rows: placed };
}

function layoutCheats(
  measure: PanelMeasure,
  screen: { readonly height: number; readonly width: number },
  rows: readonly CheatRow[],
): { layout: CheatsLayout; rows: readonly CheatRowView[] } {
  const width = Math.min(PANEL_WIDTH, screen.width - 2 * SIDE_INSET);
  const x = Math.round((screen.width - width) / 2);
  const edge = x + width - SIDE_INSET;
  const trackX = edge - SCROLLBAR.trackWidth;
  const left = x + MODAL.pad;
  const maxHeight = screen.height - 2 * MODAL.margin;
  const chrome = MODAL.header + MODAL.gap + compact.height + MODAL.pad;
  const available = maxHeight - chrome;
  const natural = placeRows(measure, { width: width - 2 * MODAL.pad, x: left, y: 0 }, rows);
  const scrolls = natural.contentHeight > available;
  const height = Math.min(maxHeight, chrome + natural.contentHeight);
  const y = Math.round((screen.height - height) / 2);
  const top = y + MODAL.header;
  const rowWidth = scrolls ? trackX - SCROLL_GAP - left : width - 2 * MODAL.pad;
  const placed = placeRows(measure, { width: rowWidth, x: left, y: top }, rows);
  return {
    layout: {
      contentHeight: placed.contentHeight,
      panel: { height, width, x, y },
      scrollbar: { ...SCROLLBAR, x: trackX },
      viewport: {
        height: height - chrome,
        width: scrolls ? edge - left : rowWidth,
        x: left,
        y: top,
      },
    },
    rows: placed.rows,
  };
}

// art: the Settings switch, right-aligned in its row.
const SWITCH = ROW.switch;

interface CheatButtonView extends PanelButton {
  readonly action: CheatAction;
  readonly lines: readonly PanelText[];
  readonly selected?: boolean;
}

export interface CheatRowView {
  readonly action?: CheatAction;
  readonly buttons: readonly CheatButtonView[];
  readonly enabled: boolean;
  readonly kind: CheatLine["kind"];
  // What a screen reader reads it by.
  readonly label: string;
  readonly rect: Rect;
  // The switch's place and whether it is on.
  readonly switch?: { readonly on: boolean; readonly x: number; readonly y: number };
  readonly texts: readonly PanelText[];
  readonly value: string;
}

export interface CheatsView {
  readonly card: QuestionPanelView;
  readonly layout: CheatsLayout;
  readonly rows: readonly CheatRowView[];
}

// A line of title text centred down a row on its left axis.
function rowText(measure: PanelMeasure, colour: number, rect: Rect, text: string): PanelText {
  const { capTop, lineHeight } = measure.title;
  const caps = Math.round(rect.y + rect.height / 2 + (capTop - lineHeight / 2) * TEXT_SCALE);
  return {
    capTop: caps,
    centre: "left",
    centreX: rect.x,
    colour,
    font: "title",
    line: 0,
    scale: TEXT_SCALE,
    text,
  };
}

function rowView(measure: PanelMeasure, row: CheatLine, rect: Rect): CheatRowView {
  const plain = {
    buttons: [],
    enabled: true,
    kind: row.kind,
    rect,
    value: "",
  };
  switch (row.kind) {
    case "divider": {
      const height = row.section ? 2 * (SECTION_GAP - stackGap) + 1 : DIVIDER_HEIGHT;
      return { ...plain, label: "", rect: { ...rect, height }, texts: [] };
    }
    case "heading": {
      const heading = { ...rect, height: HEADING_HEIGHT };
      return {
        ...plain,
        label: row.text,
        rect: heading,
        texts: [rowText(measure, PALETTE.plum, heading, row.text)],
      };
    }
    case "buttons": {
      const buttons = rowButtons(measure, row, rect);
      return {
        ...plain,
        buttons,
        label: row.buttons.map(({ label }) => label).join(", "),
        rect: { ...rect, height: buttons[0]?.rect.height ?? compact.height },
        texts: [],
      };
    }
    case "switch": {
      const stateHeight = measure.title.capHeight * TEXT_SCALE;
      const stackHeight = SWITCH.height + SWITCH_STATE_GAP + stateHeight;
      const hit = { ...rect, height: Math.max(TOGGLE_HEIGHT, stackHeight + 2 * MODAL.rowGap) };
      const look = row.enabled ? selectLook("normal") : { ...selectLook("normal"), ...GREYED };
      const colour = PALETTE[look.text];
      const switchX = rect.x + rect.width - SWITCH.width;
      const switchY = hit.y + Math.floor((hit.height - stackHeight) / 2);
      return {
        ...plain,
        action: row.action,
        enabled: row.enabled,
        label: row.label,
        rect: hit,
        switch: {
          on: row.on,
          x: switchX,
          y: switchY,
        },
        texts: [
          rowText(measure, colour, hit, row.label),
          {
            capTop: switchY + SWITCH.height + SWITCH_STATE_GAP,
            centre: "ink",
            centreX: switchX + SWITCH.width / 2,
            colour,
            font: "title",
            line: 0,
            scale: TEXT_SCALE,
            text: row.value,
          },
        ],
        value: row.value,
      };
    }
    default:
      return row satisfies never;
  }
}

// The modal as it stands: the card with its title, X and centred Back, and each
// row's view as unscrolled.
export function cheatsView(
  measure: PanelMeasure,
  context: {
    readonly data: CheatsData;
    readonly screen: { readonly height: number; readonly width: number };
    readonly words: Pick<MenuText, "cheats" | "pageBack" | "settings">;
  },
  state: CheatsState,
): CheatsView {
  const { data, screen, words } = context;
  const { layout, rows } = layoutCheats(measure, screen, cheatRows(data, words, state));
  return {
    card: {
      ...modalCardView(measure, layout.panel, words.cheats.title, []),
      footer: dismissFooter(measure, { label: words.pageBack, primary: true }, layout.panel),
    },
    layout,
    rows,
  };
}
