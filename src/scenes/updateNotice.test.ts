import { describe, expect, it, vi } from "vitest";

import { overlayRegion } from "../home/homeBar";
import { updateModalLayout } from "../home/homeLayout";
import type { PlateMode } from "../home/homeLines";
import { StartScene } from "./StartScene";

const acceptUpdate = vi.fn();
vi.mock("phaser", () => ({
  Core: { Events: {} },
  Scene: class {},
  Scenes: { Events: {} },
}));
vi.mock("../pwa", async (original) => ({
  ...(await original<typeof import("../pwa")>()),
  acceptUpdate: () => acceptUpdate(),
}));

function notice() {
  let active = false;
  let top: "bubble" | PlateMode = "update";
  const layout = updateModalLayout(overlayRegion("home"), {
    action: 100,
    cancel: 60,
    title: 160,
  });
  const methods = StartScene.prototype as unknown as {
    closeOverlay: () => void;
    releaseOnOverlay: (down: { x: number; y: number }, x: number, y: number) => void;
    syncUpdateNotice: () => void;
  };
  const state = {
    closeOverlay: () => methods.closeOverlay.call(state),
    gateTop: () => top,
    overlay: undefined as { mode: PlateMode; rect: typeof layout.panel } | undefined,
    render: vi.fn(),
    shownUpdate: undefined as PlateMode | undefined,
    sys: { isActive: () => active },
    updateLayout: () => layout,
  };
  return {
    activate: () => {
      active = true;
    },
    deactivate: () => {
      active = false;
      top = "bubble";
    },
    layout,
    newerSave: () => {
      top = "newerSave";
    },
    ready: () => {
      active = true;
      top = "update";
    },
    release: (rect: typeof layout.panel) => {
      const point = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
      methods.releaseOnOverlay.call(state, point, point.x, point.y);
    },
    state,
    sync: () => methods.syncUpdateNotice.call(state),
  };
}

describe("home update notice", () => {
  it("defers an update while home is inactive and opens when home becomes active", () => {
    const page = notice();
    page.sync();
    expect(page.state.overlay).toBeUndefined();
    expect(page.state.shownUpdate).toBeUndefined();
    page.activate();
    page.sync();
    expect(page.state.overlay?.mode).toBe("update");
  });

  it("dismisses Cancel without accepting the update or reopening on the next redraw", () => {
    acceptUpdate.mockClear();
    const page = notice();
    page.activate();
    page.sync();
    expect(page.layout.cancel).toBeDefined();
    page.release(page.layout.cancel!);
    expect(page.state.overlay).toBeUndefined();
    expect(page.state.render).toHaveBeenCalledOnce();
    expect(acceptUpdate).not.toHaveBeenCalled();
    page.sync();
    expect(page.state.overlay).toBeUndefined();
    page.deactivate();
    page.sync();
    page.ready();
    page.sync();
    expect(page.state.overlay).toBeUndefined();
    expect(acceptUpdate).not.toHaveBeenCalled();
  });

  it("keeps Update now as the accepting action and leaves newer-save eligibility unchanged", () => {
    acceptUpdate.mockClear();
    const page = notice();
    page.activate();
    page.sync();
    page.release(page.layout.button);
    expect(acceptUpdate).toHaveBeenCalledOnce();
    const newer = notice();
    newer.newerSave();
    newer.sync();
    expect(newer.state.overlay?.mode).toBe("newerSave");
  });
});
