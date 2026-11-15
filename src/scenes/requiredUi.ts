import type { ProgressHandle } from "@andornaut/game-kit/progressState";

import type { LoadingErrorView } from "../ui/dom/loadingError.ts";
import type { UiLayer } from "../ui/dom/uiLayer.ts";

export const REQUIRED_UI = "required-ui";

export interface RequiredUiResource {
  retry(): void;
  status(): "failed" | "loading" | "ready";
}

export interface RequiredUiController {
  dispose(): void;
  invalidate(): void;
  observe(resource: RequiredUiResource): () => void;
  wait(ready: () => void): () => void;
}

type Resources = Pick<
  UiLayer,
  "assetStatus" | "fontStatus" | "onReady" | "retryAssets" | "retryFonts"
>;

// The page owns one recovery boundary, including registrations after Boot has stopped. Resource
// providers own failed-only retries; disposed views cannot resume from late resource callbacks.
export function createRequiredUi(
  context: { readonly layer: Resources; readonly progress: { begin(): ProgressHandle } },
  errorView: (retry: () => void) => LoadingErrorView,
): RequiredUiController {
  const { layer } = context;
  const pending = new Set<() => void>();
  const resources = new Set<RequiredUiResource>([
    { retry: layer.retryFonts, status: layer.fontStatus },
    { retry: layer.retryAssets, status: layer.assetStatus },
  ]);
  let disposed = false;
  let settling = false;
  let retrying = false;
  let changed = false;
  let progress: ProgressHandle | undefined;
  let view: LoadingErrorView | undefined;
  const state = () => {
    const statuses = [...resources].map((resource) => resource.status());
    return statuses.includes("failed")
      ? "failed"
      : statuses.includes("loading")
        ? "loading"
        : "ready";
  };
  const finishProgress = () => {
    progress?.finish();
    progress = undefined;
  };
  const retry = () => {
    if (disposed || retrying || state() !== "failed") {
      return;
    }
    retrying = true;
    view?.show(true);
    try {
      for (const resource of resources) {
        if (resource.status() === "failed") {
          resource.retry();
        }
      }
    } finally {
      retrying = false;
      settle();
    }
  };
  const settle = () => {
    if (disposed) {
      return;
    }
    if (settling || retrying) {
      changed = true;
      return;
    }
    settling = true;
    try {
      do {
        changed = false;
        const status = state();
        if (status === "loading") {
          progress ??= context.progress.begin();
          progress.progress(undefined);
          view?.show(true);
        } else {
          finishProgress();
          if (status === "failed") {
            view ??= errorView(retry);
            view.show(false);
          } else {
            view?.hide();
            while (state() === "ready" && pending.size > 0) {
              const ready = pending.values().next().value!;
              pending.delete(ready);
              ready();
            }
            changed ||= state() !== "ready";
          }
        }
      } while (changed);
    } finally {
      settling = false;
    }
  };
  const stop = layer.onReady(settle);
  settle();
  return {
    dispose() {
      if (disposed) {
        return;
      }
      disposed = true;
      stop();
      pending.clear();
      resources.clear();
      finishProgress();
      view?.dispose();
    },
    invalidate: settle,
    observe(resource) {
      if (!disposed) {
        resources.add(resource);
        settle();
      }
      return () => {
        resources.delete(resource);
        settle();
      };
    },
    wait(ready) {
      if (!disposed) {
        pending.add(ready);
        settle();
      }
      return () => pending.delete(ready);
    },
  };
}
