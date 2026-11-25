import type { Point, Rect } from "@andornaut/game-kit/runtime/rect";

// Move each line's visible ink to the backing's horizontal centre, and the complete block to
// its vertical centre, in whole steps of unit (an art pixel, in the renderer's pixels): any odd
// row is left under the ink, and a half step across rounds right. Coordinates are in the
// renderer's pixel grid, not font advances.
export function centredInkOffsets(backing: Rect, lines: readonly Rect[], unit = 1): Point[] {
  const visible = lines.filter((line) => line.width > 0 && line.height > 0);
  if (visible.length === 0) {
    return lines.map(() => ({ x: 0, y: 0 }));
  }
  const top = Math.min(...visible.map((line) => line.y));
  const bottom = Math.max(...visible.map((line) => line.y + line.height));
  const y = backing.y + Math.floor((backing.height - (bottom - top)) / 2 / unit) * unit - top;
  return lines.map((line) => ({
    x: backing.x + Math.round((backing.width - line.width) / 2 / unit) * unit - line.x,
    y,
  }));
}
