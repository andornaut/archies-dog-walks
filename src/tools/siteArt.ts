import type { Plugin } from "vite";

import type { DomSheetJson } from "../ui/dom/index.ts";

export interface SiteArtSheet {
  readonly json: DomSheetJson;
  readonly url: string;
}

export type SiteArt = (key: string) => SiteArtSheet;

// Project the original PNG's pixels from its existing packed sheet, at the authored scale.
function background(art: SiteArt, key: string, height: number, frameIndex?: number): string {
  const { json, url } = art(key);
  const entry = json.keys[key];
  const rect = frameIndex === undefined ? entry?.rect : entry?.frames?.[frameIndex];
  if (rect === undefined || rect[3] === undefined || rect[3] <= 0) {
    throw new Error(`site art: missing packed ${key} frame ${frameIndex ?? "image"}`);
  }
  const scale = height / rect[3];
  const position = `${-rect[0]! * scale}px ${-rect[1]! * scale}px`;
  return `url("${url}") no-repeat ${position} / ${json.size.w * scale}px ${json.size.h * scale}px`;
}

// Build-only substitution keeps the source pages usable without a generated sheet.
export function siteHtml(art: SiteArt, stylesheet: (css: string) => string, html: string): string {
  const rules: string[] = [];
  const result = prepareSiteHtml(html).replace(
    /<img\s+src="\/art\/images\/(portrait-dog-[a-z-]+)\.png"\s+width="64"\s+height="64"\s+alt=""\s*\/?>/gu,
    (_tag, key: string) => {
      const { json } = art(key);
      const rect = json.keys[key]?.rect;
      if (rect === undefined || rect[2] !== rect[3]) {
        throw new Error(`site art: expected square ${key}`);
      }
      rules.push(
        `.${key}{display:block;width:64px;height:64px;` +
          `background:${background(art, key, 64)};image-rendering:pixelated}`,
      );
      return `<span class="${key}" aria-hidden="true"></span>`;
    },
  );
  if (result.includes("--site-owner-") || result.includes('class="mood ')) {
    rules.push(
      `:root{${[0, 1, 2, 3]
        .map((frame) => `--site-owner-${frame}:${background(art, "face-owner-kilo", 64, frame)}`)
        .join(";")}}`,
    );
  }
  return rules.length === 0
    ? result
    : result.replace(
        "</head>",
        `<link rel="stylesheet" href="${stylesheet(rules.join("\n"))}"></head>`,
      );
}

// Replace source values before Vite extracts and hashes the page's stylesheet. The post-HTML
// projection supplies these variables from the already built sheet, without rewriting CSS hashes.
export function prepareSiteHtml(html: string): string {
  if (!html.includes("/art/sprites/face-owner-kilo.png")) {
    return html;
  }
  let result = html.replace(
    /background:\s*url\(["']?\/art\/sprites\/face-owner-kilo\.png["']?\)[^;}]+;?/u,
    "background:var(--site-owner-0);",
  );
  for (const [mood, frame] of [
    ["neutral", 1],
    ["upset", 2],
    ["fired", 3],
  ] as const) {
    result = result.replace(
      new RegExp(`(\\.m-${mood} span\\s*\\{)\\s*background-position:[^;}]+;?`, "u"),
      `$1background:var(--site-owner-${frame});`,
    );
  }
  return result;
}

export function siteArtSourcePlugin(): Plugin {
  return {
    apply: "build",
    name: "archies-dog-walks-site-art-source",
    transformIndexHtml: { handler: prepareSiteHtml, order: "pre" },
  };
}
