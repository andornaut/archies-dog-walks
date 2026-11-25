// CLEANUP (added 2026-11-25): remove this check when the known-violations table is empty and
// ESLint guards the layers (adw-0259).
//
// The import graph of src/ follows the cross-game source bands. Every module outside the tests
// sits in a row of BANDS and imports only its own group and groups in lower rows: never a group in
// its own row (strict layers) or above; type-only imports, re-exports and `typeof import()` count.
// No cycle is made of runtime imports alone; a type-only import may close one. An import is
// type-only when it is `import type`, `export type` or `typeof import()`: under
// verbatimModuleSyntax, `import { type A }` still loads its module. Tests and src/testing/ are
// exempt from the layer rule but not from the cycle rule. KNOWN lists today's violations exactly:
// the check fails on a violation not listed and on a listed one that no longer occurs, so the
// table only shrinks.
import { readdirSync, readFileSync } from "node:fs";
import { posix } from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";
import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("../../", import.meta.url));

/** Each module's imports of src/ modules; an import is type-only when every form of it is. */
type Graph = ReadonlyMap<string, readonly { readonly to: string; readonly typeOnly: boolean }[]>;
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
 * Today's violations, `importer -> imported`: under `cycle`, every runtime import on a cycle of
 * runtime imports. CLEANUP (added 2026-11-25): remove this check when the
 * known-violations table is empty and ESLint guards the layers (adw-0259).
 */
const KNOWN: Readonly<Record<Kind, readonly string[]>> = {
  cycle: [],
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

const PLACES = BANDS.flatMap(({ rows }) => rows).flatMap((groups, row) =>
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
 * import or `typeof import()`, in source order, each marked type-only or not.
 */
function imports(text: string): { specifier: string; typeOnly: boolean }[] {
  const found: { specifier: string; typeOnly: boolean }[] = [];
  const add = (specifier: ts.Node | undefined, typeOnly: boolean): void => {
    if (specifier !== undefined && ts.isStringLiteral(specifier)) {
      found.push({ specifier: specifier.text, typeOnly });
    }
  };
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node)) {
      add(node.moduleSpecifier, node.importClause?.phaseModifier === ts.SyntaxKind.TypeKeyword);
    } else if (ts.isExportDeclaration(node)) {
      add(node.moduleSpecifier, node.isTypeOnly);
    } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      add(node.arguments[0], false);
    } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
      add(node.argument.literal, true);
    }
    ts.forEachChild(node, visit);
  };
  visit(ts.createSourceFile("module.ts", text, ts.ScriptTarget.Latest));
  return found.filter(({ specifier }) => /^(?:\.{1,2}\/|\/src\/)/u.test(specifier));
}

/** Each module with the root-relative src/ modules it imports, its source read by `read`. */
function importGraph(read: (module: string) => string, modules: readonly string[]): Graph {
  return new Map(
    modules.map((module) => {
      const targets = new Map<string, boolean>();
      for (const { specifier, typeOnly } of imports(read(module))) {
        const to = specifier.startsWith("/")
          ? specifier.slice(1)
          : posix.join(posix.dirname(module), specifier);
        if (to.startsWith("src/") && to.endsWith(".ts")) {
          targets.set(to, typeOnly && (targets.get(to) ?? true));
        }
      }
      return [module, [...targets].map(([to, typeOnly]) => ({ to, typeOnly }))];
    }),
  );
}

/**
 * Each runtime import that lies on a cycle of runtime imports, a self-import included. Type-only
 * imports close no cycle, as in import-x/no-cycle; the layer rule fixes their direction.
 */
function cycleEdges(graph: Graph): string[] {
  const runtime = new Map(
    [...graph].map(([from, targets]) => [from, targets.filter(({ typeOnly }) => !typeOnly)]),
  );
  const index = new Map<string, number>();
  const low = new Map<string, number>();
  const component = new Map<string, number>();
  const stack: string[] = [];
  const visit = (node: string): void => {
    index.set(node, index.size);
    low.set(node, index.get(node) ?? 0);
    stack.push(node);
    for (const { to } of runtime.get(node) ?? []) {
      if (!runtime.has(to)) {
        continue;
      }
      if (!index.has(to)) {
        visit(to);
        low.set(node, Math.min(low.get(node) ?? 0, low.get(to) ?? 0));
      } else if (!component.has(to)) {
        low.set(node, Math.min(low.get(node) ?? 0, index.get(to) ?? 0));
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
  for (const node of [...runtime.keys()].sort()) {
    if (!index.has(node)) {
      visit(node);
    }
  }
  return [...runtime].flatMap(([from, targets]) =>
    targets
      .filter(({ to }) => component.has(to) && component.get(to) === component.get(from))
      .map(({ to }) => `${from} -> ${to}`),
  );
}

/** Every violation in the graph by kind, sorted. */
function violations(graph: Graph): Record<Kind, string[]> {
  const found: Record<Kind, string[]> = { cycle: cycleEdges(graph), sideways: [], upward: [] };
  for (const [from, targets] of graph) {
    for (const { to } of targets) {
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
      imports(
        [
          'import { a } from "./a.ts";',
          'import type { B } from "../b.ts";',
          "import {\n  type C,\n  type D,\n} from './c.ts';",
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
      { specifier: "./a.ts", typeOnly: false },
      { specifier: "../b.ts", typeOnly: true },
      { specifier: "./c.ts", typeOnly: false },
      { specifier: "./e.ts", typeOnly: false },
      { specifier: "/src/f.ts", typeOnly: true },
      { specifier: "./side.ts", typeOnly: false },
      { specifier: "./g.ts", typeOnly: false },
      { specifier: "./h.ts", typeOnly: true },
    ]);
  });

  it("fails cycles of runtime imports and passes cycles a type-only import closes", () => {
    const sources: Readonly<Record<string, string>> = {
      "src/a.ts": 'import type { B } from "./b.ts";',
      "src/b.ts": 'import type { A } from "./a.ts";',
      "src/c.ts": 'import { d } from "./d.ts";',
      "src/d.ts": 'import type { C } from "./c.ts";',
      "src/e.ts": 'import { type F } from "./f.ts";',
      "src/f.ts": 'import { type E } from "./e.ts";',
      "src/g.ts": 'export * from "./h/h.ts";',
      "src/h/h.ts": 'const g = await import("../g.ts");',
      "src/i.ts": 'import { i } from "./i.ts";',
      "src/j.ts": 'import type { J } from "./j.ts";',
      "src/k.ts": 'import { l } from "./l.ts";',
      "src/l.ts": 'import { m } from "./m.ts";',
      "src/m.ts": 'import { k } from "./k.ts";\nimport type { A } from "./a.ts";',
      "src/n.ts": 'import { a } from "./a.ts";',
    };
    const graph = importGraph((module) => sources[module] ?? "", Object.keys(sources));
    expect(cycleEdges(graph).sort()).toEqual([
      "src/e.ts -> src/f.ts",
      "src/f.ts -> src/e.ts",
      "src/g.ts -> src/h/h.ts",
      "src/h/h.ts -> src/g.ts",
      "src/i.ts -> src/i.ts",
      "src/k.ts -> src/l.ts",
      "src/l.ts -> src/m.ts",
      "src/m.ts -> src/k.ts",
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
