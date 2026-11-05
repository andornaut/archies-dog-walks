// Retake the home page's canvas grabs, home-road.png and home-start.png (360x560, the game canvas
// at 1x), from a built game served at BASE_URL (default http://<previewHost>:4173, the preview
// container the export's devHarness.previewHost names), and write them to OUT_DIR. The game's
// dev=1 global (PAGE_GLOBAL), the storage keys and the pull message (PULL_TEXT) come from
// devHarness too. Copy them to public/art/site/ to update the home page. Run from the repository
// root.
//
// - home-road: High Park on ROAD_QUERY's seed, Trista walking Archie, Lady and Ginger with Running
//   shoes and $50, ROAD_HOLD_MS after the message strip first reads PULL_TEXT (on seed 1, Ginger
//   straining toward a squirrel). Nothing steers; each card that opens takes its first option.
// - home-start: the start screen on a first visit, from a new player's save with $600 in the bank
//   and START_SAVE's fields over it: Trista picked from four walkers, Archie, Ginger and Kilo
//   picked, Lady owned, both dog slots bought, and Running shoes picked and the Whistle owned.
//
// Deterministic: Playwright's fake clock starts paused at CLOCK_START and steps the game one
// FRAME_MS frame at a time, so animation and the walk depend only on the frame count, and each grab
// is Phaser's own snapshot of the canvas, independent of the page's CSS scale. A grab that is not
// WIDTH x HEIGHT or not opaque fails. The game's canvas is not held to the house palette (it blends
// translucent layers and draws UI colours of its own), so the tool reports the colours outside
// PALETTE64, the neutral greys and the picker colours rather than failing on them.
//
// Playwright is not a dependency of this repository: the module is imported from
// PLAYWRIGHT_MODULE, which defaults to the copy in the Playwright MCP image
// (mcr.microsoft.com/playwright/mcp), the image this runs in. art/README.md has the steps.
import { mkdirSync, writeFileSync } from "node:fs";
import { setTimeout } from "node:timers/promises";

import { decodePng, encodeRgbPng } from "@andornaut/art-kit/png";
import type { RgbaImage } from "@andornaut/art-kit/rgbaImage";

import { GAME, LAYOUT, NEUTRAL_HEX, PALETTE64, PICKER_UI, PNG_OPTIONS, run } from "./pixel.ts";

// The browser's clock steps one frame at a time, in order, so each loop awaits every step.
/* eslint-disable no-await-in-loop */

interface Clock {
  install(options: { time: number }): Promise<void>;
  pauseAt(time: number): Promise<void>;
  runFor(ms: number): Promise<void>;
}
interface Page {
  clock: Clock;
  evaluate<R, A>(fn: (arg: A) => R | Promise<R>, arg: A): Promise<R>;
  goto(url: string): Promise<unknown>;
  keyboard: { press(key: string): Promise<void> };
}
interface Context {
  addInitScript<A>(fn: (arg: A) => void, arg: A): Promise<void>;
  close(): Promise<void>;
  newPage(): Promise<Page>;
}
interface Browser {
  close(): Promise<void>;
  newContext(options: Record<string, unknown>): Promise<Context>;
}
interface Playwright {
  chromium: { launch(options: Record<string, unknown>): Promise<Browser> };
}

// Phaser's scenes as the page sees them, through the dev global (dev=1).
interface PageObject {
  list?: PageObject[];
  text?: unknown;
}
interface PageScene {
  sys: {
    displayList: { list: PageObject[] };
    isActive(): boolean;
    load?: {
      inflight: { size: number };
      isLoading(): boolean;
      list: { size: number };
      queue: { size: number };
      totalComplete: number;
    };
    settings: { key: string };
  };
}
interface PageGame {
  renderer: { snapshot(callback: (image: unknown) => void): void };
  scene: { scenes: PageScene[] };
}
// The page's globals by name: the game sits under the export's devHarness.pageGlobal.
type PageGames = Partial<Record<string, PageGame>>;
type PageGlobal = typeof globalThis & { homeGrab?: string };

const HARNESS = GAME.devHarness;
// The global the game sets with dev=1. Page functions run in the browser, so it reaches them as
// an argument.
const PAGE_GLOBAL = HARNESS.pageGlobal;

