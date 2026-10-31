import type { Loader, Scene } from "phaser";

import { byteFraction, type FileProgress, UNKNOWN_FILE_BYTES } from "../layout/loadingScreen";

// Reports how far the scene's load is, by bytes, on each file's progress. A file weighs its
// size from expectedBytes by key, else its size once the server sends it, else
// UNKNOWN_FILE_BYTES. The report never goes back, though a size that arrives late can stall it.
// Call after queueing the files and before starting the load.
export function onLoadProgress(
  scene: Scene,
  expectedBytes: ReadonlyMap<string, number>,
  report: (fraction: number) => void,
): () => void {
  const files = new Map<Loader.File, FileProgress>();
  const track = (file: Loader.File) => {
    files.set(file, { bytes: expectedBytes.get(file.key) ?? UNKNOWN_FILE_BYTES, fraction: 0 });
  };
  let shown = 0;
  const update = (file: Loader.File, fraction: number) => {
    const progress = files.get(file);
    if (progress === undefined) {
      return;
    }
    progress.fraction = fraction;
    if (!expectedBytes.has(file.key) && file.bytesTotal > 0) {
      progress.bytes = file.bytesTotal;
    }
    shown = Math.max(shown, byteFraction([...files.values()]));
    report(shown);
  };
  const added = (_key: string, _type: string, _loader: unknown, file: Loader.File) => track(file);
  const progressed = (file: Loader.File, fraction: number) => update(file, fraction);
  const loaded = (file: Loader.File) => update(file, 1);
  const stop = () => {
    scene.load.off("addfile", added);
    scene.load.off("fileprogress", progressed);
    scene.load.off("load", loaded);
    scene.load.off("loaderror", loaded);
    scene.load.off("complete", stop);
    scene.events.off("shutdown", stop);
  };
  scene.load.list.forEach(track);
  scene.load.on("addfile", added);
  scene.load.on("fileprogress", progressed);
  scene.load.on("load", loaded);
  scene.load.on("loaderror", loaded);
  scene.load.once("complete", stop);
  scene.events.once("shutdown", stop);
  return stop;
}
