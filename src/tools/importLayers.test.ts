// CLEANUP (added 2026-11-25): remove this check when the known-violations table is empty and
// ESLint guards the layers (adw-0259).
//
// The import graph of src/ follows the cross-game source bands. Every module outside the tests
// sits in a row of BANDS and imports only its own group and groups in lower rows: never a group in
// its own row (strict layers) or above. No module lies on an import cycle. Type-only imports,
// re-exports and `typeof import()` count as edges. Tests and src/testing/ are exempt from the
// layer rule but not from the cycle rule. KNOWN lists today's violations exactly: the check fails
// on a violation not listed and on a listed one that no longer occurs, so the table only shrinks.
import { readdirSync, readFileSync } from "node:fs";
import { posix } from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";
import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("../../", import.meta.url));

type Graph = ReadonlyMap<string, readonly string[]>;
type Group = string | { readonly name: string; readonly paths: readonly string[] };
type Kind = "cycle" | "sideways" | "upward";

/** Build modules that still sit in shipped folders; they belong to Support. */
const BUILD_IN_SHIPPED_FOLDERS: Group = {
  name: "build modules in shipped folders",
  paths: [
    "src/assets/unusedArt.ts",
    "src/assets/unusedArtCli.ts",
    "src/crash/crashFontText.ts",
    "src/headers/inlineStyle.ts",
    "src/headers/inlineStyleCheckPlugin.ts",
    "src/headers/securityHeadersPlugin.ts",
    "src/pwa/assetGroups.ts",
    "src/pwa/icons.ts",
    "src/pwa/precacheArt.ts",
    "src/pwa/precachePlugin.ts",
    "src/pwa/webManifestPlugin.ts",
  ],
};

/**
 * The bands of the cross-game source structure, lowest first, each with its rows lowest first.
 * A group is a directory or file under src/ (the longest match places a module) or a named set of
 * paths. Groups in one row may not import each other.
 */
const BANDS: readonly { readonly band: string; readonly rows: readonly Group[][] }[] = [
  {
    band: "Foundation",
    rows: [
      [
        "src/buildLabel.ts",
        "src/headers/securityPolicy.ts",
        "src/packCapacity.ts",
        "src/pressAdmission.ts",
        "src/units.ts",
      ],
      ["src/data"],
      ["src/content"],
      ["src/assets"],
    ],
  },
  {
    band: "Model",
    rows: [["src/state"], ["src/rules"], ["src/layout"], ["src/runner"], ["src/road"]],
  },
  { band: "Saving", rows: [["src/save"]] },
  {
    band: "Presentation",
    rows: [
      ["src/ui"],
      ["src/audio", "src/pack", "src/presentation"],
      ["src/holdRule.ts", "src/input"],
      ["src/help"],
      ["src/home"],
      ["src/dev"],
      ["src/hud"],
    ],
  },
  { band: "Platform", rows: [["src/pwa"], ["src/loadingProgress.ts"]] },
  {
    band: "Engine and views",
    rows: [
      ["src/ui/dom"],
      ["src/home/dom"],
      ["src/hud/dom"],
      ["src/assets/phaser", "src/input/phaser", "src/ui/phaser"],
      ["src/home/phaser", "src/pack/phaser"],
      ["src/scenes"],
    ],
  },
  {
    band: "Entries",
    rows: [["src/crash"], ["src/dataPage", "src/homePage", "src/main.ts"], ["src/startup.ts"]],
  },
  {
    band: "Support",
    rows: [
      [BUILD_IN_SHIPPED_FOLDERS, "src/tools/atlas"],
      ["src/tools"],
      ["src/sim"],
      ["src/tools/plannerAcceptance"],
      ["src/testing"],
    ],
  },
];

/**
 * Today's violations, `importer -> imported`: under `cycle`, every import whose two modules lie on
 * one cycle. CLEANUP (added 2026-11-25): remove this check when the known-violations table is empty
 * and ESLint guards the layers (adw-0259).
 */
