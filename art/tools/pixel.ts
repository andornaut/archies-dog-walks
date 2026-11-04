// Shared pixel-art tooling: a drawing grid on the house palette with coloured outlines, the depth
// settling of road sprites, and the step that turns frames into a sprite sheet PNG and its JSON data.
// Run the art scripts from the repository root.
import { existsSync, readFileSync, writeFileSync } from "node:fs";

import { contrast as colourContrast, rgb } from "@andornaut/art-kit/colour";
import {
  type Colour,
  type Edge,
  type Frame,
  Grid as DrawingGrid,
  opaqueCols as frameCols,
  opaqueRows as frameRows,
} from "@andornaut/art-kit/grid";
import {
  decodePng,
  encodeRgbaPng,
  encodeRgbPng,
  type RgbaPngOptions,
} from "@andornaut/art-kit/png";
import { composeContactSheet } from "@andornaut/art-kit/raster";
import type { RgbaImage } from "@andornaut/art-kit/rgbaImage";
import { writeSpriteSheet } from "@andornaut/art-kit/spriteSheet";

export type { Colour, Edge, Frame };
// A tag's name, frames and duration in milliseconds (one for every frame, or one each).
export type Tag = readonly [name: string, frames: Frame[], ms: number | readonly number[]];
// A sprite's key and tags.
export type Sprite = readonly [key: string, tags: Tag[]];

// ---------- the house palette ----------

// Endesga 32, by role.
const ENDESGA: readonly (readonly [string, string])[] = [
  ["rust", "be4a2f"],
  ["ochre", "d77643"],
  ["cream", "ead4aa"],
  ["tan", "e4a672"],
  ["brown", "b86f50"],
  ["dbrown", "733e39"],
  ["plum", "3e2731"],
  ["dred", "a22633"],
  ["red", "e43b44"],
  ["orange", "f77622"],
  ["amber", "feae34"],
  ["yellow", "fee761"],
  ["green", "63c74d"],
  ["dgreen", "3e8948"],
  ["forest", "265c42"],
  ["teal", "193c3e"],
  ["blue", "124e89"],
  ["sky", "0099db"],
  ["cyan", "2ce8f5"],
  ["white", "ffffff"],
  ["lgrey", "c0cbdc"],
  ["grey", "8b9bb4"],
  ["slate", "5a6988"],
  ["dslate", "3a4466"],
  ["navy", "262b44"],
  ["ink", "181425"],
  ["hot", "ff0044"],
  ["purple", "68386c"],
  ["mauve", "b55088"],
  ["pink", "f6757a"],
  ["skin1", "e8b796"],
  ["skin2", "c28569"],
];
// Every house colour by name, in palette order: Endesga 32, the neutral greys, the Toronto colours,
// then the picker-only UI tones.
export const K: Record<string, string> = Object.fromEntries(ENDESGA);
export const PALETTE: readonly string[] = ENDESGA.map(([, hex]) => hex);
// The colour one ramp step darker than each colour, by hex.
export const DARKER = new Map<string, string>(
  [
    "be4a2f:733e39",
    "d77643:be4a2f",
    "ead4aa:e4a672",
    "e4a672:b86f50",
    "b86f50:733e39",
    "733e39:3e2731",
    "3e2731:181425",
    "a22633:3e2731",
    "e43b44:a22633",
    "f77622:be4a2f",
    "feae34:f77622",
    "fee761:feae34",
    "63c74d:3e8948",
    "3e8948:265c42",
    "265c42:193c3e",
    "193c3e:181425",
    "124e89:262b44",
    "0099db:124e89",
    "2ce8f5:0099db",
    "ffffff:c0cbdc",
    "c0cbdc:8b9bb4",
    "8b9bb4:5a6988",
    "5a6988:3a4466",
    "3a4466:262b44",
    "262b44:181425",
    "181425:181425",
    "ff0044:a22633",
    "68386c:3e2731",
    "b55088:68386c",
    "f6757a:b55088",
    "e8b796:c28569",
    "c28569:b86f50",
  ].map(pair),
);

function pair(text: string): [string, string] {
  const [a, b] = text.split(":");
  return [a!, b!];
}

// The neutral greys, outside Endesga 32 and allowed only for disabled and locked UI (a disabled tile,
// button, slider or knob, a locked item's well): the neutral counterparts of lgrey, grey, slate and
// dslate. Ink stays the darkest step.
export const NEUTRAL: Readonly<Record<string, string>> = {
  ndslate: "4a4a4a",
  ngrey: "a4a4a4",
  nlgrey: "d8d8d8",
  nslate: "727272",
};
const NEUTRAL_ORDER = ["nlgrey", "ngrey", "nslate", "ndslate"];
for (const name of NEUTRAL_ORDER) {
  K[name] = NEUTRAL[name]!;
}
export const NEUTRAL_HEX: readonly string[] = NEUTRAL_ORDER.map((name) => NEUTRAL[name]!);
for (const p of ["d8d8d8:a4a4a4", "a4a4a4:727272", "727272:4a4a4a", "4a4a4a:181425"]) {
  DARKER.set(...pair(p));
}
// The Toronto colours, 32 past Endesga 32 for the Toronto neighbourhoods' scenery, roads, verges and
// skies, in ramps that end on an Endesga colour: canopy and olive greens, brick and warm browns,
// warm stones and dark slates for shaded laneways, TTC red, Kensington's painted-house brights, lake
// blues and sky tones. Endesga 32 plus these is the 64-colour house palette.
const TORONTO_ENTRIES: readonly (readonly [string, string])[] = [
  ["moss", "9cb04a"],
  ["olive", "6b8a35"],
  ["dolive", "445a26"],
  ["canopy", "357a2f"],
  ["pine", "1e4d2b"],
  ["fir", "11301c"],
  ["brick", "8e3b2b"],
  ["dbrick", "5e2620"],
  ["clay", "9a6a4a"],
  ["bark", "523a2c"],
  ["walnut", "2e2019"],
  ["driftwood", "a99c86"],
  ["stone", "8a857c"],
  ["dstone", "625e58"],
  ["ash", "57606a"],
  ["shale", "353b45"],
  ["coal", "26292f"],
  ["ttc", "da291c"],
  ["turquoise", "35c2a6"],
  ["dturq", "1f8a7a"],
  ["lilac", "a77bd9"],
  ["violet", "6d4bb0"],
  ["lime", "b2d94a"],
  ["foam", "a8e0e6"],
  ["shallow", "58b8c9"],
  ["lake", "2f7fa6"],
  ["dlake", "1d5576"],
  ["gold", "f9c74f"],
  ["peach", "ff9e6b"],
  ["haze", "cfe3ea"],
  ["azure", "3d86e0"],
  ["cobalt", "2654b0"],
];
export const TORONTO_HEX: readonly string[] = TORONTO_ENTRIES.map(([, hex]) => hex);
Object.assign(K, Object.fromEntries(TORONTO_ENTRIES));
export const PALETTE64: readonly string[] = [...PALETTE, ...TORONTO_HEX];
for (const p of [
  "9cb04a:6b8a35",
  "6b8a35:445a26",
  "445a26:11301c",
  "357a2f:1e4d2b",
  "1e4d2b:11301c",
  "11301c:181425",
  "8e3b2b:5e2620",
  "5e2620:2e2019",
  "9a6a4a:523a2c",
  "523a2c:2e2019",
  "2e2019:181425",
  "a99c86:8a857c",
  "8a857c:625e58",
  "625e58:26292f",
  "57606a:353b45",
  "353b45:26292f",
  "26292f:181425",
  "da291c:a22633",
  "35c2a6:1f8a7a",
  "1f8a7a:193c3e",
  "a77bd9:6d4bb0",
  "6d4bb0:68386c",
  "b2d94a:63c74d",
  "a8e0e6:58b8c9",
  "58b8c9:2f7fa6",
  "2f7fa6:1d5576",
  "1d5576:262b44",
  "f9c74f:feae34",
  "ff9e6b:f77622",
  "cfe3ea:c0cbdc",
  "3d86e0:2654b0",
  "2654b0:124e89",
]) {
  DARKER.set(...pair(p));
}

