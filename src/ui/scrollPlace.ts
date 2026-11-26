import { type DomScale, wholeArtPixels } from "./domScale.ts";

// Where the list's content is laid out at a scroll: the scale its parts are placed at and the
// device pixels the content then moves up by. Once it settles, the content moves up whole art
// pixels. While it moves, each part lands on the device pixel nearest the whole game pixel the
// canvas rounds it to: the parts are placed at a scale whose origin is moved up by the scroll's
// whole game pixels, and the content moves up to that origin's device pixel, so no art lands
// between device pixels and each part stays within half a device pixel of the canvas.
export function scrollPlace(
  scale: DomScale,
  scroll: { readonly settled: boolean; readonly y: number },
): { by: number; scale: DomScale } {
  if (scroll.settled) {
    return { by: wholeArtPixels(scale, scroll.y * scale.unit * scale.dpr), scale };
  }
  const origin = { ...scale.origin, y: scale.origin.y - Math.round(scroll.y) * scale.unit };
  const grid = (page: number) => Math.round(page * scale.dpr);
  return { by: grid(scale.origin.y) - grid(origin.y), scale: { ...scale, origin } };
}
