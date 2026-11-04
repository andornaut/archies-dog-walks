import { fillNames } from "@andornaut/game-kit/lines";
import { keysOf } from "@andornaut/game-kit/records";
import { rectsOverlap } from "@andornaut/game-kit/rect";
import { inkRowsFromCapTop } from "@andornaut/game-kit/text/bitmapFont";
import { describe, expect, it } from "vitest";

import { gameData } from "../data/index.ts";
import type { DogId, LiveTuning } from "../data/types.ts";
import { TITLE_CAP_ROWS } from "../hud/walkHud.ts";
import { scrollMax } from "../input/listScroll.ts";
import { MIN_TAP_SIZE } from "../layout/screenLayout.ts";
import { sizeHearts } from "../rules/dogs.ts";
import { capitalize, SIZE_NAMES } from "../rules/effectText.ts";
import { startingDogSlots, unlockPrice } from "../rules/shop.ts";
import type { Owned } from "../save/schema.ts";
import { fontFileMetrics, inkWidth, placedInk } from "../testing/fontInk.ts";
import { TEST_TUNING } from "../testing/tuning.ts";
import { GREYED, pictureBox, SELECT_OUTSET } from "../ui/selection.ts";
import { TEXT_SCALE } from "../ui/textFit.ts";
import { cents } from "../units.ts";
import { FEEDBACK } from "./feedback.ts";
import { gearByPrice, type Purchase } from "./home.ts";
import {
  dogRows,
  gearRows,
  ownedCountNote,
  SHOP_ROW_VIEWS,
  SHOP_TABS,
  shopAffordable,
  shopOpenTab,
  type ShopRow,
  shopRowId,
  shopRowLook,
  type ShopTab,
  shopTabOf,
  slotRows,
} from "./shop.ts";
import {
  rowRects,
  SHOP_LAYOUT,
  SHOP_MESSAGE_FIT,
  shopListBottom,
  shopListFrame,
  shopMessageCapTop,
  shopScrollbar,
  shopTabRects,
} from "./shopLayout.ts";
import { STATS_TABS } from "./statsLayout.ts";

const data = { ...gameData, tuning: TEST_TUNING };
const dollars = (amount: number) => cents(amount * 100);
const starters = keysOf(data.dogs).filter((dog) => data.dogs[dog].unlock === "start");
const starting = startingDogSlots(data);
const owned: Owned = { dogSlots: starting, dogs: starters, gear: [], walkers: [] };
// Every slot by number, counting from 1.
const allSlots = data.dogSlots.map((_, i) => i + 1);
// Every set of slots a player can own, named: the starting ones and any of the others.
const slotSets = allSlots
  .filter((slot) => !starting.includes(slot))
  .reduce<number[][]>((sets, slot) => [...sets, ...sets.map((set) => [...set, slot])], [starting])
  .map((set) => [set.join(" and "), set] as const);
const everything: Owned = {
  dogSlots: allSlots,
  dogs: keysOf(data.dogs),
  gear: keysOf(data.shopGear),
  walkers: [],
};

describe("shopRowLook", () => {
  // Every row for sale (each slot, gear item and dog not owned), and the first of each kind of
  // purchase with the bank at its price and a cent short: the look reads only the price.
  const forSale: readonly ShopRow[] = [
    ...slotRows(data, owned),
    ...gearRows(data, owned),
    ...dogRows(data, owned),
  ].filter((row) => row.price !== null);
  const firstOfKind = forSale.filter(
    (row, i) => forSale.findIndex((other) => other.purchase.kind === row.purchase.kind) === i,
  );
  const banks = firstOfKind.flatMap((row) => {
    const price = row.price ?? cents(0);
    return [
      { art: "colour", bank: price, box: GREYED.affordBox, id: row.id, look: "affordable", row },
      { art: "grey", bank: cents(price - 1), box: GREYED.box, id: row.id, look: "short", row },
    ] as const;
  });

  it.each(banks)("shows $id $look, its art in $art on $box", ({ art, bank, box, look, row }) => {
    const shown = shopRowLook(data, owned, bank, row);
    const view = SHOP_ROW_VIEWS[shown];
    expect({ art: view.art, box: pictureBox(view), look: shown }).toEqual({ art, box, look });
  });
});