const KNOWN: Readonly<Record<Kind, readonly string[]>> = {
  cycle: [
    "src/data/achievements.ts -> src/data/types.ts",
    "src/data/debuffs.ts -> src/data/types.ts",
    "src/data/dogs.ts -> src/data/types.ts",
    "src/data/encounters.ts -> src/data/types.ts",
    "src/data/hints.ts -> src/data/types.ts",
    "src/data/minorObstacles.ts -> src/data/types.ts",
    "src/data/movementProfiles.ts -> src/data/minorObstacles.ts",
    "src/data/movementProfiles.ts -> src/data/types.ts",
    "src/data/shop.ts -> src/data/types.ts",
    "src/data/tuning.ts -> src/data/types.ts",
    "src/data/types.ts -> src/data/achievements.ts",
    "src/data/types.ts -> src/data/debuffs.ts",
    "src/data/types.ts -> src/data/dogs.ts",
    "src/data/types.ts -> src/data/encounters.ts",
    "src/data/types.ts -> src/data/hints.ts",
    "src/data/types.ts -> src/data/minorObstacles.ts",
    "src/data/types.ts -> src/data/movementProfiles.ts",
    "src/data/types.ts -> src/data/shop.ts",
    "src/data/types.ts -> src/data/tuning.ts",
    "src/data/types.ts -> src/data/upgrades.ts",
    "src/data/types.ts -> src/data/walkers.ts",
    "src/data/types.ts -> src/data/world.ts",
    "src/data/upgrades.ts -> src/data/types.ts",
    "src/data/walkers.ts -> src/data/types.ts",
    "src/data/world.ts -> src/data/types.ts",
    "src/runner/slotDelivery.ts -> src/runner/slotPlan.ts",
    "src/runner/slotPlan.ts -> src/runner/slotDelivery.ts",
    "src/runner/slotWitnessConstruct.ts -> src/runner/slotWitnessOrder.ts",
    "src/runner/slotWitnessConstruct.ts -> src/runner/slotWitnessSearch.ts",
    "src/runner/slotWitnessOrder.ts -> src/runner/slotWitnessSearch.ts",
    "src/runner/slotWitnessSearch.ts -> src/runner/slotWitnessConstruct.ts",
    "src/scenes/HelpPictureScene.ts -> src/scenes/HudScene.ts",
    "src/scenes/HelpPictureScene.ts -> src/scenes/hudWalk.ts",
    "src/scenes/HelpPictureScene.ts -> src/scenes/run/packView.ts",
    "src/scenes/HelpPictureScene.ts -> src/scenes/run/runMoments.ts",
    "src/scenes/HelpScene.ts -> src/scenes/HelpPictureScene.ts",
    "src/scenes/HelpScene.ts -> src/scenes/MenuScene.ts",
    "src/scenes/HelpScene.ts -> src/scenes/homeBarPress.ts",
    "src/scenes/HelpScene.ts -> src/scenes/titleNavigation.ts",
    "src/scenes/HudScene.ts -> src/scenes/HelpScene.ts",
    "src/scenes/HudScene.ts -> src/scenes/feedbackMoments.ts",
    "src/scenes/HudScene.ts -> src/scenes/heartFeedback.ts",
    "src/scenes/HudScene.ts -> src/scenes/hudWalk.ts",
    "src/scenes/HudScene.ts -> src/scenes/run/runMoments.ts",
    "src/scenes/MenuScene.ts -> src/scenes/SettingsScene.ts",
    "src/scenes/MenuScene.ts -> src/scenes/cheatsModal.ts",
    "src/scenes/MenuScene.ts -> src/scenes/homeBarPress.ts",
    "src/scenes/PauseScene.ts -> src/scenes/HelpScene.ts",
    "src/scenes/PauseScene.ts -> src/scenes/RunScene.ts",
    "src/scenes/PauseScene.ts -> src/scenes/SettingsScene.ts",
    "src/scenes/PauseScene.ts -> src/scenes/cheatsModal.ts",
    "src/scenes/RunScene.ts -> src/scenes/HudScene.ts",
    "src/scenes/RunScene.ts -> src/scenes/PauseScene.ts",
    "src/scenes/RunScene.ts -> src/scenes/hudWalk.ts",
    "src/scenes/RunScene.ts -> src/scenes/run/menuFlow.ts",
    "src/scenes/RunScene.ts -> src/scenes/run/packView.ts",
    "src/scenes/RunScene.ts -> src/scenes/run/runMoments.ts",
    "src/scenes/RunScene.ts -> src/scenes/run/runStart.ts",
    "src/scenes/SettingsScene.ts -> src/scenes/homeBarPress.ts",
    "src/scenes/cheatsModal.ts -> src/scenes/RunScene.ts",
    "src/scenes/feedbackMoments.ts -> src/scenes/hudWalk.ts",
    "src/scenes/heartFeedback.ts -> src/scenes/hudWalk.ts",
    "src/scenes/homeBarPress.ts -> src/scenes/MenuScene.ts",
    "src/scenes/homeBarPress.ts -> src/scenes/SettingsScene.ts",
    "src/scenes/homeBarPress.ts -> src/scenes/titleNavigation.ts",
    "src/scenes/hudWalk.ts -> src/scenes/PauseScene.ts",
    "src/scenes/run/itemViews.ts -> src/scenes/run/moverView.ts",
    "src/scenes/run/itemViews.ts -> src/scenes/run/standPart.ts",
    "src/scenes/run/menuFlow.ts -> src/scenes/PauseScene.ts",
    "src/scenes/run/menuFlow.ts -> src/scenes/SettingsScene.ts",
    "src/scenes/run/moverView.ts -> src/scenes/run/itemViews.ts",
    "src/scenes/run/moverView.ts -> src/scenes/run/signatureView.ts",
    "src/scenes/run/moverView.ts -> src/scenes/run/standPart.ts",
    "src/scenes/run/packView.ts -> src/scenes/feedbackMoments.ts",
    "src/scenes/run/runMoments.ts -> src/scenes/run/packView.ts",
    "src/scenes/run/runStart.ts -> src/scenes/RunScene.ts",
    "src/scenes/run/signatureView.ts -> src/scenes/run/itemViews.ts",
    "src/scenes/run/signatureView.ts -> src/scenes/run/standPart.ts",
    "src/scenes/run/standPart.ts -> src/scenes/run/itemViews.ts",
    "src/scenes/titleNavigation.ts -> src/scenes/RunScene.ts",
    "src/tools/artManifest.ts -> src/tools/files.ts",
    "src/tools/files.ts -> src/tools/artManifest.ts",
    "src/ui/dom/artElements.ts -> src/ui/dom/pixelLine.ts",
    "src/ui/dom/domCuts.ts -> src/ui/dom/artElements.ts",
    "src/ui/dom/pixelLine.ts -> src/ui/dom/uiLayer.ts",
    "src/ui/dom/uiLayer.ts -> src/ui/dom/domCuts.ts",
    "src/ui/interaction.ts -> src/ui/selection.ts",
    "src/ui/selection.ts -> src/ui/interaction.ts",
  ],
  sideways: ["src/input/hold.ts -> src/holdRule.ts"],
  upward: [
    "src/data/screen.ts -> src/layout/projection.ts",
    "src/data/screen.ts -> src/layout/screenLayout.ts",
    "src/home/detailCardView.ts -> src/hud/effectNames.ts",
    "src/home/dom/speech.ts -> src/hud/dom/detailCard.ts",
    "src/home/endScreenView.ts -> src/hud/hudView.ts",
    "src/home/homeLayout.ts -> src/hud/walkHud.ts",
    "src/home/selectionView.ts -> src/hud/effectIcons.ts",
    "src/home/speechView.ts -> src/hud/effectNames.ts",
    "src/input/keyBindings.ts -> src/home/focus.ts",
    "src/layout/cardLayout.ts -> src/ui/buttonGeometry.ts",
    "src/layout/cardLayout.ts -> src/ui/cardRow.ts",
    "src/layout/cardLayout.ts -> src/ui/namePills.ts",
    "src/layout/cardLayout.ts -> src/ui/textFit.ts",
    "src/layout/hitEffects.ts -> src/runner/walk.ts",
    "src/layout/roadRaster.ts -> src/road/roadside.ts",
    "src/layout/screenLayout.ts -> src/ui/buttonGeometry.ts",
    "src/pack/phaser/packFigures.ts -> src/scenes/run/stage.ts",
    "src/pack/phaser/packFigures.ts -> src/scenes/sprites.ts",
    "src/pwa/precacheArt.ts -> src/tools/artManifest.ts",
    "src/tools/atlas/atlasPlugin.ts -> src/tools/artManifest.ts",
    "src/tools/atlas/atlasPlugin.ts -> src/tools/concurrency.ts",
    "src/tools/atlas/atlasPlugin.ts -> src/tools/files.ts",
    "src/tools/atlas/atlasPlugin.ts -> src/tools/siteArt.ts",
    "src/tools/atlas/hashedArt.ts -> src/tools/artManifest.ts",
  ],
};

