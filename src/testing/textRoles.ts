import { UNKNOWN_COMMIT } from "@andornaut/game-kit/build/buildVersion";
import { fillLine, fillNames, wrapWords } from "@andornaut/game-kit/runtime/lines";
import { keysOf } from "@andornaut/game-kit/runtime/records";
import type { Rect } from "@andornaut/game-kit/runtime/rect";
import { overflowOf } from "@andornaut/game-kit/runtime/text/overflow";
import type { TextFitStyle } from "@andornaut/game-kit/runtime/text/textFit";
import { buildLabel } from "@andornaut/game-kit/runtime/web/buildLabel";

import { gameData } from "../data/index.ts";
import {
  BADGE_NAME_STYLE,
  BADGE_STRIP,
  badgeStrip,
  CELEBRATION_PANEL,
  celebrationTitle,
  panelBadgeStrip,
} from "../home/badgesView.ts";
import {
  breakdownLabelRoom,
  END_LAYOUT,
  QUIP_LINES,
  QUIP_TEXT_ROOM,
  SIDE_LABEL_ROOM,
  sideTotalLabelRoom,
} from "../home/endLayout.ts";
import { overlayRegion } from "../home/homeBar.ts";
import {
  detailCardRect,
  DOG_TILE_TEXT_ROOM,
  HOME_BAR_BUTTONS,
  HOME_LAYOUT,
  updateModalLayout,
} from "../home/homeLayout.ts";
import { messageLine } from "../home/homeLines.ts";
import { MENU_TEXT_FIELDS } from "../home/menuText.ts";
import {
  INSTALL_STEPS_FIT,
  installStepsLayout,
  noteRoom,
  SETTINGS_BUILD_LABEL,
  SETTINGS_NOTE_STYLE,
} from "../home/settings.ts";
import { dogRows, gearRows, type ShopRow, slotRows } from "../home/shop.ts";
import { SHOP_LAYOUT, SHOP_MESSAGE_FIT, shopRowTextRoom } from "../home/shopLayout.ts";
import { optionMarks } from "../hud/buffMarks.ts";
import { largeBodyText, smallCardText } from "../hud/cardText.ts";
import { CELEBRATION_LAYOUT, GREETING_FIT, ZONE_EARNINGS_FIT } from "../hud/celebrationLayout.ts";
import { choiceCharmStack } from "../hud/choiceCharms.ts";
import { CHANGE_LABEL_STYLE, changeLabelRoom, hudLanes } from "../hud/hudLanes.ts";
import {
  messageRows,
  messageStripLayout,
  ownerLeadLayout,
  stripLeadSlot,
} from "../hud/messageStrip.ts";
import { FIRED_LINE_FIT, LOW_CHIP_FIT, lowHeartsText } from "../hud/moments.ts";
import { MONEY_LABEL } from "../hud/moneyLabels.ts";
import { type NoticeText, noticeTextWithNamePills, styledNoticeRows } from "../hud/noticeText.ts";
import {
  HOME_QUESTION_ANSWERS,
  NOTE_PLATE,
  noteTextRoom,
  PAUSE_NOTE_LINES,
  questionLayout,
  QUIT_QUESTION_ANSWERS,
} from "../hud/pauseMenu.ts";
import { DOG_CARD, WALK_BAR } from "../hud/walkHud.ts";
import { celebrationText } from "../hud/zoneCelebration.ts";
import { zonePillNameRoom } from "../hud/zonePill.ts";
import { SCREEN_LAYOUT } from "../layout/screen.ts";
import {
  boxStyle,
  CARD_LAYOUT,
  cardEffectArea,
  FIRES_FIT,
  largeBodyBox,
  largeBodyStyle,
} from "../presentation/cardLayout.ts";
import {
  dollarAmountText,
  dollarText,
  shortDollarAmountText,
  signedShortDollarText,
} from "../presentation/currency.ts";
import { amountText } from "../rules/causes.ts";
import { firesText } from "../rules/choices.ts";
import { payFor } from "../rules/run.ts";
import { startingDogSlots } from "../rules/shop.ts";
import { read } from "../rules/units.ts";
import type { Owned } from "../save/schema.ts";
import { readBitmapFont } from "../tools/fontFile.ts";
import { barTitleRoom } from "../ui/barTitle.ts";
import { type CloseControl, closeControl } from "../ui/closeControl.ts";
import { MODAL, modalTitleLayout } from "../ui/modal/layout.ts";
import { modalTitleInk } from "../ui/modal/titleRole.ts";
import { cardTitleRow } from "../ui/modal/titleRow.ts";
import { PAUSE_MENU_ITEMS, pauseMenuItemLabel } from "../ui/navigationMenu.ts";
import { plainMarks } from "../ui/pixelFont.ts";
import { MODAL_TITLE_SCALE, TEXT_STYLE, textOnLines } from "../ui/textFit.ts";
import { topSectionCurrency, topSectionCurrencyText, topSectionLayout } from "../ui/topSection.ts";
import { cents } from "../units.ts";
import { bodyRunWidth } from "./bodyFont.ts";
import { defined } from "./defined.ts";
import { everyCardOption } from "./everyCardOption.ts";
import { everyStripLine } from "./everyStripLine.ts";
import { fitInFont, fontFileMetrics, gameFont, inkWidth } from "./fontInk.ts";
import { TEST_TUNING } from "./tuning.ts";

