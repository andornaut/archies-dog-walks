// Rebuild the art on art-kit's build runner: run `node art/tools/<set>.ts build` for every set, in an
// order where each set runs after the sets whose exports it reads, and stop at the first failure.
//
// Builds read earlier exports from public/art/: every set that imports scene.ts reads each zone's road
// strip (roads), and the others below read the sprites, images and fonts they paste. A set with no
// entry in NEEDS reads only its own exports, the committed manifest and shared/ tables.
//
// --check snapshots every file under CHECK_PATHS (art/ and every path the builds write) before the
// rebuild and fails when the rebuild changes, removes or adds one, listing those paths. It needs no
// git. Builds are deterministic, so on a clean checkout every difference is a generator change.
// Named sets rebuild those sets and every set downstream of them.
//
// Run from the repository root in the archie-check image (SoX and ffmpeg). It spawns only node and
// reaches no network.
import { buildCommand, type BuildSets, nodeBuild } from "@andornaut/art-kit/build";

const USAGE = `Usage:
  node art/tools/build.ts [--check] [SET...]   rebuild every set, or each SET and the sets that read
                                               its exports, in dependency order; --check then fails
                                               on any file under art/ or the paths the builds write
                                               (public/art/, public/icons/, public/og-image.png and
                                               shared/palette.json, roadside.json and verges.json)
                                               that was changed or untracked before the rebuild, or
                                               that the rebuild changed, removed or added`;

// Every set with a build command, in build order: the sets that read no other set's exports
// (alphabetical), then the sets that do (alphabetical, which meets every entry in NEEDS). art-kit
// breaks ties in its build order by declaration order, so it runs the sets in this order.
const SETS = [
  "ambient",
  "animals",
  "badges",
  "debuffs",
  "dogs",
  "drops",
  "encounters",
  "feedback",
  "fonts",
  "fx",
  "glyphs",
  "hazards",
  "hits",
  "hood_people",
  "icons",
  "minis",
  "moments",
  "needs",
  "obstacles",
  "owners",
  "people",
  "pixel",
  "portraits",
  "road",
  "roads",
  "sounds",
  "ui",
  "vehicles",
  "appicons",
  "backdrops",
  "cards",
  "depths",
  "hood_city",
  "hood_markets",
  "hood_parks",
  "roadside",
  "screens",
  "share",
] as const;

type ArtSet = (typeof SETS)[number];

// The sets whose exports each set reads.
const NEEDS: Readonly<Partial<Record<ArtSet, readonly ArtSet[]>>> = {
  // Archie's portrait.
  appicons: ["portraits"],
  backdrops: ["roads"],
  // The pack, the owners' faces and the road sprites the cards pose.
  cards: ["dogs", "owners", "road", "roads"],
  // The hazards' 75 and 50 steps, which the steps between settle against.
  depths: ["hazards"],
  // The zoomies icon.
  hood_city: ["glyphs", "roads"],
  // Archie and the bill icon.
  hood_markets: ["dogs", "roads", "ui"],
  // The treat.
  hood_parks: ["road", "roads"],
  roadside: ["backdrops"],
  // Archie's portrait.
  screens: ["portraits", "roads"],
  // The backdrops, the pack, Casey, the fonts and the logo.
  share: ["backdrops", "dogs", "fonts", "road", "roads", "screens"],
};

// The modules in art/tools/ that are not sets: shared drawing code, the web font writer, previews,
// the home page's grabs (taken from the built game), scores and this file.
const NOT_SETS = [
  "build",
  "contact_sheet",
  "home_grabs",
  "mini",
  "music_cabbagetown",
  "music_distillery_district",
  "music_high_park",
  "music_kensington_market",
  "music_the_beaches",
  "music_yonge_street",
  "scene",
  "webfont",
];

// art/, which no build writes, and every path a build writes: shared/palette.json (pixel),
// shared/roadside.json (roadside) and shared/verges.json (backdrops). The rest of shared/ is the
// game's.
const CHECK_PATHS = [
  "art",
  "public/art",
  "public/icons",
  "public/og-image.png",
  "shared/palette.json",
  "shared/roadside.json",
  "shared/verges.json",
];

const TOOLS = { directory: "art/tools" };

const BUILD_SETS: BuildSets = Object.fromEntries(
  SETS.map((set) => [set, { build: nodeBuild(TOOLS, set), needs: NEEDS[set] ?? [] }]),
);

// art-kit fails on a module in art/tools/ that is neither a set nor in NOT_SETS and on a set
// declared before one it needs, then parses `[--check] [SET...]` (or prints USAGE for --help or -h)
// and returns the exit status: 0, 1 for a failed self-check, build or check, or 2 for an unknown
// option or set.
if (import.meta.main) {
  process.exitCode = await buildCommand(
    {
      check: { paths: CHECK_PATHS },
      modules: { ...TOOLS, nonSets: NOT_SETS },
      sets: BUILD_SETS,
      strictOrder: true,
      usage: USAGE,
    },
    process.argv.slice(2),
  );
}
