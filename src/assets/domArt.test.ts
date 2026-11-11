import { describe, expect, it } from "vitest";

import manifest from "../../public/art/manifest.json" with { type: "json" };
import { DOM_ART_KEYS, domArtPath } from "./domArt.ts";

describe("DOM_ART_KEYS", () => {
  it("names art the manifest has, at the paths the HTML interface loads it from", () => {
    const images = new Map(manifest.images.map(({ key, png }) => [key, png]));
    const sprites = new Map(manifest.sprites.map((sprite) => [sprite.key, sprite]));
    for (const key of DOM_ART_KEYS) {
      const sprite = sprites.get(key);
      const paths =
        sprite === undefined
          ? [images.get(key), domArtPath("image", key, "png")]
          : [
              [sprite.png, sprite.json],
              [domArtPath("sheet", key, "png"), domArtPath("sheet", key, "json")],
            ];
      expect(paths[0], key).toEqual(paths[1]);
    }
  });
});
