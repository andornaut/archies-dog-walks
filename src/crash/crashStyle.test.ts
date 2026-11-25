import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

import { describe, expect, it } from "vitest";

// The sheets that style the crash screen: the kit's, the game's (bundled) and the shared controls
// (linked from pages/play/index.html). Their order differs between the dev server and a build, so
// the screen must resolve the same in every order.
const read = (url: URL | string) => readFileSync(url, "utf8");
const SHEETS = [
  read(new URL("../../public/controls.css", import.meta.url)),
  read(new URL("./crash.css", import.meta.url)),
  read(
    createRequire(import.meta.url).resolve("@andornaut/game-kit/runtime/web/crash/dom/crash.css"),
  ),
];
const ORDERS = [
  [0, 1, 2],
  [0, 2, 1],
  [1, 0, 2],
  [1, 2, 0],
  [2, 0, 1],
  [2, 1, 0],
] as const;

// An element as its classes from the root down; the crash screen's rules use classes only.
type Path = readonly (readonly string[])[];
const PANEL: Path = [["crash"], ["crash-panel"]];
const ELEMENTS: Record<string, Path> = {
  body: [...PANEL, ["crash-body"]],
  details: [...PANEL, ["crash-details"]],
  panel: PANEL,
  reload: [...PANEL, ["crash-button"]],
  title: [...PANEL, ["crash-title"]],
};

type Specificity = readonly [number, number, number];
const ranks = (a: Specificity, b: Specificity) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
const count = (text: string, pattern: RegExp) => (text.match(pattern) ?? []).length;
// Ids; classes, attributes and pseudo-classes; types. :is() counts its most specific argument.
function specificity(selector: string): Specificity {
  const inner: Specificity[] = [];
  const rest = selector.replace(/:is\(([^()]*)\)/g, (_, args: string) => {
    inner.push(args.split(",").map(specificity).sort(ranks).at(-1)!);
    return "";
  });
  return inner.reduce<Specificity>(
    (sum, [a, b, c]) => [sum[0] + a, sum[1] + b, sum[2] + c],
    [
      count(rest, /#[\w-]+/g),
      count(rest, /\.[\w-]+|\[[^\]]*\]|:(?!:)[\w-]+/g),
      count(rest, /(?:^|[\s>+~])[a-z][\w-]*/gi),
    ],
  );
}

// Whether a selector matches the resting element at path. Compounds are classes only, joined by
// descendant or child combinators; one with a state, attribute, type or pseudo-element
// (:active, [hidden], svg, ::before) never matches.
function matches(selector: string, path: Path): boolean {
  const is = /:is\(([^()]*)\)/.exec(selector);
  if (is !== null) {
    return is[1]!.split(",").some((arg) => matches(selector.replace(is[0], arg.trim()), path));
  }
  const parts = selector
    .trim()
    .replace(/\s*>\s*/g, " > ")
    .split(/\s+/);
  const compound = (text: string, classes: readonly string[]) =>
    /^(?:\.[\w-]+)+$/.test(text) &&
    text
      .slice(1)
      .split(".")
      .every((c) => classes.includes(c));
  const from = (part: number, depth: number): boolean => {
    if (part < 0) {
      return true;
    }
    if (depth < 0 || !compound(parts[part]!, path[depth]!)) {
      return false;
    }
    if (parts[part - 1] === ">") {
      return from(part - 2, depth - 1);
    }
    return Array.from({ length: depth + 1 }, (_, i) => depth - 1 - i).some((up) =>
      from(part - 1, up),
    );
  };
  return from(parts.length - 1, path.length - 1);
}

const SIDES = ["top", "right", "bottom", "left"] as const;
// A rule's longhand declarations, with padding and margin shorthands expanded.
function declarations(body: string): [string, string][] {
  return body
    .split(";")
    .filter((line) => line.includes(":"))
    .flatMap((line) => {
      const colon = line.indexOf(":");
      const name = line.slice(0, colon).trim();
      const value = line
        .slice(colon + 1)
        .trim()
        .replace(/\s+/g, " ");
      if (name !== "padding" && name !== "margin") {
        return [[name, value] as [string, string]];
      }
      const [top, right = top, bottom = top, left = right] = value.split(" ");
      return SIDES.map((side, i): [string, string] => [
        `${name}-${side}`,
        [top, right, bottom, left][i]!,
      ]);
    });
}

// Top-level rules only: at-rules (fonts, forced colours) do not style the resting screen.
function rules(css: string): { body: string; selectors: string[] }[] {
  const text = css
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/@[^{]+\{(?:[^{}]*\{[^}]*\})*[^{}]*\}/g, "");
  return [...text.matchAll(/([^{}]+)\{([^}]*)\}/g)].map(([, selectors, body]) => ({
    body: body!,
    selectors: selectors!.split(/,(?![^(]*\))/).map((s) => s.trim()),
  }));
}

// The cascaded value of property on the element, with the sheets in order.
function resolve(order: readonly number[], path: Path, property: string): string | undefined {
  let winner: { rank: Specificity; value: string } | undefined;
  for (const rule of order.flatMap((sheet) => rules(SHEETS[sheet]!))) {
    const hits = rule.selectors.filter((selector) => matches(selector, path));
    const rank = hits.map(specificity).sort(ranks).at(-1);
    for (const [name, value] of declarations(rule.body)) {
      if (rank && name === property && (!winner || ranks(rank, winner.rank) >= 0)) {
        winner = { rank, value };
      }
    }
  }
  return winner?.value;
}

// What the specification gives each element: the property and its cascaded value.
const SPEC: readonly (readonly [string, string, string, RegExp])[] = [
  ["Reload's width", "reload", "width", /^296px$/],
  ["the panel's maximum width", "panel", "max-width", /^360px$/],
  ...SIDES.map((side): readonly [string, string, string, RegExp] => [
    `the panel's ${side} padding`,
    "panel",
    `padding-${side}`,
    /^16px$/,
  ]),
  ["the title to body gap", "title", "margin-bottom", /^16px$/],
  ["the body to Reload gap", "body", "margin-bottom", /^16px$/],
  ["the gap above the details", "details", "margin-top", /^16px$/],
  [
    "the panel's top bevel",
    "panel",
    "box-shadow",
    /^inset 0 1px 0 var\(--crash-paper-highlight\),/,
  ],
];

describe("crash screen style", () => {
  it.each(SPEC)(
    "resolves %s to the specification in every sheet order",
    (_, at, property, value) => {
      for (const order of ORDERS) {
        expect(resolve(order, ELEMENTS[at]!, property), order.join(" < ")).toMatch(value);
      }
    },
  );
});
