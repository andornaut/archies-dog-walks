import { packAtlas } from "@andornaut/art-kit/atlasLayout";
import { itemAt } from "@andornaut/game-kit/arrays";
import { getOrInsertComputed } from "@andornaut/game-kit/maps";
import type { Point, Rect } from "@andornaut/game-kit/rect";
import * as v from "valibot";

import {
  ATLAS_GROUPS,
  type AtlasGroup,
  pageGroupOf,
  steppedBases,
} from "../../assets/atlasGroups.ts";
import {
  ATLAS_DIR,
  type AtlasFrame,
  type AtlasTexture,
  BASE_FRAME,
  type FrameTrim,
} from "../../assets/atlasManifest.ts";
import { isPlainObject, parseOrThrow, record } from "../../assets/jsonSchema.ts";

// Mobile GPUs guarantee textures up to 2048 pixels a side.
export const ATLAS_MAX_SIZE = 2048;
// Each frame's edge pixels repeat this far outward, so a scaled or tiled frame that samples
// past its edge reads its own colour rather than a neighbour's.
export const EXTRUDE = 1;
const PAGE_WIDTHS = [256, 512, 1024, 2048] as const;

// A frame of a source PNG, by the rect of it that is packed. A trimmed frame's rect holds only
// its opaque pixels: bounds is then the whole frame it was cut from, and trim where it sits in
// it. Frames of a texture with the same from rect share one rect on the page.
export interface SourceFrame {
  bounds?: Rect;
  duration?: number;
  from: Rect;
  name: string;
  trim?: FrameTrim;
}

// A manifest image or sprite, read from its source PNG. Only a sprite has tags.
export interface SourceTexture {
  frames: SourceFrame[];
  key: string;
  png: string;
  tags?: unknown[];
}

// A frame copied from a source PNG to the top-left corner at on a page, its extruded border
// read inside bounds.
interface Blit {
  at: Point;
  bounds: Rect;
  from: Rect;
  png: string;
}

export interface PageLayout {
  blits: Blit[];
  group: AtlasGroup;
  height: number;
  // The page's path under /art/, less the extension its file format gives it.
  name: string;
  width: number;
}

interface AtlasLayout {
  pages: PageLayout[];
  // Keys with a frame too large for a page, left to load from their own files.
  skipped: string[];
  textures: AtlasTexture[];
}

// An image, as one frame covering its whole PNG.
export function imageSource(
  png: string,
  width: number,
  height: number,
  key: string,
): SourceTexture {
  return { frames: [{ from: { height, width, x: 0, y: 0 }, name: BASE_FRAME }], key, png };
}

const pixels = v.pipe(v.number("must be a number"), v.integer("must be a whole number"));

const asepriteFrame = record({
  duration: v.number("must be a number"),
  frame: record({ h: pixels, w: pixels, x: pixels, y: pixels }),
  rotated: v.exactOptional(v.boolean()),
  trimmed: v.exactOptional(v.boolean()),
});

const asepriteSheet = record({
  frames: v.pipe(
    v.unknown(),
    v.check(isPlainObject, 'must be an object: export with the "hash" JSON format'),
    v.record(v.string(), asepriteFrame),
  ),
  meta: record({ frameTags: v.optional(v.array(v.unknown(), "must be an array"), []) }),
});

// A sprite's frames from its Aseprite "hash" export, in export order. Throws on a frame the
// export rotated or trimmed, whose placement the packer does not read: it trims frames itself.
export function spriteSource(key: string, png: string, json: unknown): SourceTexture {
  const { frames, meta } = parseOrThrow(`${key} sheet`, asepriteSheet, json);
  return {
    frames: Object.entries(frames).map(([name, { duration, frame, rotated, trimmed }]) => {
      if (rotated === true || trimmed === true) {
        throw new Error(`${key} frame "${name}" is rotated or trimmed`);
      }
      return { duration, from: { height: frame.h, width: frame.w, x: frame.x, y: frame.y }, name };
    }),
    key,
    png,
    tags: meta.frameTags,
  };
}