// Every string the data puts in each text role, set at the role's one size as the game sets it,
// filled with the widest names and the largest amounts its template takes. overflow says how it
// misses its room, or is "" where it fits.
interface TextRoleCase {
  readonly overflow: string;
  readonly role: string;
  readonly text: string;
}

const BODY = fontFileMetrics("font-body");
const TITLE = fontFileMetrics("font-title");

type Font = "font-body" | "font-display" | "font-title";

// Text as a font draws it: the title and display fonts in capitals, marks made plain.
const shownIn = (font: Font, text: string) =>
  font === "font-body" ? plainMarks(text) : plainMarks(text).toUpperCase();

// A role whose text is set in one font and style within room.
function plainRole(
  role: string,
  font: Font,
  fit: { room: number; style: TextFitStyle },
  texts: readonly string[],
): TextRoleCase[] {
  return [...new Set(texts)].map((text) => {
    const set = fitInFont(font, fit.style, fit.room, shownIn(font, text));
    const overflow = overflowOf(fit.style.lines ?? 1, fit.room, set.lines.length, set.widest);
    return { overflow, role, text };
  });
}

// A walk line with its owners' names kept together and its effects in their pills.
function noticeOverflow(lines: number, room: number, line: NoticeText): string {
  const pilled = noticeTextWithNamePills(gameData, line);
  const said = { ...pilled, text: plainMarks(pilled.text) };
  const rows = styledNoticeRows(textOnLines(lines), bodyRunWidth, room, said);
  return overflowOf(lines, room, rows.length, Math.max(0, ...rows.map((row) => row.width)));
}

function noticeRole(
  role: string,
  lines: number,
  room: number,
  texts: readonly NoticeText[],
): TextRoleCase[] {
  const unique = new Map(texts.map((line) => [line.text, line]));
  return [...unique.values()].map((line) => ({
    overflow: noticeOverflow(lines, room, line),
    role,
    text: line.text,
  }));
}

// Each owner's walk quips beside their leading portrait, on its rows: the strip
// keeps its room under the debuff bars.
function ownerQuipRoles(): TextRoleCase[] {
  const room = ownerLeadLayout(stripLeadSlot(BODY)).room;
  return keysOf(gameData.dogs).flatMap((dog) => {
    const { name } = gameData.dogs[dog].owner;
    const quips = [...gameData.quips[dog].happier, ...gameData.quips[dog].upset].map((text) => ({
      text,
    }));
    return quips.flatMap((quip) => {
      const rows = messageRows((text) => bodyRunWidth(TEXT_STYLE, text), room, "owner", quip);
      return noticeRole("owner's quip on the strip", rows.length, room, [quip]).map((one) => ({
        ...one,
        text: `${name}: ${one.text}`,
      }));
    });
  });
}

