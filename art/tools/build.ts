// Rebuild the art: run `node art/tools/<set>.ts build` for every set, in an order where each set runs
// after the sets whose exports it reads, and stop at the first failure.
//
// Builds read earlier exports from public/art/: every set that imports scene.ts reads each zone's road
// strip (roads), and the others below read the sprites, images and fonts they paste. A set with no
// entry in NEEDS reads only its own exports, the committed manifest and shared/ tables.
//
// --check then fails when a path under TREES (art/ and every path the builds write) differs from the
// index or holds an untracked file, and lists those paths. Builds are deterministic, so on a clean
// checkout every difference is a generator change. Named sets rebuild those sets and every set
// downstream of them.
//
// Run from the repository root in the archie-check image (SoX and ffmpeg). It spawns only node and
// git, and reaches no network.
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";

import { run as runCommands, UsageError } from "./pixel.ts";

const USAGE = `Usage:
  node art/tools/build.ts [--check] [SET...]   rebuild every set, or each SET and the sets that read
                                               its exports, in dependency order; --check then fails
                                               on any changed or untracked file under art/ or
                                               the paths the builds write (public/art/,
                                               public/icons/, public/og-image.png and
                                               shared/palette.json, roadside.json and
                                               verges.json)`;

// Every set with a build command, in build order: the sets that read no other set's exports
// (alphabetical), then the sets that do (alphabetical, which meets every entry in NEEDS).
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
const TREES = [
  "art",
  "public/art",
  "public/icons",
  "public/og-image.png",
  "shared/palette.json",
  "shared/roadside.json",
  "shared/verges.json",
];

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

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

// The named sets and every set that reads their exports, directly or through another, in build order;
// every set when none is named.
function selected(named: readonly ArtSet[]): ArtSet[] {
  if (!named.length) {
    return [...SETS];
  }
  const chosen = new Set<ArtSet>(named);
  for (const set of SETS) {
    if (NEEDS[set]?.some((need) => chosen.has(need))) {
      chosen.add(set);
    }
  }
  return SETS.filter((set) => chosen.has(set));
}

function run(command: string, args: readonly string[]): number {
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.error) {
    fail(`${command}: ${result.error.message}`);
  }
  return result.status ?? 1;
}

// The changed and untracked paths under TREES, printed; true when there are none.
function unchanged(): boolean {
  const diff = run("git", ["diff", "--exit-code", "--name-status", "--", ...TREES]);
  const others = spawnSync(
    "git",
    ["ls-files", "--others", "--exclude-standard", "-z", "--", ...TREES],
    { encoding: "utf8" },
  );
  if (others.status !== 0) {
    fail(`git ls-files: ${others.stderr || others.error?.message}`);
  }
  const untracked = others.stdout.split("\0").filter(Boolean);
  for (const path of untracked) {
    console.log(`?\t${path}`);
  }
  return diff === 0 && !untracked.length;
}

// Rebuild the named sets and those downstream, or every set, then check the trees if check is set.
function rebuild(check: boolean, named: readonly string[]): void {
  const unknown = named.filter((arg) => !(SETS as readonly string[]).includes(arg));
  if (unknown.length) {
    console.error(`unknown set ${unknown.join(", ")}`);
    throw new UsageError();
  }
  const found = problems("art/tools");
  if (found.length) {
    fail(found.join("\n"));
  }
  const started = performance.now();
  for (const set of selected(named as ArtSet[])) {
    console.log(`build ${set}`);
    const status = run(process.execPath, [`art/tools/${set}.ts`, "build"]);
    if (status !== 0) {
      fail(`${set} build failed (exit ${status})`);
    }
  }
  console.log(`built in ${((performance.now() - started) / 1000).toFixed(0)}s`);
  if (check && !unchanged()) {
    fail(`the rebuild differs from the committed ${TREES.join(", ")}`);
  }
}

if (import.meta.main) {
  await runCommands({
    commands: {
      "": () => rebuild(false, []),
      "--check": () => rebuild(true, []),
      "--check SET...": (...sets) => rebuild(true, sets),
      "SET...": (...sets) => rebuild(false, sets),
    },
    doc: USAGE,
  });
}