// The preview server, by its container name.
const BASE_URL = `http://${HARNESS.previewHost}:4173`;
// How long a card that opens on the walk shows before its first option is picked (key 1).
const CARD_READ_MS = 640;
const CHEATS_KEY = HARNESS.storageKeys.devCheats;
// 2026-10-15 09:00 in Toronto: a weekday autumn morning.
const CLOCK_START = Date.parse("2026-10-15T09:00:00-04:00");
const FRAME_MS = 16;
// The game canvas at 1x: the layout's screen.
const HEIGHT = LAYOUT.screen.height;
// How long a loader's counts must hold, and how long at most a step waits for that, in real time.
const LOAD_SETTLE_MS = 100;
const LOAD_WAIT_MS = 60_000;
// The most frames to wait for a scene or a moment before giving up.
const MAX_FRAMES = 60 * 60 * 3;
const PLAYWRIGHT_MODULE = process.env.PLAYWRIGHT_MODULE ?? "/app/node_modules/playwright/index.mjs";
// The pull message for any dog: the export's text without its `{dog} ` prefix.
const PULL_TEXT = HARNESS.text.pull.replace(/^\{dog\} /, "");
if (PULL_TEXT === HARNESS.text.pull) {
  throw new Error(`devHarness.text.pull "${HARNESS.text.pull}" does not start with "{dog} "`);
}
// The dev panel's Invincible owners cheat: the unsteered walk's bumps cost no hearts, so no owner
// fires you before the grab.
const ROAD_CHEATS = { devStats: false, hitBoxes: false, invincible: true, speed: "normal" };
const ROAD_HOLD_MS = 400;
const ROAD_QUERY =
  "dev=1&gear=runningShoes&money=5000&pack=archie,lady,ginger&seed=1&walker=trista";
const SAVE_EDITS_KEY = HARNESS.storageKeys.devSaveEdits;
const SAVE_KEY = HARNESS.storageKeys.save;
// The start screen's bank, added to a new player's $0 by the dev panel's save edit, which also
// makes the game write its save.
const START_BANK_CENTS = 60_000;
// The frames the start screen settles for before its grab.
const START_SETTLE_MS = 2000;
const START_SAVE = {
  helpSeen: true,
  lastLoadout: { dogs: ["archie", "ginger", "kilo"], gear: "runningShoes" },
  owned: {
    dogSlots: [2, 3],
    dogs: ["ginger", "kilo", "lady"],
    gear: ["runningShoes", "whistle"],
    walkers: ["ada", "mrB", "trista"],
  },
  walker: "trista",
};
const USAGE = `Usage:
  node art/tools/home_grabs.ts OUT_DIR [BASE_URL]   write OUT_DIR/home-road.png and home-start.png,
                                                    grabbed from the game at BASE_URL`;
const WIDTH = LAYOUT.screen.width;

const ALLOWED = new Set(
  [...PALETTE64, ...NEUTRAL_HEX, ...Object.values(PICKER_UI)].map((hex) => hex.toLowerCase()),
);

/** Whether the scene keyed `key` is running, in the game at global `pageGlobal`. */
function sceneActive([pageGlobal, key]: readonly [string, string]): boolean {
  const game = (globalThis as unknown as PageGames)[pageGlobal];
  return game?.scene.scenes.some((s) => s.sys.settings.key === key && s.sys.isActive()) ?? false;
}

/**
 * Whether any running scene, in the game at global `pageGlobal`, shows a text object whose text
 * includes `text`.
 */
function showsText([pageGlobal, text]: readonly [string, string]): boolean {
  const game = (globalThis as unknown as PageGames)[pageGlobal];
  const has = (objects: readonly PageObject[]): boolean =>
    objects.some((o) => (typeof o.text === "string" && o.text.includes(text)) || has(o.list ?? []));
  return game?.scene.scenes.some((s) => s.sys.isActive() && has(s.sys.displayList.list)) ?? false;
}

/**
 * The loaders' progress: null once the game is made and no scene is loading, and otherwise the
 * files in flight and each loading scene's counts (no game yet counts as a file in flight).
 */
function loadState(pageGlobal: string): { counts: string; inflight: number } | null {
  const game = (globalThis as unknown as PageGames)[pageGlobal];
  if (game === undefined) {
    return { counts: "", inflight: 1 };
  }
  const loads = game.scene.scenes.flatMap(({ sys: { load } }) => (load?.isLoading() ? [load] : []));
  if (!loads.length) {
    return null;
  }
  return {
    counts: loads.map((l) => [l.list.size, l.queue.size, l.totalComplete].join(",")).join(" "),
    inflight: loads.reduce((sum, l) => sum + l.inflight.size, 0),
  };
}

