import { saveStore } from "@andornaut/game-kit/save/saveStore";
import { memoryStorage } from "@andornaut/game-kit/save/storage";
import { describe, expect, it, vi } from "vitest";

import { localSaveStorage } from "../platform/save/storage.ts";
import { testContext } from "../testing/saves";
import { saveFormat } from "./load";
import { gameSaveStore, pageSaveStore, SAVE_KEYS } from "./storage";

vi.mock("./load", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./load")>();
  return { ...actual, saveFormat: vi.fn(actual.saveFormat) };
});
vi.mock("@andornaut/game-kit/save/saveStore", () => ({ saveStore: vi.fn() }));
vi.mock("../platform/save/storage.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../platform/save/storage.ts")>();
  return { ...actual, localSaveStorage: vi.fn() };
});

describe("gameSaveStore", () => {
  it("binds the game's storage keys and save format to the supplied storage", () => {
    const storage = memoryStorage();
    const format = saveFormat(testContext);
    vi.mocked(saveFormat).mockReturnValueOnce(format);
    gameSaveStore(testContext, storage);
    expect(saveFormat).toHaveBeenLastCalledWith(testContext);
    expect(saveStore).toHaveBeenCalledWith(storage, SAVE_KEYS, format);
    expect(SAVE_KEYS).toEqual({
      backup: "dog-walker-game:save-backup",
      save: "dog-walker-game:save",
    });
  });

  it("uses the browser storage adapter for the page save store", () => {
    const storage = memoryStorage();
    vi.mocked(localSaveStorage).mockReturnValueOnce(storage);
    vi.mocked(saveStore).mockClear();
    pageSaveStore(testContext);
    expect(localSaveStorage).toHaveBeenCalledOnce();
    expect(saveStore).toHaveBeenCalledWith(storage, SAVE_KEYS, expect.any(Object));
  });
});
