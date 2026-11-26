import { saveStore } from "@andornaut/game-kit/runtime/save/saveStore";
import { memoryStorage } from "@andornaut/game-kit/runtime/save/storage";
import { describe, expect, it, vi } from "vitest";

import { testContext } from "../testing/saves.ts";
import { saveFormat } from "./load.ts";
import { gameSaveStore, SAVE_KEYS } from "./storage.ts";

vi.mock("./load.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./load.ts")>();
  return { ...actual, saveFormat: vi.fn(actual.saveFormat) };
});
vi.mock("@andornaut/game-kit/runtime/save/saveStore", () => ({ saveStore: vi.fn() }));
describe("gameSaveStore", () => {
  it("binds the game's storage keys and save format to the supplied storage", () => {
    const storage = memoryStorage();
    const format = saveFormat(testContext);
    vi.mocked(saveFormat).mockReturnValueOnce(format);
    gameSaveStore(testContext, storage);
    expect(saveFormat).toHaveBeenLastCalledWith(testContext);
    expect(saveStore).toHaveBeenCalledWith(storage, SAVE_KEYS, format);
    expect(SAVE_KEYS).toEqual({
      backup: "archies-dog-walks.save-backup",
      save: "archies-dog-walks.save",
    });
  });
});