// A change label says its amount alone: a heart change's, and a money change's.
function changeLabelRoles(): TextRoleCase[] {
  const lane = defined(hudLanes(SCREEN_LAYOUT).heartLabels[0]);
  const hearts = { room: changeLabelRoom(lane.width), style: CHANGE_LABEL_STYLE };
  const money = { room: MONEY_LABEL.room, style: TEXT_STYLE };
  return [
    ...plainRole(
      "heart change",
      "font-body",
      hearts,
      [-10, -1, 1, 10].map((amount) => amountText("hearts", amount)),
    ),
    ...plainRole(
      "money change",
      "font-body",
      money,
      [99_900, -99_900].map((amount) => amountText("money", amount)),
    ),
  ];
}

// Each card the data can deal: its small effect in the box its paws and warning leave it, its
// firing warning, and the enlarged card's warning and changes.
function cardRoles(): TextRoleCase[] {
  const { large } = CARD_LAYOUT;
  const fonts = { body: gameFont("font-body"), title: gameFont("font-title") };
  // A forgiven loss's rows in the smaller area, a firing card's.
  const area = cardEffectArea(BODY, true);
  const bodyWidth = (style: TextFitStyle, line: string) =>
    inkWidth("font-body", style, plainMarks(line));
  const forgiven = keysOf(gameData.dogs).map((dog) =>
    fillNames(gameData.runText.card.heartForgiven, { dog: gameData.dogs[dog].name, hearts: "1" }),
  );
  const warnings = new Set<string>();
  return [
    ...everyCardOption().flatMap(([name, option]) => {
      const { effect } = smallCardText(gameData, BODY, bodyWidth, option);
      const widest = Math.max(0, ...effect.lines.map((line) => bodyWidth(effect.style, line)));
      const most = effect.style.lines ?? 1;
      const small = {
        overflow: overflowOf(most, area.width, effect.lines.length, widest),
        role: "card effect",
        text: name,
      };
      const fires = option === undefined || option.fires.length === 0 ? null : option.fires;
      const warning = fires === null ? null : firesText(gameData, fires);
      const newWarning = warning !== null && !warnings.has(warning);
      if (warning !== null) {
        warnings.add(warning);
      }
      const shownWarning = warning === null ? null : shownIn("font-title", warning);
      const warningLines =
        shownWarning === null
          ? 0
          : fitInFont("font-title", FIRES_FIT.large.style, FIRES_FIT.large.room, shownWarning).lines
              .length;
      const box = largeBodyBox({ body: BODY, title: TITLE }, warningLines);
      const { charms } = optionMarks(gameData, { modified: [] }, option);
      const { height } = choiceCharmStack(fonts, large.width, charms);
      const style = largeBodyStyle(BODY, box.height, SCREEN_LAYOUT.walkView, height);
      const changes = { room: large.body.width, style };
      const enlarged = plainRole("enlarged card's changes", "font-body", changes, [
        largeBodyText(gameData, option),
      ]).map((one) => ({ ...one, text: name }));
      return [
        small,
        ...enlarged,
        ...(warning === null || !newWarning
          ? []
          : [
              ...plainRole("card's firing warning", "font-body", FIRES_FIT.small, [warning]),
              ...plainRole("enlarged card's firing warning", "font-title", FIRES_FIT.large, [
                warning,
              ]),
            ]),
      ];
    }),
    ...plainRole(
      "card effect",
      "font-body",
      { room: area.width, style: boxStyle(BODY, area.height) },
      forgiven,
    ),
  ];
}

