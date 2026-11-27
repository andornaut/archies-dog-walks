import { wrapWords } from "@andornaut/game-kit/runtime/lines";
import { inkRowsOfLines } from "@andornaut/game-kit/runtime/text/bitmapFont";
import { expect, it } from "vitest";

import { gameData } from "../../data/index.ts";
import { explainDetail } from "../../hud/explain.ts";
import { SCREEN_LAYOUT } from "../../layout/screen.ts";
import { withNamePills } from "../../presentation/effectNames.ts";
import { FakeDocument, type FakeElement } from "../../testing/fakeDom.ts";
import { fontFileMetrics, fontInk, gameFont, inkWidth } from "../../testing/fontInk.ts";
import { testState } from "../../testing/runState.ts";
import { newPlayerSave } from "../../testing/saves.ts";
import { artPixel, domScale, fontPixel, gridRect } from "../../ui/domScale.ts";
import { MODAL, modalFamilyWidth } from "../../ui/modal/layout.ts";
import { modalTitleInk } from "../../ui/modal/titleRole.ts";
import { PALETTE } from "../../ui/palette.ts";
import { plainMarks } from "../../ui/pixelFont.ts";
import { SEPARATOR } from "../../ui/separator.ts";
import { cents } from "../../units.ts";
import { textPart } from "../dom/detailText.ts";
import { cardTextRooms, HOME_LAYOUT } from "../homeLayout.ts";
import { slotRows } from "../shop.ts";
import { dogDetail, gearDetail, walkerDetail } from "./detail.ts";
import { detailCardView, type DetailMeasure, type DetailText } from "./detailCardView.ts";

const fonts = { body: fontFileMetrics("font-body"), title: fontFileMetrics("font-title") };
const widthOf = (font: "body" | "title", text: string) =>
  inkWidth(`font-${font}`, { scale: 2 }, plainMarks(text));
const wrap = (room: number, text: string) => wrapWords((line) => widthOf("body", line), room, text);
const measure: DetailMeasure = {
  ...fonts,
  art: () => undefined,
  bodyWidth: (lines) => Math.max(0, ...lines.map((line) => widthOf("body", line))),
  hasTag: () => false,
  inkWidth: widthOf,
  titleInk: (line) => modalTitleInk(gameFont("font-title"), line),
  wrapBody: wrap,
  wrapNote: wrap,
};
const bottom = (text: DetailText) =>
  text.capTop + inkRowsOfLines(fonts[text.font ?? "body"], text.lines.length) * (text.scale ?? 2);
const card = dogDetail(gameData, newPlayerSave.owned, cents(1_000_000), "sequoia");
const picture = { key: "missing-test-portrait", scale: 1 };

it("places the owner below the portrait row, photo aligned to the dog-art column", () => {
  const view = detailCardView(gameData, measure, SCREEN_LAYOUT.screen, {
    card,
    kind: "dog",
    picture,
  });
  const [well, photo] = view.framed;
  expect(photo!.rect.x + photo!.rect.width).toBe(well!.rect.x + well!.rect.width);
  const details = view.texts.filter((text) =>
    [card.subtitle, ...card.lines].includes(text.lines.join(" ")),
  );
  expect(photo!.rect.y).toBeGreaterThan(
    Math.max(well!.rect.y + well!.rect.height, ...details.map(bottom)),
  );
  const owner = view.texts.filter((text) =>
    [card.owner!.name, card.owner!.role].includes(text.lines.join(" ")),
  );
  expect(owner.every((text) => text.x > photo!.rect.x + photo!.rect.width)).toBe(true);
  const divider = view.separators![0]!;
  expect(divider.y - Math.max(well!.rect.y + well!.rect.height, ...details.map(bottom))).toBe(
    SEPARATOR.clear,
  );
  expect(Math.min(photo!.rect.y, ...owner.map((text) => text.capTop)) - divider.y - 1).toBe(
    SEPARATOR.clear,
  );
  expect(view.separators).toHaveLength(1);
});

