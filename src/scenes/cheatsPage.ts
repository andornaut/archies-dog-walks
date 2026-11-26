import { assertNever } from "@andornaut/game-kit/runtime/assertNever";
import type { Scene } from "phaser";

import { domArtUrl } from "../assets/files/index.ts";
import { pageRunSetup, randomSeed } from "../cheats/dom/index.ts";
import {
  addToBank,
  type CheatAction,
  type CheatsState,
  cheatsView,
  grantOwned,
  nextChoice,
  type NextWalk,
  nextWalkLink,
  pocketChoices,
  seedFrom,
  SPEEDS,
  stripRunOverrides,
} from "../cheats/index.ts";
import type { ZoneId } from "../data/ids.ts";
import { gameData, SCREEN_CONFIG } from "../data/index.ts";
import { overlayRegion } from "../home/index.ts";
import { showCheats, showQuestionPanel } from "../hud/dom/index.ts";
import { packDogsOf } from "../state/index.ts";
import { type DomQuestionPanel, loadSheet } from "../ui/dom/index.ts";
import { MODAL, modalFamilyWidth, PALETTE } from "../ui/index.ts";
import { CHEATS_CHANGED_EVENT, nextWalk, setNextWalk } from "./cheatChoices.ts";
import { canvasPanelMeasure } from "./modalMeasure.ts";
import { nativeModalShade } from "./nativeModalShade.ts";
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

// The Cheats page (gameplay/cheats.md), which CheatsScene shows: the view of the cheats where it
// opened, over a walk or on the Start screen, and what each press does. It owns its HTML and
// Reset save's question, a modal over it.
export interface CheatsPage {
  // Closes Reset save's question, if open: false when there was none to close.
  back(): boolean;
  destroy(): void;
}

// Reset save's question is a Large modal.
const RESET_WIDTH = modalFamilyWidth(SCREEN_CONFIG.width - 2 * MODAL.margin, "large");

// The walk the page opened over, while it is on.
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

// Runs work in the task after the browser next paints, so what the press drew shows first: a
// frame callback runs before that paint, and the timeout it starts runs after. Returns a cancel.
function afterPaint(work: () => void): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  if (typeof globalThis.requestAnimationFrame !== "function") {
    timer = setTimeout(work, 0);
    return () => clearTimeout(timer);
  }
  const frame = globalThis.requestAnimationFrame(() => {
    timer = setTimeout(work, 0);
  });
  return () => {
    globalThis.cancelAnimationFrame(frame);
    clearTimeout(timer);
  };
}

export function openCheatsPage(
  scene: Scene,
  inWalk: boolean,
  close: () => void,
): CheatsPage | undefined {
  const place = htmlPanelPlace(scene);
  if (place === undefined) {
    return undefined;
  }
  let question: DomQuestionPanel | undefined;
  // A live Start at press shows its neighbourhood selected at once. The switch plans the new
  // road, which takes long enough to hold the frame, so it runs after that frame paints.
  let switching: { readonly cancel: () => void; readonly zone: ZoneId } | undefined;
  const state = (): CheatsState => {
    const walk = runOf(scene, inWalk)?.activeCheats();
    return {
      canResetSave: canResetSave(scene),
      next: nextWalk(scene),
      walk:
        walk === undefined || switching === undefined ? walk : { ...walk, zone: switching.zone },
    };
  };
  const area = overlayRegion(inWalk ? "walk" : "home");
  const view = () =>
    cheatsView(canvasPanelMeasure(scene), { data: gameData, words: gameData.menuText }, state());
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
      const home = stripRunOverrides(globalThis.location.href, false);
      void resetSave(scene).then((started) => {
        if (started) {
          globalThis.location.replace(home);
        } else {
          closeQuestion();
        }
      });
    };
    const panel = questionView(scene, area, {
      close: closeQuestion,
      entries: [
        { label: words.cancel, press: closeQuestion },
        { label: words.confirm, press: reset },
      ],
      note: [{ colour: PALETTE.plum, text: words.note }],
      panelWidth: RESET_WIDTH,
      primary: "last",
      sentenceLines: false,
      title: words.title,
    });
    question = followScene(
      scene,
      nativeModalShade(
        scene,
        showQuestionPanel(place.layer, {
          ...htmlPanelInput(place),
          backgroundCancel: closeQuestion,
          close: closeQuestion,
          numberKeys: true,
          presses: [closeQuestion, reset],
          view: panel,
        }),
      ),
    );
    dom.setDimmed(true);
    dom.setInert(true);
  };
  // The pending switch, if any, applied now: before any other cheat, and as the page closes.
  const finishSwitch = () => {
    if (switching === undefined) {
      return;
    }
    const { cancel, zone } = switching;
    switching = undefined;
    cancel();
    runOf(scene, true)?.jumpToZone(zone);
  };
  const switchZone = (zone: ZoneId) => {
    if (runOf(scene, true) === undefined) {
      return;
    }
    switching?.cancel();
    switching = {
      cancel: afterPaint(() => {
        finishSwitch();
        render();
      }),
      zone,
    };
    render();
  };
  const act = (action: CheatAction) => {
    if (action.kind !== "startAt") {
      finishSwitch();
    }
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
          switchZone(action.zone);
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
      finishSwitch();
      question?.destroy();
      question = undefined;
      dom.destroy();
    },
  };
}
