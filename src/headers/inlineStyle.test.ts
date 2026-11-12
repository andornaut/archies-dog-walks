import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildInlineStyleProblems,
  htmlStyleAttributes,
  type InlineStyleAllowance,
  scriptInlineStyles,
} from "./inlineStyle.ts";
import { inlineStyleCheckPlugin } from "./inlineStyleCheckPlugin.ts";

const REPO = join(import.meta.dirname, "../..");

const whatIn = (code: string) => scriptInlineStyles("x.js", code).map(({ what }) => what);

describe("scriptInlineStyles", () => {
  it.each([
    ['document.createElement("style")', "creates a style element"],
    ["doc.createElement('STYLE')", "creates a style element"],
    ['d.createElementNS("http://www.w3.org/1999/xhtml", "style")', "creates a style element"],
    ['el.setAttribute("style", "color: red")', "sets a style attribute"],
    ['el.setAttributeNS(null, "style", "color: red")', "sets a style attribute"],
    ["el.innerHTML = '<p style=\"color: red\">x</p>'", "writes a style attribute in markup"],
    // A template's head, before its first substitution.
    [
      ['el.innerHTML = `<div class=a style="$', '{x}">`'].join(""),
      "writes a style attribute in markup",
    ],
    [
      'el.insertAdjacentHTML("beforeend", "<style>p{}</style>")',
      "writes a style element in markup",
    ],
    ["document.adoptedStyleSheets = [sheet]", "adopts a constructed stylesheet"],
  ])("reports %s", (code, what) => {
    expect(whatIn(code)).toEqual([what]);
  });

  it.each([
    'el.style.color = "red"',
    'el.style.setProperty("--adw-cream", "#fff")',
    'el.style.cssText = "color: red"',
    'document.createElement("div")',
    'el.setAttribute("aria-label", "style")',
    'el.setAttribute(name, "color: red")',
    '// document.createElement("style")',
    'el.innerHTML = "<link rel=stylesheet href=/nav.css>"',
  ])("allows %s", (code) => {
    expect(whatIn(code)).toEqual([]);
  });

  it("places a use by its line", () => {
    const [use] = scriptInlineStyles("x.js", 'const a = 1;\n\nel.setAttribute("style", "")');
    expect(use?.line).toBe(3);
  });
});

describe("htmlStyleAttributes", () => {
  it("reports a style attribute in the markup alone, by its line", () => {
    const html = [
      "<!-- <p style='x'> -->",
      "<style>p { color: red }</style>",
      "<script>const tag = '<b style=x>';</script>",
      '<div class="a" style="color: red">x</div>',
    ].join("\n");
    expect(htmlStyleAttributes("index.html", html).map(({ line }) => line)).toEqual([4]);
  });
});

describe("buildInlineStyleProblems", () => {
  const allowance: InlineStyleAllowance = {
    file: /^assets\/phaser-/,
    near: "xhrLoader.responseText",
    why: "the CSS file loader",
  };
  const loader =
    'this.data=document.createElement("style");this.data.innerHTML=xhrLoader.responseText';

  it.each([
    ["an allowed use", [{ fileName: "assets/phaser-a1.js", text: loader }], 0],
    ["an allowed use in another file", [{ fileName: "assets/main-a1.js", text: loader }], 2],
    [
      "a use no allowance covers",
      [
        { fileName: "assets/phaser-a1.js", text: loader },
        { fileName: "assets/main-a1.js", text: 'e.setAttribute("style","")' },
      ],
      1,
    ],
    ["an allowance that covers nothing", [{ fileName: "assets/phaser-a1.js", text: "" }], 1],
    [
      "a page's style attribute and inline script",
      [
        { fileName: "assets/phaser-a1.js", text: loader },
        {
          fileName: "play/index.html",
          text: '<p style="x"></p><script>document.createElement("style")</script>',
        },
      ],
      2,
    ],
    [
      "a stylesheet's text",
      [
        { fileName: "assets/phaser-a1.js", text: loader },
        { fileName: "assets/main-a1.css", text: '<style>, [style="x"]' },
      ],
      0,
    ],
  ])("finds %s", (_name, files, problems) => {
    expect(buildInlineStyleProblems([allowance], files)).toHaveLength(problems);
  });
});

describe("inlineStyleCheckPlugin", () => {
  it("fails a build whose script adds a style element", () => {
    const plugin = inlineStyleCheckPlugin();
    const generateBundle = plugin.generateBundle as (
      this: { error(message: string): never },
      options: unknown,
      bundle: Record<string, unknown>,
    ) => void;
    const errors: string[] = [];
    const context = {
      error: (message: string): never => {
        errors.push(message);
        throw new Error(message);
      },
    };
    const bundle = {
      "assets/main-a1.js": {
        code: 'document.head.append(document.createElement("style"))',
        fileName: "assets/main-a1.js",
        type: "chunk",
      },
    };
    expect(() => generateBundle.call(context, {}, bundle)).toThrow();
    expect(errors[0]).toContain("assets/main-a1.js:1 creates a style element");
  });
});

// The sources' own uses, found before a build: the game's and tools' code, the site's shared
// script and the built pages' markup. The art gallery's pages, whose policy allows style
// attributes, are not among them.
describe("the sources", () => {
  const files = (dir: string, ending: string) =>
    readdirSync(join(REPO, dir), { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith(ending))
      .map((entry) => relative(REPO, join(entry.parentPath, entry.name)));

  it("add no inline style the CSP blocks", () => {
    const scripts = [
      ...files("src", ".ts").filter((path) => !path.endsWith(".test.ts")),
      "public/nav.js",
    ];
    const found = [
      ...scripts.flatMap((path) =>
        scriptInlineStyles(path, readFileSync(join(REPO, path), "utf8")),
      ),
      ...files("pages", ".html").flatMap((path) =>
        htmlStyleAttributes(path, readFileSync(join(REPO, path), "utf8")),
      ),
    ];
    expect(found.map(({ fileName, line, what }) => `${fileName}:${line} ${what}`)).toEqual([]);
  });
});
