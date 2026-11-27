import { describe, expect, it } from "vitest";

import { gameData } from "../data/index.ts";
import { bodyTextWidth } from "../testing/bodyFont.ts";
import {
  fillNoticeText,
  noticeRows,
  noticeTextWithNamePills,
  ownerNameText,
} from "./noticeText.ts";

const width = (line: string) => bodyTextWidth(2, line);
const owner = ownerNameText(gameData, "sequoia");

describe("notice owner names", () => {
  it("wraps an owner and their signed heart value together at the measured row edge", () => {
    const phrase = `${owner.text} −12♥`;
    const notice = fillNoticeText("Oh no: {owner} −12♥", { owner });
    const rows = noticeRows(width, width(phrase), notice);

    expect(notice.text).toBe(`Oh no: ${phrase}`);
    expect(rows).toEqual([
      { text: "Oh no:", width: width("Oh no:") },
      { text: phrase, width: width(phrase) },
    ]);
  });

  it("measures the complete text with the font's existing letter spacing and kerning", () => {
    const notice = fillNoticeText("Thanks, {owner}!", { owner });
    const measured = width(notice.text);
    expect(noticeRows(width, measured, notice)).toEqual([{ text: notice.text, width: measured }]);
  });

  it("keeps the full owner name intact after an effect name gains its pill", () => {
    const effect = gameData.debuffs.muddy.name;
    const plain = fillNoticeText("{effect} hit {owner} +2♥", { effect, owner });
    const pilled = noticeTextWithNamePills(gameData, {
      ...plain,
      names: [{ at: 0, kind: "muddy", length: effect.length }],
    });
    const rows = noticeRows(width, width(`${owner.text} +2♥`), pilled);

    expect(pilled.text).not.toBe(plain.text);
    expect(rows.at(-1)?.text).toBe(`${owner.text} +2♥`);
  });
});
