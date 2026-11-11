import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { playingFrame, sheetFrame, sheetTagFrames } from "./sheetFrames.ts";

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

describe("sheetTagFrames", () => {
  it("lists fx-confetti's play tag's frames in order with their durations from its JSON", () => {
    const json = JSON.parse(
      readFileSync(
        new URL("../../../public/art/sprites/fx-confetti.json", import.meta.url),
        "utf8",
      ),
    ) as {
      frames: Record<string, { duration: number; frame: { x: number } }>;
      meta: { frameTags: { from: number; name: string; to: number }[] };
    };
    const tag = json.meta.frameTags.find(({ name }) => name === "play");
    const listed = Object.values(json.frames).slice(tag?.from, (tag?.to ?? 0) + 1);
    const frames = sheetTagFrames(json, "play");
    expect(frames.map(({ durationMs, x }) => [durationMs, x])).toEqual(
      listed.map(({ duration, frame }) => [duration, frame.x]),
    );
    expect(sheetTagFrames(json, "absent")).toEqual([]);
  });

  it.each([
    [0, 0],
    [79, 0],
    [80, 1],
    [159, 1],
    [160, undefined],
  ])("shows, %d ms into a play of two 80 ms frames, frame %s", (elapsedMs, frame) => {
    expect(playingFrame([{ durationMs: 80 }, { durationMs: 80 }], elapsedMs)).toBe(frame);
  });
});