const ROWS = BANDS.flatMap(({ rows }) => rows);
const PLACES = ROWS.flatMap((groups, row) =>
  groups.flatMap((group) =>
    typeof group === "string"
      ? [{ group, path: group, row }]
      : group.paths.map((path) => ({ group: group.name, path, row })),
  ),
);

/** The group and row of the longest placed path a module falls under. */
function placeOf(module: string): { group: string; row: number } | undefined {
  return PLACES.filter(({ path }) => module === path || module.startsWith(`${path}/`)).sort(
    (a, b) => b.path.length - a.path.length,
  )[0];
}

function isTest(module: string): boolean {
  return module.endsWith(".test.ts") || module.startsWith("src/testing/");
}

/** The layer rule's verdict on one import of a placed module by a non-test module. */
function layerViolation(from: string, to: string): Kind | undefined {
  const [a, b] = [placeOf(from), placeOf(to)];
  if (isTest(from) || a === undefined || b === undefined || a.group === b.group) {
    return undefined;
  }
  if (b.row > a.row) {
    return "upward";
  }
  return b.row === a.row ? "sideways" : undefined;
}

/**
 * The relative and /src/ specifiers a module imports, re-exports or loads with a literal dynamic
 * import or `typeof import()`, type-only forms included.
 */
function specifiers(text: string): string[] {
  return ts
    .preProcessFile(text, true, true)
    .importedFiles.map(({ fileName }) => fileName)
    .filter((specifier) => /^(?:\.{1,2}\/|\/src\/)/u.test(specifier));
}