// The end screen's labels beside the widest amount in its short form, its owners' fired headers
// and their closing lines.
function endRoles(): TextRoleCase[] {
  const words = gameData.menuText.end;
  const amountWidth = (amount: number) =>
    inkWidth("font-body", TEXT_STYLE, plainMarks(signedShortDollarText(amount)));
  const widest = Math.max(
    ...[999, 9_999, 99_999, 999_999].flatMap((dollars) => [
      amountWidth(dollars * 100),
      amountWidth(-dollars * 100),
    ]),
  );
  const owners = Object.values(gameData.dogs).map(({ owner }) => owner.name);
  const quips = Object.values(gameData.quips).flatMap((moments) => Object.values(moments).flat());
  return [
    ...plainRole(
      "end screen's breakdown label",
      "font-body",
      { room: breakdownLabelRoom(widest), style: TEXT_STYLE },
      Object.values(words.earnings),
    ),
    ...plainRole(
      "end screen's TOTAL",
      "font-title",
      { room: sideTotalLabelRoom(widest), style: TEXT_STYLE },
      [words.total],
    ),
    ...plainRole(
      "end screen's button",
      "font-title",
      // Inside the face less 12px a side, as Start walk's loading label.
      {
        room: END_LAYOUT.backToTitle.width - 24,
        style: { scale: END_LAYOUT.backToTitleLabel.scale },
      },
      [words.headHome],
    ),
    ...plainRole(
      "end screen's side label",
      "font-body",
      { room: SIDE_LABEL_ROOM, style: TEXT_STYLE },
      [words.zonesWalked],
    ),
    ...plainRole(
      "end screen's fired header",
      "font-title",
      { room: QUIP_TEXT_ROOM, style: TEXT_STYLE },
      owners.map((owner) => fillLine(MENU_TEXT_FIELDS.end, words, "firedYou", { owner })),
    ),
    ...plainRole(
      "owner's closing line",
      "font-body",
      { room: QUIP_TEXT_ROOM, style: textOnLines(QUIP_LINES) },
      quips,
    ),
  ];
}

// The shop's rows, with nothing bought and with everything owned, beside their price or OWNED in
// a row beside a scrollbar; and its messages.
function shopRoles(): TextRoleCase[] {
  const data = { ...gameData, tuning: TEST_TUNING };
  // A label's width as Phaser gives it: its glyphs' advances at 2x.
  const advances = (font: Font, text: string) => {
    const { glyphs } = readBitmapFont(font);
    return 2 * [...text].reduce((sum, char) => sum + (glyphs.get(char)?.advance ?? 0), 0);
  };
  const rightWidth = (row: ShopRow) =>
    row.price === null
      ? SHOP_LAYOUT.row.ownedDx + advances("font-title", gameData.homeText.shop.owned.toUpperCase())
      : advances("font-body", dollarText(row.price)) + 6;
  const starting: Owned = {
    dogSlots: startingDogSlots(data),
    dogs: keysOf(data.dogs).filter((dog) => data.dogs[dog].unlock === "start"),
    gear: [],
    walkers: [],
  };
  const everything: Owned = {
    dogSlots: data.dogSlots.map((_, i) => i + 1),
    dogs: keysOf(data.dogs),
    gear: keysOf(data.shopGear),
    walkers: [],
  };
  const rowsOf = (have: Owned) => [
    ...gearRows(data, have),
    ...slotRows(data, have),
    ...dogRows(data, have),
  ];
  const rows = [starting, everything].flatMap(rowsOf);
  const wrappedRole = (role: string, font: Font, room: number, texts: readonly string[]) =>
    texts.flatMap((text) => {
      const lines = wrapWords(
        (line) => inkWidth(font, TEXT_STYLE, shownIn(font, line)),
        room,
        text,
      );
      return plainRole(role, font, { room, style: { ...TEXT_STYLE, lines: lines.length } }, [text]);
    });
  const rowRole = (role: string, text: (row: ShopRow) => string, wraps = false) =>
    rows
      .filter((row) => text(row) !== "")
      .flatMap((row) => {
        const room = shopRowTextRoom(SHOP_LAYOUT.row.width, rightWidth(row));
        return wraps
          ? wrappedRole(role, "font-body", room, [text(row)])
          : plainRole(role, "font-body", { room, style: TEXT_STYLE }, [text(row)]);
      });
  const messages = rowsOf(starting).flatMap((row) => [
    ...(row.price === null
      ? []
      : [messageLine(data.homeText, { amount: row.price, kind: "cantAfford", name: row.name })]),
    messageLine(data.homeText, { kind: "bought", name: row.name, purchase: row.purchase }),
  ]);
  return [
    ...rowRole("shop row's name", (row) => row.name),
    ...rowRole("shop row's line", (row) => row.line, true),
    ...wrappedRole(
      "shop message",
      "font-body",
      SHOP_MESSAGE_FIT.room,
      messages.flatMap((text) => (text === null ? [] : [text])),
    ),
  ];
}

