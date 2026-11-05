// Rebuild the art on art-kit's build runner: run `node art/tools/<set>.ts build` for every set, in an
// order where each set runs after the sets whose exports it reads, and stop at the first failure.
//
// Builds read earlier exports from public/art/: every set that imports scene.ts reads each zone's road
// strip (roads), and the others below read the sprites, images and fonts they paste. A set with no
// entry in NEEDS reads only its own exports, the committed manifest and shared/ tables.
//
// --check then fails when the rebuild changes, removes or adds a file under CHECK_PATHS (art/ and
// every path the builds write), and lists those paths. It compares the files before and after the
// rebuild and needs no git. Builds are deterministic, so on a clean checkout every difference is a
// generator change. Named sets rebuild those sets and every set downstream of them.
//
// Run from the repository root in the archie-check image (SoX and ffmpeg). It spawns only node and
// reaches no network.
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";

import { buildCommand, type BuildSets } from "@andornaut/art-kit/build";

import { run as runCommands } from "./pixel.ts";

const USAGE = `Usage:
  node art/tools/build.ts [--check] [SET...]   rebuild every set, or each SET and the sets that read
                                               its exports, in dependency order; --check then fails
                                               on any file the rebuild changed, removed or added
                                               under art/ or the paths the builds write (public/art/,
                                               public/icons/, public/og-image.png and
                                               shared/palette.json, roadside.json and
                                               verges.json)`;

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

// The modules in art/tools/ that are not sets: shared drawing code, previews, the home page's grabs
// (taken from the built game), scores and this file.
const NOT_SETS = new Set([
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
]);

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

// Problems with SETS and NEEDS: a module in dir that is neither a set nor listed in NOT_SETS, or a set
// ordered before one it needs.
function problems(dir: string): string[] {
  const out: string[] = [];
  const known = new Set<string>([...SETS, ...NOT_SETS]);
  for (const name of readdirSync(dir)) {
    const stem = name.replace(/\.ts$/, "");
    if (name.endsWith(".ts") && !known.has(stem)) {
      out.push(`${name} is not in SETS or NOT_SETS`);
    }
  }
  for (const [set, needs] of Object.entries(NEEDS)) {
    for (const need of needs) {
      if (SETS.indexOf(need) > SETS.indexOf(set as ArtSet)) {
        out.push(`${set} runs before ${need}, which it needs`);
      }
    }
  }
  return out;
}

// Run the set's build in its own node process; a nonzero exit fails the set.
function spawnBuild(set: ArtSet): void {
  const result = spawnSync(process.execPath, [`art/tools/${set}.ts`, "build"], {
    stdio: "inherit",
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`exit ${result.status ?? result.signal}`);
  }
}

const BUILD_SETS: BuildSets = Object.fromEntries(
  SETS.map((set) => [set, { build: () => spawnBuild(set), needs: NEEDS[set] ?? [] }]),
);

// Hand art-kit the `[--check] [SET...]` arguments and exit with its status: 0, 1 for a failing build
// or check differences, or 2 for an unknown set.
async function build(argv: readonly string[]): Promise<void> {
  const options = { check: { paths: CHECK_PATHS }, sets: BUILD_SETS, usage: USAGE };
  const status = await buildCommand(options, argv);
  process.exitCode = status;
}

// Check SETS and NEEDS, then build.
function rebuild(argv: readonly string[]): Promise<void> {
  const found = problems("art/tools");
  if (found.length) {
    console.error(found.join("\n"));
    process.exit(1);
  }
  return build(argv);
}

if (import.meta.main) {
  await runCommands({
    commands: {
      "": () => rebuild([]),
      "--check": () => rebuild(["--check"]),
      "--check SET...": (...sets) => rebuild(["--check", ...sets]),
      "SET...": (...sets) => rebuild(sets),
    },
    doc: USAGE,
  });
}
