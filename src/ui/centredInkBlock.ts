import type { Point, Rect } from "@andornaut/game-kit/rect";

// Move each line's visible ink to the backing's horizontal centre, and the complete block to
// its vertical centre. Coordinates are in the renderer's pixel grid, not font advances.
export function centredInkOffsets(backing: Rect, lines: readonly Rect[]): Point[] {
  const visible = lines.filter((line) => line.width > 0 && line.height > 0);
  if (visible.length === 0) {
    return lines.map(() => ({ x: 0, y: 0 }));
  }
  const top = Math.min(...visible.map((line) => line.y));
  const bottom = Math.max(...visible.map((line) => line.y + line.height));
  const y = Math.round(backing.y + (backing.height - (bottom - top)) / 2) - top;
  return lines.map((line) => ({
    x: Math.round(backing.x + (backing.width - line.width) / 2) - line.x,
    y,
  }));
}
