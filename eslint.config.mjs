import { globSync } from "node:fs";
import { posix } from "node:path";
import { fileURLToPath } from "node:url";

import js from "@eslint/js";
import { defineConfig } from "eslint/config";
// WORKAROUND: https://github.com/un-ts/eslint-plugin-import-x/issues/569
import { createNodeResolver } from "eslint-plugin-import-x/node-resolver";
import extensions from "eslint-plugin-import-x/rules/extensions";
import noCycle from "eslint-plugin-import-x/rules/no-cycle";
import noRestrictedPaths from "eslint-plugin-import-x/rules/no-restricted-paths";
import globals from "globals";
import ts from "typescript-eslint";

import { plugins, sourceRules, toolingRules } from "./eslint.config.base.mjs";

const SOURCE_FILES = ["art/tools/**/*.ts", "src/**/*.ts"];
const PHASER_FILES = ["src/main.ts", "src/scenes/**", "src/**/phaser/**"];
const TEST_FILES = ["src/**/*.test.ts"];
const CONFIG_FILES = ["*.ts", "*.js", "*.mjs"];
const ROOT = fileURLToPath(new URL(".", import.meta.url));

// One plugin object for every config that uses import-x: ESLint refuses two different objects
// under the same plugin name for one file.
const IMPORT_X = {
  plugins: {
    "import-x": {
      rules: { extensions, "no-cycle": noCycle, "no-restricted-paths": noRestrictedPaths },
    },
  },
  settings: {
    "import-x/extensions": [".ts"],
    "import-x/resolver-next": [createNodeResolver({ extensions: [".ts", ".js"] })],
  },
};

// The import boundaries, one row each: the files outside `except` may not import what `forbid`
// names. Logic, layout and data stay free of Phaser and the scenes, so they run in unit tests
// without a renderer.
const BOUNDARIES = [
  {
    except: PHASER_FILES,
    forbid: {
      group: ["**/phaser", "**/phaser/*", "**/scenes", "**/scenes/*"],
      message:
        "Only src/main.ts, src/scenes/ and phaser/ folders may import Phaser, a scene or a phaser/ folder.",
    },
  },
  {
    except: TEST_FILES,
    forbid: {
      group: ["**/testing", "**/testing/*"],
      message: "Only tests may import src/testing/.",
    },
  },
];

// The cross-game source bands, lowest first, each with its rows lowest first. A group is a folder or
// a file of src/, and a module belongs to the longest group that holds it. A module imports only its
// own group and groups in lower rows: never a group in its own row (strict layers) or a higher one,
// so nothing shipped imports Support, the top band. Type-only imports count; tests and src/testing/
// are exempt. Every other module of src/ must sit in a group.
const BANDS = [
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
      ["src/input"],
      ["src/help"],
      ["src/home"],
      ["src/cheats"],
      ["src/hud"],
    ],
  },
  { band: "Platform", rows: [["src/assets/files", "src/pwa"], ["src/loadingProgress.ts"]] },
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
      ["src/tools/atlas"],
      ["src/tools"],
      ["src/sim"],
      ["src/tools/plannerAcceptance"],
      ["src/testing"],
    ],
  },
];

// Each group with its row, counted from the lowest row of the lowest band.
const GROUPS = BANDS.flatMap(({ rows }) => rows).flatMap((groups, row) =>
  groups.map((group) => ({ group, row })),
);
const SUPPORT = BANDS.at(-1).rows.flat();
const LAYER_EXEMPT = [...TEST_FILES, "src/testing/**", "src/**/*.d.ts"];

// Each folder group but src/testing/ has one public entry, its index.ts, and a module outside the
// group imports only that entry: the group's other modules and its stylesheets stay internal, and
// a group nested in it has an entry of its own. In src/data/ only these modules sit behind the
// entry; every other module there is an authored data file, which any group imports directly.
const DATA_BEHIND_ENTRY = ["layout.ts", "screen.ts", "types.ts"];
// CLEANUP (added 2026-11-25): the bands whose groups have their entry so far. Remove it, holding
// every group to its entry, once the last band has one (adw-0259 step 9).
const ENTRY_BANDS = ["Foundation", "Model", "Saving", "Presentation"];
const ENTRY_GROUPS = BANDS.filter(({ band }) => ENTRY_BANDS.includes(band)).flatMap(({ rows }) =>
  rows.flat(),
);

// The band rule reads import declarations, re-exports and dynamic imports, but not import() types.
const IMPORT_TYPES = {
  message: "Import a module of src/ with import type, which the band rule reads.",
  selector: "TSImportType[source.value=/^\\./]",
};

// Every way to pick some of the items, the empty pick included.
function subsets(items) {
  return items.reduce((picks, item) => [...picks, ...picks.map((pick) => [...pick, item])], [[]]);
}

// A files entry that matches only what matches one glob from each list: within a list the globs
// are alternatives, and a nested files array requires all of its globs.
function allOf(globLists) {
  return globLists
    .reduce(
      (combos, globs) => combos.flatMap((combo) => globs.map((glob) => [...combo, glob])),
      [[]],
    )
    .map((combo) => (combo.length === 1 ? combo[0] : combo));
}