describe("slotRows", () => {
  // Every slot listed in order with the one slot line, the owned ones owned whichever they are,
  // each one for sale at its own price and opening the shop on its own row, and the heading's
  // count the slots owned out of all of them.
  it.each(slotSets)("lists every slot, owned ones marked, with slots %s owned", (_, dogSlots) => {
    const have = { ...owned, dogSlots };
    const rows = slotRows(data, have);
    expect(rows.map(({ id }) => id)).toEqual(allSlots.map((slot) => `slot:${slot}`));
    rows.forEach((row, i) => {
      const slot = allSlots[i] ?? 0;
      expect(row.line).toBe(data.homeText.shop.slotLine);
      expect(row.purchase).toEqual({ kind: "dogSlot", slot });
      expect(shopRowId(row.purchase)).toBe(row.id);
      expect(row.price).toBe(
        dogSlots.includes(slot)
          ? null
          : unlockPrice(data.tuning, data.dogSlots[i] ?? data.dogSlots[0]),
      );
    });
    expect(ownedCountNote(data, have, "slots")).toBe(
      fillNames(data.homeText.shop.ownedCount, {
        max: String(rows.length),
        owned: String(dogSlots.length),
      }),
    );
  });

  it("puts the dog heading under the last slot row", () => {
    const { dogHeadingY, slotRows: spec } = SHOP_LAYOUT.dogs;
    const last = rowRects(SHOP_LAYOUT.row.width, spec, slotRows(data, owned).length).at(-1);
    expect(last && last.y + last.height).toBeLessThan(dogHeadingY);
  });
});

describe("gearRows and dogRows", () => {
  it("list every gear item cheapest first, an owned one in place without a price", () => {
    const rows = gearRows(data, { ...owned, gear: ["fannyPack"] });
    expect(rows.map(({ id }) => id)).toEqual(gearByPrice(data).map((gear) => `gear:${gear}`));
    expect(rows.find(({ id }) => id === "gear:fannyPack")?.price).toBeNull();
  });

  const allDogs = keysOf(data.dogs);
  const forSale = allDogs.filter((dog) => !starters.includes(dog));
  const dogOf = (row: ShopRow): DogId => (row.purchase.kind === "dog" ? row.purchase.dog : "kilo");

  // Owning a dog keeps its row in place, marked owned as gear is: no price, the owned look.
  it.each<[string, readonly DogId[]]>([
    ["nothing bought", starters],
    ["one dog bought", [...starters, forSale[0] ?? "kilo"]],
    ["every dog bought", allDogs],
  ])("list every dog in one order, owned ones marked owned, with %s", (_, dogs) => {
    const holding = { ...owned, dogs: [...dogs] };
    const rows = dogRows(data, holding);
    expect(rows.map(({ id }) => id)).toEqual(dogRows(data, owned).map(({ id }) => id));
    expect(rows.map(dogOf).sort()).toEqual([...allDogs].sort());
    rows.forEach((row) => {
      const have = dogs.includes(dogOf(row));
      expect(row.price === null).toBe(have);
      expect(shopRowLook(data, holding, dollars(100_000), row) === "owned").toBe(have);
    });
  });

  const dogPrice = (tuning: LiveTuning, dog: DogId) => unlockPrice(tuning, data.dogs[dog]);
  const withDogPrices = (pick: (dog: DogId) => number): LiveTuning => ({
    ...TEST_TUNING,
    money: {
      ...TEST_TUNING.money,
      prices: {
        ...TEST_TUNING.money.prices,
        ...Object.fromEntries(
          forSale.flatMap((dog) => {
            const item = data.dogs[dog];
            return item.unlock === "shop" ? [[item.price, pick(dog)]] : [];
          }),
        ),
      },
    },
  });
  const dollarPrices = forSale.map((dog) => dogPrice(TEST_TUNING, dog) / 100);
  const cheapestDog = forSale.reduce((a, b) =>
    dogPrice(TEST_TUNING, b) < dogPrice(TEST_TUNING, a) ? b : a,
  );
  const dogTunings: readonly [string, LiveTuning][] = [
    ["today's prices", TEST_TUNING],
    ["every dog at one price", withDogPrices(() => Math.max(...dollarPrices))],
    [
      "the cheapest dog retuned above the dearest",
      withDogPrices((dog) =>
        dog === cheapestDog ? Math.max(...dollarPrices) + 1 : dogPrice(TEST_TUNING, dog) / 100,
      ),
    ],
  ];

  it.each(dogTunings)(
    "list every dog cheapest first by list price, ties in data order, at %s",
    (_, tuning) => {
      const order = dogRows({ ...data, tuning }, owned).map(dogOf);
      expect(order.slice(0, starters.length)).toEqual(starters);
      order.slice(1).forEach((dog, i) => {
        const before = order[i] as DogId;
        const step = dogPrice(tuning, dog) - dogPrice(tuning, before);
        expect(step).toBeGreaterThanOrEqual(0);
        if (step === 0) {
          expect(allDogs.indexOf(dog)).toBeGreaterThan(allDogs.indexOf(before));
        }
      });
    },
  );

  it("gives a dog's row its size and hearts, and its price on the plate", () => {
    const dog = forSale[0] ?? "kilo";
    const row = dogRows(data, owned).find(({ id }) => id === `dog:${dog}`);
    const { size } = data.dogs[dog];
    const kind = fillNames(data.homeText.focus.kind, {
      hearts: String(sizeHearts(data.tuning, data.dogs[dog])),
      size: SIZE_NAMES[size],
    });
    expect(row?.line).toBe(capitalize(kind));
    expect(row?.price).toBe(unlockPrice(data.tuning, data.dogs[dog]));
  });
});

