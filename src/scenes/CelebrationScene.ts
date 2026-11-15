import { type Rect } from "@andornaut/game-kit/runtime/rect";
import { inkRowsFromCapTop } from "@andornaut/game-kit/runtime/text/bitmapFont";
import { Scene } from "phaser";

import { gameData } from "../data/index.ts";
import { SCREEN_LAYOUT } from "../data/screen.ts";
import type { AchievementId, DogId } from "../data/types.ts";
import {
  BADGE_STRIP,
  badgeRowNames,
  badgeStripRows,
  celebrationTitle,
  earnedBadges,
  stripUnderClose,
} from "../home/badgesView.ts";
import { overlayRegion } from "../home/homeBar.ts";
import { isConfirmKey, isPauseKey, menuKeyActs } from "../input/keyBindings.ts";
import { achievementLabel } from "../rules/achievements.ts";
import { BUTTON_SIZE } from "../ui/buttonGeometry.ts";
import {
  MODAL,
  modalActionWidth,
  modalPanelWidth,
  modalRect,
  modalTitleWidth,
} from "../ui/modal/layout.ts";
import { panelButton, panelTitle } from "../ui/modal/view.ts";
import { labelInkWidth, pixelFontMetrics, withProbe } from "../ui/phaser/pixelText.ts";
import { addRampDim } from "../ui/phaser/rampDim.ts";
import { badgeCelebrationNames } from "./badges.ts";
import { listenHomeBar, sceneRegionOutside } from "./homeBarPress.ts";
import { canvasPanelMeasure, modalTextWidth } from "./modalMeasure.ts";
import { addNativeBadgeCelebration } from "./nativeBadgeCelebration.ts";
import { mountNativeOverlay } from "./nativeOverlayReady.ts";
import { closeOverlay, listenDismiss, nativeSceneAccepts } from "./overlay.ts";
import { currentSettings } from "./profileStore.ts";
import { SCENE_KEYS, type SceneKey } from "./sceneKeys.ts";
import { soundboardOf } from "./soundboard.ts";
import { BODY_TEXT } from "./uiKit.ts";

export interface CelebrationSceneData {
  achievements: readonly AchievementId[];
  // The owners who cheer, at most three.
  owners: readonly DogId[];
  resume: SceneKey;
}

const SCREEN = SCREEN_LAYOUT.screen;
const FACES = { pitch: 44, size: 32 };
// The action follows the panel at the section gap.
const BUTTON = { gap: MODAL.gap, height: BUTTON_SIZE.compact.height };

// Badges earned away from a run's end, on launch or by a purchase, over the dimmed home screen:
// the badges burst in and the owners cheer. Nice! and the close control return to the screen
// below.
export class CelebrationScene extends Scene {
  constructor() {
    super(SCENE_KEYS.celebration);
  }

  create(data: CelebrationSceneData): void {
    mountNativeOverlay(this, () => this.mount(data));
  }

  private mount({ achievements, owners, resume }: CelebrationSceneData): boolean {
    const reduced = currentSettings(this).reducedMotion;
    // Dimmed down the colour ramps under the lit top bar, as under the pause menu and the cards.
    const dim = overlayRegion("home");
    const cheering = owners.slice(0, 3);
    const rows = badgeStripRows(achievements.length);
    const names = earnedBadges(gameData, achievements).map((badge) =>
      achievementLabel(gameData, badge),
    );
    const buttonWidth = modalActionWidth(
      modalTextWidth(this, "title", [gameData.menuText.celebration.button]),
    );
    const width = modalPanelWidth(
      SCREEN.width - 2 * MODAL.margin,
      Math.max(
        buttonWidth + 2 * MODAL.pad,
        modalTitleWidth(
          modalTextWidth(this, "title", [celebrationTitle(gameData, achievements.length)]),
        ),
        modalTextWidth(this, "body", names) * Math.min(names.length, BADGE_STRIP.maxNamed) +
          2 * MODAL.pad,
        BADGE_STRIP.badgeSize * Math.min(names.length, BADGE_STRIP.perRow) + 2 * MODAL.pad,
        (cheering.length - 1) * FACES.pitch + FACES.size + 2 * MODAL.pad,
      ),
    );
    const slotWidth =
      (width - 2 * BADGE_STRIP.inset) / Math.min(achievements.length, BADGE_STRIP.perRow);
    const lineCounts = withProbe(this, BODY_TEXT, (probe) =>
      badgeRowNames(labelInkWidth(probe), slotWidth, names).lines.map((lines) => lines.length),
    );
    const namedLines = achievements.length <= BADGE_STRIP.maxNamed ? Math.max(0, ...lineCounts) : 0;
    const shift = stripUnderClose({ height: 0, width, x: 0, y: 0 }).y;
    const badgeBottom =
      shift + BADGE_STRIP.badgeTop + (rows - 1) * BADGE_STRIP.rowPitch + BADGE_STRIP.badgeSize;
    const nameHeight =
      namedLines === 0
        ? 0
        : BADGE_STRIP.nameGap +
          (namedLines - 1) * BADGE_STRIP.namePitch +
          inkRowsFromCapTop(pixelFontMetrics(this, "body")) * 2;
    const badgesHeight = badgeBottom + nameHeight + MODAL.pad;
    const height = badgesHeight + (cheering.length > 0 ? MODAL.gap + FACES.size + MODAL.pad : 0);
    const group = modalRect(dim, undefined, { height: height + BUTTON.gap + BUTTON.height, width });
    const top = group.y;
    const panel: Rect = { height, width, x: group.x, y: top };
    const buttonRect: Rect = {
      height: BUTTON.height,
      width: buttonWidth,
      x: (SCREEN.width - buttonWidth) / 2,
      y: top + height + BUTTON.gap,
    };
    const close = () => closeOverlay(resume, this);
    const measure = canvasPanelMeasure(this);
    const titleY = panel.y + BADGE_STRIP.titleY;
    const left = SCREEN.width / 2 - ((cheering.length - 1) * FACES.pitch + FACES.size) / 2;
    const facesY = top + badgesHeight + MODAL.gap;
    const html = addNativeBadgeCelebration(
      this,
      {
        button: panelButton(measure, buttonRect, true, gameData.menuText.celebration.button),
        names: badgeCelebrationNames(this, panel, rows, achievements, true),
        panel,
        title: panelTitle(measure, panel, titleY, celebrationTitle(gameData, achievements.length)),
        titleY,
      },
      {
        badges: earnedBadges(gameData, achievements),
        close,
        faces: cheering.map((dog, i) => ({
          dog,
          rect: {
            height: FACES.size,
            width: FACES.size,
            x: Math.round(left + i * FACES.pitch),
            y: facesY,
          },
        })),
        reduced,
        rows,
      },
    );
    if (html === undefined) {
      return false;
    }
    addRampDim(this, dim);
    soundboardOf(this).play("badge");
    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
      if (!nativeSceneAccepts(this)) {
        return;
      }
      if (
        menuKeyActs(event.repeat, event.code) &&
        (isConfirmKey(event.code) || isPauseKey(event.code))
      ) {
        close();
      }
    });
    // A tap anywhere around the panel and Nice!, the top bar's empty area included, closes, as
    // Nice! and the close control do; the top bar's buttons keep their own taps.
    listenDismiss(this, sceneRegionOutside(this, "home", 0, [panel, buttonRect]), close);
    listenHomeBar(this, close);
    return true;
  }
}
