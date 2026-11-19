// The home page's Install button beside Play, on the game's install flow (the kit's
// wireInstallButton), and the router worker, so an app installed from this page opens through it
// and plays offline once the game has installed. Its words are in pages/index.html.
import { wireInstallButton } from "@andornaut/game-kit/runtime/web/pwa/dom/installButton";
import { watchInstall } from "@andornaut/game-kit/runtime/web/pwa/dom/installFlow";
import { registerRouter } from "@andornaut/game-kit/runtime/web/pwa/dom/launch";

import { SERVICE_WORKER_URL } from "../pwa/cachePolicy.ts";

// Elements in pages/index.html. The steps dialog holds one section per InstallStepsKind, each
// marked data-steps with its kind and titled by its h2.
const INSTALL_ID = "install";
const STEPS_ID = "install-steps";

// Listens at once: beforeinstallprompt can fire before the page has drawn anything.
const flow = watchInstall(window);
const button = document.getElementById(INSTALL_ID);
const steps = document.getElementById(STEPS_ID);

if (button !== null && steps instanceof HTMLDialogElement) {
  wireInstallButton(flow, button, steps);
}

// The production build only: the dev server has no /sw.js. Registering installs nothing; the
// game's launch at /play/ does.
if (import.meta.env.PROD) {
  void registerRouter(
    "serviceWorker" in navigator ? navigator.serviceWorker : undefined,
    SERVICE_WORKER_URL,
  );
}