// The cash on the walk bar, which stays under $1,000; and the bank on the home screen's top
// bar, every amount from nothing to the most a save holds, in full where it fits and else in
// its short form.
function cashRole(): TextRoleCase[] {
  const cash = [0, 111, 888, 999].map((dollars) => `$${dollarAmountText(cents(dollars * 100))}`);
  const width = (scale: number, text: string) => inkWidth("font-title", { scale }, text);
  const section = topSectionLayout(HOME_BAR_BUTTONS, { currency: true });
  const bank = [
    0, 5, 88, 888, 999, 1_000, 1_234, 12_345, 99_999, 123_456, 1_000_000, 123_456_789,
    90_071_992_547_409,
  ].map((dollars) => {
    const amount = cents(dollars * 100);
    const texts = { full: dollarAmountText(amount), short: shortDollarAmountText(amount) };
    return `$${topSectionCurrencyText(width, section, texts)}`;
  });
  const { room, scale } = WALK_BAR.cash;
  return [
    ...plainRole("walk bar's cash", "font-title", { room, style: { scale } }, cash),
    ...plainRole(
      "home screen's bank",
      "font-title",
      {
        room: topSectionCurrency(section, 0).room,
        style: { scale: HOME_LAYOUT.topBar.bank.scale },
      },
      bank,
    ),
  ];
}

// The neighbourhood pill's names, each beside the widest count a walk of up to nine zones could
// show, the pill inside the screen.
function zonePillRoles(): TextRoleCase[] {
  const digits = Array.from({ length: 9 }, (_, i) => String(i + 1));
  const counts = digits.flatMap((n) =>
    digits.map((total) => fillNames(gameData.runText.zoneProgress, { n, total })),
  );
  const widest = Math.max(...counts.map((count) => inkWidth("font-body", TEXT_STYLE, count)));
  const room = zonePillNameRoom(SCREEN_LAYOUT.screen, widest);
  const names = gameData.world.zones.map((zone) => zone.name);
  return plainRole("neighbourhood pill's name", "font-body", { room, style: TEXT_STYLE }, names);
}

// The zone celebration's earnings line at its widest: the fullest pack's pay, alone and with
// tips up to a million dollars.
function zoneEarningsRoles(): TextRoleCase[] {
  const { tuning } = gameData;
  const fees = cents(payFor(tuning) * read(tuning, "counts", "packSizeMax"));
  const walker = defined(keysOf(gameData.walkers)[0]);
  const lines = [0, 999, 9_999, 99_999, 999_999].map((dollars) => {
    const shown = celebrationText(gameData, {
      fees,
      kind: "zoneDone",
      tips: cents(dollars * 100),
      walker,
      zone: "",
    });
    return shown.kind === "zoneDone" ? shown.earnings.map(({ text }) => text).join("") : "";
  });
  return plainRole("zone celebration's earnings", "font-body", ZONE_EARNINGS_FIT, lines);
}

