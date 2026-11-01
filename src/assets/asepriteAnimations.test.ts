import { animationSpecs as sheetAnimations } from "@andornaut/game-kit/art/aseprite";
import { describe, expect, it, vi } from "vitest";

import { animationSpecs } from "./asepriteAnimations";

vi.mock("@andornaut/game-kit/art/aseprite", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@andornaut/game-kit/art/aseprite")>();
  return { ...actual, animationSpecs: vi.fn(actual.animationSpecs) };
});

function sheet(durations: number[], frameTags: unknown[] | undefined) {
  return {
    frames: Object.fromEntries(durations.map((duration, i) => [`dog ${i}.aseprite`, { duration }])),
    meta: frameTags === undefined ? {} : { frameTags },
  };
}

function tag(direction: string, from: number, to: number) {
  return { direction, from, name: "walk", to };
}

describe("animationSpecs", () => {
  it("validates a sheet before passing its texture and frames to the kit", () => {
    const json = sheet([150], [tag("forward", 0, 0)]);
    const built = [{ frames: [], key: "built-by-kit" }];
    vi.mocked(sheetAnimations).mockReturnValueOnce(built);
    expect(animationSpecs("dog-kilo", json)).toBe(built);
    expect(sheetAnimations).toHaveBeenLastCalledWith("dog-kilo", json);
  });

  it("normalizes absent frame tags for the kit", () => {
    const json = sheet([100], undefined);
    vi.mocked(sheetAnimations).mockReturnValueOnce([]);
    animationSpecs("face", json);
    expect(sheetAnimations).toHaveBeenLastCalledWith("face", {
      ...json,
      meta: { frameTags: [] },
    });
  });

  it("adds the texture name and retains the cause when the kit rejects a sheet", () => {
    const cause = new Error("invalid frame reference");
    vi.mocked(sheetAnimations).mockImplementationOnce(() => {
      throw cause;
    });
    expect(() => animationSpecs("dog-kilo", sheet([150], []))).toThrow(
      expect.objectContaining({ cause, message: "dog-kilo: invalid frame reference" }),
    );
  });

  it("rejects a malformed sheet, naming the tag or frame", () => {
    const cases: { error: string; json: unknown; name: string }[] = [
      {
        error: "dog-kilo sheet.meta.frameTags[0] from must not be after to",
        json: sheet([150, 150, 150], [tag("forward", 2, 1)]),
        name: "a tag whose from is after its to",
      },
      {
        error: "dog-kilo sheet.meta.frameTags[0].direction must be one of",
        json: sheet([150], [tag("sideways", 0, 0)]),
        name: "a tag with an unknown direction",
      },
      {
        error: "dog-kilo sheet.meta.frameTags[0].from must be a whole number",
        json: sheet([150, 150], [tag("forward", 0.5, 1)]),
        name: "a tag whose frames are not whole numbers",
      },
      {
        error: "dog-kilo sheet.frames.dog 0.aseprite.duration must be positive",
        json: sheet([0], []),
        name: "a frame without a positive duration",
      },
      { error: "dog-kilo sheet.meta is required", json: { frames: {} }, name: "a missing meta" },
      {
        error: 'dog-kilo sheet.frames must be an object: export with the "hash" JSON format',
        json: { frames: [{ duration: 150, filename: "dog 0.aseprite" }], meta: {} },
        name: "Aseprite's array export",
      },
    ];
    for (const { error, json, name } of cases) {
      expect(() => animationSpecs("dog-kilo", json), name).toThrow(error);
    }
  });
});

describe("the shipped art", () => {
  const sheets = import.meta.glob<unknown>("../../public/art/sprites/*.json", {
    eager: true,
    import: "default",
  });

  it("parses every sprite sheet under public/art/sprites/", () => {
    const entries = Object.entries(sheets);
    expect(entries.length).toBeGreaterThan(0);
    for (const [path, json] of entries) {
      expect(() => animationSpecs(path, json)).not.toThrow();
    }
  });
});