describe("shopAffordable", () => {
  it("holds while the bank covers anything, and fails once everything is owned", () => {
    expect(shopAffordable(data, owned, dollars(600))).toBe(true);
    expect(shopAffordable(data, owned, dollars(0))).toBe(false);
    expect(shopAffordable(data, everything, dollars(100_000))).toBe(false);
  });
});

// Each list's heading note counts what the list sells that is owned, out of all of it, and
// sits right of the heading's ink with a gap, beside a scrollbar too.
describe("ownedCountNote", () => {
  const titles = {
    dogs: data.homeText.shop.dogs,
    gear: data.homeText.shop.tabs.gear,
    slots: data.homeText.shop.slots,
  };
  const note = (have: number, max: number) =>
    data.homeText.shop.ownedCount.replace("{owned}", String(have)).replace("{max}", String(max));
  const cases = [owned, everything].flatMap((have) => [
    ["dogs", have, have.dogs.length, Object.keys(data.dogs).length] as const,
    ["gear", have, have.gear.length, Object.keys(data.shopGear).length] as const,
    ["slots", have, have.dogSlots.length, data.dogSlots.length] as const,
  ]);
  const style = { scale: 2 };

  it.each(cases)("%s: counts owned of all, clear of heading", (list, have, count, max) => {
    const text = ownedCountNote(data, have, list);
    expect(text).toBe(note(count, max));
    const titleRight =
      SHOP_LAYOUT.headingX + placedInk("font-title", style, titles[list].toUpperCase()).right;
    const noteLeft = shopListFrame(true).headingRight - inkWidth("font-body", style, text);
    expect(titleRight + 8).toBeLessThanOrEqual(noteLeft);
  });
});

describe("shopRowId and shopTabOf", () => {
  it("puts each purchase's row on the tab that lists it", () => {
    const rows: Record<ShopTab, ShopRow[]> = {
      dogs: [...slotRows(data, owned), ...dogRows(data, owned)],
      gear: gearRows(data, owned),
    };
    const purchases: Purchase[] = [
      { dog: "reggie", kind: "dog" },
      ...allSlots.map((slot): Purchase => ({ kind: "dogSlot", slot })),
      { gear: "luckyCollar", kind: "gear" },
    ];
    for (const purchase of purchases) {
      const ids = rows[shopTabOf(purchase)].map(({ id }) => id);
      expect(ids).toContain(shopRowId(purchase));
    }
  });
});

describe("shopOpenTab", () => {
  it.each<[string, ShopTab, Purchase | undefined]>([
    ["no item", "dogs", undefined],
    ["a dog", "dogs", { dog: "reggie", kind: "dog" }],
    ["a dog slot", "dogs", { kind: "dogSlot", slot: 2 }],
    ["gear", "gear", { gear: "luckyCollar", kind: "gear" }],
  ])("with %s, opens on the %s tab", (_, tab, focus) => {
    expect(shopOpenTab(focus)).toBe(tab);
  });
});