// The pause menu's note in both its forms, naming the widest walk cash (cashRole), on the note
// plate's lines.
function pauseNoteRoles(): TextRoleCase[] {
  const fields = MENU_TEXT_FIELDS.pause;
  const words = gameData.menuText.pause;
  const amounts = [888, 999].map((dollars) => dollarText(cents(dollars * 100)));
  const notes = amounts.flatMap((cash) => [
    fillLine(fields, words, "noteAll", { cash }),
    ...amounts.map((kept) => fillLine(fields, words, "note", { cash, kept })),
  ]);
  const { notePlate } = questionLayout(BODY, SCREEN_LAYOUT.walkView, {
    buttonCount: PAUSE_MENU_ITEMS.length,
    noteLines: PAUSE_NOTE_LINES,
  });
  const fit = {
    room: noteTextRoom(notePlate),
    style: { lines: PAUSE_NOTE_LINES, scale: NOTE_PLATE.scale },
  };
  return plainRole("pause menu's note", "font-body", fit, notes);
}

// The width a button's label has on panel, its key number included: a button is as wide as its
// label's ink and the label's padding either side (modalActionWidth), at most the panel's inside.
function labelTextRoom(panel: Pick<Rect, "width">): number {
  return panel.width - 4 * MODAL.pad;
}

// The pause menu's buttons' labels, and the Home question's and Quit?'s with the number key that
// picks each, on the panel each is shown on; their titles are cardTitles'.
function questionPanelRoles(): TextRoleCase[] {
  const home = gameData.runText.homeQuestion;
  const { quit } = gameData.homeText;
  const parts = (buttonCount: number) => ({ buttonCount, noteLines: 0 });
  const numbered = (labels: readonly string[]) => labels.map((label, i) => `${i + 1} ${label}`);
  const menus = [
    {
      labels: PAUSE_MENU_ITEMS.map((item) => pauseMenuItemLabel(gameData, item)),
      panel: questionLayout(BODY, overlayRegion("walk"), parts(PAUSE_MENU_ITEMS.length)).panel,
    },
    {
      labels: numbered(HOME_QUESTION_ANSWERS.map((answer) => home[answer])),
      panel: questionLayout(BODY, overlayRegion("walk"), parts(HOME_QUESTION_ANSWERS.length)).panel,
    },
    {
      labels: numbered(QUIT_QUESTION_ANSWERS.map((answer) => quit[answer])),
      panel: questionLayout(BODY, overlayRegion("home"), parts(QUIT_QUESTION_ANSWERS.length)).panel,
    },
  ];
  return menus.flatMap(({ labels, panel }) =>
    plainRole(
      "pause menu's and questions' button",
      "font-title",
      { room: labelTextRoom(panel), style: TEXT_STYLE },
      labels,
    ),
  );
}

// The update notice over the home screen, as UpdateScene lays it out. Each button is as wide as its
// label's ink and the label's padding either side (modalActionWidth), at most the card's inside.
function updateNotice() {
  const ink = (text: string) => inkWidth("font-title", TEXT_STYLE, shownIn("font-title", text));
  const { shop, update } = gameData.homeText;
  return updateModalLayout(overlayRegion("home"), {
    action: ink(update.button),
    cancel: ink(shop.confirmCancel),
    title: ink(update.title),
  });
}

// A card with a title row and a close control, and every title the data puts on it.
interface CardTitles {
  readonly card: Rect;
  readonly close?: CloseControl;
  readonly role: string;
  readonly titles: readonly string[];
}

