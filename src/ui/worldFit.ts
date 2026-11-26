import type { Point, Rect } from "@andornaut/game-kit/runtime/rect";
import { type RenderFit, renderFit } from "@andornaut/game-kit/runtime/view/renderScale";

import { SCREEN_CONFIG } from "../data/index.ts";

interface RenderScale {
  readonly gameSize: { readonly height: number; readonly width: number };
  readonly zoom: number;
}

const installed = new WeakSet<object>();

// Native backing coordinates apply only after this game's device-resolution bridge owns scale.
export function ownDeviceFit(scale: object): () => void {
  installed.add(scale);
  return () => installed.delete(scale);
}

export function deviceFitOwned(scale: object): boolean {
  return installed.has(scale);
}

export function worldFit(scale: RenderScale): RenderFit {
  return renderFit(SCREEN_CONFIG, 1 / scale.zoom, {
    height: scale.gameSize.height * scale.zoom,
    width: scale.gameSize.width * scale.zoom,
  });
}

// The logical screen stays top-aligned and horizontally centred in the native backing.
export function worldViewport(fit: RenderFit): Rect {
  return {
    height: fit.view.height,
    width: fit.view.width,
    x: Math.floor((fit.backing.width - fit.view.width) / 2),
    y: 0,
  };
}

export function logicalWorldPoint(fit: RenderFit, point: Point): Point {
  const view = worldViewport(fit);
  return { x: (point.x - view.x) / fit.zoom, y: (point.y - view.y) / fit.zoom };
}

// The canvas letterbox belongs to the backing, outside the logical game viewport.
export function logicalBackingBounds(fit: RenderFit): Rect {
  return {
    ...logicalWorldPoint(fit, { x: 0, y: 0 }),
    height: fit.backing.height / fit.zoom,
    width: fit.backing.width / fit.zoom,
  };
}

// The HTML layer uses the camera's actual logical view, excluding the native canvas's bars.
// box is the unturned canvas layout rect relative to the page body, supplied by the UI layer.
export function worldViewBox(scale: RenderScale, box: Rect): Rect {
  const fit = worldFit(scale);
  const view = worldViewport(fit);
  return {
    height: (view.height * box.height) / fit.backing.height,
    width: (view.width * box.width) / fit.backing.width,
    x: box.x + (view.x * box.width) / fit.backing.width,
    y: box.y,
  };
}

// A zoomed scene rect clipped to its camera. Readback uses backing pixels; the restored
// texture's placement and size stay in the scene's logical coordinates.
export function shownWorldRect(
  camera: Rect & { readonly scrollX: number; readonly scrollY: number; readonly zoom?: number },
  rect: Rect,
): { readonly canvas: Rect; readonly world: Rect } | undefined {
  const zoom = camera.zoom ?? 1;
  const left = Math.ceil(Math.max(camera.x + (rect.x - camera.scrollX) * zoom, camera.x));
  const top = Math.ceil(Math.max(camera.y + (rect.y - camera.scrollY) * zoom, camera.y));
  const right = Math.floor(
    Math.min(camera.x + (rect.x + rect.width - camera.scrollX) * zoom, camera.x + camera.width),
  );
  const bottom = Math.floor(
    Math.min(camera.y + (rect.y + rect.height - camera.scrollY) * zoom, camera.y + camera.height),
  );
  if (right <= left || bottom <= top) {
    return undefined;
  }
  const canvas = { height: bottom - top, width: right - left, x: left, y: top };
  return {
    canvas,
    world: {
      height: canvas.height / zoom,
      width: canvas.width / zoom,
      x: (left - camera.x) / zoom + camera.scrollX,
      y: (top - camera.y) / zoom + camera.scrollY,
    },
  };
}