// A later no-restricted-imports replaces an earlier one rather than adding to it, so the configs
// partition the files: one config per set of boundaries that binds a file, listing the patterns of
// every boundary in the set.
function boundaryConfigs() {
  return subsets(BOUNDARIES)
    .filter((binding) => binding.length > 0)
    .map((binding) => {
      const exempt = BOUNDARIES.filter((boundary) => !binding.includes(boundary));
      return {
        files: allOf([SOURCE_FILES, ...exempt.map(({ except }) => except)]),
        ignores: binding.flatMap(({ except }) => except),
        rules: {
          "no-restricted-imports": ["error", { patterns: binding.map(({ forbid }) => forbid) }],
        },
      };
    });
}

function groupFiles(group) {
  return group.endsWith(".ts") ? group : `${group}/**/*.ts`;
}

function nestedGroups(group) {
  return GROUPS.filter((other) => other.group.startsWith(`${group}/`));
}

// The zone that holds a lower folder group to its entry, for an importer outside it.
function entryZone(group) {
  const internal =
    group === "src/data"
      ? { except: [], from: DATA_BEHIND_ENTRY.map((file) => `${group}/${file}`) }
      : {
          except: [
            "index.ts",
            ...nestedGroups(group).map((nested) => posix.relative(group, nested.group)),
            ...globSync(`${group}/**/*.css`, { cwd: ROOT }).map((file) =>
              posix.relative(group, file),
            ),
          ],
          from: group,
        };
  return {
    ...internal,
    message: `Import ${group}/ through its entry, ${group}/index.ts.`,
    target: "src",
  };
}

// One config per group, over the files it holds and no group nested in it does. Each zone forbids
// one group in the same row or a higher one, except the groups nested in that one which sit lower
// or are the importer's own.
function bandConfig({ group, row }) {
  const zones = GROUPS.filter((other) => other.group !== group && other.row >= row).map(
    (other) => ({
      except: nestedGroups(other.group)
        .filter((nested) => nested.group === group || nested.row < row)
        .map((nested) => posix.relative(other.group, nested.group)),
      from: other.group,
      message:
        SUPPORT.includes(other.group) && !SUPPORT.includes(group)
          ? "Shipped code never imports Support, the top band of BANDS."
          : `${other.group} sits ${other.row === row ? "in the same row as" : "above"} ${group} in ` +
            "BANDS: imports point down only.",
      target: "src",
    }),
  );
  const entries = GROUPS.filter(
    (other) =>
      other.row < row &&
      ENTRY_GROUPS.includes(other.group) &&
      !other.group.endsWith(".ts") &&
      other.group !== "src/testing",
  ).map(({ group: other }) => entryZone(other));
  return {
    ...IMPORT_X,
    files: [groupFiles(group)],
    ignores: [...nestedGroups(group).map((nested) => groupFiles(nested.group)), ...LAYER_EXEMPT],
    rules: {
      "import-x/no-restricted-paths": ["error", { basePath: ROOT, zones: [...zones, ...entries] }],
      "no-restricted-syntax": [...sourceRules["no-restricted-syntax"], IMPORT_TYPES],
    },
  };
}

export default defineConfig(
  {
    // Task worktrees and generated output are checked separately.
    ignores: [".claude/", ".worktrees/", ".wrangler/", "dist/", "node_modules/"],
  },
  js.configs.recommended,
  ts.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
  },
  // The house rules, over what this ships and art/tools/. max-len is inert here: prettier
  // wraps at 100 in this repository, inside the 120 the rule allows.
  {
    files: SOURCE_FILES,
    plugins,
    rules: sourceRules,
  },
  ...boundaryConfigs(),
  // The bands: each group imports only its own and lower rows, and a module no group holds fails.
  ...GROUPS.map(bandConfig),
  {
    files: ["src/**/*.ts"],
    ignores: [...GROUPS.map(({ group }) => groupFiles(group)), ...LAYER_EXEMPT],
    rules: {
      "no-restricted-syntax": [
        ...sourceRules["no-restricted-syntax"],
        { message: "Place this module in a group of BANDS.", selector: "Program" },
      ],
    },
  },
  // No import cycles: a module in a cycle can run before what it imports has loaded. Type-only
  // imports are erased at build time, so they never form one; the bands keep them inside a group.
  // no-cycle also skips `import { type A }`, which verbatimModuleSyntax keeps as a module load, so
  // that form is written `import type { A }`, which loads nothing.
  {
    ...IMPORT_X,
    files: SOURCE_FILES,
    rules: {
      "@typescript-eslint/no-import-type-side-effects": "error",
      "import-x/no-cycle": "error",
    },
  },
  // Every relative import names its file, ./x.ts or ./dir/index.ts, so plain node runs the source
  // with type stripping and no resolver. Package imports keep their exported subpaths.
  {
    ...IMPORT_X,
    files: [...SOURCE_FILES, ...CONFIG_FILES],
    rules: { "import-x/extensions": ["error", "ignorePackages", { checkTypeImports: true }] },
  },
  // Config files: they produce what ships rather than being it.
  {
    files: CONFIG_FILES,
    plugins,
    rules: toolingRules,
  },
);
