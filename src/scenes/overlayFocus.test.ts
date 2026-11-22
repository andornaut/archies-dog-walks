import { EventEmitter } from "node:events";

import type { Scene } from "phaser";
import { afterEach, expect, it, vi } from "vitest";

import { FakeDocument } from "../testing/fakeDom.ts";
import { openOverlay } from "./overlay.ts";
import { SCENE_KEYS } from "./sceneKeys.ts";

vi.mock("phaser", () => ({}));
afterEach(() => vi.unstubAllGlobals());

it.each(["return", "removed", "covered", "shutdown"])(
  "restores only an available invoking control after the parent paints: %s",
  (state) => {
    const doc = new FakeDocument();
    vi.stubGlobal("document", doc);
    const invoking = doc.createElement("button");
    doc.body.append(invoking);
    invoking.focus();
    const events = new EventEmitter();
    const gameEvents = new EventEmitter();
    const scene = {
      events,
      game: { events: gameEvents },
      input: { enabled: true },
      scene: { launch: vi.fn(), pause: vi.fn() },
      sys: { isActive: () => true },
    } as unknown as Scene;
    expect(openOverlay(scene, SCENE_KEYS.help, { resume: SCENE_KEYS.pause })).toBe(true);
    doc.body.focus();
    if (state === "removed") {
      invoking.remove();
    }
    if (state === "covered") {
      invoking.setAttribute("inert", "");
    }
    if (state === "shutdown") {
      events.emit("shutdown");
    }
    events.emit("resume");
    expect(doc.activeElement).toBe(doc.body);
    gameEvents.emit("postrender");
    expect(doc.activeElement).toBe(state === "return" ? invoking : doc.body);
  },
);