// A texture as packed: the first of its frames with each distinct from rect, which get a rect
// on the page each, and for every frame the index of its rect among them.
interface Packable {
  firsts: SourceFrame[];
  slots: number[];
  texture: SourceTexture;
}

function packable(texture: SourceTexture): Packable {
  const index = new Map<string, number>();
  const firsts: SourceFrame[] = [];
  const slots = texture.frames.map((frame) => {
    const { height, width, x, y } = frame.from;
    const id = `${x},${y},${width},${height}`;
    return getOrInsertComputed(id, () => firsts.push(frame) - 1, index);
  });
  return { firsts, slots, texture };
}

const tallestFrame = (texture: SourceTexture) =>
  Math.max(...texture.frames.map(({ from }) => from.height));

// The page width that packs the group onto the fewest pages, each one a request, then into the
// least area, preferring the narrower on a tie.
function packGroup(textures: readonly SourceTexture[], maxSize: number) {
  return (
    packAtlas(
      {
        compare: (a, b) =>
          tallestFrame(b.value.texture) - tallestFrame(a.value.texture) ||
          (a.value.texture.key < b.value.texture.key ? -1 : 1),
        extrude: EXTRUDE,
        maxSize,
        widths: [...PAGE_WIDTHS.filter((candidate) => candidate < maxSize), maxSize],
      },
      textures.map((texture) => {
        const value = packable(texture);
        return { rectangles: value.firsts.map(({ from }) => from), value };
      }),
    ) ?? { pages: [], width: 0 }
  );
}

function fits(texture: SourceTexture, maxSize: number): boolean {
  return texture.frames.every(
    ({ from }) => from.width + 2 * EXTRUDE <= maxSize && from.height + 2 * EXTRUDE <= maxSize,
  );
}

// Packs the textures into pages of at most maxSize a side, by group in ATLAS_GROUPS order, and
// maps every frame to its rect on its page. A trimmed frame keeps its trim, which places its
// rect in the whole frame, so anchors measured in frame pixels still hold.
export function layoutAtlases(
  textures: readonly SourceTexture[],
  maxSize: number = ATLAS_MAX_SIZE,
): AtlasLayout {
  const layout: AtlasLayout = { pages: [], skipped: [], textures: [] };
  const stepped = steppedBases(textures.map(({ key }) => key));
  for (const group of ATLAS_GROUPS) {
    const members = textures.filter((texture) => pageGroupOf(stepped, texture.key) === group);
    layout.skipped.push(...members.filter((t) => !fits(t, maxSize)).map(({ key }) => key));
    const packed = members.filter((texture) => fits(texture, maxSize));
    const { pages, width } = packGroup(packed, maxSize);
    // A group no page width can hold is skipped whole.
    if (pages.length === 0) {
      layout.skipped.push(...packed.map(({ key }) => key));
    }
    pages.forEach(({ height, placed }, index) => {
      const page = layout.pages.length;
      const blits: Blit[] = [];
      for (const { at, item } of placed) {
        const { firsts, slots, texture } = item.value;
        firsts.forEach(({ bounds, from }, i) => {
          blits.push({ at: itemAt(at, i), bounds: bounds ?? from, from, png: texture.png });
        });
        const frames = texture.frames.map(({ duration, from, name, trim }, i): AtlasFrame => {
          const to = itemAt(at, itemAt(slots, i));
          return {
            ...(duration === undefined ? {} : { duration }),
            h: from.height,
            name,
            ...(trim === undefined ? {} : { trim }),
            w: from.width,
            x: to.x,
            y: to.y,
          };
        });
        const { key, tags } = texture;
        layout.textures.push(
          tags === undefined ? { frames, key, page } : { frames, key, page, tags },
        );
      }
      layout.pages.push({ blits, group, height, name: `${ATLAS_DIR}/${group}-${index}`, width });
    });
  }
  return layout;
}
