// A key's frames as its Aseprite JSON lists them, in the DOM sheet a build packs it on, for the
// HTML interface to show one frame of the sheet as a background.

export interface SheetFrame {
  readonly height: number;
  // The sheet's size, in art pixels.
  readonly sheet: { readonly height: number; readonly width: number };
  readonly width: number;
  readonly x: number;
  readonly y: number;
}

interface Rect {
  readonly h: number;
  readonly w: number;
  readonly x: number;
  readonly y: number;
}

const isNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const isRect = (value: unknown): value is Rect =>
  typeof value === "object" &&
  value !== null &&
  ["h", "w", "x", "y"].every((field) => isNumber((value as Record<string, unknown>)[field]));

// The frame tag names first, or the sheet's first frame where tag is undefined or the sheet lacks
// it: its rect in the sheet, which an Aseprite hash export lists in frame order. Throws on a file
// that is not such a sheet.
export function sheetFrame(json: unknown, tag: string | undefined): SheetFrame {
  const sheet = json as {
    frames?: Record<string, { frame?: unknown }>;
    meta?: {
      frameTags?: { from?: unknown; name?: unknown }[];
      size?: { h?: unknown; w?: unknown };
    };
  };
  const frames = Object.values(sheet.frames ?? {}).map(({ frame }) => frame);
  const from = sheet.meta?.frameTags?.find(({ name }) => name === tag)?.from;
  const frame = frames[isNumber(from) ? from : 0];
  const size = { h: sheet.meta?.size?.h, w: sheet.meta?.size?.w };
  if (!isRect(frame) || !isNumber(size.h) || !isNumber(size.w)) {
    throw new Error("Not an Aseprite sheet");
  }
  return {
    height: frame.h,
    sheet: { height: size.h, width: size.w },
    width: frame.w,
    x: frame.x,
    y: frame.y,
  };
}

// The frame Phaser names name, by the name the sheet's JSON gives it (as the canvas's loader and
// the atlas keep it), or by its index in frame order where name is a number or its index's
// digits; the sheet's first frame where the sheet has no such frame. Throws on a file that is
// not such a sheet.
export function sheetFrameNamed(json: unknown, name: number | string): SheetFrame {
  const sheet = json as {
    frames?: Record<string, { frame?: unknown }>;
    meta?: { size?: { h?: unknown; w?: unknown } };
  };
  const named = Object.entries(sheet.frames ?? {});
  const index =
    typeof name === "number" ? name : named.findIndex(([frameName]) => frameName === name);
  const digits = typeof name === "string" && /^\d+$/.test(name) ? Number(name) : 0;
  const frame = named[index === -1 ? digits : index]?.[1].frame;
  const size = { h: sheet.meta?.size?.h, w: sheet.meta?.size?.w };
  if (!isRect(frame) || !isNumber(size.h) || !isNumber(size.w)) {
    throw new Error("Not an Aseprite sheet");
  }
  return {
    height: frame.h,
    sheet: { height: size.h, width: size.w },
    width: frame.w,
    x: frame.x,
    y: frame.y,
  };
}

// A DOM sheet's JSON, as a build writes it (src/tools/atlas/domSheets.ts): the sheet's size and,
// by key, the rect of its own file's image as [x, y, width, height]; for a sprite sheet each
// frame's rect and duration in its own export's order, the frame names where its own export's
// differ from "<key> <index>.aseprite", and its tags as [name, from, to, direction]. An image's
// one frame is its rect.
export interface DomSheetJson {
  readonly keys: Readonly<Record<string, DomSheetEntry>>;
  readonly size: { readonly h: number; readonly w: number };
}

export interface DomSheetEntry {
  readonly frames?: readonly (readonly number[])[];
  readonly names?: readonly string[];
  readonly rect: readonly [number, number, number, number];
  readonly tags?: readonly (readonly [string, number, number, string])[];
}

const isSize = (value: unknown): value is { h: number; w: number } =>
  typeof value === "object" &&
  value !== null &&
  isNumber((value as { h?: unknown }).h) &&
  isNumber((value as { w?: unknown }).w);

// The JSON as a DOM sheet's. Throws on any other shape.
function domSheetJson(json: unknown): DomSheetJson {
  const sheet = json as { keys?: unknown; size?: unknown };
  if (
    typeof json !== "object" ||
    json === null ||
    !isSize(sheet.size) ||
    typeof sheet.keys !== "object" ||
    sheet.keys === null
  ) {
    throw new Error("Not a DOM sheet");
  }
  return json as DomSheetJson;
}

