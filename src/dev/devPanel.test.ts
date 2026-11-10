import { afterEach, describe, expect, it, vi } from "vitest";

import { gameData } from "../data/index.ts";
import { saveContextFrom } from "../save/load.ts";
import { createDefaultSave } from "../save/schema.ts";
import { applyPendingSaveEdits } from "./devPanel.ts";
import { encodeSaveEdits, SAVE_CHEATS } from "./devPanelModel.ts";

const mocks = vi.hoisted(() => ({
  load: vi.fn(),
  read: vi.fn(),
  remove: vi.fn(),
  save: vi.fn(),
}));

vi.mock("../save/storage.ts", async (original) => ({
  ...(await original<typeof import("../save/storage.ts")>()),
  pageSaveStore: () => ({ load: mocks.load, save: mocks.save }),
}));
vi.mock("@andornaut/game-kit/web/save/dom/pageSessionStore", () => ({
  sessionRead: mocks.read,
  sessionRemove: mocks.remove,
  sessionWrite: vi.fn(),
}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetAllMocks();
});

describe("queued browser save edits", () => {
  it("does not commit a queued edit if the browser becomes an app during save loading", async () => {
    const mode = { matches: false };
    vi.stubGlobal("window", { matchMedia: () => mode, navigator: {} });
    mocks.read.mockReturnValue(encodeSaveEdits(SAVE_CHEATS.map(({ edit }) => edit)));
    mocks.load.mockImplementation(async () => {
      mode.matches = true;
      return { save: createDefaultSave(saveContextFrom(gameData).defaults), status: "loaded" };
    });
    await applyPendingSaveEdits();
    expect(mocks.remove).toHaveBeenCalledOnce();
    expect(mocks.load).toHaveBeenCalledOnce();
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it("discards queued actions without loading the save in an installed app", async () => {
    vi.stubGlobal("window", { matchMedia: () => ({ matches: true }), navigator: {} });
    mocks.read.mockReturnValue(encodeSaveEdits(SAVE_CHEATS.map(({ edit }) => edit)));
    await applyPendingSaveEdits();
    expect(mocks.remove).toHaveBeenCalledOnce();
    expect(mocks.load).not.toHaveBeenCalled();
    expect(mocks.save).not.toHaveBeenCalled();
  });
});
