import {
  createRequiredLoading,
  type LoadingAttemptState,
  type RequiredLoading,
  type RequiredLoadingResource,
} from "@andornaut/game-kit/runtime/load/loadingAttempts";
import type { ProgressHandle } from "@andornaut/game-kit/runtime/progressState";

import type { OfflineInstallation } from "../pwa/installationState.ts";
import type { LoadingErrorView } from "../ui/dom/loadingError.ts";
import type { UiLayer } from "../ui/dom/uiLayer.ts";

export const REQUIRED_UI = "required-ui";
export type RequiredUiResource = RequiredLoadingResource;
export type RequiredUiController = Pick<
  RequiredLoading,
  "dispose" | "invalidate" | "observe" | "wait"
>;

type Resources = Pick<
  UiLayer,
  "assetStatus" | "fontStatus" | "onReady" | "retryAssets" | "retryFonts"
>;

// Game resource ports and the existing top strip adapt the shared required-loading lifecycle.
export function createRequiredUi(
  context: {
    readonly installation: OfflineInstallation;
    readonly layer: Resources;
    readonly progress: { begin(): ProgressHandle };
  },
  errorView: (retry: () => Promise<void>) => LoadingErrorView,
): RequiredUiController {
  const { layer } = context;
  const required = createRequiredLoading([
    { retry: layer.retryFonts, status: layer.fontStatus },
    { retry: layer.retryAssets, status: layer.assetStatus },
  ]);
  let progress: ProgressHandle | undefined;
  let view: LoadingErrorView | undefined;
  const finishProgress = () => {
    progress?.finish();
    progress = undefined;
  };
  let disposed = false;
  let requiredState: LoadingAttemptState = { attempt: 0, kind: "idle" };
  let installationState = context.installation.state();
  let visible: "required" | "installation" | undefined;
  let revision = 0;
  const retry = async () => {
    if (disposed) {
      return;
    }
    if (visible === "required") {
      await required.retry();
    } else if (visible === "installation") {
      await context.installation.retry();
    }
  };
  const render = () => {
    if (disposed) {
      return;
    }
    const source =
      requiredState.kind === "failed" || requiredState.kind === "loading"
        ? "required"
        : "installation";
    const state = source === "required" ? requiredState : installationState;
    // Idle is not proof that a failed full offline installation is usable.
    if (source === "installation" && state.kind === "idle" && visible === source) {
      return;
    }
    if (state.kind === "failed" || (state.kind === "loading" && visible !== undefined)) {
      visible = source;
      view ??= errorView(retry);
      const attempt = ++revision;
      view.show(
        state.kind === "failed"
          ? { attempt, error: state.error, kind: "failed" }
          : { attempt, kind: "loading" },
      );
    } else {
      visible = undefined;
      view?.hide();
    }
  };
  const stopResources = layer.onReady(required.invalidate);
  const stopState = required.subscribe((state) => {
    requiredState = state;
    if (state.kind === "loading") {
      progress ??= context.progress.begin();
      progress.progress(undefined);
    } else {
      finishProgress();
    }
    render();
  });
  const stopInstallation = context.installation.subscribe((state) => {
    installationState = state;
    render();
  });
  return {
    dispose() {
      disposed = true;
      stopInstallation();
      stopResources();
      stopState();
      required.dispose();
      finishProgress();
      view?.dispose();
    },
    invalidate: required.invalidate,
    observe: required.observe,
    wait: required.wait,
  };
}
