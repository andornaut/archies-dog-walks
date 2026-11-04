import { describe, expect, it } from "vitest";

import { gameData } from "../data/index.ts";
import { MENU_TEXT } from "../data/menuText.ts";
import { veteranSave } from "../testing/saves.ts";
import { STATS_TABS } from "./statsLayout.ts";
import { overallRows } from "./statsView.ts";

const words = MENU_TEXT.stats;

describe("the Logbook's words", () => {
  const { outcomes, overall } = overallRows(gameData, veteranSave().stats);

  it("say walk, never run, on every tab, heading and row", () => {
    const labels = [
      ...STATS_TABS.map((tab) => words.tabs[tab]),
      ...Object.values(words.sections),
      ...[...overall, ...outcomes].map(({ label }) => label),
    ];
    expect(labels.filter((label) => /\brun/i.test(label))).toEqual([]);
  });
});
