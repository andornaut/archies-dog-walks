import { EventEmitter } from "node:events";

import type { RequiredUpdateState } from "@andornaut/game-kit/web/pwa/updateReady";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { gameData } from "../data/index.ts";
import { overlayRegion } from "../home/homeBar.ts";
import { updateModalLayout } from "../home/homeLayout.ts";
import type { Sections } from "../home/sections.ts";
import { StartScene } from "./StartScene.ts";

const acceptUpdate = vi.fn();
const arriveHome = vi.fn();
const dismissUpdateOffer = vi.fn();
const acceptance = { failed: false, pending: false };
const offer = { shown: false };
const required = { state: undefined as RequiredUpdateState | undefined };
vi.mock("phaser", () => ({
  Core: { Events: {} },
  Scene: class {},
  Scenes: { Events: { CREATE: "create" } },
}));
vi.mock("../pwa/index.ts", async (original) => ({
  ...(await original<typeof import("../pwa/index.ts")>()),
  acceptUpdate: () => acceptUpdate(),
  arriveHome: () => arriveHome(),
  dismissUpdateOffer: () => dismissUpdateOffer(),
  requiredUpdate: () => required.state,
  updateAcceptanceFailed: () => acceptance.failed,
  updateAccepting: () => acceptance.pending,
  updatePlateShown: () => offer.shown,
}));

function notice() {
  let active = false;
  offer.shown = true;
  const layout = updateModalLayout(overlayRegion("home"), {
    action: 100,
    cancel: 60,
    title: 160,
  });
  const methods = StartScene.prototype as unknown as {
    closeOverlay: () => void;
    prepareArrival: () => void;
    releaseOnOverlay: (down: { x: number; y: number }, x: number, y: number) => void;
    syncUpdateNotice: () => void;
    updateOffered: () => boolean;
  };
  const state = {
    closeOverlay: () => methods.closeOverlay.call(state),
    events: new EventEmitter(),
    overlay: undefined as { rect: typeof layout.panel; update: true } | undefined,
    render: vi.fn(() => methods.syncUpdateNotice.call(state)),
    shownUpdate: false,
    sys: { isActive: () => active },
    updateLayout: () => layout,
    updateOffered: () => methods.updateOffered.call(state),
  };
  return {
    activate: () => {
      active = true;
    },
    beginVisit: () => {
      active = false;
      state.overlay = undefined;
      state.shownUpdate = false;
      methods.prepareArrival.call(state);
    },
    deactivate: () => {
      active = false;
      offer.shown = false;
    },
    layout,
    ready: () => {
      active = true;
      offer.shown = true;
    },
    release: (rect: typeof layout.panel) => {
      const point = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
      methods.releaseOnOverlay.call(state, point, point.x, point.y);
    },
    state,
    sync: () => methods.syncUpdateNotice.call(state),
  };
}

beforeEach(() => {
  acceptance.pending = false;
  acceptance.failed = false;
  required.state = undefined;
});

describe("home update notice", () => {
  it("reopens a cancelled offer on the next scene's first active render without another action", () => {
    acceptUpdate.mockClear();
    arriveHome.mockClear();
    const page = notice();
    page.activate();
    page.sync();
    page.release(page.layout.cancel);
    expect(page.state.overlay).toBeUndefined();
    page.state.render.mockClear();

    page.beginVisit();
    expect(arriveHome).toHaveBeenCalledOnce();
    expect(page.state.render).not.toHaveBeenCalled();
    page.activate();
    page.state.events.emit("create");
    expect(page.state.overlay?.update).toBe(true);
    expect(page.state.render).toHaveBeenCalledOnce();
    page.state.events.emit("create");
    expect(page.state.render).toHaveBeenCalledOnce();
    expect(acceptUpdate).not.toHaveBeenCalled();
  });

  it("defers an update while home is inactive and opens when home becomes active", () => {
    const page = notice();
    page.sync();
    expect(page.state.overlay).toBeUndefined();
    expect(page.state.shownUpdate).toBe(false);
    page.activate();
    page.sync();
    expect(page.state.overlay?.update).toBe(true);
  });

  it("dismisses Cancel without accepting the update or reopening on the next redraw", () => {
    acceptUpdate.mockClear();
    dismissUpdateOffer.mockClear();
    const page = notice();
    page.activate();
    page.sync();
    page.release(page.layout.cancel);
    expect(page.state.overlay).toBeUndefined();
    expect(page.state.render).toHaveBeenCalledOnce();
    expect(acceptUpdate).not.toHaveBeenCalled();
    expect(dismissUpdateOffer).toHaveBeenCalledOnce();
    page.sync();
    expect(page.state.overlay).toBeUndefined();
    page.deactivate();
    page.sync();
    page.ready();
    page.sync();
    expect(page.state.overlay).toBeUndefined();
    expect(acceptUpdate).not.toHaveBeenCalled();
  });

  it("closes the accepted offer while pending and reopens only for a failed retry", () => {
    const page = notice();
    page.activate();
    page.sync();
    acceptance.pending = true;
    offer.shown = false;
    page.sync();
    expect(page.state.overlay).toBeUndefined();
    expect(page.state.shownUpdate).toBe(false);
    page.sync();
    expect(page.state.overlay).toBeUndefined();
    acceptance.pending = false;
    acceptance.failed = true;
    offer.shown = true;
    page.sync();
    expect(page.state.overlay?.update).toBe(true);
  });

  it("keeps Update now as the accepting action", () => {
    acceptUpdate.mockClear();
    dismissUpdateOffer.mockClear();
    const page = notice();
    page.activate();
    page.sync();
    page.release(page.layout.button);
    expect(acceptUpdate).toHaveBeenCalledOnce();
    expect(dismissUpdateOffer).not.toHaveBeenCalled();
  });
});

describe("Start walk while a newer save requires the newer version", () => {
  const complete = { heading: "", note: "", state: "complete" } as const;
  const sections = { dogs: complete, pocket: complete, walker: complete } as unknown as Sections;
  const startOpen = (StartScene.prototype as unknown as { startOpen: (s: Sections) => boolean })
    .startOpen;

  it.each<[RequiredUpdateState | undefined, boolean]>([
    [undefined, true],
    ["updating", false],
    ["unavailable", false],
  ])("with the update %s, with a walker and a dog picked, is open: %s", (state, open) => {
    required.state = state;
    expect(startOpen(sections)).toBe(open);
    required.state = undefined;
  });
});

it("keeps Start walk and home actions closed while the accepted update waits for navigation", () => {
  acceptance.pending = true;
  const prototype = StartScene.prototype as unknown as {
    startOpen: (s: Sections) => boolean;
    act: (target: { kind: string }) => void;
  };
  const complete = { heading: "", note: "", state: "complete" } as const;
  expect(
    prototype.startOpen({
      dogs: complete,
      pocket: complete,
      walker: complete,
    } as unknown as Sections),
  ).toBe(false);
  expect(() => prototype.act.call({}, { kind: "start" })).not.toThrow();
});

it("uses the authored failure copy only after an unsuccessful accepted update", () => {
  const title = (StartScene.prototype as unknown as { updateTitle: () => string }).updateTitle;
  expect(title()).toBe(gameData.homeText.update.title);
  acceptance.failed = true;
  expect(title()).toBe(gameData.homeText.update.failure);
});