// A message, at 2x on one line, keeps its ink inside its plate's frame (every message fits the
// plate's room: ui/textRoles.test.ts).
describe("the shop's message", () => {
  const body = fontFileMetrics("font-body");
  const { frame, plate, textDx } = SHOP_LAYOUT.message;
  const { room, style } = SHOP_MESSAGE_FIT;

  it("keeps a message's ink inside its plate's frame", () => {
    expect(room).toBeLessThanOrEqual(plate.width - 2 * textDx);
    const capTop = shopMessageCapTop(body, style.scale);
    expect(capTop).toBeGreaterThanOrEqual(plate.y + frame);
    expect(capTop + inkRowsFromCapTop(body) * style.scale).toBeLessThanOrEqual(
      plate.y + plate.height - frame,
    );
  });

  // The plate sits at the top of the list area, under the tabs, across the tabs' span, and ends
  // over every tab's first row as far under it as the selected tab's frame ends over it.
  it("lies across the list's top, under the tabs, over each tab's first row", () => {
    const { list, tab } = SHOP_LAYOUT;
    const tabBottom = tab.drawY + tab.drawHeight + SELECT_OUTSET;
    expect(plate).toMatchObject({ width: tab.span, x: tab.x, y: list.rect.y });
    for (const rows of [SHOP_LAYOUT.dogs.slotRows, SHOP_LAYOUT.gear.rows]) {
      expect(rows.y - (plate.y + plate.height)).toBe(plate.y - tabBottom);
    }
  });
});

// Every heading's capitals sit as far over its rows as under the selected tab or the rows
// before it, and the first heading's are centred on the message's plate.
describe("the shop's headings", () => {
  const caps = TITLE_CAP_ROWS * TEXT_SCALE;
  const { dogs, gear, message, tab } = SHOP_LAYOUT;
  const tabBottom = tab.drawY + tab.drawHeight + SELECT_OUTSET;
  const lastSlotBottom = (count: number) =>
    dogs.slotRows.y + (count - 1) * dogs.slotRows.pitch + dogs.slotRows.height;
  it.each<[string, number, number, number]>([
    ["dog slots", dogs.slotHeadingY, tabBottom, dogs.slotRows.y],
    ["dogs", dogs.dogHeadingY, lastSlotBottom(allSlots.length), dogs.dogRows.y],
    ["gear", gear.headingY, tabBottom, gear.rows.y],
  ])("%s: as far over its rows as under what is above it", (_, y, above, rows) => {
    expect(rows - (y + caps)).toBe(y - above);
  });

  it("centres the first heading's capitals on the message's plate", () => {
    const { plate } = message;
    expect(dogs.slotHeadingY - plate.y).toBe(Math.floor((plate.height - caps) / 2));
  });
});

// Selected tabs clear the title row and retain the gap over the list.
describe("the shop's tabs", () => {
  it("clear the title row and the list by at least 6px when selected", () => {
    const { list, tab } = SHOP_LAYOUT;
    const row = SHOP_LAYOUT.title.row;
    const above = tab.drawY - FEEDBACK.liftPx - SELECT_OUTSET - (row.y + row.height);
    const below = list.rect.y - (tab.drawY + tab.drawHeight + SELECT_OUTSET);
    expect(SHOP_LAYOUT.close.hit.x + SHOP_LAYOUT.close.hit.width).toBe(
      SHOP_LAYOUT.panel.x + SHOP_LAYOUT.panel.width,
    );
    expect(above).toBeGreaterThanOrEqual(6);
    expect(below).toBe(6);
  });

  // The shop's tabs and the Logbook's split the same span, gap apart, each a full tap target.
  it.each([
    ["Pet shop", SHOP_TABS.length],
    ["Logbook", STATS_TABS.length],
  ])("%s: split the tab span evenly", (_, count) => {
    const { gap, span, x } = SHOP_LAYOUT.tab;
    const tabs = shopTabRects(count);
    expect(tabs).toHaveLength(count);
    expect(tabs[0]?.x).toBe(x);
    const last = tabs.at(-1);
    expect((last?.x ?? 0) + (last?.width ?? 0)).toBe(x + span);
    tabs.slice(1).forEach((tab, i) => {
      const before = tabs[i];
      expect(tab.x - (before?.x ?? 0) - (before?.width ?? 0)).toBe(gap);
      expect(Math.abs(tab.width - (before?.width ?? 0))).toBeLessThan(count);
    });
    for (const tab of tabs) {
      expect(Math.min(tab.width, tab.height)).toBeGreaterThanOrEqual(MIN_TAP_SIZE);
      expect(rectsOverlap(tab, SHOP_LAYOUT.close.hit)).toBe(false);
      expect(
        tab.y - (SHOP_LAYOUT.close.hit.y + SHOP_LAYOUT.close.hit.height),
      ).toBeGreaterThanOrEqual(4);
    }
  });
});

