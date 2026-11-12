import { clamp01 } from "@andornaut/game-kit/numbers";
import type { Rect } from "@andornaut/game-kit/rect";

// Beside a list longer than its view: a trackWidth-wide track at x, as tall as the view, and in
// it a thumbWidth-wide thumb thumbInset inside the track's edges, at least thumbMin tall.
interface ScrollbarSpec {
  readonly thumbInset: number;
  readonly thumbMin: number;
  readonly thumbWidth: number;
  readonly trackWidth: number;
  readonly x: number;
}

// A scrollbar's track and the thumb in it.
export interface ScrollbarRects {
  readonly thumb: Rect;
  readonly track: Rect;
}

// The scrollbar's track and thumb for a list max pixels taller than view, scrolled y, or null
// for a list that fits. The thumb is as tall a share of the track's inside as the view is of
// the list.
export function scrollbarRects(
  spec: ScrollbarSpec,
  view: { readonly height: number; readonly y: number },
  max: number,
  y: number,
): ScrollbarRects | null {
  if (max <= 0) {
    return null;
  }
  const { thumbInset, thumbMin, thumbWidth, trackWidth, x } = spec;
  const inner = view.height - 2 * thumbInset;
  const height = Math.max(thumbMin, Math.round((inner * view.height) / (view.height + max)));
  const share = clamp01(y / max);
  return {
    thumb: {
      height,
      width: thumbWidth,
      x: x + thumbInset,
      y: view.y + thumbInset + Math.round((inner - height) * share),
    },
    track: { height: view.height, width: trackWidth, x, y: view.y },
  };
}

// bar as the HTML interface draws it, in art pixels from the track's corner, perGame art pixels a
// game pixel: the track and thumb as wide as in game pixels, as their art is drawn, so the thumb
// is centred in the track with equal insets; the track as long as the view, and the thumb as long
// as on the canvas, each rounded once for the list, so the thumb keeps its length while the list
// scrolls; and the thumb inset as on the canvas at each end of its travel, moved by the canvas's
// share of it, rounded.
export function scrollbarArt(bar: ScrollbarRects, perGame: number): ScrollbarRects {
  const { thumb, track } = bar;
  const inset = thumb.x - track.x;
  const length = Math.round(track.height * perGame);
  const inner = length - 2 * inset;
  const height = Math.min(inner, Math.round(thumb.height * perGame));
  const travel = track.height - 2 * inset - thumb.height;
  const share = travel > 0 ? clamp01((thumb.y - track.y - inset) / travel) : 0;
  return {
    thumb: {
      height,
      width: thumb.width,
      x: inset,
      y: inset + Math.round((inner - height) * share),
    },
    track: { height: length, width: track.width, x: 0, y: 0 },
  };
}
