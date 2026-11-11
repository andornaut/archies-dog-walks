// A sprite sheet's frames as its Aseprite JSON lists them, for the HTML interface to show one
// frame of the whole sheet as a background: CSS loads whole files, and the canvas's atlas packs
// the frames elsewhere.

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

const sheets = new Map<string, Promise<unknown>>();

// The sheet's JSON at url, fetched once per page.
export function loadSheet(url: string): Promise<unknown> {
  let sheet = sheets.get(url);
  if (sheet === undefined) {
    sheet = fetch(url).then((response) => {
      if (!response.ok) {
        throw new Error(`${url}: ${response.status}`);
      }
      return response.json() as Promise<unknown>;
    });
    // A failed fetch is tried again next time.
    sheet.catch(() => sheets.delete(url));
    sheets.set(url, sheet);
  }
  return sheet;
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