it.each([false, true])(
  "centres a single-ink price and separate status row when locked is %s",
  (locked) => {
    const prompt = gameData.homeText.detail.saveUp;
    const view = detailCardView(gameData, measure, SCREEN_LAYOUT.screen, {
      card: { ...card, locked },
      kind: "dog",
      picture,
      statusLines: [
        { kind: "price", text: card.status },
        { kind: "status", text: prompt },
      ],
    });
    const price = view.texts.find((text) => text.font === "title")!;
    const saving = view.texts.find((text) => text.lines.join(" ") === prompt)!;
    for (const text of [price, saving]) {
      expect(text.align).toBe("inkCentre");
      expect(text.x).toBe(view.card.panel.x + view.card.panel.width / 2);
      expect(text.scale ?? 2).toBe(2);
    }
    expect(view.separators).toHaveLength(2);
    expect(price.spans).toBeUndefined();
    expect(price.colour).toBe(locked ? PALETTE.darkRed : PALETTE.plum);
    expect(saving.colour).toBe(locked ? PALETTE.darkRed : PALETTE.forest);
    expect(saving.capTop - bottom(price)).toBe(MODAL.pad);
    expect(price.capTop - (view.separators!.at(-1)!.y + 1)).toBe(SEPARATOR.clear);
    expect(view.card.footer!.rect.y - bottom(saving)).toBe(MODAL.gap);
  },
);

it("keeps the wrapped walker unlock sentence in one centred text block", () => {
  const info = walkerDetail(gameData, newPlayerSave.owned, "ada");
  const view = detailCardView(gameData, measure, SCREEN_LAYOUT.screen, {
    card: info,
    kind: "walker",
    picture,
  });
  const expected = wrap(cardTextRooms(view.card.panel.width).full, info.status);
  expect(expected.length).toBeGreaterThan(1);
  const status = view.texts.find((text) => text.lines.join(" ") === info.status)!;
  expect(status.lines).toEqual(expected);
  expect(status.align).toBe("inkCentre");
  expect(view.card.footer!.rect.y - bottom(status)).toBe(MODAL.gap);
});

it("shows only the price below an affordable card with Cancel and primary Buy", () => {
  const purchase = {
    buy: gameData.homeText.shop.confirmBuy,
    cancel: gameData.homeText.shop.confirmCancel,
  };
  const view = detailCardView(gameData, measure, SCREEN_LAYOUT.screen, {
    card,
    kind: "dog",
    picture,
    purchase,
    statusLines: [{ kind: "price", text: card.status }],
  });
  expect(view.card.footer).toBeUndefined();
  expect(view.card.buttons.map(({ label, primary }) => [label, primary])).toEqual([
    [purchase.cancel, false],
    [purchase.buy, true],
  ]);
  const [cancel, buy] = view.card.buttons;
  expect(buy!.rect.y > cancel!.rect.y || buy!.rect.x > cancel!.rect.x).toBe(true);
  const price = view.texts.find((text) => text.font === "title")!;
  expect(price.lines).toEqual([card.status]);
  expect(view.texts.filter((text) => text.capTop >= price.capTop)).toEqual([price]);
});

it("fits all authored dog details at full font size with separate price and saving rows", () => {
  const prompt = gameData.homeText.detail.saveUp;
  for (const dog of Object.keys(gameData.dogs) as (keyof typeof gameData.dogs)[]) {
    const info = dogDetail(gameData, newPlayerSave.owned, cents(1_000_000), dog);
    const view = detailCardView(gameData, measure, SCREEN_LAYOUT.screen, {
      card: info,
      kind: "dog",
      picture,
      statusLines: [
        { kind: "price", text: info.status },
        { kind: "status", text: prompt },
      ],
    });
    expect(view.card.panel.height, dog).toBeLessThanOrEqual(
      SCREEN_LAYOUT.screen.height - 2 * MODAL.margin,
    );
    expect(view.card.footer!.rect.y, dog).toBeGreaterThanOrEqual(
      Math.max(...view.texts.map(bottom)) + MODAL.gap,
    );
  }
});

