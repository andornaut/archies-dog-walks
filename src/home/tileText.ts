import type { Rect } from "@andornaut/game-kit/runtime/rect";
import { type FontMetrics, inkRowsFromCapTop } from "@andornaut/game-kit/runtime/text/bitmapFont";

import { HOME_LAYOUT } from "./homeGeometry.ts";

// A walker or Pocket tile's label strip, rows tall, from the drawn tile at tile: across the tile
// inside its one-column outline and on the row over its bottom outline, its first row a rule.
export const TILE_STRIP_EDGE = 1;
export function tileStrip(tile: Rect, rows: number): Rect {
  return {
    height: rows,
    width: tile.width - 2 * TILE_STRIP_EDGE,
    x: tile.x + TILE_STRIP_EDGE,
    y: tile.y + tile.height - TILE_STRIP_EDGE - rows,
  };
}

// How wide a dog tile's name may be: from its text column to padRight inside its face's edge.
export const DOG_TILE_TEXT_ROOM = HOME_LAYOUT.dogTile.name.width;

// The dog slot sign's cream inside its board's frame and lit and shaded rows, and where its two
// lines go: each line's ink centred on the cream's middle column, the block from the call's
// capitals to the price's lowest ink centred down the cream.
export function slotSignText(body: FontMetrics): {
  cream: Rect;
  headCapY: number;
  priceCapY: number;
  x: number;
} {
  const { board, boardEdge, linePitch, scale } = HOME_LAYOUT.slotSign;
  const { frame, lit, shade } = boardEdge;
  const cream = {
    height: board.height - 2 * frame - lit - shade,
    width: board.width - 2 * frame,
    x: board.x + frame,
    y: board.y + frame + lit,
  };
  const block = linePitch + inkRowsFromCapTop(body) * scale;
  const headCapY = cream.y + (cream.height - block) / 2;
  return { cream, headCapY, priceCapY: headCapY + linePitch, x: cream.x + cream.width / 2 };
}
