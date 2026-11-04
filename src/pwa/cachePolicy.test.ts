import { describe, expect, it } from "vitest";

import { hashedArtFileName } from "../tools/atlas/hashedArt";
import { CACHE_POLICY } from "./cachePolicy";

describe("the game's cache policy", () => {
  it("puts the game's hashed art under its configured immutable prefix", () => {
    expect(`/${hashedArtFileName("fonts/font-body.fnt", "fixture")}`).toBe(
      `${CACHE_POLICY.hashedAssetPrefix}art/fonts/font-body-fixture.fnt`,
    );
  });
});
