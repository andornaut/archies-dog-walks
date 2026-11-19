import { readFileSync } from "node:fs";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  loadSheet,
  onSheetReady,
  playingFrame,
  sheetFrame,
  sheetFrameNamed,
  sheetTagFrames,
} from "./sheetFrames.ts";

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

afterEach(() => vi.unstubAllGlobals());

// A DOM sheet with a two-frame sprite and an image.
const DOM_SHEET = {
  keys: {
    "ui-dog": {
      frames: [
        [10, 0, 4, 6, 100],
        [14, 0, 4, 6, 200],
      ],
      rect: [10, 0, 8, 6],
      tags: [["run", 0, 1, "forward"]],
    },
    "ui-well": { rect: [0, 2, 5, 3] },
  },
  size: { h: 8, w: 20 },
};

it("notifies a new sheet once after consumer placement and stops after unsubscribe", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ json: () => Promise.resolve(DOM_SHEET), ok: true }),
  );
  const events: string[] = [];
  const off = onSheetReady(() => events.push("ready"));
  const request = loadSheet("/phase5-ready-sheet.json#ui-dog");
  void request.then(() => events.push("placed"));
  await request;
  await Promise.resolve();
  expect(events).toEqual(["placed", "ready"]);
  await loadSheet("/phase5-ready-sheet.json#ui-dog");
  expect(events).toHaveLength(2);
  off();
  await loadSheet("/phase5-ready-other-sheet.json#ui-dog");
  await Promise.resolve();
  expect(events).toHaveLength(2);
});

it("reads each key's frames from its DOM sheet's JSON, fetched once for every key", async () => {
  const fetch = vi.fn().mockResolvedValue({ json: () => Promise.resolve(DOM_SHEET), ok: true });
  vi.stubGlobal("fetch", fetch);
  const [dog, well, sheet] = await Promise.all([
    loadSheet("/frames-once.json#ui-dog"),
    loadSheet("/frames-once.json#ui-well"),
    loadSheet("/frames-once.json"),
  ]);
  expect(fetch).toHaveBeenCalledExactlyOnceWith("/frames-once.json");
  expect(sheet).toBe(DOM_SHEET);
  expect(sheetTagFrames(dog, "run")).toEqual([
    { durationMs: 100, height: 6, sheet: { height: 8, width: 20 }, width: 4, x: 10, y: 0 },
    { durationMs: 200, height: 6, sheet: { height: 8, width: 20 }, width: 4, x: 14, y: 0 },
  ]);
  expect(sheetFrameNamed(dog, "ui-dog 1.aseprite")).toMatchObject({ x: 14 });
  expect(sheetFrame(well, undefined)).toEqual({
    height: 3,
    sheet: { height: 8, width: 20 },
    width: 5,
    x: 0,
    y: 2,
  });
  await expect(loadSheet("/frames-once.json#ui-missing")).rejects.toThrow("has no ui-missing");
});

it.each([
  ["by its name", "tile 2.aseprite", 40],
  ["by its index", 1, 20],
  ["by its index's digits", "1", 20],
  ["first, where the sheet has no such frame", "__BASE", 0],
] as const)("finds a sheet's frame %s", (_, name, x) => {
  const json = {
    frames: Object.fromEntries(
      [0, 1, 2].map((i) => [`tile ${i}.aseprite`, { frame: { h: 20, w: 20, x: i * 20, y: 0 } }]),
    ),
    meta: { size: { h: 20, w: 60 } },
  };
  expect(sheetFrameNamed(json, name)).toMatchObject({ sheet: { height: 20, width: 60 }, x });
});
