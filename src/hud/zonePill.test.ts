import { keysOf } from "@andornaut/game-kit/runtime/records";
import { describe, expect, it } from "vitest";

import { gameData } from "../data/index.ts";
import { SCREEN_LAYOUT } from "../data/screen.ts";
import { fontFileMetrics, fontInk, fontInkRows } from "../testing/fontInk.ts";
import { inside } from "../testing/rects.ts";
import { TEXT_SCALE } from "../ui/textFit.ts";
import { MESSAGE_STRIP, messageStripLayout } from "./messageStrip.ts";
import { debuffBarRects, zoneProgressText } from "./walkHud.ts";
import { ZONE_PILL, zonePillLayout } from "./zonePill.ts";

const { screen, topBar } = SCREEN_LAYOUT;
const inkOf = (text: string) => {
  const ink = fontInk("font-body", { scale: TEXT_SCALE }, text);
  return { ...fontInkRows("font-body", { scale: TEXT_SCALE }, text), width: ink.right - ink.left };
};

// Every neighbourhood's name beside each count a walk shows.
const ZONES = gameData.world.zones.flatMap((zone) =>
  gameData.world.zones.map((_, i) => {
    const count = zoneProgressText(gameData, i);
    return [zone.name, count, { count: inkOf(count), name: inkOf(zone.name) }] as const;
  }),
);

describe("zonePillLayout", () => {
  it.each(ZONES)("fits %j and %j inside the screen, centred, padded and apart", (_n, _c, ink) => {
    const { countRight, nameLeft, pill } = zonePillLayout(topBar, screen, 0, ink);
    const { pad, padY, textGap } = ZONE_PILL;
    expect(inside(pill, screen)).toBe(true);
    const left = pill.x - screen.x;
    const right = screen.x + screen.width - (pill.x + pill.width);
    expect(right - left).toBeGreaterThanOrEqual(0);
    expect(right - left).toBeLessThanOrEqual(1);
    expect(nameLeft - pill.x).toBe(pad);
    expect(pill.x + pill.width - countRight).toBe(pad);
    expect(countRight - ink.count.width - (nameLeft + ink.name.width)).toBe(textGap);
    const tallest = Math.max(ink.name.bottom - ink.name.top, ink.count.bottom - ink.count.top);
    expect(pill.height).toBe(tallest + 2 * padY);
  });

  // No debuff up, and each count of debuff bars up to every debuff at once.
  const counts = Array.from({ length: keysOf(gameData.debuffs).length + 1 }, (_, i) => i);
  it.each(counts)("hangs the pill gap rows under the walk bar and %i debuff bars", (debuffs) => {
    const ink = {
      count: inkOf(zoneProgressText(gameData, 0)),
      name: inkOf(gameData.world.zones[0]!.name),
    };
    const { pill } = zonePillLayout(topBar, screen, debuffs, ink);
    const above = debuffBarRects(topBar, debuffs).at(-1) ?? topBar;
    expect(pill.y).toBe(above.y + above.height + ZONE_PILL.gap);
    const notice = messageStripLayout(fontFileMetrics("font-body"), debuffs, topBar).panel;
    expect(notice.y - pill.y).toBe(
      (debuffs === 0 ? MESSAGE_STRIP.gap : MESSAGE_STRIP.barGap) - ZONE_PILL.gap,
    );
    expect(notice.y).toBeLessThan(pill.y + pill.height);
    expect(pill.height).toBe(
      Math.max(ink.count.bottom - ink.count.top, ink.name.bottom - ink.name.top) +
        2 * ZONE_PILL.padY,
    );
  });
});