/**
 * Steps the paused clock one frame. While anything loads, it first waits in real time until no
 * file is in flight and the loaders' counts hold for LOAD_SETTLE_MS, so the frames a download or
 * decode takes in real time never shift the game's clock or the animations that follow it.
 */
async function step(page: Page): Promise<void> {
  const deadline = Date.now() + LOAD_WAIT_MS;
  let state = await page.evaluate(loadState, PAGE_GLOBAL);
  while (state !== null) {
    if (Date.now() > deadline) {
      throw new Error(`a load took more than ${LOAD_WAIT_MS} ms`);
    }
    await setTimeout(LOAD_SETTLE_MS);
    const now = await page.evaluate(loadState, PAGE_GLOBAL);
    if (now !== null && now.inflight === 0 && now.counts === state.counts) {
      break;
    }
    state = now;
  }
  await page.clock.runFor(FRAME_MS);
}

/** Steps a frame at a time until `ready` holds in the page. */
async function stepUntil<A>(page: Page, ready: (arg: A) => boolean, arg: A): Promise<void> {
  for (let frame = 0; frame < MAX_FRAMES; frame += 1) {
    if (await page.evaluate(ready, arg)) {
      return;
    }
    await step(page);
  }
  throw new Error(`gave up waiting for ${ready.name}(${JSON.stringify(arg)})`);
}

/** Steps `ms`, a frame at a time. */
async function stepFor(page: Page, ms: number): Promise<void> {
  for (let elapsed = 0; elapsed < ms; elapsed += FRAME_MS) {
    await step(page);
  }
}

/** The canvas as the next frame draws it, from Phaser's renderer snapshot. */
async function snapshot(page: Page): Promise<RgbaImage> {
  await page.evaluate((pageGlobal) => {
    const page = globalThis as PageGlobal;
    delete page.homeGrab;
    (globalThis as unknown as PageGames)[pageGlobal]?.renderer.snapshot((image) => {
      page.homeGrab = (image as HTMLImageElement).src;
    });
  }, PAGE_GLOBAL);
  await stepUntil(page, () => (globalThis as PageGlobal).homeGrab !== undefined, null);
  const url = await page.evaluate(() => (globalThis as PageGlobal).homeGrab ?? "", null);
  return decodePng(Buffer.from(url.replace(/^data:image\/png;base64,/, ""), "base64"));
}

/** A new page in its own context, its clock paused at CLOCK_START. */
async function freshPage(browser: Browser): Promise<[Context, Page]> {
  const context = await browser.newContext({
    deviceScaleFactor: 1,
    locale: "en-CA",
    reducedMotion: "no-preference",
    timezoneId: "America/Toronto",
    viewport: { height: HEIGHT, width: WIDTH },
  });
  const page = await context.newPage();
  await page.clock.install({ time: CLOCK_START - 1000 });
  await page.clock.pauseAt(CLOCK_START);
  return [context, page];
}

/** The walk grab. */
async function roadGrab(baseUrl: string, browser: Browser): Promise<RgbaImage> {
  const [context, page] = await freshPage(browser);
  await context.addInitScript(
    ([key, text]) => {
      sessionStorage.setItem(key, text);
    },
    [CHEATS_KEY, JSON.stringify(ROAD_CHEATS)] as const,
  );
  await page.goto(`${baseUrl}/play/?${ROAD_QUERY}`);
  await stepUntil(page, sceneActive, [PAGE_GLOBAL, "run"] as const);
  const pull = [PAGE_GLOBAL, PULL_TEXT] as const;
  for (let frame = 0; !(await page.evaluate(showsText, pull)); frame += 1) {
    if (frame === MAX_FRAMES) {
      throw new Error(`gave up waiting for "${PULL_TEXT}"`);
    }
    if (await page.evaluate(sceneActive, [PAGE_GLOBAL, "card"] as const)) {
      await stepFor(page, CARD_READ_MS);
      await page.keyboard.press("1");
    }
    await step(page);
  }
  await stepFor(page, ROAD_HOLD_MS);
  const image = await snapshot(page);
  await context.close();
  return image;
}

