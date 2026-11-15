import { DOM_BUTTON_SKIN } from "../../assets/domArt.ts";
import { loadSheet } from "./sheetFrames.ts";

export type RequiredAssetStatus = "failed" | "loading" | "ready";
export interface RequiredAsset {
  readonly kind: "button-manifest" | "image" | "sheet";
  readonly url: string;
}

interface Entry {
  readonly asset: RequiredAsset;
  skin: boolean;
  status: RequiredAssetStatus;
  image?: HTMLImageElement;
}

// Startup resources are strict; optional view art keeps its settlement-based reveal policy.
export function requiredAssets(doc: Document, changed: () => void) {
  const entries = new Map<string, Entry>();
  let disposed = false;
  const register = (skin: boolean, assets: readonly RequiredAsset[]) => {
    if (disposed) {
      return;
    }
    const fresh: Entry[] = [];
    for (const asset of assets) {
      const entry = entries.get(asset.url);
      const belongsToSkin = skin || asset.kind === "button-manifest";
      if (entry === undefined) {
        const added: Entry = { asset, skin: belongsToSkin, status: "loading" };
        entries.set(asset.url, added);
        fresh.push(added);
      } else {
        entry.skin ||= belongsToSkin;
      }
    }
    if (fresh.length > 0) {
      changed();
      for (const entry of fresh) {
        if (disposed) {
          break;
        }
        start(entry);
      }
    }
  };
  const load = async (entry: Entry) => {
    const { kind, url } = entry.asset;
    if (kind === "image") {
      const image = doc.createElement("img");
      entry.image = image;
      image.src = url;
      await image.decode();
    } else if (kind === "sheet") {
      await loadSheet(url);
    } else {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error("Required button manifest unavailable");
      }
      const value = (await response.json()) as {
        sprites?: { key?: unknown; json?: unknown; png?: unknown }[];
      };
      if (!Array.isArray(value.sprites)) {
        throw new Error("Invalid required button manifest");
      }
      const assets = DOM_BUTTON_SKIN.sheets.flatMap((key) => {
        const sprite = value.sprites!.find((candidate) => candidate.key === key);
        if (typeof sprite?.json !== "string" || typeof sprite.png !== "string") {
          throw new Error("Missing required button sheet");
        }
        const base = new URL(url, doc.baseURI);
        return [
          { kind: "sheet" as const, url: new URL(sprite.json, base).href },
          { kind: "image" as const, url: new URL(sprite.png, base).href },
        ];
      });
      register(true, assets);
    }
  };
  const start = (entry: Entry) => {
    entry.status = "loading";
    void load(entry).then(
      () => {
        if (!disposed) {
          entry.status = "ready";
          changed();
        }
      },
      () => {
        if (!disposed) {
          entry.status = "failed";
          changed();
        }
      },
    );
  };
  return {
    add: (assets: readonly RequiredAsset[]) => register(false, assets),
    dispose() {
      disposed = true;
      entries.clear();
    },
    failed: () =>
      [...entries.values()]
        .filter(({ status }) => status === "failed")
        .map(({ asset }) => asset.url),
    failedSkin: () => [...entries.values()].some(({ skin, status }) => skin && status === "failed"),
    retry() {
      if (disposed) {
        return;
      }
      let retried = false;
      for (const entry of entries.values()) {
        if (entry.status === "failed") {
          start(entry);
          retried = true;
        }
      }
      if (retried) {
        changed();
      }
    },
    status: (): RequiredAssetStatus =>
      [...entries.values()].some(({ status }) => status === "failed")
        ? "failed"
        : [...entries.values()].every(({ status }) => status === "ready")
          ? "ready"
          : "loading",
  };
}