it("keeps the slot icon and capacity without an owner or owner divider", () => {
  const slot = slotRows(gameData, newPlayerSave.owned)[0]!;
  const key = "icon-dog-slot";
  const view = detailCardView(
    gameData,
    {
      ...measure,
      art: (artKey) => (artKey === key ? { height: 32, width: 32 } : undefined),
    },
    SCREEN_LAYOUT.screen,
    {
      card: {
        lines: [slot.line],
        locked: false,
        status: gameData.homeText.shop.owned,
        subtitle: "",
        title: slot.name,
      },
      kind: "dogSlot",
      picture: { key, scale: 2 },
    },
  );
  expect(view.art.map(({ key: artKey, scale }) => [artKey, scale])).toEqual([[key, 2]]);
  expect(view.separators).toEqual([]);
  expect(view.texts.some(({ lines }) => lines.join(" ") === slot.line)).toBe(true);
  expect(view.card.footer!.label).toBe(gameData.menuText.common.close);
});

it.each([
  { dpr: 1, width: 360 },
  { dpr: 2.625, width: 575 },
])("centres rendered segmented price and status ink at fit $width DPR $dpr", ({ dpr, width }) => {
  const prompt = gameData.homeText.detail.saveUp;
  const view = detailCardView(gameData, measure, SCREEN_LAYOUT.screen, {
    card: { ...card, locked: true },
    kind: "dog",
    picture,
    statusLines: [
      { kind: "price", text: card.status },
      { kind: "status", text: prompt },
    ],
  });
  const scale = domScale(dpr, { height: 894, width, x: 0, y: 0 });
  const panel = gridRect(scale, view.card.panel);
  const middle = panel.left + panel.width / 2;
  for (const row of view.texts.filter(
    (text) => text.font === "title" || text.lines.join(" ") === prompt,
  )) {
    const doc = new FakeDocument();
    const part = textPart(
      doc as unknown as Document,
      {
        fonts: { body: gameFont("font-body"), title: gameFont("font-title") },
        pillColours: () => undefined,
      },
      row,
    );
    part.place(scale);
    const runs = (part.element as unknown as FakeElement).children.filter((element) =>
      element.classList.contains("adw-text"),
    );
    const ink = runs.map((run) => {
      const bounds = fontInk(
        `font-${row.font ?? "body"}`,
        { scale: fontPixel(scale, row.scale ?? 2) },
        run.textContent,
      );
      const x = Number.parseFloat(run.style.left ?? "");
      return { left: x + bounds.left, right: x + bounds.right };
    });
    const centre =
      (Math.min(...ink.map((run) => run.left)) + Math.max(...ink.map((run) => run.right))) / 2;
    expect(Math.abs(centre - middle), row.lines.join(" ")).toBeLessThanOrEqual(
      artPixel(scale) / 2 + 0.5,
    );
  }
});

it.each(["gear", "dogSlot"] as const)(
  "separates a %s price group from its item details",
  (kind) => {
    const slot = slotRows(gameData, newPlayerSave.owned)[1]!;
    const view = detailCardView(gameData, measure, SCREEN_LAYOUT.screen, {
      card: {
        lines: [slot.line],
        locked: true,
        status: card.status,
        subtitle: "",
        title: slot.name,
      },
      kind,
      picture,
      statusLines: [
        { kind: "price", text: card.status },
        { kind: "status", text: gameData.homeText.detail.saveUp },
      ],
    });
    expect(view.separators).toHaveLength(1);
    const divider = view.separators![0]!;
    const well = view.framed[0]!.rect;
    const details = view.texts.filter((text) => text.lines.join(" ") === slot.line);
    const price = view.texts.find((text) => text.font === "title")!;
    expect(divider.y - Math.max(well.y + well.height, ...details.map(bottom))).toBe(
      SEPARATOR.clear,
    );
    expect(price.capTop - divider.y - divider.height).toBe(SEPARATOR.clear);
    expect(view.card.panel.height).toBeLessThanOrEqual(
      SCREEN_LAYOUT.screen.height - 2 * MODAL.margin,
    );
  },
);

