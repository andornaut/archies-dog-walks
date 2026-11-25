import { readFileSync } from "node:fs";

import { type Point, type Rect, rectsOverlap } from "@andornaut/game-kit/runtime/rect";
import { inkRowsOfLines } from "@andornaut/game-kit/runtime/text/bitmapFont";
import { describe, expect, it } from "vitest";

import { ICON_LABEL_GAP } from "../data/layout.ts";
import { SCREEN_CONFIG } from "../data/screen.ts";
import { SCREEN_LAYOUT } from "../layout/screen.ts";
import { fontFileMetrics } from "../testing/fontInk.ts";
import { perkIconKey } from "./effectIcons.ts";
import {
  CHANGE_CHIP,
  CHANGE_LABEL_STYLE,
  changeChipPlace,
  changeLabelRoom,
  type ChipText,
  hudLanes,
  REACH_ICON,
  reachChipPlace,
} from "./hudLanes.ts";
import { messageStripLayout } from "./messageStrip.ts";
import { cashChipPlace } from "./moneyLabels.ts";
import { DOG_CARD, ownerTabRect } from "./walkHud.ts";

const layout = SCREEN_LAYOUT;
const BODY = fontFileMetrics("font-body");
const lanes = hudLanes(layout);
const messages = messageStripLayout(BODY).panel;

describe("hudLanes", () => {
  it("keeps the lanes apart from each other, the walk bar, the road and the cards' headers", () => {
    const slotPairs = layout.dogSlots.flatMap((slot, i): [string, Rect, Rect][] => {
      const header = { height: DOG_CARD.dogFace.y, width: slot.width, x: slot.x, y: slot.y };
      const label = lanes.heartLabels[i] ?? slot;
      return [
        [`heart label ${i} and the owners' tabs`, label, lanes.ownerTabs],
        [`heart label ${i} and the road`, label, layout.roadView],
        [`heart label ${i} and the card's header`, label, header],
      ];
    });
    const pairs: [string, Rect, Rect][] = [
      ["the message strip and the walk bar", messages, layout.topBar],
      ["the message strip and the road", messages, layout.roadView],
      ["the owners' tabs and the message strip", lanes.ownerTabs, messages],
      ...slotPairs,
    ];
    expect(pairs.filter(([, a, b]) => rectsOverlap(a, b)).map(([name]) => name)).toEqual([]);
  });

  it("keeps every lane on screen, with one heart label per slot and each owner tab in its lane", () => {
    expect(lanes.heartLabels).toHaveLength(layout.dogSlots.length);
    for (const lane of [messages, lanes.ownerTabs, ...lanes.heartLabels]) {
      expect(Math.min(lane.x, lane.y)).toBeGreaterThanOrEqual(0);
      expect(lane.x + lane.width).toBeLessThanOrEqual(SCREEN_CONFIG.width);
      expect(lane.y + lane.height).toBeLessThanOrEqual(SCREEN_CONFIG.height);
    }
    for (const slot of layout.dogSlots) {
      const tab = ownerTabRect(slot);
      expect(tab.y).toBeGreaterThanOrEqual(lanes.ownerTabs.y);
      expect(tab.y + tab.height).toBeGreaterThan(lanes.ownerTabs.y + lanes.ownerTabs.height - 1);
    }
  });
});

// A heart change's label, its amount on one line as wide as its room, sits on a chip inside its
// lane, the text's ink padded inside the chip (every amount fits its room:
// ui/textRoles.test.ts).
describe("a heart change's label", () => {
  it.each(lanes.heartLabels.map((lane, slot) => [slot, lane] as const))(
    "sets its amount on a chip inside card %i's lane",
    (_slot, lane) => {
      const { scale } = CHANGE_LABEL_STYLE;
      const shown = { lines: 1, scale, width: changeLabelRoom(lane.width) };
      const { chip, text: caps } = changeChipPlace(BODY, lane, shown);
      const inkBottom = caps.y + inkRowsOfLines(BODY, 1) * scale;
      expect(chip.y).toBeGreaterThanOrEqual(lane.y);
      expect(chip.y + chip.height).toBeLessThanOrEqual(lane.y + lane.height);
      expect(chip.x + chip.width).toBeLessThanOrEqual(lane.x + lane.width);
      expect(caps.y - chip.y).toBeGreaterThanOrEqual(CHANGE_CHIP.padY);
      expect(chip.y + chip.height - inkBottom).toBeGreaterThanOrEqual(CHANGE_CHIP.padY);
    },
  );
});

describe("a reached pickup's chip", () => {
  const text = { lines: 1, scale: CHANGE_LABEL_STYLE.scale, width: 30 };
  const lane = lanes.heartLabels[0] as Rect;
  const places: [string, (shown: ChipText) => { chip: Rect; text: Point }][] = [
    ["a tip's by the cash", (shown) => cashChipPlace(BODY, 0, shown)],
    ["a treat's on its card", (shown) => changeChipPlace(BODY, lane, shown)],
  ];

  it("fits the perk icon art", () => {
    const png = readFileSync(`public/art/images/${perkIconKey("longReach")}.png`);
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([
      REACH_ICON.size,
      REACH_ICON.size,
    ]);
  });

  it.each(places)(
    "widens %s chip for the icon, held at its left before the text, and keeps it when not reached",
    (_name, place) => {
      const plain = place(text);
      expect(reachChipPlace(place, false, text)).toEqual({ ...plain, icon: null });
      const { chip, icon, text: ink } = reachChipPlace(place, true, text);
      expect(REACH_ICON.gap).toBe(ICON_LABEL_GAP);
      expect(chip.width).toBe(plain.chip.width + REACH_ICON.span);
      expect(chip.height).toBe(plain.chip.height);
      expect(ink).toEqual({ x: chip.x + CHANGE_CHIP.padX + REACH_ICON.span, y: plain.text.y });
      expect(icon!.x + REACH_ICON.span).toBe(ink.x);
    },
  );

  // The icon's cell and the text's ink are one group centred on the chip's flat fill, inside its
  // 1-row frame: a clear row or more over and under it, any odd row under.
  it.each(places.flatMap(([name, place]) => [1, 2].map((lines) => [name, lines, place] as const)))(
    "centres %s chip's icon and %i-line text as one group on its fill",
    (_name, lines, place) => {
      const shown = { ...text, lines };
      const { chip, icon, text: caps } = reachChipPlace(place, true, shown);
      const top = Math.min(icon!.y, caps.y);
      const bottom = Math.max(
        icon!.y + REACH_ICON.size,
        caps.y + inkRowsOfLines(BODY, lines) * shown.scale,
      );
      const above = top - (chip.y + 1);
      const below = chip.y + chip.height - 1 - bottom;
      expect(Math.min(above, below)).toBeGreaterThanOrEqual(1);
      expect([0, 1]).toContain(below - above);
    },
  );

  it("stays centred where the cash places it", () => {
    const place = (shown: ChipText) => cashChipPlace(BODY, 0, shown);
    const centre = ({ width, x }: Rect) => x + width / 2;
    const reached = reachChipPlace(place, true, text).chip;
    expect(Math.abs(centre(reached) - centre(place(text).chip))).toBeLessThanOrEqual(0.5);
  });
});