export function cardTitles(): CardTitles[] {
  const screen = SCREEN_LAYOUT.screen;
  const home = overlayRegion("home");
  const { installSteps } = gameData.menuText.settings;
  const questions = questionLayout(BODY, screen, {
    buttonCount: PAUSE_MENU_ITEMS.length,
    noteLines: 0,
  });
  const badgeCounts = Array.from(
    { length: Object.keys(gameData.achievements).length },
    (_, i) => i + 1,
  );
  return [
    {
      card: { ...CELEBRATION_PANEL, height: CELEBRATION_PANEL.badgesHeight, y: 0 },
      role: "badge celebration's title",
      titles: badgeCounts.map((count) => celebrationTitle(gameData, count)),
    },
    {
      card: questions.panel,
      role: "pause menu's and questions' title",
      titles: [
        gameData.menuText.pause.title,
        gameData.runText.homeQuestion.title,
        gameData.homeText.quit.title,
      ],
    },
    {
      card: detailCardRect(home, home.height - 2 * MODAL.margin),
      role: "detail card's title",
      titles: [gameData.dogs, gameData.shopGear, gameData.walkers].flatMap((items) =>
        Object.values(items).map(({ name }) => name),
      ),
    },
    ...Object.values(installSteps).map(({ steps, title }) => {
      const { room, style } = INSTALL_STEPS_FIT;
      const fitted = fitInFont("font-body", style, room, shownIn("font-body", steps));
      const ink = {
        steps: Math.max(0, ...fitted.lines.map((line) => inkWidth("font-body", style, line))),
        title: inkWidth("font-title", TEXT_STYLE, shownIn("font-title", title)),
      };
      const preview = installStepsLayout(home, fitted.lines.length, ink);
      const header = modalTitleLayout(
        {
          font: TITLE,
          inkOf: (line: string) => modalTitleInk(gameFont("font-title"), line),
          widthOf: (line) => inkWidth("font-title", TEXT_STYLE, shownIn("font-title", line)),
        },
        barTitleRoom(cardTitleRow(preview.card), preview.close),
        title,
      );
      return {
        card: installStepsLayout(home, fitted.lines.length, {
          ...ink,
          titleExtraHeight: header.extraHeight,
        }).card,
        role: "install steps' title",
        titles: [title],
      };
    }),
    {
      card: updateNotice().panel,
      role: "update notice's title",
      titles: [gameData.homeText.update.title, gameData.homeText.update.failure],
    },
  ];
}

// Each card's titles in the room its title row leaves them beside its close control, and the
// pages' titles (the Pet shop's, the Logbook's, Settings' and Cheats') across their title row,
// which has none.
function cardTitleRoles(): TextRoleCase[] {
  const rooms = [
    ...cardTitles().map(({ card, close = closeControl(card), role, titles }) => ({
      role,
      room: barTitleRoom(cardTitleRow(card), close),
      titles,
    })),
    {
      role: "page title",
      room: barTitleRoom(SHOP_LAYOUT.title.row, undefined),
      titles: [
        gameData.homeText.shop.title,
        gameData.menuText.stats.title,
        gameData.menuText.settings.title,
        gameData.menuText.cheats.title,
      ],
    },
  ];
  return rooms.flatMap(({ role, room, titles }) =>
    titles.flatMap((title) => {
      const heading = modalTitleLayout(
        {
          font: TITLE,
          inkOf: (line) => modalTitleInk(gameFont("font-title"), line),
          widthOf: (line) => inkWidth("font-title", TEXT_STYLE, shownIn("font-title", line)),
        },
        room,
        title,
      );
      return plainRole(
        role,
        "font-title",
        { room, style: { lines: heading.lines.length, scale: MODAL_TITLE_SCALE } },
        [title],
      );
    }),
  );
}