/** Each module with the root-relative src/ modules it imports, its source read by `read`. */
function importGraph(read: (module: string) => string, modules: readonly string[]): Graph {
  return new Map(
    modules.map((module) => [
      module,
      [
        ...new Set(
          specifiers(read(module))
            .map((specifier) =>
              specifier.startsWith("/")
                ? specifier.slice(1)
                : posix.join(posix.dirname(module), specifier),
            )
            .filter((target) => target.startsWith("src/") && target.endsWith(".ts")),
        ),
      ],
    ]),
  );
}

/** Each import whose two modules lie in one strongly connected set, a self-import included. */
function cycleEdges(graph: Graph): string[] {
  const index = new Map<string, number>();
  const low = new Map<string, number>();
  const component = new Map<string, number>();
  const stack: string[] = [];
  const visit = (node: string): void => {
    index.set(node, index.size);
    low.set(node, index.get(node) ?? 0);
    stack.push(node);
    for (const next of graph.get(node) ?? []) {
      if (!graph.has(next)) {
        continue;
      }
      if (!index.has(next)) {
        visit(next);
        low.set(node, Math.min(low.get(node) ?? 0, low.get(next) ?? 0));
      } else if (!component.has(next)) {
        low.set(node, Math.min(low.get(node) ?? 0, index.get(next) ?? 0));
      }
    }
    if (low.get(node) === index.get(node)) {
      let member: string | undefined;
      do {
        member = stack.pop();
        if (member !== undefined) {
          component.set(member, index.get(node) ?? 0);
        }
      } while (member !== undefined && member !== node);
    }
  };
  for (const node of [...graph.keys()].sort()) {
    if (!index.has(node)) {
      visit(node);
    }
  }
  return [...graph].flatMap(([from, targets]) =>
    targets
      .filter((to) => component.has(to) && component.get(to) === component.get(from))
      .map((to) => `${from} -> ${to}`),
  );
}

/** Every violation in the graph by kind, sorted. */
function violations(graph: Graph): Record<Kind, string[]> {
  const found: Record<Kind, string[]> = { cycle: cycleEdges(graph), sideways: [], upward: [] };
  for (const [from, targets] of graph) {
    for (const to of targets) {
      const kind = layerViolation(from, to);
      if (kind !== undefined) {
        found[kind].push(`${from} -> ${to}`);
      }
    }
  }
  for (const list of Object.values(found)) {
    list.sort();
  }
  return found;
}

/** Each .ts module under a directory, relative to the root, declaration files excluded. */
function modules(directory: string): string[] {
  return readdirSync(posix.join(root, directory), { withFileTypes: true }).flatMap((entry) => {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) {
      return modules(path);
    }
    return entry.name.endsWith(".ts") && !entry.name.endsWith(".d.ts") ? [path] : [];
  });
}

