// Draw the zone backdrops: the neighbourhood band between the top bar and the road.
//
// backdrop-<zone>: 360x158 images in the house palette, drawn on screen rows 48 to 205. The
// street ends at a T-junction: the bottom rows continue the pseudo-3D road below the band (the
// same projection, so the same road, curb and sidewalk edges at the same slope) up to a cross
// street that runs flat across the band. Beyond it the far side faces the camera: the zone's
// houses, park or shops, the scenery behind them (hills, rooftops, water, a skyline) and the sky.
// The band, the approach and the camera come from the game's layout export. The backdrops draw
// no static scenery on the near corners or the stub's verges, where the game's road begins and
// its items spawn: only the verge's ground.
//
// Rows, in band rows (0 to 157): the sky is one flat colour above row 45 (CALM), under the message
// strip (band rows 6 to 57 while a message shows), but any neighbourhood's skyline may rise above
// it (Cabbagetown's old trees, chapel spire, far downtown towers and stars; High Park's oaks,
// ridge and clouds; the Distillery District's chimney stack, water tower and condo towers; The
// Beaches' high clouds and tall trees; and Yonge Street's skyline, moon and stars); the far side's
// ground row 115 (BASE), the far sidewalk 119 to 122, the far curb 123 to 124, the cross street
// 125 to 133 with its centre line on row 129, the near curb 134 to 135 (none where the cross
// street has none), the near sidewalk 136 to 138, and the stub from row 139 (STUB, the approach)
// to the bottom row, 157, which continues the game's road (the 320-wide strip on columns 100 to
// 259, lane dividers on 132, 164, 195 and 227, verge outside). The two sidewalks' middles run from
// (87, 157) to (93, 138) and from (273, 157) to (267, 138) (node art/tools/backdrops.ts camera
// prints them for the current constants).
//
// Every seeded texture (clouds, ridges, oaks, lit windows, passers-by, soot streaks, rough lawn)
// draws from game-kit's randomStream, one stream per texture named after it, so a build is the
// same on every run.
//
// Run from the repository root. A build overwrites the exports, so hand edits to them belong in
// this file instead.
import { command } from "./backdrops/entry.ts";

export { umbrella } from "./backdrops/beaches.ts";
export { shadeTree } from "./backdrops/beaches.ts";
export { type Paint } from "./backdrops/common.ts";
export { H } from "./backdrops/common.ts";
export { CX } from "./backdrops/common.ts";
export { word } from "./backdrops/common.ts";
export { cloud } from "./backdrops/common.ts";
export { roofline } from "./backdrops/common.ts";
export { bandRows } from "./backdrops/common.ts";
export { bands } from "./backdrops/common.ts";
export { sun } from "./backdrops/common.ts";
export { ground } from "./backdrops/common.ts";
export { type HouseParts } from "./backdrops/common.ts";
export { house } from "./backdrops/common.ts";
export { tree } from "./backdrops/common.ts";
export { SHRUB } from "./backdrops/common.ts";
export { bush } from "./backdrops/common.ts";
export { flowers } from "./backdrops/common.ts";
export { ROAD } from "./backdrops/common.ts";
export { WALK } from "./backdrops/common.ts";
export { BASE } from "./backdrops/common.ts";
export { noise } from "./backdrops/common.ts";
export { hashed } from "./backdrops/common.ts";
export { sunburst } from "./backdrops/common.ts";
export { VERGES } from "./backdrops/common.ts";
export { vergePaving } from "./backdrops/common.ts";
export { warehouse } from "./backdrops/distillery.ts";
export { DISTILLERY_SKY } from "./backdrops/distillery.ts";
export { ironFence } from "./backdrops/gardens.ts";
export { gasLamp } from "./backdrops/gardens.ts";
export { bayGable } from "./backdrops/gardens.ts";
export { LLAMA_COLOURS } from "./backdrops/gardens.ts";
export { figure } from "./backdrops/gardens.ts";
export { WORN_WALL } from "./backdrops/kensington.ts";
export { WORN_ROOF } from "./backdrops/kensington.ts";
export { FADED } from "./backdrops/kensington.ts";
export { wire } from "./backdrops/kensington.ts";
export { KENSINGTON_ROAD } from "./backdrops/kensington.ts";
export { KENSINGTON_GUTTER } from "./backdrops/kensington.ts";
export { type Tower } from "./backdrops/yonge.ts";
export { YONGE_SKY } from "./backdrops/yonge.ts";
export { MURAL } from "./pixel.ts";

if (import.meta.main) {
  await command();
}
