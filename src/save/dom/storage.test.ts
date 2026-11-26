import { saveStore } from "@andornaut/game-kit/runtime/save/saveStore";
import { memoryStorage } from "@andornaut/game-kit/runtime/save/storage";
import { localSaveStorage } from "@andornaut/game-kit/runtime/web/save/dom/localSaveStorage";
import { expect, it, vi } from "vitest";

import { testContext } from "../../testing/saves.ts";
import { SAVE_KEYS } from "../storage.ts";
import { pageSaveStore } from "./index.ts";

vi.mock("@andornaut/game-kit/runtime/save/saveStore", () => ({ saveStore: vi.fn() }));
vi.mock("@andornaut/game-kit/runtime/web/save/dom/localSaveStorage", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@andornaut/game-kit/runtime/web/save/dom/localSaveStorage")
    >();
  return { ...actual, localSaveStorage: vi.fn() };
});

it("uses the browser storage adapter for the page save store", () => {
  const storage = memoryStorage();
  vi.mocked(localSaveStorage).mockReturnValueOnce(storage);
  vi.mocked(saveStore).mockClear();
  pageSaveStore(testContext);
  expect(localSaveStorage).toHaveBeenCalledOnce();
  expect(saveStore).toHaveBeenCalledWith(storage, SAVE_KEYS, expect.any(Object));
});
