import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { sheetFrame } from "./sheetFrames.ts";

const SHEET = JSON.parse(
  readFileSync(
    new URL("../../../public/art/sprites/face-owner-archie.json", import.meta.url),
    "utf8",
  ),
) as {
  frames: Record<string, { frame: { x: number } }>;
  meta: { frameTags: { from: number; name: string }[]; size: { h: number; w: number } };
};

describe("sheetFrame", () => {
  it.each([
    ["neutral", "neutral"],
    ["a tag the sheet lacks", undefined],
  ])("finds a sheet's frame by %s in its JSON", (_case, tag) => {
    const from = SHEET.meta.frameTags.find(({ name }) => name === tag)?.from ?? 0;
    const frame = sheetFrame(SHEET, tag ?? "absent");
    expect(frame.x).toBe(Object.values(SHEET.frames)[from]?.frame.x);
    expect(frame.sheet).toEqual({ height: SHEET.meta.size.h, width: SHEET.meta.size.w });
  });

  it("refuses a file that is no sheet", () => {
    expect(() => sheetFrame({ frames: {} }, undefined)).toThrow();
  });
});
