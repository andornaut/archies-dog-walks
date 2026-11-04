// Draw the four contact-debuff effects around the lead dog's feet.
//
// fx-debuff-muddy, -spotlight, -stinky and -zoomies are 60x36, with play frames 0 to 11 at 100ms
// each, played once (1200ms). Frame 4 is the reduced-motion pose. Draw one copy under the actual
// first dog in the ordered pack, including a side formation slot, with no other-dog or walker copies
// or fallback. If the lead dog is not drawn, show no ground cue. Anchor at (30,30) on the lead dog's
// (feetX, feetY-1), origin (0.5,5/6). Display at 2x (120x72), with the displayed anchor at (60,60).
// Follow the lead dog's feet for the whole cue. Draw above ground shadows and below all actors and
// leashes (road depth 9.5), clipped to the road viewport. These ground effects never float above a
// head; the separate acquisition icon appears above the lead dog.
//
// The broad mud splats, low gas clouds, rushing arcs and pools of light use the exact face, shade,
// fill and name colours from ui.ts's DEBUFF_LOOKS, plus the same ink edge as the bars. No recoloured
// icon is baked into a sprite. The shared roadBanners.popUpArt notification draws the native 16px HUD
// icon at 2x as a bare 32x32 image, with no plate. Its bottom starts 4px above the actual lead dog's
// visible head. Snapshot the position, clamp to the viewport and fade immediately over 1000ms without
// rising or following the pack, in both motion modes. Only an effect actually acquired or refreshed
// shows this notification and its matching sound, played once for the pack, never per member.
//
// Run from the repository root. Edit this script, not the generated sources.
import { rim } from "./fx.ts";
import { type Colour, Grid, main, type Sprite } from "./pixel.ts";
import { DEBUFF_LOOKS } from "./ui.ts";

const USAGE = `Usage:
  node art/tools/debuffs.ts preview OUT.png   every frame on the neighbourhood roads
  node art/tools/debuffs.ts build             write art/debuffs/*.aseprite and export
                                              public/art/sprites/*.png and *.json`;

type Point = readonly [number, number];

const WIDTH = 60;
const HEIGHT = 36;
const FRAME_MS = 100;
const ENVELOPE: readonly number[] = [0.72, 0.86, 0.96, 1, 1, 1, 0.98, 0.94, 0.84, 0.68, 0.48, 0.28];

function radians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

// Expand around the ground under the feet, never up toward a head.
function point(step: number, x: number, y: number): Point {
  const s = ENVELOPE[step]!;
  return [30 + (x - 30) * s, 29 + (y - 29) * s];
}

function oval(
  g: Grid,
  step: number,
  x: number,
  y: number,
  rx: number,
  ry: number,
  fill: string,
  shade: Colour = null,
  light: Colour = null,
): void {
  const s = ENVELOPE[step]!;
  g.cel(...point(step, x, y), Math.max(1.5, rx * s), Math.max(1.5, ry * s), fill, shade, light);
}

function path(g: Grid, step: number, points: readonly Point[], colour: string, width = 2): void {
  const pts = points.map(([x, y]) => point(step, x, y));
  for (let i = 1; i < pts.length; i++) {
    const [a, b] = [pts[i - 1]!, pts[i]!];
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]))));
    for (let k = 0; k < n + 1; k++) {
      const x = a[0] + ((b[0] - a[0]) * k) / n;
      const y = a[1] + ((b[1] - a[1]) * k) / n;
      g.rect(Math.round(x - width / 2), Math.round(y - width / 2), width, width, colour);
    }
  }
}

// A thin ink edge, matching the progress bar's edge, keeps low shapes readable.
function part(dst: Grid, draw: (g: Grid) => void): void {
  const g = new Grid(WIDTH, HEIGHT);
  draw(g);
  rim(g, "ink");
  g.px.forEach((row, y) =>
    row.forEach((c, x) => {
      if (c) {
        dst.px[y]![x] = c;
      }
    }),
  );
}

// A filled shape expands with the same ground envelope as the curved marks.
function polygon(g: Grid, step: number, points: readonly Point[], colour: string): void {
  const pts = points.map(([x, y]) => point(step, x, y));
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      let inside = false;
      pts.forEach(([ax, ay], i) => {
        const [bx, by] = pts[(i + 1) % pts.length]!;
        if (
          ay > y + 0.5 !== by > y + 0.5 &&
          x + 0.5 < ((bx - ax) * (y + 0.5 - ay)) / (by - ay) + ax
        ) {
          inside = !inside;
        }
      });
      if (inside) {
        g.p(x, y, colour);
      }
    }
  }
}

