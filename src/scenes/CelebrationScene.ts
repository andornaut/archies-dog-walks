import { inkRowsFromCapTop } from "@andornaut/game-kit/runtime/text/bitmapFont";
import { Scene } from "phaser";

import type { AchievementId, DogId } from "../data/ids.ts";
import { BADGE_STRIP, FACE_SIZE, gameData } from "../data/index.ts";
import {
  badgeRowNames,
  badgeStripRows,
  CELEBRATION_PANEL,
  celebrationTitle,
  earnedBadges,
  overlayRegion,
  stripUnderClose,
} from "../home/index.ts";
import { ordinaryBadgeModalLayout } from "../hud/index.ts";
import { isConfirmKey, isPauseKey, menuKeyActs, screenArea } from "../input/index.ts";
import { SCREEN_LAYOUT } from "../layout/index.ts";
import { achievementLabel } from "../rules/index.ts";
import {
  barTitleRoom,
  cardTitleRow,
  closeControl,
  MODAL,
  modalActionWidth,
  modalTitleLayout,
  panelButton,
  panelTitle,
  TEXT_SCALE,
} from "../ui/index.ts";
import { labelInkWidth, pixelFontMetrics, withProbe } from "../ui/phaser/index.ts";
import { badgeCelebrationNames } from "./badges.ts";
import { clearOnHomePageOpening } from "./homeBarPress.ts";
import { canvasPanelMeasure, modalTextWidth } from "./modalMeasure.ts";
import { addNativeBadgeCelebration } from "./nativeBadgeCelebration.ts";
import { mountNativeOverlay } from "./nativeOverlayReady.ts";
import { closeOverlay, listenDismiss, nativeSceneAccepts } from "./overlay.ts";
import { currentSettings } from "./profileStore.ts";
import { addRampDim } from "./rampDim.ts";
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
const FACES = { pitch: 44, size: FACE_SIZE };
// The action follows the panel at the section gap.

// Badges earned away from a run's end, on launch or by a purchase, over the dimmed home screen:
// the badges burst in and the owners cheer. Close and the close control return to the screen
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
    // Placed in the safe region under the top bar; the whole game frame dims under it.
    const dim = overlayRegion("home");
    const cheering = owners.slice(0, 3);
    const rows = badgeStripRows(achievements.length);
    const names = earnedBadges(gameData, achievements).map((badge) =>
      achievementLabel(gameData, badge),
    );
    const buttonWidth = modalActionWidth(
      modalTextWidth(this, "title", [gameData.menuText.common.close]),
    );
    const { width } = CELEBRATION_PANEL;
    const slotWidth =
      (width - 2 * BADGE_STRIP.inset) / Math.min(achievements.length, BADGE_STRIP.perRow);
    const lineCounts = withProbe(this, BODY_TEXT, (probe) =>
      badgeRowNames(labelInkWidth(probe), slotWidth, names).lines.map((lines) => lines.length),
    );
    const namedLines = achievements.length <= BADGE_STRIP.maxNamed ? Math.max(0, ...lineCounts) : 0;
    const measure = canvasPanelMeasure(this);
    const titlePanel = { height: 0, width, x: 0, y: 0 };
    const heading = modalTitleLayout(
      {
        font: measure.title,
        inkOf: measure.titleInk,
        widthOf: (line) => measure.inkWidth("title", line),
      },
      barTitleRoom(cardTitleRow(titlePanel), closeControl(titlePanel)),
      celebrationTitle(gameData, achievements.length),
    );
    const titleExtraHeight = heading.extraHeight;
    const shift = stripUnderClose(titlePanel, titleExtraHeight).y;
    const badgeBottom =
      shift + BADGE_STRIP.badgeTop + (rows - 1) * BADGE_STRIP.rowPitch + BADGE_STRIP.badgeSize;
    const nameHeight =
      namedLines === 0
        ? 0
        : BADGE_STRIP.nameGap +
          (namedLines - 1) * BADGE_STRIP.namePitch +
          inkRowsFromCapTop(pixelFontMetrics(this, "body")) * TEXT_SCALE;
    const badgesHeight = badgeBottom + nameHeight + MODAL.pad;
    const height = badgesHeight + (cheering.length > 0 ? MODAL.gap + FACES.size + MODAL.pad : 0);
    const { button: buttonRect, panel } = ordinaryBadgeModalLayout(dim, {
      buttonWidth,
      height,
      width,
    });
    const top = panel.y;
    const close = () => closeOverlay(resume, this);
    const left = SCREEN.width / 2 - ((cheering.length - 1) * FACES.pitch + FACES.size) / 2;
    const facesY = top + badgesHeight + MODAL.gap;
    const html = addNativeBadgeCelebration(
      this,
      {
        button: panelButton(measure, buttonRect, true, gameData.menuText.common.close),
        names: badgeCelebrationNames(this, panel, rows, achievements, true, titleExtraHeight),
        panel,
        title: panelTitle(
          measure,
          panel,
          cardTitleRow(panel).y,
          celebrationTitle(gameData, achievements.length),
        ),
        titleExtraHeight,
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
    addRampDim(this);
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
    // A tap anywhere around the panel and Nice!, the top bar included, closes, as Nice! and the
    // close control do: the panel's backdrop takes the game frame, this the page beside it.
    listenDismiss(this, screenArea([panel, buttonRect]), close);
    clearOnHomePageOpening(this, close);
    return true;
  }
}
