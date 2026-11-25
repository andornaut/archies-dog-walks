import { EventEmitter } from "node:events";

import type { Scene } from "phaser";

// Test support: a scene's loader as the kit's watchLoader drives it, with Phaser's loader event
// names, its queue and its counters. A test that uses it mocks phaser's Loader.Events and
// Scenes.Events with the same names.

interface FakeFile {
  key: string;
  retryAttempts: number;
  type: string;
  url: string;
  xhrSettings: { timeout: number };
}

export function fakeLoaderScene() {
  const file = (key: string, url: string): FakeFile => ({
    key,
    retryAttempts: 0,
    type: "image",
    url,
    xhrSettings: { timeout: 0 },
  });
  const add = (queued: FakeFile) => {
    loader.list.add(queued);
    loader.emit("addfile", queued.key, queued.type, loader, queued);
  };
  const loader = Object.assign(new EventEmitter(), {
    image: (key: string, url: string) => add(file(key, url)),
    isLoading: () => loader.loading,
    list: new Set<FakeFile>(),
    loading: false,
    maxRetries: 2,
    path: "",
    prefix: "",
    start: () => {
      loader.loading = true;
      loader.emit("start", loader);
    },
    totalComplete: 0,
    totalFailed: 0,
    totalToLoad: 0,
    xhr: { timeout: 30_000 },
  });
  // A file finishing, loaded or failed after the loader's own retries.
  const settle = (queued: FakeFile, ok: boolean) => {
    loader.list.delete(queued);
    loader.emit(ok ? "load" : "loaderror", queued);
  };
  const complete = () => {
    loader.loading = false;
    loader.emit("complete", loader, 0, 0);
  };
  const scene = { events: new EventEmitter(), load: loader } as unknown as Scene;
  return { add, complete, file, loader, scene, settle };
}
