import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const CSS = readFileSync(new URL("../../public/nav.css", import.meta.url), "utf8").replace(
  /\/\*[\s\S]*?\*\//g,
  "",
);

// The innermost rules, so a rule inside an at-rule block reads as its own selector.
const RULES = [...CSS.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, selector = "", body = ""]) => ({
  body,
  selector: selector.trim(),
}));

// Rules whose selector names a link, so they style the nav's items and the current page's face.
const LINK_RULES = RULES.filter(({ selector }) =>
  selector.split(",").some((part) => /(^|\s)a([:[]|$)/.test(part.trim())),
);

// The current page's face is the link's text span, so it keeps its size inside the 48px press.
const FACE = '.art-nav a[aria-current="page"] > span';

describe("the site nav's current page", () => {
  it("is styled, and no link rule animates or transitions", () => {
    const selectors = LINK_RULES.map((rule) => rule.selector);
    expect(selectors).toContain(FACE);
    expect(selectors).toContain(`${FACE}::before`);
    const moving = LINK_RULES.filter(({ body }) =>
      /(^|[\s;])(animation|transition)[\w-]*\s*:/.test(body),
    );
    expect(moving.map(({ selector }) => selector)).toEqual([]);
    expect(CSS).not.toContain("@keyframes");
  });
});

describe("the site nav's links", () => {
  it("press at least 48px square", () => {
    const body = (selector: string) => RULES.find((rule) => rule.selector === selector)?.body ?? "";
    expect(body(".art-nav li")).toMatch(/(^|;)\s*min-width:\s*48px\s*(;|$)/);
    expect(body(".art-nav a")).toMatch(/(^|;)\s*height:\s*48px\s*(;|$)/);
  });
});