// A low wet pool and two outward splash fans leave the soles visible.
function muddy(step: number): Grid {
  const [face, shade, light] = DEBUFF_LOOKS.get("muddy")!;
  const g = new Grid(WIDTH, HEIGHT);
  const lift = [0, 1, 2, 3, 3, 2, 1, 0, -1, -1, 0, 0][step]!;

  part(g, (p) => {
    oval(p, step, 30, 30, 26, 4, face, shade);
    for (const side of [-1, 1]) {
      const x = 30 + side * 17;
      oval(p, step, x, 28, 10, 5.5, face, shade);
      const fan: Point[] = [
        [x - side * 8, 30],
        [x - side * 5, 23],
        [x - side * 3, 25],
        [x, 18 - lift],
        [x + side * 3, 25],
        [x + side * 8, 21 - lift / 2],
        [x + side * 6, 30],
      ];
      polygon(p, step, fan, face);
      path(
        p,
        step,
        [
          [x - side * 6, 28],
          [x, 25],
          [x + side * 5, 26],
        ],
        light,
        3,
      );
      path(
        p,
        step,
        [
          [x, 23],
          [x, 20 - lift],
        ],
        light,
        2,
      );
    }
    path(
      p,
      step,
      [
        [14, 31],
        [22, 30],
        [38, 30],
        [46, 31],
      ],
      light,
      2,
    );
  });
  for (const side of [-1, 1]) {
    const x = 30 + side * 25;
    part(g, (p) => oval(p, step, x, 20 - lift, 2, 2.5, light, face));
  }
  return g;
}

// Broad low mauve clouds carry pink curls beside the feet, never above a head.
function stinky(step: number): Grid {
  const [face, shade, light, name] = DEBUFF_LOOKS.get("stinky")!;
  const g = new Grid(WIDTH, HEIGHT);
  const rise = [0, 0, 1, 2, 2, 2, 3, 3, 3, 2, 1, 0][step]!;
  for (const side of [-1, 1]) {
    const x = 30 + side * 17;
    const sway = [0, 0, 1, 1, 0, -1, -1, 0, 1, 1, 0, 0][step]! * side;
    part(g, (p) => {
      oval(p, step, x, 28, 10, 5, face, shade);
      oval(p, step, x + side * 5, 24 - rise / 2, 5, 5, face, shade, light);
      oval(p, step, x - side * 3, 23, 6, 5, face, shade, light);
      const pts: Point[] = [
        [x - side * 5, 28],
        [x - side * 7, 25],
        [x - side * 4 + sway, 22],
        [x + side * 2 + sway, 22],
        [x + side * 4 + sway, 19 - rise],
        [x + side + sway, 16 - rise],
      ];
      path(p, step, pts, light, 3);
      path(
        p,
        step,
        [
          [x - side, 29],
          [x + side * 4, 28],
        ],
        light,
        2,
      );
      if (step >= 2 && step <= 7) {
        path(
          p,
          step,
          [
            [x - side * 5, 25],
            [x - side * 3, 23],
          ],
          name,
          1,
        );
      }
    });
  }
  return g;
}

// Broad green rushing crescents and yellow arrow tips turn around the ground footprint.
function zoomies(step: number): Grid {
  const [face, shade, light] = DEBUFF_LOOKS.get("zoomies")!;
  const g = new Grid(WIDTH, HEIGHT);
  const turn = -65 + step * 17;
  for (const offset of [0, 180]) {
    const pts: Point[] = [];
    for (let a = Math.round(turn + offset); a < Math.round(turn + offset + 112); a += 6) {
      pts.push([30 + Math.cos(radians(a)) * 24, 24 + Math.sin(radians(a)) * 6]);
    }
    part(g, (p) => {
      path(p, step, pts, shade, 6);
      path(
        p,
        step,
        pts.map(([x, y]) => [x, y - 1]),
        face,
        4,
      );
      path(
        p,
        step,
        pts.slice(3).map(([x, y]) => [x, y - 2]),
        light,
        2,
      );
      const [x, y] = pts.at(-1)!;
      const a = radians(turn + offset + 112);
      const [dx, dy] = [-Math.sin(a), Math.cos(a)];
      polygon(
        p,
        step,
        [
          [x + dx * 4, y + dy * 3],
          [x - dx * 4 - dy * 4, y - dy * 3 + dx * 4],
          [x - dx * 4 + dy * 4, y - dy * 3 - dx * 4],
        ],
        light,
      );
    });
  }
  return g;
}

// A broad blue pool with a yellow rim and low white light marks sits beneath the feet.
function spotlight(step: number): Grid {
  const [face, shade, light, name] = DEBUFF_LOOKS.get("spotlight")!;
  const g = new Grid(WIDTH, HEIGHT);
  part(g, (p) => {
    oval(p, step, 30, 28, 27, 6.5, face, shade);
    oval(p, step, 30, 27, 22, 4.5, light);
    oval(p, step, 30, 26.5, 15, 2.5, face);
  });
  const slide = [0, 2, 4, 6, 7, 7, 6, 4, 2, 0, -1, 0][step]!;
  for (const side of [-1, 1]) {
    const x = 30 + side * (16 + slide / 2);
    part(g, (p) =>
      path(
        p,
        step,
        [
          [x, 24],
          [x + side * 3, 18],
        ],
        name,
        3,
      ),
    );
  }
  return g;
}

const DEBUFFS: ReadonlyMap<string, (step: number) => Grid> = new Map([
  ["muddy", muddy],
  ["spotlight", spotlight],
  ["stinky", stinky],
  ["zoomies", zoomies],
]);

// Every sprite: [key, [[tag, frames, duration in ms]]].
export function* sprites(): Generator<Sprite> {
  for (const [name, draw] of DEBUFFS) {
    yield [
      `fx-debuff-${name}`,
      [["play", ENVELOPE.map((_, i) => draw(i).outlined(false)), FRAME_MS]],
    ];
  }
}

if (import.meta.main) {
  await main({ doc: USAGE, sprites });
}