const mrB = walkerDetail(gameData, newPlayerSave.owned, "mrB");
const shoes = gearDetail(
  gameData,
  newPlayerSave.owned,
  cents(0),
  newPlayerSave.lastLoadout,
  "runningShoes",
);
const slot = slotRows(gameData, newPlayerSave.owned)[0]!;
it.each([
  { card: mrB, description: mrB.lines, kind: "walker" },
  { card: shoes, description: shoes.lines, kind: "gear" },
  { card, description: card.lines.slice(1), kind: "dog" },
  {
    card: {
      lines: [slot.line],
      locked: false,
      status: gameData.homeText.shop.owned,
      subtitle: "",
      title: slot.name,
    },
    description: [slot.line],
    kind: "dogSlot",
  },
] as const)(
  "packs $kind $card.title prose into the whole right-of-portrait column",
  ({ card: info, description, kind }) => {
    const view = detailCardView(gameData, measure, SCREEN_LAYOUT.screen, {
      card: info,
      kind,
      picture,
    });
    const full = cardTextRooms(view.card.panel.width).beside;
    const well = view.framed[0]!.rect;
    for (const line of description) {
      const text = withNamePills(gameData, line);
      const row = view.texts.find((row) => row.lines.join(" ") === text)!;
      expect(row, line).toBeDefined();
      expect(row.x).toBe(view.card.panel.x + HOME_LAYOUT.card.besideX);
      expect(row.lines).toEqual(wrap(full, text));
      expect(row.capTop).toBeGreaterThanOrEqual(well.y);
      expect(row.lines.every((line) => widthOf("body", line) <= full)).toBe(true);
      for (let i = 0; i < row.lines.length - 1; i += 1) {
        const word = row.lines[i + 1]!.split(/\s+/)[0]!;
        expect(widthOf("body", `${row.lines[i]} ${word}`)).toBeGreaterThan(full);
      }
    }
  },
);

it("retains a fitting Medium for Mr. B despite fewer description lines on Large", () => {
  const info = walkerDetail(gameData, newPlayerSave.owned, "mrB");
  const prose = info.lines.map((line) => withNamePills(gameData, line));
  const rowsAt = (family: "medium" | "large") => {
    const width = modalFamilyWidth(SCREEN_LAYOUT.screen.width - 2 * MODAL.margin, family);
    return prose.reduce((count, text) => count + wrap(cardTextRooms(width).beside, text).length, 0);
  };
  expect(rowsAt("medium")).toBeGreaterThan(rowsAt("large"));
  const view = detailCardView(gameData, measure, SCREEN_LAYOUT.screen, {
    card: info,
    kind: "walker",
    picture,
  });
  expect(view.card.panel.width).toBe(
    modalFamilyWidth(SCREEN_LAYOUT.screen.width - 2 * MODAL.margin, "medium"),
  );
});

it("keeps real narrow description wrapping and applies the same layout to a debuff explanation", () => {
  const info = explainDetail(
    gameData,
    newPlayerSave,
    testState({ archie: 3 }, { debuffs: [{ debuff: "muddy", secondsLeft: 9.2 }] }),
    { debuff: "muddy", kind: "debuff" },
  )!;
  const area = { ...SCREEN_LAYOUT.screen, width: 240 };
  const view = detailCardView(gameData, measure, area, info);
  const full = cardTextRooms(view.card.panel.width).beside;
  const prose = withNamePills(gameData, info.card.lines[0]!);
  const row = view.texts.find((row) => row.lines.join(" ") === prose)!;
  expect(row.x).toBe(view.card.panel.x + HOME_LAYOUT.card.besideX);
  expect(row.lines).toEqual(wrap(full, prose));
  expect(row.lines.every((line) => widthOf("body", line) <= full)).toBe(true);
  const walker = detailCardView(gameData, measure, area, { card: mrB, kind: "walker", picture });
  const room = cardTextRooms(walker.card.panel.width).beside;
  const proseLines = mrB.lines.map((line) => withNamePills(gameData, line));
  expect(proseLines.some((text) => wrap(room, text).length > 1)).toBe(true);
  for (const text of proseLines) {
    const shown = walker.texts.find((row) => row.lines.join(" ") === text)!;
    expect(shown.lines).toEqual(wrap(room, text));
    expect(shown.lines.every((line) => widthOf("body", line) <= room)).toBe(true);
  }
});