describe("the import check", () => {
  it("parses static, type-only, multi-line, re-export, dynamic and typeof imports", () => {
    expect(
      specifiers(
        [
          'import { a } from "./a.ts";',
          'import type { B } from "../b.ts";',
          "import {\n  c,\n  type D,\n} from './c.ts';",
          'export { e } from "./e.ts";',
          'export type * from "/src/f.ts";',
          'import "./side.ts";',
          'const g = await import("./g.ts");',
          'type H = typeof import("./h.ts");',
          "const i = 'import { i } from \"./i.ts\";';",
          'import { join } from "node:path";',
        ].join("\n"),
      ),
    ).toEqual([
      "./a.ts",
      "../b.ts",
      "./c.ts",
      "./e.ts",
      "/src/f.ts",
      "./side.ts",
      "./g.ts",
      "./h.ts",
    ]);
  });

  it("reports every import on a cycle, type-only cycles included, and passes a chain", () => {
    const graph = importGraph(
      (module) =>
        ({
          "src/a.ts": 'import type { B } from "./b.ts";',
          "src/b.ts": 'import { type A } from "./a.ts";\nimport { c } from "./c.ts";',
          "src/c.ts": 'import { d } from "./d/d.ts";',
          "src/d/d.ts": 'export * from "../e.ts";',
          "src/e.ts": 'type C = typeof import("./c.ts");',
          "src/f.ts": 'import { a } from "./a.ts";',
          "src/g.ts": 'import { g } from "./g.ts";',
        })[module] ?? "",
      ["src/a.ts", "src/b.ts", "src/c.ts", "src/d/d.ts", "src/e.ts", "src/f.ts", "src/g.ts"],
    );
    expect(cycleEdges(graph).sort()).toEqual([
      "src/a.ts -> src/b.ts",
      "src/b.ts -> src/a.ts",
      "src/c.ts -> src/d/d.ts",
      "src/d/d.ts -> src/e.ts",
      "src/e.ts -> src/c.ts",
      "src/g.ts -> src/g.ts",
    ]);
  });

  it.each([
    ["src/rules/a.ts", "src/rules/b.ts", undefined],
    ["src/hud/a.ts", "src/rules/b.ts", undefined],
    ["src/ui/modal/a.ts", "src/ui/b.ts", undefined],
    ["src/pwa/precacheArt.ts", "src/pwa/cachePolicy.ts", undefined],
    ["src/scenes/a.test.ts", "src/main.ts", undefined],
    ["src/testing/a.ts", "src/sim/b.ts", undefined],
    ["src/rules/a.ts", "src/save/b.ts", "upward"],
    ["src/rules/a.ts", "src/ui/b.ts", "upward"],
    ["src/ui/dom/a.ts", "src/scenes/b.ts", "upward"],
    ["src/pwa/launch.ts", "src/pwa/icons.ts", "upward"],
    ["src/sim/a.ts", "src/testing/b.ts", "upward"],
    ["src/input/a.ts", "src/holdRule.ts", "sideways"],
    ["src/ui/phaser/a.ts", "src/input/phaser/b.ts", "sideways"],
  ])("judges %s importing %s as %s", (from, to, kind) => {
    expect(layerViolation(from, to)).toBe(kind);
  });
});

describe("the src/ import graph", () => {
  const graph = importGraph(
    (module) => readFileSync(posix.join(root, module), "utf8"),
    modules("src"),
  );

  it("places every module outside the tests in a band", () => {
    const unplaced = [...graph.keys()].filter(
      (module) => !isTest(module) && placeOf(module) === undefined,
    );
    expect(unplaced).toEqual([]);
  });

  it("has exactly the known cycles, upward and sideways imports", () => {
    const found = violations(graph);
    const differences = Object.fromEntries(
      (Object.keys(KNOWN) as Kind[]).map((kind) => [
        kind,
        {
          fixed: KNOWN[kind].filter((violation) => !found[kind].includes(violation)),
          new: found[kind].filter((violation) => !KNOWN[kind].includes(violation)),
        },
      ]),
    );
    expect(differences).toEqual({
      cycle: { fixed: [], new: [] },
      sideways: { fixed: [], new: [] },
      upward: { fixed: [], new: [] },
    });
  });
});
