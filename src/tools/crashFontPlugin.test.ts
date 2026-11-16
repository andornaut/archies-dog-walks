import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { build, createServer } from "vite";
import { expect, it } from "vitest";

import { CRASH_BODY_FONT, crashFontPlugin } from "./crashFontPlugin.ts";

const FONT = join(import.meta.dirname, "../../art/fonts/tiny5/Tiny5.ttf");
const CSS = join(import.meta.dirname, "../crash/crash.css");

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "adw-crash-font-test-"));
  await writeFile(join(root, "index.html"), '<link rel="stylesheet" href="/style.css">');
  await writeFile(join(root, "style.css"), (await readFile(CSS, "utf8")).split("\n\n")[0]!);
  return {
    async destroy() {
      await rm(root, { recursive: true });
    },
    root,
  };
}

it("emits the crash font through Vite's hashed CSS asset URL without changing the original", async () => {
  const original = createHash("sha256")
    .update(await readFile(FONT))
    .digest("hex");
  const page = await fixture();
  try {
    const result = await build({
      build: { assetsInlineLimit: 0, write: false },
      configFile: false,
      logLevel: "silent",
      plugins: [crashFontPlugin(FONT)],
      root: page.root,
    });
    if (Array.isArray(result) || !("output" in result)) {
      throw new Error("Expected one bundle");
    }
    const assets = result.output.filter((entry) => entry.type === "asset");
    const font = assets.find((entry) => /\/Tiny5-[\w-]+\.woff2$/.test(entry.fileName));
    const css = assets.find((entry) => entry.fileName.endsWith(".css"));
    expect(font).toBeDefined();
    expect(String(css?.source)).toContain(`url(/${font!.fileName})`);
    expect(String(css?.source)).toContain('format("woff2")');
    expect(String(css?.source)).not.toContain(CRASH_BODY_FONT);
    expect(assets.some((entry) => entry.fileName.endsWith(".ttf"))).toBe(false);
    expect(
      createHash("sha256")
        .update(await readFile(FONT))
        .digest("hex"),
    ).toBe(original);
  } finally {
    await page.destroy();
  }
});

it("serves the same CSS font asset in development without an authored WOFF2 file", async () => {
  const page = await fixture();
  const server = await createServer({
    configFile: false,
    logLevel: "silent",
    plugins: [crashFontPlugin(FONT)],
    root: page.root,
    server: { host: "127.0.0.1", port: 0 },
  });
  try {
    await server.listen();
    const address = server.httpServer!.address();
    if (!address || typeof address === "string") {
      throw new Error("Expected a listening test server");
    }
    const base = `http://127.0.0.1:${address.port}`;
    const css = await (await fetch(`${base}/style.css?direct`)).text();
    expect(css).toContain("Tiny5.woff2");
    expect(css).not.toContain(CRASH_BODY_FONT);
    expect(css).toContain('format("woff2")');
    const url = /url\("([^"()]+)"\)/.exec(css)?.[1];
    expect(url).toBeDefined();
    const font = await fetch(new URL(url!, base));
    expect(font.status).toBe(200);
    expect(font.headers.get("content-type")).toContain("font/woff2");
    expect((await font.arrayBuffer()).byteLength).toBeGreaterThan(0);
  } finally {
    await server.close();
    await page.destroy();
  }
});