// Every text role, with representative strip wording combinations.
export function textRoleCases(): TextRoleCase[] {
  const strip = everyStripLine("representative");
  const dogNames = Object.values(gameData.dogs).map(({ name }) => name);
  const badgeLayout = {
    maxNamed: BADGE_STRIP.maxNamed,
    width: END_LAYOUT.badges.width - 8,
    x: END_LAYOUT.badges.x + 4,
  };
  // The narrower of the end screen's and the celebration's named slots.
  const celebration = { ...CELEBRATION_PANEL, height: CELEBRATION_PANEL.badgesHeight, y: 0 };
  const badgeSlot = Math.min(
    defined(badgeStrip(badgeLayout, 1, BADGE_STRIP.maxNamed).slots[0]).width,
    defined(panelBadgeStrip(celebration, 1, BADGE_STRIP.maxNamed).slots[0]).width,
  );
  const { newWalker, zoneDone } = gameData.runText;
  const { settings } = gameData.menuText;
  return [
    ...cardTitleRoles(),
    ...noticeRole("strip", 2, messageStripLayout(BODY).room, strip),
    ...ownerQuipRoles(),
    ...noticeRole(
      "low-hearts chip",
      1,
      LOW_CHIP_FIT.room,
      keysOf(gameData.dogs).map((dog) => lowHeartsText(gameData, dog)),
    ),
    ...plainRole(
      "fired line",
      "font-body",
      FIRED_LINE_FIT,
      Object.values(gameData.quips).flatMap(({ fired }) => fired),
    ),
    ...changeLabelRoles(),
    ...cashRole(),
    ...pauseNoteRoles(),
    ...questionPanelRoles(),
    ...zoneEarningsRoles(),
    ...zonePillRoles(),
    ...plainRole(
      "walk card's dog name",
      "font-title",
      { room: DOG_CARD.name.room, style: { scale: DOG_CARD.name.scale } },
      dogNames,
    ),
    ...cardRoles(),
    ...plainRole(
      "celebration title",
      "font-display",
      {
        room: CELEBRATION_LAYOUT.titleRoom,
        style: { lines: CELEBRATION_LAYOUT.titleLines, scale: CELEBRATION_LAYOUT.titleScale },
      },
      [newWalker.title, zoneDone.title],
    ),
    ...plainRole(
      "walker's greeting",
      "font-body",
      GREETING_FIT,
      Object.values(gameData.walkers).map(({ greeting }) => greeting),
    ),
    ...plainRole(
      "badge name",
      "font-body",
      { room: badgeSlot - 4, style: BADGE_NAME_STYLE },
      gameData.achievements.map(({ name }) => name),
    ),
    ...plainRole(
      "start screen's dog name",
      "font-body",
      { room: DOG_TILE_TEXT_ROOM, style: TEXT_STYLE },
      dogNames,
    ),
    ...plainRole(
      "Start walk's label",
      "font-title",
      { room: HOME_LAYOUT.startLoading.room, style: { scale: HOME_LAYOUT.startLabel.scale } },
      [gameData.homeText.startWalk, gameData.homeText.startLoading],
    ),
    ...plainRole(
      "update notice's buttons",
      "font-title",
      { room: labelTextRoom(updateNotice().panel), style: TEXT_STYLE },
      [gameData.homeText.update.button, gameData.homeText.shop.confirmCancel],
    ),
    ...endRoles(),
    ...shopRoles(),
    ...plainRole(
      "settings switch note",
      "font-body",
      { room: noteRoom("switch"), style: SETTINGS_NOTE_STYLE },
      [settings.motionNote, settings.soundNote],
    ),
    ...plainRole(
      "settings build label",
      "font-body",
      SETTINGS_BUILD_LABEL,
      // A long version with a full 8-character commit, and a local build's "dev".
      ["0.0.1", "99.99.99"].flatMap((version) =>
        [UNKNOWN_COMMIT, "01234567", "89abcdef"].map((commit) => buildLabel(version, commit)),
      ),
    ),
    ...plainRole(
      "install steps",
      "font-body",
      INSTALL_STEPS_FIT,
      Object.values(settings.installSteps).map(({ steps }) => steps),
    ),
  ];
}
