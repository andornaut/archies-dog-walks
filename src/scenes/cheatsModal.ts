import { assertNever } from "@andornaut/game-kit/runtime/assertNever";
import type { Rect } from "@andornaut/game-kit/runtime/rect";
import type { Scene } from "phaser";

import { domArtUrl } from "../assets/domArtFiles.ts";
import { gameData } from "../data/index.ts";
import { SCREEN_CONFIG, SCREEN_LAYOUT } from "../data/screen.ts";
import {
  addToBank,
  grantOwned,
  nextChoice,
  type NextWalk,
  nextWalkLink,
  pocketChoices,
  seedFrom,
  SPEEDS,
} from "../dev/cheats.ts";
import { type CheatAction, type CheatsState, cheatsView } from "../dev/cheatsView.ts";
import { stripDevParams } from "../dev/devStart.ts";
import { pageRunSetup } from "../dev/pageRunSetup.ts";
import { randomSeed } from "../dev/runSetup.ts";
import { showCheats } from "../hud/dom/cheats.ts";
import { type DomQuestionPanel, showQuestionPanel } from "../hud/dom/questionPanel.ts";
import { homeQuestionLayout } from "../hud/pauseMenu.ts";
import { packDogsOf } from "../state/pack.ts";
import { loadSheet } from "../ui/dom/sheetFrames.ts";
import { MODAL, modalFamilyWidth } from "../ui/modal/layout.ts";
import { PALETTE } from "../ui/palette.ts";
import { CHEATS_CHANGED_EVENT, nextWalk, setNextWalk } from "./cheatChoices.ts";
import { canvasPanelMeasure } from "./modalMeasure.ts";
import {
  canResetSave,
  currentSettings,
  profileSave,
  resetSave,
  updateProfile,
  walkerInUse,
} from "./profileStore.ts";
import { followScene, htmlPanelInput, htmlPanelPlace, questionView } from "./questionPanel.ts";
import type { RunScene } from "./RunScene.ts";
import { SCENE_KEYS } from "./sceneKeys.ts";

// The Cheats modal opened directly from Menu or Pause (gameplay/cheats.md): the view of the cheats where it
// opened, over a walk or on the Start screen, and what each press does. It owns its HTML and
// Reset save's question over it.
export interface CheatsModal {
  // Closes Reset save's question, if open: false when there was none to close.
  back(): boolean;
  destroy(): void;
  // The card's rect, which a tap outside closes.
  panel(): Rect;
}

// Reset save's question is as wide as the Cheats modal under it.
const RESET_WIDTH = modalFamilyWidth(SCREEN_CONFIG.width - 2 * MODAL.margin, "large");

// The walk the modal opened over, while it is on.
function runOf(scene: Scene, inWalk: boolean): RunScene | undefined {
  const { scene: plugin } = scene;
  if (!inWalk || !(plugin.isActive(SCENE_KEYS.run) || plugin.isPaused(SCENE_KEYS.run))) {
    return undefined;
  }
  const run = plugin.get(SCENE_KEYS.run) as RunScene;
  return run.cheatsApply() ? run : undefined;
}

// A link that starts the next walk as set up: its seed, start, Pocket item and Invincible owners
// over the Start screen's pack, Pocket item and walker.
function runLink(scene: Scene, next: NextWalk & { readonly seed: number }): string {
  const save = profileSave(scene);
  const dogs = packDogsOf(save.lastLoadout.dogs);
  const base = {
    dev: pageRunSetup().setup.dev,
    gear: save.lastLoadout.gear,
    invincible: false,
    ...(dogs === undefined ? {} : { pack: dogs }),
    seed: next.seed,
    speed: 1,
    walker: walkerInUse(save),
    zone: 1,
  };
  const page = new URL("/play/", globalThis.location.href).href;
  return nextWalkLink(gameData, page, next, base);
}

