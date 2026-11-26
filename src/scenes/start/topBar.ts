import type { Scene } from "phaser";

import { gameData } from "../../data/index.ts";
import { homeBarButtons } from "../../home/index.ts";
import { dollarAmountText, shortDollarAmountText } from "../../presentation/index.ts";
import type { NativeTopSection } from "../../ui/dom/index.ts";
import type { TopSectionButton } from "../../ui/index.ts";
import type { Cents } from "../../units.ts";
import { routeHomeBar } from "../homeBarPress.ts";
import { isMuted } from "../profileStore.ts";
import { addNativeTopSection } from "../topSection.ts";

interface StartTopBarActions {
  readonly accepts: () => boolean;
  readonly exit: boolean;
  readonly press: (id: TopSectionButton, startedMs: number) => void;
}

export function createStartTopBar(scene: Scene, actions: StartTopBarActions) {
  return addNativeTopSection(scene, {
    accepts: actions.accepts,
    buttons: homeBarButtons(actions.exit).map(([id]) => id),
    currency: true,
    labels: {
      exit: gameData.homeText.quit.quit,
      menu: gameData.menuText.menu.title,
      mute: gameData.menuText.settings.sound,
      pause: gameData.menuText.pause.title,
    },
    muted: isMuted(scene),
    press: (id, metadata) => {
      if (
        ((id === "menu" || id === "mute" || id === "exit") && routeHomeBar(scene, id)) ||
        !scene.sys.isActive() ||
        !scene.input.enabled
      ) {
        return;
      }
      const elapsed =
        metadata.startedAt === undefined
          ? 0
          : Math.max(0, metadata.completedAt - metadata.startedAt);
      actions.press(id, scene.time.now - elapsed);
    },
  });
}

export function refreshStartTopBar(scene: Scene, section: NativeTopSection, bank: Cents): void {
  section.setAmount(dollarAmountText(bank), shortDollarAmountText(bank));
  section.setMuted(isMuted(scene));
}
