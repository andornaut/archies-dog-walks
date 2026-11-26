import type { Rect } from "@andornaut/game-kit/runtime/rect";

import type { ZoneId } from "../data/ids.ts";
import { distanceAtY, type RoadProjection, roadXAt, rowScale } from "../layout/index.ts";
import { markLimit, type RoughPatch, type RowMarks } from "./roadside.ts";
import { STRIP, type StripLines } from "./roadStrip.ts";
import { type Carried, carriedBuffer } from "./vergeDraw.ts";

export { drawRoad, type RoadFrame } from "./roadDraw.ts";
export {
  LINE_RUN,
  type PixelImage,
  pixelWord,
  type RoadLook,
  roadLook,
  shrinkRows,
  solidStrip,
  START_STRIP_ZONE_ROWS,
  STRIP,
  stripLevels,
  stripLines,
  stripSeams,
} from "./roadStrip.ts";

// The projected road drawn a screen row at a time into a pixel buffer: every row samples one
// row of the zone's road strip, stretched across by the row's scale, with the verge either
// side. Pixels are 32-bit words in the byte order of canvas ImageData (r, g, b, a in memory),
// so a strip read from a canvas copies straight through.

// The road x of each screen column, floored, and how far its centre is from the centre line,
// or -1 on the strip, which covers columns roadStart to roadEnd (excluded). roadXFrom to
// roadXTo are the road pixels whose left edges fall in each column, so the columns share the
// road's pixels out between them, none missed and none twice (none on a row wider than the
// road, where a pixel covers more than a column). The row covers the road from near to far
// ahead of the feet and samples it at distance; the row below samples it at below. dotLevel
// sizes the cells the verge's dots are seeded on, 2^dotLevel road pixels long, at least as long
// as the row's span, so every cell shows on some row and the dots move down with the road
// rather than reshuffle. splits caches
// verge edges by across, and lineColumns the columns whose share of the road holds a strip
// line, by the strip's lines.
export interface RasterRow {
  readonly across: Float32Array;
  readonly below: number;
  readonly distance: number;
  readonly dotLevel: number;
  readonly far: number;
  // The keep below which each kind of verge mark shows on the row (markLimit).
  readonly leafLimit: number;
  readonly level: 0 | 1 | 2;
  readonly lineColumns: Map<StripLines, Int16Array>;
  readonly near: number;
  // The farthest across the row shows, at its outer columns.
  readonly reach: number;
  readonly roadEnd: number;
  readonly roadStart: number;
  readonly roadX: Int16Array;
  readonly roadXFrom: Int16Array;
  readonly roadXTo: Int16Array;
  readonly scale: number;
  readonly span: number;
  readonly splits: Map<number, readonly [number, number]>;
  readonly tuftLimit: number;
}

// verges holds each zone's verge before seams, patches and marks, drawn once; marks and
// patches cache what the road rows and blocks in view hold. The first approachRows rows lie
// past the far edge of the road in view, on the backdrop's approach to its cross street:
// they draw the road surface, and the verge only where the backdrop shows the verge as the
// raster draws it (its ground, seams, dots and marks), leaving its corners, fences and the rest
// as they are. The first junctionRows of them, between the near corners up to the cross street,
// draw the road surface alone.
export interface RoadRaster {
  readonly approachRows: number;
  readonly junctionRows: number;
  readonly centreX: number;
  readonly marks: Map<number, RowMarks>;
  readonly patches: Map<number, readonly RoughPatch[]>;
  readonly rows: readonly RasterRow[];
  readonly verges: Map<ZoneId, readonly Uint32Array[]>;
  // Scratch space drawRoad reuses frame to frame: marks carried to the next row, the
  // columns a mark has drawn on in this row, and the strip rows a row's lines are looked for on.
  readonly scratch: { carried: [Carried, Carried]; lineRows: Int32Array; marked: Uint8Array };
  readonly view: Rect;
  readonly visibleDistance: number;
}

// Rows covering more than this much road per strip row step down a level.
const LEVEL_SPAN = 2;

function levelFor(span: number): 0 | 1 | 2 {
  if (span <= LEVEL_SPAN) {
    return 0;
  }
  return span <= 2 * LEVEL_SPAN ? 1 : 2;
}

// The per-row tables for drawing the road into view, which must lie below the horizon. The
// view's rows above approachY are the junction's.
export function roadRaster(
  projection: Pick<
    RoadProjection,
    "centreX" | "farY" | "focal" | "footY" | "horizonY" | "visibleDistance"
  >,
  approachY: number,
  view: Rect,
): RoadRaster {
  const rows: RasterRow[] = [];
  const { centreX } = projection;
  const left = centreX - STRIP.width / 2;
  for (let y = view.y; y < view.y + view.height; y++) {
    const scale = rowScale(projection, y);
    const distance = distanceAtY(projection, y + 0.5);
    const span = distance - distanceAtY(projection, y + 1.5);
    const roadX = new Int16Array(view.width);
    const roadXFrom = new Int16Array(view.width);
    const roadXTo = new Int16Array(view.width);
    const across = new Float32Array(view.width);
    for (let i = 0; i < view.width; i++) {
      const x = roadXAt(projection, scale, view.x + i + 0.5);
      roadX[i] = Math.floor(x);
      roadXFrom[i] = Math.ceil(roadXAt(projection, scale, view.x + i));
      roadXTo[i] = Math.ceil(roadXAt(projection, scale, view.x + i + 1)) - 1;
      const onStrip = x >= left && x < left + STRIP.width;
      across[i] = onStrip ? -1 : Math.abs(x - centreX);
    }
    const roadStart = across.findIndex((value) => value < 0);
    // The strip's columns are one run, as the projection keeps order across a row.
    const roadEnd = Math.max(0, roadStart) + across.filter((value) => value < 0).length;
    rows.push({
      across,
      below: distanceAtY(projection, y + 1.5),
      distance,
      dotLevel: Math.max(0, Math.ceil(Math.log2(span))),
      far: distanceAtY(projection, y),
      leafLimit: markLimit("leaf", scale, span),
      level: levelFor(span),
      lineColumns: new Map(),
      near: distanceAtY(projection, y + 1),
      reach: Math.max(0, across[0] ?? 0, across[view.width - 1] ?? 0),
      roadEnd,
      roadStart: Math.max(0, roadStart),
      roadX,
      roadXFrom,
      roadXTo,
      scale,
      span,
      splits: new Map(),
      tuftLimit: markLimit("tuft", scale, span),
    });
  }
  return {
    approachRows: Math.min(view.height, Math.max(0, projection.farY - view.y)),
    centreX,
    junctionRows: Math.min(view.height, Math.max(0, approachY - view.y)),
    marks: new Map(),
    patches: new Map(),
    rows,
    scratch: {
      carried: [carriedBuffer(), carriedBuffer()],
      lineRows: new Int32Array(STRIP.height),
      marked: new Uint8Array(view.width),
    },
    verges: new Map(),
    view,
    visibleDistance: projection.visibleDistance,
  };
}