// Each tab's list, with nothing bought and with everything bought, scrolls far enough to bring
// its last row inside the list area, and no further than its padding below it.
describe("the shop's list", () => {
  const { padBottom, rect } = SHOP_LAYOUT.list;
  const listBottom = rect.y + rect.height;
  const lists = [
    ["gear, nothing bought", SHOP_LAYOUT.gear.rows, gearRows(data, owned).length],
    ["gear, everything bought", SHOP_LAYOUT.gear.rows, gearRows(data, everything).length],
    ["dogs, nothing bought", SHOP_LAYOUT.dogs.dogRows, dogRows(data, owned).length],
    ["dogs, everything bought", SHOP_LAYOUT.dogs.dogRows, dogRows(data, everything).length],
  ] as const;

  // max: how far the list moves; y: its scroll. The track runs the list area's height, the
  // thumb thumbInset inside it.
  it.each<[string, number, number, "bottom" | "top"]>([
    ["sits at the top scrolled to the top", 200, 0, "top"],
    ["sits at the bottom scrolled to the bottom", 200, 200, "bottom"],
    ["sits at the bottom of a long list scrolled to the bottom", 5000, 5000, "bottom"],
  ])("the scrollbar's thumb %s", (_, max, y, end) => {
    const bar = shopScrollbar(max, y);
    expect(bar).not.toBeNull();
    const { thumb, track } = bar ?? { thumb: rect, track: rect };
    expect(track).toMatchObject({ height: rect.height, y: rect.y });
    const { thumbInset, thumbMin } = SHOP_LAYOUT.scrollbar;
    expect(thumb.height).toBeGreaterThanOrEqual(thumbMin);
    if (end === "top") {
      expect(thumb.y).toBe(track.y + thumbInset);
    } else {
      expect(thumb.y + thumb.height).toBe(track.y + track.height - thumbInset);
    }
  });

  // Each list scrolls its last row into view. Its rows and heading note end where its scrollbar
  // allows: at the tabs' right edge with no scrollbar, else short of the track. A selected row's
  // frame stays inside the list area, which stays inside the card's 8px frame.
  it.each(lists)("%s: scrolls to its last row, rows to their edge", (_, spec, count) => {
    const bottom = shopListBottom(spec, count);
    const max = scrollMax(rect, bottom);
    const lastRowBottom = spec.y + (Math.max(1, count) - 1) * spec.pitch + spec.height;
    expect(lastRowBottom - max).toBeLessThanOrEqual(listBottom - padBottom);
    expect(bottom - max).toBeLessThanOrEqual(listBottom);
    const scrolls = max > 0;
    const frame = shopListFrame(scrolls);
    const tabsRight = Math.max(...shopTabRects(SHOP_TABS.length).map(({ width, x }) => x + width));
    const track = shopScrollbar(scrolls ? 1 : 0, 0)?.track;
    const { panel } = SHOP_LAYOUT;
    for (const row of rowRects(frame.rowWidth, spec, count)) {
      const right = row.x + row.width;
      expect(frame.headingRight).toBe(right);
      if (track === undefined) {
        expect(right).toBe(tabsRight);
      } else {
        expect(right).toBeLessThan(track.x);
      }
      const outer = { left: row.x - SELECT_OUTSET, right: right + SELECT_OUTSET };
      expect(outer.left).toBeGreaterThanOrEqual(frame.rect.x);
      expect(outer.right).toBeLessThanOrEqual(frame.rect.x + frame.rect.width);
      expect(frame.rect.x + frame.rect.width).toBeLessThanOrEqual(panel.x + panel.width - 8);
    }
  });

  // The scrollbar stays clear of the list area, where the rows and their frames are clipped,
  // inside the card's 8px frame, with the thumb thumbInset inside the track; a list that fits
  // has none.
  it("puts the scrollbar between the list area and the card's frame", () => {
    expect(shopScrollbar(0, 0)).toBeNull();
    const bar = shopScrollbar(100, 0);
    const { panel, scrollbar } = SHOP_LAYOUT;
    const { thumb, track } = bar ?? { thumb: rect, track: rect };
    expect(track.x).toBeGreaterThanOrEqual(rect.x + rect.width);
    expect(track.x + track.width).toBeLessThanOrEqual(panel.x + panel.width - 8);
    expect(thumb.x - track.x).toBe(scrollbar.thumbInset);
    expect(track.x + track.width - (thumb.x + thumb.width)).toBe(scrollbar.thumbInset);
  });
});
