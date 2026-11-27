import { readFile } from "node:fs/promises";

import { PNG } from "pngjs";
import { describe, expect, it } from "vitest";

import palette from "../../shared/palette.json" with { type: "json" };
import { gameData } from "../data/index.ts";

const HOME_PAGE = new URL("../../pages/index.html", import.meta.url);
const SKY_BACKDROP = new URL("../../public/art/images/backdrop-yonge-street.png", import.meta.url);

describe("the game homepage", () => {
  it("keeps the themed hero, compact About, Controls and footer in reading order", async () => {
    const html = await readFile(HOME_PAGE, "utf8");
    const main = /<main>([\s\S]*?)<\/main>/u.exec(html)?.[1] ?? "";
    expect(main).toMatch(/<header class="hero">/u);
    expect([...main.matchAll(/<h2[^>]*>([^<]+)<\/h2>/gu)].map(([, title]) => title)).toEqual([
      "About",
      "Controls",
    ]);
    const about = /<ul class="about-highlights">([\s\S]*?)<\/ul>/u.exec(main)?.[1] ?? "";
    expect([...about.matchAll(/<li>/gu)]).toHaveLength(3);
    expect(main).toContain(`Walk a pack of dogs through ${gameData.world.name}.`);
    expect(main).toContain("/art/images/logo.png");
    expect(html.indexOf("<footer")).toBeGreaterThan(html.indexOf("</main>"));
  });

  it("keeps Play, the conditional Install control, metadata and existing site links", async () => {
    const html = await readFile(HOME_PAGE, "utf8");
    expect(html).toContain("<title>Archie's Dog Walks</title>");
    for (const property of ["og:description", "og:image", "og:title", "og:type", "og:url"]) {
      expect(html).toContain(`property="${property}"`);
    }
    for (const name of [
      "description",
      "twitter:description",
      "twitter:image",
      "twitter:title",
      "viewport",
    ]) {
      expect(html).toContain(`name="${name}"`);
    }
    for (const relationship of ["canonical", "manifest", "apple-touch-icon"]) {
      expect(html).toContain(`rel="${relationship}"`);
    }
    const actions = /<div class="actions">([\s\S]*?)<\/div>/u.exec(html)?.[1] ?? "";
    expect(actions).toMatch(/<button[^>]*id="install"[^>]*hidden/u);
    expect(actions).toMatch(/<a[^>]*class="play [^"]*"[^>]*href="\/play\/"/u);
    expect(html).toContain('src="/src/homePage/main.ts"');
    expect(html).toContain('src="/nav.js"');
    const footer = /<footer[^>]*>([\s\S]*?)<\/footer>/u.exec(html)?.[1] ?? "";
    expect([...footer.matchAll(/href="([^"]+)"/gu)].map(([, href]) => href)).toEqual([
      "/art/",
      "https://github.com/andornaut/archies-dog-walks",
      "/tuning/",
    ]);
  });

  it("exposes gameplay and menu controls as semantic Action and Input tables", async () => {
    const html = await readFile(HOME_PAGE, "utf8");
    const tables = [...html.matchAll(/<table>([\s\S]*?)<\/table>/gu)].map(([, table]) => table!);
    expect(tables).toHaveLength(2);
    expect(
      tables.map((table) => /<caption>\s*([^<]+?)\s*<\/caption>/u.exec(table)?.[1]?.trim()),
    ).toEqual(["Walking", "Menus and loadout"]);
    for (const table of tables) {
      const headers = /<thead>([\s\S]*?)<\/thead>/u.exec(table)?.[1] ?? "";
      expect(
        [...headers.matchAll(/<th scope="col">([^<]+)<\/th>/gu)].map(([, text]) => text),
      ).toEqual(["Action", "Input"]);
      const rows = /<tbody>([\s\S]*?)<\/tbody>/u.exec(table)?.[1] ?? "";
      for (const [, row] of rows.matchAll(/<tr>([\s\S]*?)<\/tr>/gu)) {
        expect(row).toMatch(/<th scope="row">[^<]+<\/th>/u);
        expect(row).toMatch(/<td>[\s\S]+<\/td>/u);
      }
    }
    expect(html).toContain("Tap either half of the road");
    expect(html).toContain("Press and hold");
    expect(html).toContain("right-click an available action");
  });

  it("gives every install steps kind its steps as the data has them", async () => {
    const html = (await readFile(HOME_PAGE, "utf8")).replaceAll(/\s+/gu, " ");
    const shown = Object.fromEntries(
      [
        ...html.matchAll(
          /<div data-steps="(\w+)" hidden> <h2 id="install-steps-\1">([^<]*)<\/h2> <p> ?([^<]*?) ?<\/p>/gu,
        ),
      ].map(([, kind, title, steps]) => [kind, { steps, title }]),
    );
    expect(shown).toEqual(gameData.menuText.settings.installSteps);
  });
});

describe("the home page's sky band", () => {
  it("runs the backdrop's top row on above it, in the palette colour of that name", async () => {
    const html = await readFile(HOME_PAGE, "utf8");
    const name = /\.sky\s*\{[^}]*background:\s*var\(--palette-([a-z]+)\)/u.exec(html)?.[1] ?? "";
    const hex = palette[name as keyof typeof palette]?.hex;
    const { data } = PNG.sync.read(await readFile(SKY_BACKDROP));
    const topLeft = [...data.subarray(0, 3)].map((byte) => byte.toString(16).padStart(2, "0"));
    expect({ hex, name }).toEqual({
      hex: topLeft.join(""),
      name: Object.entries(palette).find(([, colour]) => colour.hex === hex)?.[0],
    });
  });
});