// Encode in-gamut linear sRGB channels as nearest-byte picker colours.
function pickerEncode(channels: readonly number[]): string {
  if (channels.some((channel) => channel < 0 || channel > 1)) {
    throw new RangeError("Picker colour is outside the sRGB gamut");
  }
  return channels
    .map((c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055))
    .map((channel) =>
      Math.floor(channel * 255 + 0.5)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("");
}

// One picker hue at the shared perceptual lightness and chroma.
export function pickerHeader(lightness: number, chroma: number, hue: number): string {
  // Oklab matrices: https://bottosson.github.io/posts/oklab/#converting-from-linear-srgb-to-oklab
  const angle = hue * (Math.PI / 180);
  const a = chroma * Math.cos(angle);
  const b = chroma * Math.sin(angle);
  const lCone = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const mCone = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const sCone = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return pickerEncode([
    4.0767416621 * lCone - 3.3077115913 * mCone + 0.2309699292 * sCone,
    -1.2684380046 * lCone + 2.6097574011 * mCone - 0.3413193965 * sCone,
    -0.0041960863 * lCone - 0.7034186147 * mCone + 1.707614701 * sCone,
  ]);
}

// A picker header's linear sRGB scaled by factor, encoded with nearest-byte rounding.
export function pickerBody(factor: number, header: string): string {
  const encoded = [0, 2, 4].map(
    (start) => Number.parseInt(header.slice(start, start + 2), 16) / 255,
  );
  const linear = encoded.map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return pickerEncode(linear.map((channel) => factor * channel));
}

// Picker-only colours extend K without changing the house palette or its ramps.
export const PICKER_LIGHTNESS = 0.55;
export const PICKER_CHROMA = 0.105;
export const PICKER_BODY_FACTOR = 0.5;
export const PICKER_HUES: readonly (readonly [string, number])[] = [
  ["Dogs", 290],
  ["Pocket", 350],
  ["Walker", 230],
];
const PICKER_ENTRIES: [string, string][] = [];
for (const [section, hue] of PICKER_HUES) {
  const header = pickerHeader(PICKER_LIGHTNESS, PICKER_CHROMA, hue);
  PICKER_ENTRIES.push([`picker${section}Header`, header]);
  PICKER_ENTRIES.push([`picker${section}Body`, pickerBody(PICKER_BODY_FACTOR, header)]);
}
PICKER_ENTRIES.push(["pickerSelectedBody", pickerBody(PICKER_BODY_FACTOR, K.amber!)]);
export const PICKER_UI: Readonly<Record<string, string>> = Object.fromEntries(PICKER_ENTRIES);
Object.assign(K, PICKER_UI);
for (const [name, colour] of PICKER_ENTRIES) {
  if (name.endsWith("Body")) {
    DARKER.set(colour, K.ink!);
  }
}
for (const [section] of PICKER_HUES) {
  DARKER.set(PICKER_UI[`picker${section}Header`]!, PICKER_UI[`picker${section}Body`]!);
}

// ---------- the game's export ----------

// Game data and layout come from the game's export in shared/export/, never from src/, and only
// through GAME and LAYOUT. Each type below lists every field an art tool reads, and readExport fails
// on a file that lacks one.

// A rectangle in the export's layout.
export interface ExportRect {
  height: number;
  width: number;
  x: number;
  y: number;
}

export interface GameData {
  // Each card face's illustration key and the card-frame tag it shows in.
  cards: readonly { art: string; frame: string }[];
  dogs: readonly { id: string; size: string }[];
  zones: readonly {
    art: string;
    id: string;
    leashColour: string;
    name: string;
    roadColour: string;
    roadShadowColour: string;
  }[];
}

export interface Layout {
  camera: { centreX: number; focal: number; footY: number; horizonY: number };
  lanes: { dividers: readonly number[] };
  pack: {
    collarHeights: Readonly<Record<string, number>>;
    feet: {
      lead: Readonly<Record<string, number>>;
      side: Readonly<Record<string, number>>;
      sideOfThreeLarge: number;
      trioLead: Readonly<Record<string, number>>;
    };
    laneHalfWidth: number;
    slots: readonly (readonly string[])[];
    walkerHands: { heightAboveFeet: number; leftDx: number; rightDx: number };
  };
  regions: { approach: ExportRect; backdrop: ExportRect; junction: ExportRect; road: ExportRect };
  scenes: { home: { petShop: ExportRect & { board: ExportRect } } };
}

// Every field of GameData, as dotted paths (a segment ending in [] means every element of that array).
const GAME_FIELDS: readonly string[] = [
  "cards[].art",
  "cards[].frame",
  "dogs[].id",
  "dogs[].size",
  "zones[].art",
  "zones[].id",
  "zones[].leashColour",
  "zones[].name",
  "zones[].roadColour",
  "zones[].roadShadowColour",
];
// Every field of Layout, as GAME_FIELDS.
const LAYOUT_FIELDS: readonly string[] = [
  "camera.centreX",
  "camera.focal",
  "camera.footY",
  "camera.horizonY",
  "lanes.dividers",
  "pack.collarHeights",
  "pack.feet.lead",
  "pack.feet.side",
  "pack.feet.sideOfThreeLarge",
  "pack.feet.trioLead",
  "pack.laneHalfWidth",
  "pack.slots",
  "pack.walkerHands.heightAboveFeet",
  "pack.walkerHands.leftDx",
  "pack.walkerHands.rightDx",
  ...["approach", "backdrop", "junction", "road"].flatMap((r) => rectFields(`regions.${r}`)),
  ...rectFields("scenes.home.petShop"),
  ...rectFields("scenes.home.petShop.board"),
];

// A rectangle's four fields under path.
function rectFields(path: string): string[] {
  return ["height", "width", "x", "y"].map((field) => `${path}.${field}`);
}

// Whether value lacks the field at path, a list of path segments as in GAME_FIELDS.
function absent(value: unknown, path: readonly string[]): boolean {
  if (!path.length) {
    return value === undefined || value === null;
  }
  const [head, ...rest] = path as [string, ...string[]];
  const each = head.endsWith("[]");
  const key = each ? head.slice(0, -2) : head;
  const next =
    typeof value === "object" && value !== null
      ? (value as Record<string, unknown>)[key]
      : undefined;
  if (each) {
    return !Array.isArray(next) || next.some((item) => absent(item, rest));
  }
  return absent(next, rest);
}

// shared/export/<name>, parsed; throws naming every one of fields it lacks.
function readExport<T>(fields: readonly string[], name: string): T {
  const value: unknown = JSON.parse(
    readFileSync(new URL(`../../shared/export/${name}`, import.meta.url), "utf8"),
  );
  const missing = fields.filter((field) => absent(value, field.split(".")));
  if (missing.length) {
    throw new Error(`shared/export/${name} has no ${missing.join(", ")}`);
  }
  return value as T;
}

export const GAME: GameData = readExport(GAME_FIELDS, "game-data.json");
export const LAYOUT: Layout = readExport(LAYOUT_FIELDS, "layout.json");

// The zones' art ids in the tools' order, which the preview grounds and ui-zone-pips' tags keep.
const ZONE_ORDER: readonly string[] = [
  "cabbagetown",
  "high-park",
  "distillery-district",
  "kensington-market",
  "the-beaches",
  "yonge-street",
];

// {art id: road colour hex} for every zone of the game's export, in ZONE_ORDER.
function zoneRoadColours(): Map<string, string> {
  const roads = new Map(GAME.zones.map((z) => [z.art, z.roadColour.replace(/^#+/, "")]));
  if (roads.size !== ZONE_ORDER.length || ZONE_ORDER.some((art) => !roads.has(art))) {
    throw new Error(`ZONE_ORDER ${ZONE_ORDER.join(", ")} differs from the export's zones`);
  }
  return new Map(ZONE_ORDER.map((art) => [art, roads.get(art)!]));
}

// Each zone's road colour by art id, in ZONE_ORDER (Cabbagetown's grey, High Park's tan, the
// Distillery District's dslate, Kensington Market's stone, The Beaches' cream, Yonge Street's shale).
export const ZONE_ROAD_COLOURS: ReadonlyMap<string, string> = zoneRoadColours();
// The zone roads, the preview grounds when a set names none.
export const ZONE_ROADS: readonly string[] = [...ZONE_ROAD_COLOURS.values()];

// The contrast roads: the Distillery District's (dark), then the roads an outline must hold 3:1 on: tan,
// pink and skin2 (light) and Kensington Market's (mid grey), which takes it nearly to ink.
export const ROADS: readonly string[] = [
  ZONE_ROAD_COLOURS.get("distillery-district")!,
  K.tan!,
  K.pink!,
  K.skin2!,
  ZONE_ROAD_COLOURS.get("kensington-market")!,
];

// A colour's hex: a K name's, or the colour itself.
export function hexOf(c: string): string {
  return Object.hasOwn(K, c) ? K[c]! : c;
}

// WCAG contrast ratio of two house colour names or hexadecimal colours.
export function contrast(a: string, b: string): number {
  return colourContrast(hexOf(a), hexOf(b));
}

// The Kensington Market murals' diagonal colour bands, shared by the backdrop, its zone card and the
// mural wall prop.
export const MURAL: readonly string[] = ["dred", "ochre", "olive", "dturq", "violet", "mauve"];

// The colour one ramp step darker than hex c.
function darker(c: string): string {
  const out = DARKER.get(c);
  if (out === undefined) {
    throw new RangeError(`No darker ramp step for ${c}`);
  }
  return out;
}

// The colour one ramp step darker than c, a K name or hex.
export function dk(c: string): string {
  return darker(hexOf(c));
}

// ---------- grids ----------

// What every drawing function draws on: a Grid, or a grid that scales its shapes (mini.ts's Mini).
export interface Drawable {
  blob(
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    c: Colour,
    sh?: Colour,
    li?: Colour,
    power?: number,
  ): void;
  cel(
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    c: Colour,
    sh?: Colour,
    li?: Colour,
    power?: number,
  ): void;
  ell(cx: number, cy: number, rx: number, ry: number, c: Colour, sh?: Colour, li?: Colour): void;
  h: number;
  outlined(outline?: boolean): Frame;
  p(x: number, y: number, c: Colour): void;
  readonly px: Frame;
  rect(x: number, y: number, w: number, h: number, c: Colour): void;
  tri(a: Point, b: Point, c: Point, col: Colour): void;
  w: number;
}
export type Point = readonly [number, number];

// ---------- drawing scopes ----------

// road.ts's faceFront options: the eyes' and mouth's colours, each eye's centre's distance from cx and
// the smile's corners' row below the eye row.
export interface FaceOptions {
  eyes?: string;
  lips?: string;
  mouth?: number;
  spread?: number;
}
// road.ts's faceFront: eyes and a smile for a chibi head seen from the front; y is the eye row.
export type FaceFront = (g: Drawable, cx: number, y: number, options?: FaceOptions) => void;

// What a drawing module draws through, so a caller can swap its parts while it draws (mini.ts's small
// draws a module's sprites on a Mini that way). A module that can be drawn small exports one scope,
// `export const scope = { Grid: (w = 32, h = 32) => new Grid(w, h), ... }`, and makes every grid with
// scope.Grid(w, h) and calls each swappable function as scope.name(...), never by its own binding. A
// module adds its own swappable functions (road.ts's squirrelHead) to its scope.
export interface DrawingScope {
  // road.ts's face, in road.ts's scope and in the scope of every module that draws it.
  faceFront?: FaceFront;
  // Every grid the module makes.
  Grid: (w?: number, h?: number) => Drawable;
}

// run() with each scope's entries replaced by its patch, then restored, even when run throws.
export function swapped<S extends object, R>(patches: ReadonlyMap<S, Partial<S>>, run: () => R): R {
  const saved = [...patches].map(([scope, patch]) => {
    const before = Object.fromEntries(
      Object.keys(patch).map((k) => [k, [Object.hasOwn(scope, k), scope[k as keyof S]]] as const),
    );
    Object.assign(scope, patch);
    return [scope, before] as const;
  });
  try {
    return run();
  } finally {
    for (const [scope, before] of saved.reverse()) {
      for (const [k, [had, value]] of Object.entries(before)) {
        if (had) {
          (scope as Record<string, unknown>)[k] = value;
        } else {
          delete (scope as Record<string, unknown>)[k];
        }
      }
    }
  }
}

// The grid that holds g's pixels: the grid a drawable draws onto (a Mini's g), or g.
export function raster(g: Drawable): Grid {
  return ("g" in g ? g.g : g) as Grid;
}

// The scale g draws the design grid at: a Mini's s, 1 for a plain Grid.
export function scaleOf(g: Drawable): number {
  return "s" in g && typeof g.s === "number" ? g.s : 1;
}

// The row scale g draws the design grid at: a Mini's sy, else scaleOf(g).
export function rowScaleOf(g: Drawable): number {
  return "sy" in g && typeof g.sy === "number" ? g.sy : scaleOf(g);
}

function outlineEdge(c: string): string {
  return darker(darker(c));
}

// House palette with mutable outline policy and the positional outline flag.
export class Grid extends DrawingGrid implements Drawable {
  constructor(w = 32, h = 32) {
    super(K, w, h, { edge: null });
  }

  override outlined(outline: boolean | Parameters<DrawingGrid["outlined"]>[0] = true): Frame {
    return super.outlined({
      close: this.close,
      edge: this.edge ?? outlineEdge,
      enabled: Boolean(outline),
    });
  }
}

// A road sprite's outline for fill c: two ramp steps darker, then on down the ramp until it holds 3:1
// against the light roads and the stone road (ROADS[1:]). The fill inside it carries the dslate road.
export function roadEdge(c: string): string {
  let out = darker(darker(c));
  while (darker(out) !== out && ROADS.slice(1).some((r) => contrast(out, r) < 3)) {
    out = darker(out);
  }
  return out;
}

// An icon's outline for fill c: two ramp steps darker, then on down the ramp until it holds 3:1 on
// cream and tan.
export function iconEdge(c: string): string {
  let out = darker(darker(c));
  while (darker(out) !== out && Math.min(contrast(out, "cream"), contrast(out, "tan")) < 3) {
    out = darker(out);
  }
  return out;
}

// Give g an outline rule (roadEdge unless told otherwise) and return it. edge is a function of the
// fill, or a colour name for one line round every fill. close runs the line along the bottom row. A
// grid that draws onto an inner Grid (a Mini) passes the rule on, so the small versions keep it.
export function edged<G extends Drawable>(g: G, edge: Edge | string = roadEdge, close = false): G {
  let rule: Edge;
  if (typeof edge === "string") {
    const line = hexOf(edge);
    rule = () => line;
  } else {
    rule = edge;
  }
  const inner = raster(g);
  inner.edge = rule;
  inner.close = close;
  return g;
}

// Recolour to line every hair pixel with skin directly below it: the hair's lower edge, where a fill
// close to the skin's tone would otherwise run into the face. On a Mini it is 1px of the drawn grid.
export function hairline(g: Drawable, hair: string, skin: string, line: string): void {
  const px = raster(g);
  const h = K[hair];
  const s = K[skin];
  const edge: [number, number][] = [];
  for (let y = 0; y < px.h - 1; y++) {
    for (let x = 0; x < px.w; x++) {
      if (px.px[y]![x] === h && px.px[y + 1]![x] === s) {
        edge.push([x, y]);
      }
    }
  }
  for (const [x, y] of edge) {
    px.p(x, y, line);
  }
}

// The 7x6 heart the UI, the badges, the fonts' drawn heart and scene.ts's callout hearts share.
export const HEART: readonly string[] = [
  ".11.11.",
  "1111111",
  "1111111",
  ".11111.",
  "..111..",
  "...1...",
];

// Stamp a character map at (x0, y0): each character in cols is a colour, any other is left clear;
// mirror flips it left to right.
export function bitmap(
  g: Drawable,
  x0: number,
  y0: number,
  rows: readonly string[],
  cols: Readonly<Record<string, string>>,
  mirror = false,
): void {
  rows.forEach((row, y) => {
    const chars = mirror ? [...row].reverse() : [...row];
    chars.forEach((ch, x) => {
      if (Object.hasOwn(cols, ch)) {
        g.p(x0 + x, y0 + y, cols[ch]!);
      }
    });
  });
}

// Frame rows of hex colours (null where clear) as an RGBA image.
export function toImage(px: Frame): RgbaImage {
  const width = px[0]!.length;
  const height = px.length;
  const data = new Uint8Array(width * height * 4);
  px.forEach((row, y) =>
    row.forEach((colour, x) => {
      if (colour) {
        data.set([...rgb(colour), 255], (y * width + x) * 4);
      }
    }),
  );
  return { data, height, width };
}

// The PNG encoder setting every export and preview uses.
export const PNG_OPTIONS: RgbaPngOptions = { deflateLevel: 6, deflateStrategy: 0, filterType: -1 };

// An image with clear pixels as an RGBA PNG.
export function savePng(image: RgbaImage): Uint8Array {
  return encodeRgbaPng(PNG_OPTIONS, image);
}

// An opaque image as an RGB PNG.
export function rgbPng(image: RgbaImage): Uint8Array {
  return encodeRgbPng(PNG_OPTIONS, image);
}

// The contact sheet's background, scale and gap.
export const PREVIEW_BACKGROUND: readonly [number, number, number] = [24, 20, 37];
export const PREVIEW_SCALE = 6;
export const PREVIEW_GAP = 4;

// A ground's preview sheet path: out without a trailing .png, a hyphen, the ground's hex and .png, so
// OUT.png on ground 8b9bb4 is OUT-8b9bb4.png.
export function groundSheetPath(ground: string, out: string): string {
  return `${out.replace(/\.png$/, "")}-${ground}.png`;
}

// Contact sheets, one per distinct ground colour at groundSheetPath: one row per sprite, every frame
// in tag order. One sheet per ground keeps the largest sets' sheets within memory.
export function preview(
  {
    gap = PREVIEW_GAP,
    grounds = ZONE_ROADS,
    scale = PREVIEW_SCALE,
  }: { gap?: number; grounds?: readonly string[]; scale?: number },
  sprites: readonly Sprite[],
  out: string,
): void {
  for (const ground of new Set(grounds)) {
    const sheet = composeContactSheet(
      { background: PREVIEW_BACKGROUND, cellSize: "row-first-frame", gap, resolveRgb: rgb, scale },
      sprites,
      [ground],
    );
    writeFileSync(groundSheetPath(ground, out), rgbPng(sheet));
  }
}

const DEPTH_STEPS = new URL("../../shared/depth-steps.json", import.meta.url);

// {suffix: scale} for every depth step below full size in shared/depth-steps.json, the table the game
// reads: {"@94": 0.9375, "@88": 0.875, ...}.
export function depthScales(): Map<string, number> {
  const { steps } = JSON.parse(readFileSync(DEPTH_STEPS, "utf8")) as {
    steps: { scale: number; suffix: string }[];
  };
  return new Map(steps.filter((q) => q.scale < 1).map((q) => [q.suffix, q.scale]));
}

// ---------- exported sprite sheets ----------

// A frame's rectangle in its sheet PNG.
export interface SheetRect {
  h: number;
  w: number;
  x: number;
  y: number;
}
// A tag's name and its first and last frame indices.
export interface SheetTag {
  from: number;
  name: string;
  to: number;
}
// An exported sprite: its sheet PNG, each frame's rectangle in order and its tags (none when the JSON
// lists no frameTags).
export interface SpriteSheet {
  frames: SheetRect[];
  image: RgbaImage;
  tags: SheetTag[];
}

export const SPRITES_DIR = "public/art/sprites";

// public/art/sprites/<key>.png and .json, decoded.
export function readSheet(key: string): SpriteSheet {
  const path = `${SPRITES_DIR}/${key}`;
  const data = JSON.parse(readFileSync(`${path}.json`, "utf8")) as {
    frames: Record<string, { frame: SheetRect }>;
    meta: { frameTags?: SheetTag[] };
  };
  return {
    frames: Object.values(data.frames).map((f) => f.frame),
    image: decodePng(readFileSync(`${path}.png`)),
    tags: data.meta.frameTags ?? [],
  };
}

// The pixels of image inside r as rows of hex colours, null where clear.
export function sheetFrame(image: RgbaImage, r: SheetRect): Frame {
  return Array.from({ length: r.h }, (_, y) =>
    Array.from({ length: r.w }, (__, x) => {
      const i = ((r.y + y) * image.width + r.x + x) * 4;
      return image.data[i + 3] ? hexAt(image, i) : null;
    }),
  );
}

// The hex colour of the pixel at byte offset i of image.
function hexAt(image: RgbaImage, i: number): string {
  return Array.from(image.data.subarray(i, i + 3), (c) => c.toString(16).padStart(2, "0")).join("");
}

// public/art/sprites/<key>'s frame 0 as rows of colours (null where clear), or null if it is not
// exported.
function exported(key: string): Frame | null {
  if (!existsSync(`${SPRITES_DIR}/${key}.json`)) {
    return null;
  }
  const { frames, image } = readSheet(key);
  return sheetFrame(image, frames[0]!);
}

// tags with every frame moved dy rows down (up when negative) in its frame.
export function shifted<T extends Cell>(tags: readonly CellTag<T>[], dy: number): CellTag<T>[] {
  const move = (f: T[][]): T[][] => {
    const blank = Array.from({ length: Math.abs(dy) }, () =>
      Array<T>(f[0]!.length).fill(null as T),
    );
    if (dy > 0) {
      return [...blank, ...f.slice(0, f.length - dy)];
    }
    return dy < 0 ? [...f.slice(-dy), ...blank] : f;
  };
  return tags.map(([tag, fs, ms]) => [tag, fs.map(move), ms]);
}

// ---------- depth settling ----------

// A fill pixel a cut left on the rim (see withoutRows): it compares as its fill, so the cuts after it
// are chosen as if it were not there, and it is drawn in line, the outline colour beside it.
interface Lined {
  readonly fill: string;
  readonly line: string;
}
type Cell = Colour | Lined;
type CellFrame = Cell[][];
type CellTag<T extends Cell = Cell> = readonly [
  name: string,
  frames: T[][][],
  ms: number | readonly number[],
];

// The colour a cell compares as.
function fillOf(c: Cell): Colour {
  return c !== null && typeof c === "object" ? c.fill : c;
}

// The colour pixel c is drawn in (see Lined).
function shown(c: Cell): Colour {
  return c !== null && typeof c === "object" ? c.line : c;
}

function sameRow(a: readonly Cell[], b: readonly Cell[]): boolean {
  return a.length === b.length && a.every((c, i) => fillOf(c) === fillOf(b[i]!));
}

function cellRows(frames: readonly CellFrame[]): [number, number] | null {
  return frameRows(frames as Frame[]);
}

function cellCols(frames: readonly CellFrame[]): [number, number] | null {
  return frameCols(frames as Frame[]);
}

// A depth variant's tags moved so frame 0's last opaque row, the feet row the game measures, is feet,
// or the frame's bottom row when that is past it. Every frame moves together, and never so far that it
// clips an opaque pixel: art taller than the rows above its feet row first loses the rows that change
// it least, and art reaching further below frame 0's feet than the rows under the feet row loses the
// rows that change it least down there (see withoutRows).
function seated(key: string, tags: readonly CellTag[], feet: number): CellTag[] {
  let frames = tags.flatMap(([, fs]) => fs);
  let out = [...tags];
  const h = frames[0]!.length;
  const placed = (): [number, number, number] => {
    const [top, bottom] = cellRows(frames)!;
    return [Math.min(feet, h - 1) - (cellRows([frames[0]!]) ?? [0, h - 1])[1], top, bottom];
  };
  let [dy, top, bottom] = placed();
  if (bottom + dy > h - 1) {
    frames = withoutRows(frames, bottom + dy - (h - 1), {
      below: (cellRows([frames[0]!]) ?? [0, h - 1])[1],
    });
    out = regrouped(out, frames);
    [dy, top, bottom] = placed();
  }
  if (top + dy < 0) {
    frames = withoutRows(frames, -(top + dy));
    out = regrouped(out, frames);
    [dy, top, bottom] = placed();
  }
  if (dy && !(top + dy >= 0 && top + dy <= bottom + dy && bottom + dy <= h - 1)) {
    console.log(`${key}: cannot move ${dy} rows to its feet row without clipping`);
    return out;
  }
  return shifted(out, dy);
}

// {scale: [width, height]}: the most art each of a w x h sprite's depth steps (scales) may fill. The
// game sizes a road sprite by its frame's larger side, an integer, and draws it from the smallest step
// at least that size (src/layout/depthScale.ts), so one pixel past a step's side it draws a larger step
// scaled down to it. A frame, floor(side x scale + 0.5), can round its shorter side past that. So each
// step's art keeps to the full size scaled to its own side plus one, rounded down, and to the next
// larger step's art, so no step is bigger than a larger one.
export function depthEnvelope(
  w: number,
  h: number,
  scales: readonly number[],
): Map<number, [number, number]> {
  const out = new Map<number, [number, number]>();
  let art: [number, number] = [w, h];
  for (const s of [...scales].sort((a, b) => b - a)) {
    const fw = Math.floor(w * s + 0.5);
    const fh = Math.floor(h * s + 0.5);
    const k = (Math.max(fw, fh) + 1) / Math.max(w, h);
    art = [
      Math.min(fw, art[0], Math.floor(w * k + 1e-9)),
      Math.min(fh, art[1], Math.floor(h * k + 1e-9)),
    ];
    out.set(s, art);
  }
  return out;
}

// The pixels that taking row r out of frames leaves newly touching a clear one across the cut and that
// are not outline pixels, as [frame, row, column, the outline colour the cut takes from beside it]. An
// outline pixel is one already on the art's rim, or one the colour of that outline pixel, so the
// outline carries on. A pixel is left as it is where drawing it in the outline colour would take a
// feature out: one of a colour none of its other neighbours has (a sparkle's centre, an eye), or one
// with that outline colour behind it, the last fill across a part 1px thin. Rows r - 1 and r + 1 meet
// at the cut, and nothing else moves relative to its neighbours.
function opened(frames: readonly CellFrame[], r: number): [number, number, number, Colour][] {
  const h = frames[0]!.length;
  const out: [number, number, number, Colour][] = [];
  frames.forEach((f, i) => {
    const w = f[0]!.length;
    const above = r > 0 ? f[r - 1]! : null;
    const cut = f[r]!;
    const under = r + 1 < h ? f[r + 1]! : null;
    for (let x = 0; x < w; x++) {
      const a = above && above[x]!;
      const b = under && under[x]!;
      if (Boolean(a) === Boolean(b) || !cut[x]) {
        continue;
      }
      const [y, c, away] = a ? [r - 1, a, r - 2] : [r + 1, b!, r + 2];
      const line = shown(cut[x]!);
      const row = f[y]!;
      if (shown(c) === line || x === 0 || x === w - 1 || !(row[x - 1] && row[x + 1])) {
        continue;
      }
      if (!(away >= 0 && away < h && f[away]![x])) {
        continue;
      }
      const behind = f[away]![x]!;
      if (
        shown(behind) === line ||
        ![shown(row[x - 1]!), shown(row[x + 1]!), shown(behind)].includes(shown(c))
      ) {
        continue;
      }
      out.push([i, y, x, line]);
    }
  });
  return out;
}

// Compare tuples of numbers lexicographically.
function compareTuples(a: readonly number[], b: readonly number[]): number {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return a[i]! < b[i]! ? -1 : 1;
    }
  }
  return 0;
}

function range(start: number, stop: number): number[] {
  return Array.from({ length: Math.max(0, stop - start) }, (_, i) => start + i);
}

// frames with n rows taken out from inside their opaque bounds (frame 0's when first), or from the rows
// past row below to their last opaque row, then as many clear rows added on top. Each goes where the
// art changes least: the row most like the one above it in every frame and crossing the fewest
// features 2 rows thin or less, in the longest run of equal rows, nearest the middle. picks, when given,
// names the row taken out at each step in its place (see PINNED_CUTS). The outline stays closed: a fill
// pixel the cut leaves on the rim is drawn in the outline colour it lost (see opened and Lined).
function withoutRows(
  source: readonly CellFrame[],
  n: number,
  {
    below: belowRow,
    first = false,
    picks = [],
  }: { below?: number; first?: boolean; picks?: readonly number[] } = {},
): CellFrame[] {
  let frames = [...source];
  let below = belowRow;
  for (let step = 0; step < n; step++) {
    const [opaqueTop, bottom] = cellRows(first ? frames.slice(0, 1) : frames)!;
    let top = opaqueTop;
    let rows = range(top + 1, bottom);
    if (below !== undefined) {
      top = below;
      rows = range(below + 1, bottom + 1);
      below += 1;
    }
    if (!rows.length) {
      break;
    }
    const h = frames[0]!.length;
    const mid = (top + bottom) / 2;
    const current = frames;
    const same = (a: number, b: number): boolean => current.every((f) => sameRow(f[a]!, f[b]!));
    const run = (r: number): number => {
      let a = r;
      let b = r;
      while (a > top && same(a - 1, r)) {
        a -= 1;
      }
      while (b < bottom && same(b + 1, r)) {
        b += 1;
      }
      return b - a + 1;
    };
    const counts = current.map((f) => {
      const cnt = new Map<string, number>();
      for (const row of f) {
        for (const c of row) {
          const fill = fillOf(c);
          if (fill) {
            cnt.set(fill, (cnt.get(fill) ?? 0) + 1);
          }
        }
      }
      return cnt;
    });
    // The weight of the small features row r crosses: each opaque pixel in a run of its colour at most
    // 2 long across rows (a line, a knot, an eye) that taking the row out would thin away, ten times
    // over when its colour is rare in the frame (a bow's knot, a collar's tag).
    const thin = (r: number): number => {
      let weight = 0;
      current.forEach((f, i) => {
        f[r]!.forEach((cell, x) => {
          const c = fillOf(cell);
          if (!c) {
            return;
          }
          let a = r;
          let b = r;
          while (a > 0 && fillOf(f[a - 1]![x]!) === c) {
            a -= 1;
          }
          while (b < f.length - 1 && fillOf(f[b + 1]![x]!) === c) {
            b += 1;
          }
          if (b - a + 1 <= 2) {
            weight += counts[i]!.get(c)! <= 16 ? 10 : 1;
          }
        });
      });
      return weight;
    };
    const score = (r: number): number[] => {
      let diff = 0;
      for (const f of current) {
        const row = f[r]!;
        const prev = f[r - 1]!;
        const len = Math.min(row.length, prev.length);
        for (let x = 0; x < len; x++) {
          if (fillOf(row[x]!) !== fillOf(prev[x]!)) {
            diff += 1;
          }
        }
      }
      return [diff + thin(r), -run(r), Math.abs(r - mid)];
    };
    let r: number;
    if (step < picks.length) {
      r = picks[step]!;
    } else {
      r = rows[0]!;
      let best = score(r);
      for (const candidate of rows.slice(1)) {
        const s = score(candidate);
        if (compareTuples(s, best) < 0) {
          r = candidate;
          best = s;
        }
      }
    }
    if (!rows.includes(r)) {
      throw new Error(`pinned cut ${r} is outside rows ${rows[0]}..${rows.at(-1)}`);
    }
    const cuts = opened(current, r);
    frames = current.map((f) => [
      Array<Cell>(f[0]!.length).fill(null),
      ...f.slice(0, r),
      ...f.slice(r + 1),
    ]);
    for (const [i, openedY, x, line] of cuts) {
      const y = openedY + (openedY < r ? 1 : 0);
      const f = frames[i]!;
      f[y] = [...f[y]!];
      f[y][x] = { fill: fillOf(f[y][x]!)!, line: line! };
    }
    if (!frames.every((f) => f.length === h)) {
      throw new Error("A cut changed a frame's height");
    }
  }
  return frames;
}

function transposed(frames: readonly CellFrame[]): CellFrame[] {
  return frames.map((f) => f[0]!.map((_, x) => f.map((row) => row[x]!)));
}

// tags with their art cut to at most w x h (see depthEnvelope) by taking out the rows and columns that
// change it least (see withoutRows). A column comes out with a clear one added on the side with less
// margin, so the art stays centred.
function squatted(tags: readonly CellTag[], w: number, h: number): CellTag[] {
  let frames = tags.flatMap(([, fs]) => fs);
  const fw = frames[0]![0]!.length;
  const fh = frames[0]!.length;
  frames = withoutRows(frames, fh - h);
  if (fw > w) {
    let cols = withoutRows(transposed(frames), fw - w);
    const [left, right] = cellRows(cols)!;
    if (left > 0 && left - 1 > fw - 1 - right) {
      cols = cols.map((c) => [...c.slice(1), Array<Cell>(c[0]!.length).fill(null)]);
    }
    frames = transposed(cols);
  }
  return regrouped(tags, frames);
}

// The keys public/art/manifest.json lists without an anchor: the game does not stand them on the
// ground (overlays, icons and the like), so they keep their place in their frame.
function unanchored(): Set<string> {
  if (!existsSync("public/art/manifest.json")) {
    return new Set();
  }
  const { sprites } = JSON.parse(readFileSync("public/art/manifest.json", "utf8")) as {
    sprites: { anchor?: unknown; key: string }[];
  };
  return new Set(sprites.filter((s) => !("anchor" in s)).map((s) => s.key));
}

// tags with their frames, in order, replaced by frames.
function regrouped<T extends Cell>(
  tags: readonly CellTag[],
  frames: readonly T[][][],
): CellTag<T>[] {
  const out: CellTag<T>[] = [];
  let i = 0;
  for (const [tag, fs, ms] of tags) {
    out.push([tag, frames.slice(i, i + fs.length), ms]);
    i += fs.length;
  }
  return out;
}

// tags with frame 0's art cut to at most cols opaque columns, by taking out the columns that change it
// least (see withoutRows), then moved back to centre on the side with more margin.
function narrowed(tags: readonly CellTag[], cols: number): CellTag[] {
  let cut = transposed(tags.flatMap(([, fs]) => fs));
  const [left, right] = cellRows(cut.slice(0, 1)) ?? [0, -1];
  const n = Math.max(0, right - left + 1 - cols);
  if (!n) {
    return [...tags];
  }
  cut = withoutRows(cut, n, { first: true });
  const fw = cut[0]!.length;
  let [lo, hi] = cellRows(cut) ?? [0, fw - 1];
  while (lo > 0 && lo - 1 > fw - 1 - hi) {
    cut = cut.map((c) => [...c.slice(1), Array<Cell>(c[0]!.length).fill(null)]);
    lo -= 1;
    hi -= 1;
  }
  return regrouped(tags, transposed(cut));
}

// tags with frame 0's art cut to at most rows opaque rows, by taking out the rows that change it least,
// or the rows picks names (see withoutRows).
function shortened(
  tags: readonly CellTag[],
  rows: number,
  picks: readonly number[] = [],
): CellTag[] {
  const frames = tags.flatMap(([, fs]) => fs);
  const [top, bottom] = cellRows(frames.slice(0, 1)) ?? [0, -1];
  return regrouped(
    tags,
    withoutRows(frames, Math.max(0, bottom - top + 1 - rows), { first: true, picks }),
  );
}

// Depth steps whose shortening takes out pinned rows, as the row taken out at each step (see
// shortened), in place of the settle's choice. dog-penny@69 takes out row 27: in her shake frames the
// collar's and the tag's outlines share one colour, whose count passes withoutRows's rarity cutoff, so
// the settle would take out row 14, through her left ear.
export const PINNED_CUTS: ReadonlyMap<string, readonly number[]> = new Map([
  ["dog-penny@69", [27]],
]);

function partition(key: string): [string, boolean, string] {
  const i = key.indexOf("@");
  return i < 0 ? [key, false, ""] : [key.slice(0, i), true, key.slice(i + 1)];
}

// sprites with each depth variant (<key>@<step>) cut to its step's depthEnvelope (see squatted) and, for
// a ground sprite, held to its ideal, the full size at its scale, and seated on a feet row from it. The
// game draws a ground sprite smoothly, from the smallest step at least its true size scaled down
// (src/layout/depthScale.ts), so the step's frame 0 keeps inside the full size's opaque rows and columns
// at its scale, rounded half up, and inside the next larger step L's, so no step is bigger than its
// ideal or than a larger step (see shortened and narrowed). A step a little under its ideal is fine;
// holding each step to L at its scale instead would compound the rounding down the steps. Its feet row
// is the full size's at side / full side, rounded up, or the frame's bottom row when that is past it,
// so the feet move less than 1px when it switches. The others (status overlays) are drawn at their own
// step. The full-size sprite is the one in sprites, else in originals ({key: tags}), else the one
// already exported; so is each step, settled larger steps first. A sprite's steps are the ones in
// sprites and the ones already exported.
//
// The tags named in apart are settled on their own, against their own full-size frame 0, as a second
// pose set: a pose that differs from the rest pose (a crouch beside a standing walk) then takes out the
// rows and columns that change it least, and adding it leaves the other tags' settling as it was. Each
// step's apart frames then move sideways to keep their full-size offset from the rest (see abreast).
// apart needs each full-size sprite, in sprites or in originals.
export function depthSettled(
  {
    apart = [],
    originals,
  }: { apart?: readonly string[]; originals?: ReadonlyMap<string, readonly Tag[]> | undefined },
  source: Iterable<Sprite>,
): Sprite[] {
  const sprites = [...source];
  if (apart.length) {
    const split = (keep: (tag: string) => boolean): [Map<string, Tag[]>, Map<string, Tag[]>] => {
      const part: Sprite[] = [];
      for (const [k, tags] of sprites) {
        const ts = tags.filter((t) => keep(t[0]));
        if (ts.length) {
          part.push([k, ts]);
        }
      }
      const full = new Map<string, Tag[]>();
      for (const [k, tags] of originals ?? []) {
        const ts = tags.filter((t) => keep(t[0]));
        if (ts.length) {
          full.set(k, ts);
        }
      }
      return [
        new Map(depthSettled({ originals: full.size ? full : undefined }, part)),
        new Map([...full, ...part]),
      ];
    };
    const [[rest, restFull], [own, ownFull]] = [
      split((tag) => !apart.includes(tag)),
      split((tag) => apart.includes(tag)),
    ];
    const scales = depthScales();
    return sprites.map(([key, tags]) => {
      const [base, at, suffix] = partition(key);
      const ownTags = own.get(key);
      const restTags = rest.get(key);
      const ownBase = ownFull.get(base);
      const restBase = restFull.get(base);
      if (at && ownTags && restTags && ownBase && restBase) {
        own.set(
          key,
          abreast(
            restTags,
            scales.get(`@${suffix}`) ?? 1,
            middle(ownBase)! - middle(restBase)!,
            ownTags,
          ),
        );
      }
      const settledTags = new Map(
        [...(rest.get(key) ?? []), ...(own.get(key) ?? [])].map((t) => [t[0], t]),
      );
      return [key, tags.map((t) => settledTags.get(t[0])!)];
    });
  }
  const full = new Map<string, readonly CellTag[]>([...(originals ?? []), ...sprites]);
  const scales = depthScales();
  const free = unanchored();
  const settled = new Map<string, CellFrame>();
  const frame0 = (key: string): CellFrame | null => {
    const done = settled.get(key);
    if (done) {
      return done;
    }
    const tags = full.get(key);
    return tags && !key.includes("@") ? tags[0]![1][0]! : exported(key);
  };
  const scaleOfKey = (key: string): number => {
    const [, at, suffix] = partition(key);
    return at ? (scales.get(`@${suffix}`) ?? 1) : 1;
  };
  const order = sprites
    .map((kt, i) => [kt, i] as const)
    .sort((a, b) => -scaleOfKey(a[0][0]) - -scaleOfKey(b[0][0]) || a[1] - b[1])
    .map(([kt]) => kt);
  for (const [key, sourceTags] of order) {
    let tags: CellTag[] = [...sourceTags];
    const [base, at, suffix] = partition(key);
    const scale = scales.get(`@${suffix}`);
    if (!(at && scale !== undefined)) {
      continue;
    }
    const frame0Full = frame0(base);
    if (frame0Full === null) {
      console.log(`${key}: no full-size ${base} to settle it by`);
      continue;
    }
    const steps = [...scales]
      .filter(([x]) => full.has(`${base}${x}`) || existsSync(`public/art/sprites/${base}${x}.json`))
      .map(([, s]) => s);
    const [w, h] = depthEnvelope(frame0Full[0]!.length, frame0Full.length, steps).get(scale)!;
    tags = squatted(tags, w, h);
    if (!free.has(base)) {
      const larger = Math.min(...steps.filter((s) => s > scale), 1);
      const lkey = larger < 1 ? base + [...scales].find(([, s]) => s === larger)![0] : base;
      let frameL = frame0(lkey);
      if (frameL === null) {
        console.log(`${key}: no ${lkey} to settle it by`);
        frameL = frame0Full;
      }
      const [topF, feetF] = cellRows([frame0Full]) ?? [0, frame0Full.length - 1];
      const [leftF, rightF] = cellCols([frame0Full]) ?? [0, frame0Full[0]!.length - 1];
      const [topL, feetL] = cellRows([frameL]) ?? [0, frameL.length - 1];
      const [leftL, rightL] = cellCols([frameL]) ?? [0, frameL[0]!.length - 1];
      const sideF = Math.max(frame0Full[0]!.length, frame0Full.length);
      const first = tags[0]![1][0]!;
      const side = Math.max(first[0]!.length, first.length);
      tags = shortened(
        tags,
        Math.min(Math.floor((feetF - topF + 1) * scale + 0.5), feetL - topL + 1),
        PINNED_CUTS.get(key) ?? [],
      );
      tags = narrowed(
        tags,
        Math.min(Math.floor((rightF - leftF + 1) * scale + 0.5), rightL - leftL + 1),
      );
      tags = seated(key, tags, Math.ceil((feetF * side) / sideF - 1e-9));
    }
    settled.set(key, tags[0]![1][0]!);
    full.set(key, tags);
  }
  const drawn = (tags: readonly CellTag[]): Tag[] =>
    tags.map(([tag, fs, ms]) => [tag, fs.map((f) => f.map((row) => row.map(shown))), ms]);
  return sprites.map(([key, tags]) => [key, settled.has(key) ? drawn(full.get(key)!) : tags]);
}

// The middle of frame 0's opaque columns, or null when it is blank.
function middle(tags: readonly Tag[]): number | null {
  const cols = frameCols([tags[0]![1][0]!]);
  return cols && (cols[0] + cols[1]) / 2;
}

// A depth step's apart tags (see depthSettled) moved sideways so frame 0 sits gap x scale columns from
// the rest's frame 0, as at full size, rounded, without clipping an opaque pixel.
function abreast(rest: readonly Tag[], scale: number, gap: number, tags: readonly Tag[]): Tag[] {
  const frames = tags.flatMap(([, fs]) => fs);
  const width = frames[0]![0]!.length;
  const [left, right] = frameCols(frames) ?? [0, width - 1];
  const want = Math.round(middle(rest)! + gap * scale - middle(tags)!);
  const dx = Math.max(-left, Math.min(width - 1 - right, want));
  const move = (f: Frame): Frame =>
    f.map((row) =>
      dx >= 0
        ? [...Array<Colour>(dx).fill(null), ...row.slice(0, row.length - dx)]
        : [...row.slice(-dx), ...Array<Colour>(-dx).fill(null)],
    );
  return tags.map(([tag, fs, ms]) => [tag, fs.map(move), ms]);
}

// ---------- building ----------

// Settle road depth variants and export each sprite to its sheet and JSON paths.
export async function build(
  {
    apart = [],
    originals,
  }: { apart?: readonly string[]; originals?: ReadonlyMap<string, readonly Tag[]> | undefined },
  source: Iterable<Sprite>,
): Promise<void> {
  const sprites = depthSettled({ apart, originals }, source);
  const built: string[] = [];
  for (const [key, tags] of sprites) {
    // One at a time keeps a build's output in order.
    // eslint-disable-next-line no-await-in-loop
    await writeSpriteSheet(
      { data: `public/art/sprites/${key}.json`, sheet: `public/art/sprites/${key}.png` },
      { key },
      tags,
    );
    built.push(key);
  }
  console.log("built", built.join(", "));
}

// ---------- commands ----------

// A command's handler, given the arguments its pattern names (see run).
export type Command = (...args: string[]) => unknown;

// Thrown by a command whose arguments do not fit it, so run prints the usage text.
export class UsageError extends Error {}

const HELP: ReadonlySet<string> = new Set(["--help", "-h"]);

// A pattern word in upper case (OUT.png, KEY, KEY...) takes an argument; any other must appear as
// written.
function isArgument(word: string): boolean {
  return /^[A-Z]/.test(word);
}

// The command whose pattern argv matches, and the arguments it takes, or null.
function matched(
  commands: Readonly<Record<string, Command>>,
  argv: readonly string[],
): [Command, string[]] | null {
  for (const [pattern, command] of Object.entries(commands)) {
    const words = pattern === "" ? [] : pattern.split(" ");
    const rest = words.at(-1)?.endsWith("...") ?? false;
    if (rest ? argv.length < words.length : argv.length !== words.length) {
      continue;
    }
    // The word each argument fills: a last word ending in "..." fills every one past it.
    const fills = argv.map((_, i) => words[Math.min(i, words.length - 1)]!);
    if (fills.every((word, i) => isArgument(word) || word === argv[i])) {
      return [command, argv.filter((_, i) => isArgument(fills[i]!))];
    }
  }
  return null;
}

// A tool's command line: runs the command whose pattern argv matches. A pattern is the words after
// the tool's name: an upper-case word (OUT.png, KEY) takes one argument, a last one ending in "..."
// (KEY...) one or more, and any other word (preview, --write) must appear as written; the empty
// pattern takes no arguments. --help or -h prints doc to stdout; no match, or a command that throws
// UsageError, prints it to stderr and exits 1.
export async function run(
  { commands, doc }: { commands: Readonly<Record<string, Command>>; doc: string },
  argv: readonly string[] = process.argv.slice(2),
): Promise<void> {
  if (argv.length === 1 && HELP.has(argv[0]!)) {
    console.log(doc);
    return;
  }
  try {
    const found = matched(commands, argv);
    if (found === null) {
      throw new UsageError();
    }
    await found[0](...found[1]);
  } catch (error) {
    if (!(error instanceof UsageError)) {
      throw error;
    }
    console.error(doc);
    process.exit(1);
  }
}

export interface MainOptions {
  // The tags settled on their own (see depthSettled).
  apart?: readonly string[];
  // The set's other commands by pattern (see run). One named "build" or "preview OUT.png" replaces
  // the default.
  commands?: Readonly<Record<string, Command>>;
  // The usage text.
  doc: string;
  // The preview's ground colours.
  grounds?: readonly string[];
  // The full-size sprites whose depth variants sprites draws but not their full size, by key.
  originals?: () => ReadonlyMap<string, readonly Tag[]>;
  // Every sprite the set draws.
  sprites: () => Iterable<Sprite>;
}

// A sprite set's command line (see run): preview OUT.png (one sheet per ground at groundSheetPath),
// build and the set's other commands.
export async function main(
  { apart = [], commands = {}, doc, grounds = ZONE_ROADS, originals, sprites }: MainOptions,
  argv: readonly string[] = process.argv.slice(2),
): Promise<void> {
  await run(
    {
      commands: {
        build: () => build({ apart, originals: originals?.() }, sprites()),
        "preview OUT.png": (out) =>
          preview({ grounds }, depthSettled({ apart, originals: originals?.() }, sprites()), out),
        ...commands,
      },
      doc,
    },
    argv,
  );
}

export const PALETTE_JSON = "shared/palette.json";

// Every colour by K name, including picker-only UI tones: its hex and the name of the colour one ramp
// step darker.
export function paletteTable(): Record<string, { darker: string; hex: string }> {
  const names = new Map(Object.entries(K).map(([k, v]) => [v, k]));
  // Entries, not a literal, so the written keys keep their order: hex, then darker.
  return Object.fromEntries(
    Object.entries(K).map(([name, hexed]) => [
      name,
      Object.fromEntries([
        ["hex", hexed],
        ["darker", names.get(darker(hexed))!],
      ]) as { darker: string; hex: string },
    ]),
  );
}

// paletteTable as PALETTE_JSON holds it.
export function paletteJson(): string {
  return `${JSON.stringify(paletteTable(), null, 2)}\n`;
}

// Write paletteTable to PALETTE_JSON, for the game's dark ramp.
export function writePalette(): void {
  writeFileSync(PALETTE_JSON, paletteJson());
}

const USAGE = `Usage:
  node art/tools/pixel.ts palette           print the palette as JSON: every colour by K name, its
                                            hex and the name of the colour one ramp step darker
                                            (DARKER)
  node art/tools/pixel.ts palette --write   write it to shared/palette.json, which the game's dark
                                            ramp reads`;

if (import.meta.main) {
  await run({
    commands: {
      palette: () => process.stdout.write(paletteJson()),
      "palette --write": () => writePalette(),
    },
    doc: USAGE,
  });
}