/** A new player's save with START_BANK_CENTS in the bank, as stored. */
async function newSave(baseUrl: string, browser: Browser): Promise<Record<string, unknown>> {
  const [context, page] = await freshPage(browser);
  await context.addInitScript(
    ([key, text]) => {
      sessionStorage.setItem(key, text);
    },
    [SAVE_EDITS_KEY, JSON.stringify([{ amount: START_BANK_CENTS, kind: "addMoney" }])] as const,
  );
  await page.goto(`${baseUrl}/play/?dev=1`);
  await stepUntil(page, sceneActive, [PAGE_GLOBAL, "start"] as const);
  const text = await page.evaluate((key) => localStorage.getItem(key), SAVE_KEY);
  await context.close();
  if (text === null) {
    throw new Error(`no ${SAVE_KEY} after the start screen opened`);
  }
  return JSON.parse(text) as Record<string, unknown>;
}

/** The start screen grab. */
async function startGrab(baseUrl: string, browser: Browser): Promise<RgbaImage> {
  const stored = await newSave(baseUrl, browser);
  // Reduced motion stills the selection borders' travelling segment.
  const settings = { ...(stored.settings as object), reducedMotion: true };
  const save = { ...stored, ...START_SAVE, settings };
  const [context, page] = await freshPage(browser);
  await context.addInitScript(
    ([key, text]) => {
      localStorage.setItem(key, text);
    },
    [SAVE_KEY, JSON.stringify(save)] as const,
  );
  await page.goto(`${baseUrl}/play/?dev=1`);
  await stepUntil(page, sceneActive, [PAGE_GLOBAL, "start"] as const);
  await stepFor(page, START_SETTLE_MS);
  const image = await snapshot(page);
  await context.close();
  return image;
}

/** What is wrong with `image`: not WIDTH x HEIGHT or not opaque. */
function grabFaults(name: string, image: RgbaImage): string[] {
  if (image.width !== WIDTH || image.height !== HEIGHT) {
    return [`${name} is ${image.width}x${image.height}, not ${WIDTH}x${HEIGHT}`];
  }
  const clear = image.data.filter((value, i) => i % 4 === 3 && value !== 255).length;
  return clear ? [`${name} has ${clear} pixels that are not opaque`] : [];
}

/** The colours in `image` outside the house palette, with how many pixels each covers. */
function strayColours(image: RgbaImage): Map<string, number> {
  const strays = new Map<string, number>();
  for (let i = 0; i < image.data.length; i += 4) {
    const hex = Array.from(image.data.subarray(i, i + 3), (c) => c.toString(16).padStart(2, "0"));
    if (!ALLOWED.has(hex.join(""))) {
      strays.set(hex.join(""), (strays.get(hex.join("")) ?? 0) + 1);
    }
  }
  return strays;
}

// Grab both pictures from the game at baseUrl into outDir, and fail on a fault.
async function grabAll(baseUrl: string, outDir: string): Promise<void> {
  const { chromium } = (await import(PLAYWRIGHT_MODULE)) as Playwright;
  const browser = await chromium.launch({
    args: ["--no-sandbox"],
    channel: "chromium",
    headless: true,
  });
  const faults: string[] = [];
  try {
    mkdirSync(outDir, { recursive: true });
    const grabs: [string, RgbaImage][] = [
      ["home-road", await roadGrab(baseUrl, browser)],
      ["home-start", await startGrab(baseUrl, browser)],
    ];
    for (const [name, image] of grabs) {
      faults.push(...grabFaults(name, image));
      const path = `${outDir}/${name}.png`;
      writeFileSync(path, encodeRgbPng({ ...PNG_OPTIONS, deflateLevel: 9 }, image));
      const strays = strayColours(image);
      const covered = [...strays.values()].reduce((sum, n) => sum + n, 0);
      console.log(
        "wrote",
        path,
        `(${strays.size} colours outside the house palette, ${covered} px)`,
      );
    }
  } finally {
    await browser.close();
  }
  if (faults.length) {
    console.error(faults.join("\n"));
    process.exit(1);
  }
}

if (import.meta.main) {
  await run({
    commands: {
      OUT_DIR: (outDir) => grabAll(BASE_URL, outDir),
      "OUT_DIR BASE_URL": (outDir, baseUrl) => grabAll(baseUrl, outDir),
    },
    doc: USAGE,
  });
}
