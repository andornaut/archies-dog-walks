import * as v from "valibot";

import { parseOrThrow, record } from "./jsonSchema.ts";

// Packed page paths are relative to art/, like the asset manifest paths.
export const ATLAS_DIR = "atlas";

// Phaser's name for the frame that covers a whole image. An atlased image has only this frame.
export const BASE_FRAME = "__BASE";

// A trimmed frame's full size, and where its packed rect sits in it: Phaser's sourceSize and
// spriteSourceSize.
export interface FrameTrim {
  h: number;
  w: number;
  x: number;
  y: number;
}

export interface AtlasFrame {
  // Milliseconds, from the Aseprite export. Images have none.
  duration?: number;
  h: number;
  name: string;
  // Present when the rect holds only the frame's opaque pixels.
  trim?: FrameTrim;
  w: number;
  x: number;
  y: number;
}

// One manifest image or sprite, drawn from one atlas page. A sprite keeps its Aseprite tags
// and frame names, in export order.
export interface AtlasTexture {
  frames: AtlasFrame[];
  key: string;
  page: number;
  tags?: unknown[];
}

interface AtlasPage {
  // The page's image, by its path under /art/: a lossless WebP in a build.
  file: string;
  group: string;
  height: number;
  width: number;
}

export interface AtlasManifest {
  pages: AtlasPage[];
  textures: AtlasTexture[];
}

const count = v.pipe(v.number(), v.integer(), v.minValue(0));
const size = v.pipe(v.number(), v.integer(), v.minValue(1));

const pagesSchema = v.array(
  record({ file: v.string(), group: v.string(), height: size, width: size }),
);

// Production manifest.atlas uses [key, page, frames, tags?] textures. Each frame is
// [x, y, w, h, duration?, trim?, name?], with null placeholders for omitted optional slots.
// trim is [w, h, x, y]. Only an exact "<key> <index>.aseprite" name is inferred.
// The static gallery projects this same wire shape; runtime consumers use AtlasManifest only.
type PackedFrame = [
  number,
  number,
  number,
  number,
  (number | null)?,
  ([number, number, number, number] | null)?,
  string?,
];
type PackedTexture = [string, number, PackedFrame[], unknown[]?];
export interface PackedAtlasManifest {
  pages: AtlasManifest["pages"];
  textures: PackedTexture[];
}

export function packAtlasManifest(atlas: AtlasManifest): PackedAtlasManifest {
  return {
    pages: atlas.pages,
    textures: atlas.textures.map(({ frames, key, page, tags }): PackedTexture => {
      const packedFrames = frames.map(
        ({ duration, h, name, trim, w, x, y }, index): PackedFrame => {
          const frame: PackedFrame = [x, y, w, h];
          const exceptional = name !== `${key} ${index}.aseprite`;
          if (duration !== undefined || trim !== undefined || exceptional) {
            frame[4] = duration ?? null;
          }
          if (trim !== undefined || exceptional) {
            frame[5] = trim === undefined ? null : [trim.w, trim.h, trim.x, trim.y];
          }
          if (exceptional) {
            frame[6] = name;
          }
          return frame;
        },
      );
      return tags === undefined ? [key, page, packedFrames] : [key, page, packedFrames, tags];
    }),
  };
}

const packedAtlasSchema = record({
  pages: pagesSchema,
  textures: v.array(
    v.strictTuple([
      v.string(),
      count,
      v.pipe(
        v.array(
          v.strictTuple([
            count,
            count,
            size,
            size,
            v.optional(v.nullable(v.number())),
            v.optional(v.nullable(v.strictTuple([size, size, count, count]))),
            v.optional(v.string()),
          ]),
        ),
        v.minLength(1),
      ),
      v.optional(v.array(v.unknown())),
    ]),
  ),
});

export function unpackAtlasManifest(value: unknown): AtlasManifest {
  const packed = parseOrThrow("packed atlas manifest", packedAtlasSchema, value);
  return {
    pages: packed.pages,
    textures: packed.textures.map(([key, page, frames, tags]) => ({
      frames: frames.map(([x, y, w, h, duration, trim, name], index) => ({
        ...(duration == null ? {} : { duration }),
        h,
        name: name ?? `${key} ${index}.aseprite`,
        ...(trim == null ? {} : { trim: { h: trim[1], w: trim[0], x: trim[2], y: trim[3] } }),
        w,
        x,
        y,
      })),
      key,
      page,
      ...(tags === undefined ? {} : { tags }),
    })),
  };
}

// The Phaser texture key an atlas page loads under. The colon keeps it apart from the
// manifest's kebab-case keys.
export function atlasPageKey(page: number): string {
  return `atlas:${page}`;
}

// The Aseprite sheet a sprite's animations are built from, as Phaser's Aseprite loader caches
// it: frame durations keyed by frame name, and the tags.
export function asepriteSheetOf({ frames, tags }: AtlasTexture): unknown {
  return {
    frames: Object.fromEntries(frames.map(({ duration, name }) => [name, { duration }])),
    meta: { frameTags: tags ?? [] },
  };
}