// The key's frames on a DOM sheet as its own Aseprite hash export lists them, moved to its rect
// on the sheet, with the sheet's size. Throws where the sheet lacks the key or a frame's rect.
export function domSheetSprite(json: DomSheetJson, key: string): unknown {
  const entry = json.keys[key];
  if (entry === undefined) {
    throw new Error(`The DOM sheet has no ${key}`);
  }
  const frames = (entry.frames ?? [entry.rect]).map((frame, index) => {
    const [x, y, w, h, duration = 0] = frame;
    if (![x, y, w, h, duration].every(isNumber)) {
      throw new Error(`${key} frame ${index} has no rect`);
    }
    return [
      entry.names?.[index] ?? `${key} ${index}.aseprite`,
      { duration, frame: { h, w, x, y } },
    ] as const;
  });
  return {
    frames: Object.fromEntries(frames),
    meta: {
      frameTags: (entry.tags ?? []).map(([name, from, to, direction]) => ({
        direction,
        from,
        name,
        to,
      })),
      size: { h: json.size.h, w: json.size.w },
    },
  };
}

const sheets = new Map<string, Promise<DomSheetJson>>();
const sprites = new Map<string, Promise<unknown>>();
const loaded = new Map<string, unknown>();
const readyListeners = new Set<() => void>();

// A newly available sheet can promote a view while its scene's loop is sleeping.
export function onSheetReady(listener: () => void): () => void {
  readyListeners.add(listener);
  return () => readyListeners.delete(listener);
}

// The DOM sheet's JSON at url, fetched once per page.
function fetchSheet(url: string): Promise<DomSheetJson> {
  let sheet = sheets.get(url);
  if (sheet === undefined) {
    sheet = fetch(url).then(async (response) => {
      if (!response.ok) {
        throw new Error(`${url}: ${response.status}`);
      }
      return domSheetJson(await response.json());
    });
    // A failed fetch is tried again next time.
    sheet.catch(() => sheets.delete(url));
    sheets.set(url, sheet);
  }
  return sheet;
}

// The JSON at url, fetched once per page: a DOM sheet's, or, where the URL's fragment names a key
// (domArtFileUrl in src/assets/domArt.ts), that key's frames on it as an Aseprite hash export.
export function loadSheet(url: string): Promise<unknown> {
  let sprite = sprites.get(url);
  if (sprite === undefined) {
    const hash = url.indexOf("#");
    const sheet = fetchSheet(hash === -1 ? url : url.slice(0, hash));
    sprite =
      hash === -1
        ? sheet
        : sheet.then((json) => {
            const parsed = domSheetSprite(json, decodeURIComponent(url.slice(hash + 1)));
            sheetFrame(parsed, undefined);
            return parsed;
          });
    sprite.then(
      (json) => {
        loaded.set(url, json);
        queueMicrotask(() => {
          for (const listener of [...readyListeners]) {
            listener();
          }
        });
      },
      () => sprites.delete(url),
    );
    sprites.set(url, sprite);
  }
  return sprite;
}

// The sheet's JSON at url once loadSheet has loaded it, else undefined.
export function loadedSheet(url: string): unknown {
  return loaded.get(url);
}

// A frame of a tag as it plays: its rect in the sheet and how long it shows.
export interface TagFrame extends SheetFrame {
  readonly durationMs: number;
}

// The frames of the sheet's tag in the order it plays them forward, each with its duration, as
// its Aseprite JSON lists them; none where the sheet lacks the tag. Throws on a file that is not
// such a sheet.
export function sheetTagFrames(json: unknown, tag: string): TagFrame[] {
  const sheet = json as {
    frames?: Record<string, { duration?: unknown; frame?: unknown }>;
    meta?: {
      frameTags?: { from?: unknown; name?: unknown; to?: unknown }[];
      size?: { h?: unknown; w?: unknown };
    };
  };
  const named = sheet.meta?.frameTags?.find(({ name }) => name === tag);
  const size = { h: sheet.meta?.size?.h, w: sheet.meta?.size?.w };
  if (!isNumber(size.h) || !isNumber(size.w)) {
    throw new Error("Not an Aseprite sheet");
  }
  if (named === undefined || !isNumber(named.from) || !isNumber(named.to)) {
    return [];
  }
  const frames = Object.values(sheet.frames ?? {}).slice(named.from, named.to + 1);
  return frames.map(({ duration, frame }) => {
    if (!isRect(frame) || !isNumber(duration)) {
      throw new Error("Not an Aseprite sheet");
    }
    return {
      durationMs: duration,
      height: frame.h,
      sheet: { height: size.h as number, width: size.w as number },
      width: frame.w,
      x: frame.x,
      y: frame.y,
    };
  });
}

// The index of the frame a tag playing once shows elapsedMs after it starts, or undefined once
// it has played.
export function playingFrame(
  frames: readonly Pick<TagFrame, "durationMs">[],
  elapsedMs: number,
): number | undefined {
  let end = 0;
  for (const [i, { durationMs }] of frames.entries()) {
    end += durationMs;
    if (elapsedMs < end) {
      return i;
    }
  }
  return undefined;
}
