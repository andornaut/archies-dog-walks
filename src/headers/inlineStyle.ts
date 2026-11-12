import { inlineBlocks } from "@andornaut/game-kit/web/headers/securityHeaders";
import ts from "typescript";

// Finds the styles a page's CSP blocks: every built page's policy allows styles from the site's
// own files and its inline blocks' hashes alone (securityPolicy.ts), so a style element or a
// style attribute that a script adds, or that a page's markup carries, is dropped. Styles set
// through the CSSOM (element.style, setProperty, cssText) are allowed and not reported.
// Constructed stylesheets are reported too: a browser applies them under the policy only as a
// gap in it.

export interface InlineStyle {
  // Text around the use, which an allowance names.
  readonly context: string;
  readonly fileName: string;
  readonly line: number;
  readonly what: string;
}

// A use the policy blocks that the page never reaches, in a file whose name matches file and
// whose context holds near.
export interface InlineStyleAllowance {
  readonly file: RegExp;
  readonly near: string;
  readonly why: string;
}

// Phaser's, in its chunk: names its code keeps through minification place each one.
export const PHASER_INLINE_STYLES: readonly InlineStyleAllowance[] = [
  {
    file: /^assets\/phaser-/,
    near: "xhrLoader.responseText",
    why: "the CSS file loader (load.css), which the game never calls",
  },
  {
    file: /^assets\/phaser-/,
    near: "position: fixed; height: 100vh",
    why:
      "GetInnerHeight's ruler, which the scale manager measures only on iOS with the window as " +
      "the game's parent; the game's parent is #game",
  },
];

const CONTEXT = 120;

const MARKUP: readonly (readonly [RegExp, string])[] = [
  [/<style[\s>/]/i, "writes a style element in markup"],
  [/<[a-z][^<>]*\sstyle\s*=/i, "writes a style attribute in markup"],
];

// The argument that names the element or attribute, by method.
const NAME_ARGUMENT: Readonly<Record<string, readonly [number, string]>> = {
  createElement: [0, "creates a style element"],
  createElementNS: [1, "creates a style element"],
  setAttribute: [0, "sets a style attribute"],
  setAttributeNS: [1, "sets a style attribute"],
};

const literalText = (node: ts.Node | undefined) =>
  node !== undefined && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
    ? node.text
    : undefined;

// The inline styles a script's code adds: a style element created or written as markup, a style
// attribute set or written as markup, and an adopted constructed stylesheet. A name that is not a
// literal is not judged.
export function scriptInlineStyles(fileName: string, code: string): InlineStyle[] {
  const source = ts.createSourceFile(fileName, code, ts.ScriptTarget.Latest, false);
  const found: InlineStyle[] = [];
  const report = (node: ts.Node, what: string) => {
    const start = node.getStart(source);
    found.push({
      context: code.slice(Math.max(0, start - CONTEXT), node.end + CONTEXT),
      fileName,
      line: source.getLineAndCharacterOfPosition(start).line + 1,
      what,
    });
  };
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const named = NAME_ARGUMENT[node.expression.name.text];
      if (named !== undefined && literalText(node.arguments[named[0]])?.toLowerCase() === "style") {
        report(node, named[1]);
      }
    } else if (ts.isPropertyAccessExpression(node) && node.name.text === "adoptedStyleSheets") {
      report(node, "adopts a constructed stylesheet");
    } else if (
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isTemplateLiteralToken(node)
    ) {
      for (const [pattern, what] of MARKUP) {
        if (pattern.test(node.text)) {
          report(node, what);
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

// The style attributes a page's markup carries, outside its comments, scripts and style blocks
// (whose hashes the policy holds).
export function htmlStyleAttributes(fileName: string, html: string): InlineStyle[] {
  const markup = html.replace(
    /<!--[\s\S]*?-->|<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,
    (block) => block.replace(/[^\n]/g, " "),
  );
  return [...markup.matchAll(/<[a-z][^<>]*\sstyle\s*=[^<>]*>/gi)].map((match) => ({
    context: match[0],
    fileName,
    line: markup.slice(0, match.index).split("\n").length,
    what: "carries a style attribute",
  }));
}

export interface BuiltFile {
  readonly fileName: string;
  readonly text: string;
}

// Why a build must fail: each inline style in its scripts (.js) and pages (.html, with their
// inline scripts) that no allowance covers, and each allowance that covers none, so the list keeps to what the build
// holds.
export function buildInlineStyleProblems(
  allowances: readonly InlineStyleAllowance[],
  files: readonly BuiltFile[],
): string[] {
  const used = new Set<InlineStyleAllowance>();
  const problems: string[] = [];
  for (const { fileName, text } of files) {
    const found = fileName.endsWith(".html")
      ? [
          ...htmlStyleAttributes(fileName, text),
          ...inlineBlocks(text).scripts.flatMap((code) =>
            scriptInlineStyles(`${fileName} (inline script)`, code),
          ),
        ]
      : fileName.endsWith(".js")
        ? scriptInlineStyles(fileName, text)
        : [];
    for (const use of found) {
      const allowance = allowances.find(
        ({ file, near }) => file.test(use.fileName) && use.context.includes(near),
      );
      if (allowance === undefined) {
        problems.push(`${use.fileName}:${use.line} ${use.what}, which the page's CSP blocks`);
      } else {
        used.add(allowance);
      }
    }
  }
  for (const allowance of allowances) {
    if (!used.has(allowance)) {
      problems.push(`no inline style near "${allowance.near}" (${allowance.why}) is left to allow`);
    }
  }
  return problems;
}