export function openCheatsModal(
  scene: Scene,
  inWalk: boolean,
  close: () => void,
): CheatsModal | undefined {
  const place = htmlPanelPlace(scene);
  if (place === undefined) {
    return undefined;
  }
  let question: DomQuestionPanel | undefined;
  const state = (): CheatsState => {
    const run = runOf(scene, inWalk);
    return {
      canResetSave: canResetSave(scene),
      next: nextWalk(scene),
      walk: run?.activeCheats(),
    };
  };
  const view = () =>
    cheatsView(
      canvasPanelMeasure(scene),
      { data: gameData, screen: SCREEN_CONFIG, words: gameData.menuText },
      state(),
    );
  const render = () => dom.update(view());
  const changed = () => {
    scene.game.events.emit(CHEATS_CHANGED_EVENT);
    render();
  };
  const setNext = (change: (next: NextWalk) => NextWalk) => {
    setNextWalk(scene, change(nextWalk(scene)));
    render();
  };
  // A grant changes the save and is written like any change: Add money goes to the bank.
  const grant = (change: Parameters<typeof updateProfile>[1]) => {
    void updateProfile(scene, change);
    changed();
  };
  const copyLink = () => {
    const seed = nextWalk(scene).seed ?? randomSeed();
    setNext((next) => ({ ...next, seed }));
    const link = runLink(scene, { ...nextWalk(scene), seed });
    void globalThis.navigator.clipboard?.writeText(link).catch((error: unknown) => {
      console.warn("Copy run link: the link was not copied", error);
    });
  };
  const closeQuestion = () => {
    question?.destroy();
    question = undefined;
    dom.setInert(false);
    dom.setDimmed(false);
    dom.focusReset();
  };
  // Reset save writes a new player's save and no badges, then loads the Start screen afresh.
  const askReset = () => {
    if (question !== undefined || !canResetSave(scene)) {
      return;
    }
    const words = gameData.menuText.cheats.reset;
    const reset = () => {
      const home = stripDevParams(globalThis.location.href, false);
      void resetSave(scene).then((started) => {
        if (started) {
          globalThis.location.replace(home);
        } else {
          closeQuestion();
        }
      });
    };
    const panel = questionView(scene, SCREEN_LAYOUT.screen, {
      close: closeQuestion,
      entries: [
        { label: words.cancel, press: closeQuestion },
        { label: words.confirm, press: reset },
      ],
      layout: homeQuestionLayout,
      note: [{ colour: PALETTE.plum, text: words.note }],
      panelWidth: RESET_WIDTH,
      primary: "last",
      sentenceLines: false,
      title: words.title,
    });
    question = followScene(
      scene,
      showQuestionPanel(place.layer, {
        ...htmlPanelInput(place),
        backgroundCancel: closeQuestion,
        close: closeQuestion,
        numberKeys: true,
        presses: [closeQuestion, reset],
        view: panel,
      }),
    );
    dom.setDimmed(true);
    dom.setInert(true);
  };
  const act = (action: CheatAction) => {
    switch (action.kind) {
      case "addMoney":
      case "debuff":
      case "finishZone":
      case "refillHearts":
      case "upgrade":
      case "upgrades":
        runOf(scene, inWalk)?.cheat(action);
        render();
        return;
      case "addBank":
        grant((save) => addToBank(action.amount, save));
        return;
      case "copyRunLink":
        copyLink();
        return;
      case "invincible": {
        if (inWalk) {
          runOf(scene, true)?.toggleInvincible();
          render();
        } else {
          setNext((next) => ({ ...next, invincible: !next.invincible }));
        }
        return;
      }
      case "own":
        grant((save) => grantOwned(gameData, action.grant, save));
        return;
      case "pocket":
        setNext((next) => ({ ...next, pocket: nextChoice(pocketChoices(gameData), next.pocket) }));
        return;
      case "resetSave":
        askReset();
        return;
      case "speed": {
        const speeds = SPEEDS.map(({ id }) => id);
        setNext((next) => ({ ...next, speed: nextChoice(speeds, next.speed) }));
        return;
      }
      case "startAt": {
        if (inWalk) {
          runOf(scene, true)?.jumpToZone(action.zone);
          render();
        } else {
          setNext((next) => ({ ...next, start: action.zone }));
        }
        return;
      }
      default:
        assertNever(action);
    }
  };
  const dom = followScene(
    scene,
    showCheats(place.layer, {
      ...htmlPanelInput(place),
      act,
      artUrl: domArtUrl,
      close,
      loadSheet,
      reducedMotion: () => currentSettings(scene).reducedMotion,
      seed: (text) => {
        const seed = seedFrom(text);
        if (seed !== undefined && seed !== nextWalk(scene).seed) {
          setNext((next) => ({ ...next, seed }));
        } else {
          render();
        }
      },
      view: view(),
    }),
  );
  return {
    back: () => {
      if (question === undefined) {
        return false;
      }
      closeQuestion();
      return true;
    },
    destroy: () => {
      question?.destroy();
      question = undefined;
      dom.destroy();
    },
    panel: () => view().layout.panel,
  };
}
