import { beforeEach, expect, it } from "vitest";

import { type SiteArt, siteHtml } from "./siteArt.ts";

const art: SiteArt = (key) => ({
  json: {
    keys: {
      [key]: {
        frames: [
          [10, 20, 32, 32],
          [42, 20, 32, 32],
          [10, 52, 32, 32],
          [42, 52, 32, 32],
        ],
        rect: [10, 20, 64, 64],
      },
    },
    size: { h: 256, w: 512 },
  },
  url: "/assets/art/dom/sheet-123.webp",
});

let stylesheet = "";
const project = (html: string) =>
  siteHtml(
    art,
    (css) => {
      stylesheet = css;
      return "/assets/site-art-123.css";
    },
    html,
  );
beforeEach(() => {
  stylesheet = "";
});

it("retains decorative portrait dimensions and the labelled group's accessibility", () => {
  const html =
    '<head></head><div role="img" aria-label="Dogs">' +
    '<img src="/art/images/portrait-dog-archie.png" width="64" height="64" alt="" /></div>';
  const built = project(html);
  expect(built).toContain('role="img" aria-label="Dogs"');
  expect(built).toContain('<span class="portrait-dog-archie" aria-hidden="true"></span>');
  expect(stylesheet).toContain(
    'width:64px;height:64px;background:url("/assets/art/dom/sheet-123.webp") no-repeat -10px -20px / 512px 256px',
  );
  expect(built).not.toContain("/art/images/");
  expect(built).toContain('<link rel="stylesheet" href="/assets/site-art-123.css"></head>');
  expect(built).not.toContain("<style");
});

it("projects owner moods from the same packed pixels", () => {
  const html =
    '<head><style>.mood span {background: url("/art/sprites/face-owner-kilo.png")' +
    " no-repeat 0 0 / 320px 64px;} .m-neutral span {background-position:-64px 0;}" +
    " .m-upset span {background-position:-128px 0;} .m-fired span {background-position:-192px 0;}</style></head>";
  const built = project(html);
  for (const position of ["-20px -40px", "-84px -40px", "-20px -104px", "-84px -104px"]) {
    expect(stylesheet).toContain(`no-repeat ${position}`);
  }
  expect(built).not.toContain("/art/sprites/");
});

it("projects the minified HTML styles Vite passes to post transforms", () => {
  const html =
    "<head><style>.mood span{background:url(/art/sprites/face-owner-kilo.png) no-repeat 0 0/320px 64px}" +
    ".m-neutral span{background-position:-64px 0}.m-upset span{background-position:-128px 0}" +
    ".m-fired span{background-position:-192px 0}</style></head>";
  const built = project(html);
  expect(built).not.toContain("/art/sprites/");
  expect(built).not.toContain("background-position:");
  expect(stylesheet).toContain("no-repeat -84px -104px / 1024px 512px}");
});
