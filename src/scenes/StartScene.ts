import { clampIndex, itemAt } from "@andornaut/game-kit/runtime/arrays";
import { type ProgressHandle } from "@andornaut/game-kit/runtime/progressState";
import { containsPoint, insetRect, type Rect } from "@andornaut/game-kit/runtime/rect";
import { fontMetrics } from "@andornaut/game-kit/runtime/text/bitmapFont";
import { Core, type GameObjects, Scene, Scenes, type Time } from "phaser";

import { artUrl } from "../assets/artFiles.ts";
import { gearSmallIconKey } from "../assets/iconKeys.ts";
import { MANIFEST_CACHE_KEY } from "../assets/phaser/manifestArt.ts";
import { dogSpriteKey, gearIconKey, walkerPortraitKey } from "../assets/spriteKeys.ts";
import { gameData } from "../data/index.ts";
import { HOME_SCREEN } from "../data/layout.ts";
import { SCREEN_LAYOUT } from "../data/screen.ts";
import type { DogId, GearId, WalkerId } from "../data/types.ts";
import { clearRunOverrides } from "../dev/pageRunSetup.ts";
import { startWalkOpensHelp } from "../help/helpSeen.ts";
import { bankAtLastVisit, newlyAffordable } from "../home/afford.ts";
import {
  type DetailCard,
  type DetailPicture,
  dogDetail,
  gearDetail,
  walkerDetail,
} from "../home/detail.ts";
import { createNativeHomeView, type NativeHomeView } from "../home/dom/screen.ts";
import { createNativeHomeSession } from "../home/dom/session.ts";
import {
  badgePopOffset,
  bobOffset,
  FEEDBACK,
  hopOffset,
  pressDip,
  settleDelay,
  shakeOffset,
} from "../home/feedback.ts";
import { type Focus, focusDirectionForKey, moveFocus } from "../home/focus.ts";
import { gearPictureFallback } from "../home/gearPictureView.ts";
import {
  dogInfo,
  gearByPrice,
  gearInfo,
  type HomeLoadout,
  partingSpeech,
  type Purchase,
  rosterRows,
  tapDog,
  tapGear,
} from "../home/home.ts";
import { homeBackAction, homeBarButtonAt, overlayRegion, regionOutside } from "../home/homeBar.ts";
import { HOME_LAYOUT, homeBarButtons, tileFace, updateModalLayout } from "../home/homeLayout.ts";
import {
  bubbleSpeech,
  bubbleTurnLine,
  type HomeAction,
  noticeOrSpeech,
  packBonusLine,
  requiredNotice,
  storageNotice,
  tappedBubbleTurn,
  type WalkerLine,
  walkerLineKey,
  walkerSays,
  walkersUnlockedSince,
} from "../home/homeLines.ts";
import { renderHomeBackdrop } from "../home/phaser/homeBackdrop.ts";
import { nativeFrames } from "../home/phaser/nativeFrames.ts";
import { porchOwners } from "../home/porch.ts";
import { homeSections, type Sections, startReady } from "../home/sections.ts";
import { type HomeSelectionView, homeSelectionViews } from "../home/selectionView.ts";
import { shopAffordable } from "../home/shop.ts";
import { slotSign, slotSignPurchase } from "../home/slotSign.ts";
import { homeSpeechView } from "../home/speechView.ts";
import { tapWalker } from "../home/walkers.ts";
import type { DomQuestionPanel } from "../hud/dom/questionPanel.ts";
import { pillKind } from "../hud/effectNames.ts";
import { downTail } from "../hud/moments.ts";
import {
  type HoldPress,
  holdRule,
  moveHold,
  releaseHold,
  startHold,
  tickHold,
  TILE_SLOP_PX,
} from "../input/hold.ts";
import {
  isConfirmKey,
  isExitKey,
  isHelpKey,
  isMuteKey,
  isPauseKey,
  menuKeyActs,
} from "../input/keyBindings.ts";
import type { PackPlacement } from "../layout/packFormation.ts";
import { waitedLoad } from "../loadingProgress.ts";
import { addFigure, PackFigures } from "../pack/phaser/packFigures.ts";
import { dollarAmountText, shortDollarAmountText } from "../presentation/currency.ts";
import {
  acceptUpdate,
  arriveHome,
  dismissUpdateOffer,
  exitShown,
  installNudgeDue,
  noteInstallNudged,
  PHONE_EVENTS,
  requiredUpdate,
  startWakeLock,
  stopWakeLock,
  updateAcceptanceFailed,
  updateAccepting,
  updatePlateShown,
} from "../pwa/index.ts";
import { walkerOrder } from "../rules/walkers.ts";
import type { SaveDocument } from "../save/schema.ts";
import { walksFinished, walksPlayed } from "../save/stats.ts";
import { packDogsOf } from "../state/pack.ts";
import { barTitleRoom } from "../ui/barTitle.ts";
import { closeControl } from "../ui/closeControl.ts";
import { disabledArtKey } from "../ui/disabledArt.ts";
import type { NativeTopSection } from "../ui/dom/nativeTopSection.ts";
import { loadSheet } from "../ui/dom/sheetFrames.ts";
import { uiLayer } from "../ui/dom/uiLayer.ts";
import { gridRects, rectIndexAt } from "../ui/grid.ts";
import { cardTitleRow } from "../ui/modal/titleRow.ts";
import { PALETTE } from "../ui/palette.ts";
import { drawShadow } from "../ui/phaser/draw.ts";
import { addModalShade } from "../ui/phaser/rampDim.ts";
import { REFUSE } from "../ui/refuse.ts";
import type { Cents } from "../units.ts";
import { artReady, waitForWalkArt, whenArtReady } from "./artReady.ts";
import type { CelebrationSceneData } from "./CelebrationScene.ts";
import { pillColours } from "./effectNameColours.ts";
import { HELP_CLOSED_EVENT } from "./HelpScene.ts";
import { openHelp } from "./helpScreen.ts";
import { exitGame, HOME_PAGE_OPENING_EVENT, openHomePage, routeHomeBar } from "./homeBarPress.ts";
import { addAffordFrame, detailView } from "./homePanels.ts";
import { drawPetShopFallback, PLATE_PAD, purchasePicture, SHOP_ART } from "./itemArt.ts";
import { measureModalTitle, modalTextWidth } from "./modalMeasure.ts";
import { NATIVE_HOME_READY } from "./nativeHomeReady.ts";
import { listenOnePress } from "./onePress.ts";
import {
  BAR_MUTED_EVENT,
  listenOutsideTap,
  onBackPressed,
  onceSceneEvent,
  onSceneEvent,
  onWindowEvent,
  openOverlay,
  type OverlayData,
} from "./overlay.ts";
import { afterMsUnderOverlay } from "./overlayClock.ts";
import { addOwnerFigure } from "./ownerFigure.ts";
import {
  currentSettings,
  isMuted,
  onSettingsChanged,
  profileSave,
  storageState,
  takeCelebrations,
  toggleMuted,
  updateProfile,
  walkerSpriteKey,
} from "./profileStore.ts";
import {
  addHtmlDetailCard,
  addHtmlModalCard,
  htmlPanelInput,
  htmlPanelPlace,
  keepPanel,
  type KeptPanel,
} from "./questionPanel.ts";
import { nextRunStart } from "./run/runRecorder.ts";
import { type RunPick, runSceneData } from "./run/runStart.ts";
import { SCENE_KEYS } from "./sceneKeys.ts";
import { maskToRect } from "./scrollView.ts";
import { selectionOrbitSegments } from "./selectionOrbit.ts";
import { SETTINGS_CLOSED_EVENT } from "./SettingsScene.ts";
import { addShopBoard, addShopIdle, type ShopBoard, type ShopIdle } from "./shopIdle.ts";
import {
  SHOP_CHANGED_EVENT,
  SHOP_CLOSED_EVENT,
  type ShopClosed,
  type ShopSceneData,
} from "./ShopScene.ts";
import { playEffect, spriteMetrics } from "./sprites.ts";
import { addNativeTopSection } from "./topSection.ts";
import { addGraphicsIn, addTagImage, addTapBurst, type IconButton } from "./uiKit.ts";
const SCREEN = SCREEN_LAYOUT.screen;
const HOME_REGION = overlayRegion("home");
const GATE = HOME_LAYOUT.gate;
const PATH = HOME_LAYOUT.path;
const WALKER_AT_GATE = HOME_LAYOUT.walkerAtGate;
const GATE_SPOTS: readonly PackPlacement[] = HOME_LAYOUT.gateSpots;
const PORCH_SPOTS: Readonly<
  Partial<
    Record<
      DogId,
      {
        footY: number;
        x: number;
      }
    >
  >
> = HOME_LAYOUT.porchSpots;
const PORCH_DOG_OFFSET = HOME_LAYOUT.porchDogOffset;
const PET_SHOP: Rect = HOME_LAYOUT.petShop;
const PET_SHOP_BOARD: Rect = HOME_LAYOUT.petShop.board;
const SLOT_SIGN = HOME_LAYOUT.slotSign;
const POCKET = HOME_LAYOUT.pocket;
const WALKER_TILES = HOME_LAYOUT.walkerTiles;
const WALKER_ORIGIN = HOME_LAYOUT.walkerOrigin;
const DOG_TILES = HOME_LAYOUT.dogTiles;
const DOG_TILE_INSET = HOME_LAYOUT.dogTileInset;
const DOG_ORIGIN = HOME_LAYOUT.dogOrigin;
const START_BUTTON: Rect = HOME_LAYOUT.startButton;
// Start walk's opacity while it waits for the rest of the art to load.
const WAITING_ALPHA = 0.6;
const GEAR_BADGE: Rect = HOME_LAYOUT.gearBadge;
// The keyboard ring sits outside the ui-select frame.
const FOCUS_OUTSET = HOME_SCREEN.focusOutset;
// The walker's speech bubble: its place, padding and most lines.
// The gate scene, which crops the Pet shop group: its foot sits under the divider strip.
const HERO_CROP: Rect = { ...GATE, width: SCREEN.width, x: 0 };
const HERO_MASK_KEY = "home-hero-mask";
function walkerIds(): WalkerId[] {
  return walkerOrder(gameData);
}
function gearIds(): GearId[] {
  return gearByPrice(gameData);
}
type DetailTarget =
  | {
      dog: DogId;
      kind: "dog";
    }
  | {
      gear: GearId;
      kind: "gear";
    }
  | {
      kind: "walker";
      walker: WalkerId;
    };
type Target =
  | {
      dog: DogId;
      kind: "dog";
    }
  | {
      gear: GearId;
      kind: "gear";
    }
  | {
      kind: "bubble";
    }
  | {
      kind: "exit";
    }
  | {
      kind: "help";
    }
  | {
      kind: "logbook";
    }
  | {
      kind: "menu";
    }
  | {
      kind: "mute";
    }
  | {
      kind: "petShop";
    }
  | {
      kind: "settings";
    }
  | {
      kind: "slotSign";
    }
  | {
      kind: "start";
    }
  | {
      kind: "walker";
      walker: WalkerId;
    };
// One key per tappable thing, for its feedback timers.
function targetId(target: Target): string {
  switch (target.kind) {
    case "dog":
      return `dog:${target.dog}`;
    case "gear":
      return `gear:${target.gear}`;
    case "walker":
      return `walker:${target.walker}`;
    default:
      return target.kind;
  }
}
// The roster as the grid lays it out, row by row (rosterRows): tiles, taps and keyboard focus
// all read this one order.
function rosterOrder(): DogId[] {
  return rosterRows(gameData).flat();
}
function dogTiles(): Rect[] {
  return gridRects(DOG_TILES, rosterOrder().length, DOG_ORIGIN);
}
// A dog tile as drawn, inside its hit area.
function dogFace(hit: Rect): Rect {
  return tileFace(DOG_TILE_INSET, hit);
}
// The Pocket section's cells, cheapest first (gearByPrice); each draws its tile inset inside.
function gearSlots(): Rect[] {
  return gridRects(POCKET.cells, gearIds().length, POCKET.origin);
}
function pocketTile(cell: Rect): Rect {
  return tileFace(POCKET.tileInset, cell);
}
function walkerTiles(): Rect[] {
  return gridRects(WALKER_TILES, walkerIds().length, WALKER_ORIGIN);
}
// A walker tile as drawn, inside its hit area.
function walkerFace(hit: Rect): Rect {
  return tileFace(HOME_LAYOUT.walkerTileInset, hit);
}
interface Focusable {
  rect: Rect;
  target: Target;
}
// The keyboard's rows, top to bottom as the screen shows them: the dog slot sign while it
// shows and the Pet shop, the walkers, the dog rows,
// the Pocket and Start walk.
function focusRows(shown: { sign: boolean }): Focusable[][] {
  const walkers = walkerTiles();
  const sign: Focusable = { rect: SLOT_SIGN.board, target: { kind: "slotSign" } };
  const rows: Focusable[][] = [
    [...(shown.sign ? [sign] : []), { rect: PET_SHOP, target: { kind: "petShop" } }],
    walkerIds().map((walker, i): Focusable => ({
      rect: walkerFace(itemAt(walkers, i)),
      target: { kind: "walker", walker },
    })),
  ];
  const tiles = dogTiles();
  const dogs = rosterOrder().map((dog, i): Focusable => ({
    rect: dogFace(itemAt(tiles, i)),
    target: { dog, kind: "dog" },
  }));
  for (let i = 0; i < dogs.length; i += DOG_TILES.columns) {
    rows.push(dogs.slice(i, i + DOG_TILES.columns));
  }
  const slots = gearSlots();
  rows.push(
    gearIds().map((gear, i): Focusable => ({
      rect: pocketTile(itemAt(slots, i)),
      target: { gear, kind: "gear" },
    })),
  );
  rows.push([{ rect: START_BUTTON, target: { kind: "start" } }]);
  return rows;
}
// A held item's detail card or the dismissible update notice, above the home screen.
type Overlay = {
  rect: Rect | undefined;
} & (
  | {
      update: true;
    }
  | {
      target: DetailTarget;
    }
);
// The heart after the Dogs band's pack-size bonus.
// The bank the last time the home screen was shown this session, so the walker can say
// when something new became affordable.
const LAST_VISIT_BANK_KEY = "homeLastVisitBank";
// The walkers owned the last time the home screen was shown this session, so the walker can
// say when one has just been unlocked. A session's first visit has none to compare with.
const LAST_VISIT_WALKERS_KEY = "homeLastVisitWalkers";
// The screen before a walk: the bank at the top bar's left and Logbook, Help, Sound, Settings
// and Exit at its right (Exit where exitShown); the walker and pack at the gate beside the Pet
// shop; the Walker, Dogs and Pocket sections and Start walk. A waiting game update opens a
// dismissible modal. Buying happens only in the
// shop: tapping the building opens it, and tapping a locked dog, gear item or the dog slot sign
// opens it on that item. Holding a dog or gear tile opens its detail card.
// The arrow keys move a focus ring, Enter or Space picks, Escape, P or back closes a card, ?
// opens help, S settings, L the logbook, M mutes and Q leaves the game as Exit does, where the
// top bar shows Exit. Start walk and help wait for boot to load the rest of the art, which it
// does behind this screen. Native controls sit above the canvas yard and its actors.
export class StartScene extends Scene {
  // The last action, for the message line and the bubble.
  private action: HomeAction = { kind: "none" };
  // A press of Start walk or help made before boot has loaded the rest of the art: the latest
  // runs once it has, and Start walk shows held down and dimmed while it waits.
  private artWait:
    | {
        action: () => void;
        kind: "help" | "start";
      }
    | undefined;
  private entry: object | undefined;
  // The walk's planning, which the line shows travelling from Start walk until the walk starts.
  private planning: ProgressHandle | undefined;
  // Whether keyboard Quit is offered by the current browser or installed window.
  private exit = true;
  private focus: Focus | null = null;
  private gateDogs: {
    dog: DogId;
    footY: number;
    sprite: GameObjects.Sprite;
  }[] = [];
  // A press on a dog or gear tile that may become a hold.
  private hold: HoldPress | undefined;
  private loadout: HomeLoadout = { dogs: [], gear: null };
  private overlay: Overlay | undefined;
  // The update notice drawn in HTML, while one is open, and the notice it shows.
  private htmlNotice: DomQuestionPanel | undefined;
  // The detail card drawn in HTML, while one is open.
  private htmlDetail: KeptPanel | undefined;
  private overlayLayer: GameObjects.Container | undefined;
  // A press that began while a panel was open: it never reaches the tiles under it.
  private overlayPress:
    | {
        x: number;
        y: number;
      }
    | undefined;
  // Taps waiting for their dip to finish before they act.
  private pending = new Set<Time.TimerEvent>();
  private pops = new Map<string, number>();
  private press:
    | {
        held: boolean;
        id: string;
        startedMs: number;
      }
    | undefined;
  private pressedTarget: Target | undefined;
  // The parting lines drawn this visit, one per dog picked or bought.
  private quips = new Map<DogId, string>();
  private topSection: NativeTopSection | undefined;
  private nativeHome: ReturnType<typeof createNativeHomeSession> | undefined;
  private nativeView: NativeHomeView | undefined;
  private nativeReady = false;
  private nativeSelections: readonly HomeSelectionView[] = [];
  private nativeSpeechOwner: string | undefined;
  private nativeFrame = nativeFrames();
  private root: GameObjects.Container | undefined;
  private shakes = new Map<string, number>();
  private refusals = new Map<string, number>();
  private shownUpdate = false;
  private petShop:
    | {
        container: GameObjects.Container;
        iconButton?: IconButton;
        shopBoard?: ShopBoard;
        shopIdle?: ShopIdle;
      }
    | undefined;
  private walkerLine: WalkerLine = "firstVisit";
  // The walkers unlocked since the last visit, in unlock order, whom the walker's newWalker line
  // names one at a time; bubbleTurn counts the taps on the bubble or the walker at the gate
  // that move it on (bubbleTurnLine), and usualLine is the walker's line without the news.
  private joined: WalkerId[] = [];
  private bubbleTurn = 0;
  private usualLine: WalkerLine = "afterWalk";
  // Where a tap moves the bubble on: the bubble and the walker at the gate, as last drawn.
  private bubbleHits: Rect[] = [];
  constructor() {
    super(SCENE_KEYS.start);
  }
  create(): void {
    this.action = { kind: "none" };
    this.artWait = undefined;
    this.entry = undefined;
    this.planning = undefined;
    this.events.once("shutdown", () => this.endPlanning());
    this.exit = exitShown();
    this.focus = null;
    this.hold = undefined;
    // The scene's shutdown destroyed any HTML card.
    this.htmlDetail = undefined;
    this.overlay = undefined;
    this.overlayPress = undefined;
    this.shownUpdate = false;
    this.pending = new Set();
    this.pops = new Map();
    this.press = undefined;
    this.pressedTarget = undefined;
    this.quips = new Map();
    this.shakes = new Map();
    this.refusals = new Map();
    this.petShop = undefined;
    const { bankCents, lastLoadout, owned, stats } = profileSave(this);
    this.loadout = { dogs: [...lastLoadout.dogs], gear: lastLoadout.gear };
    const remembered = this.registry.get(LAST_VISIT_BANK_KEY) as Cents | undefined;
    const before = bankAtLastVisit(remembered, bankCents, stats.lastWalk);
    const walkersBefore = this.registry.get(LAST_VISIT_WALKERS_KEY) as WalkerId[] | undefined;
    this.joined = walkersUnlockedSince(gameData, walkersBefore, owned.walkers);
    this.bubbleTurn = 0;
    const news = {
      affordable: newlyAffordable(gameData, owned, before, bankCents),
      walker: this.joined.length > 0,
    };
    // Once per device, after the first finished walk, in place of the how-to or welcome back.
    const suggestInstall = walksFinished(stats) > 0 && installNudgeDue();
    this.walkerLine = walkerLineKey(stats.lastWalk, news, suggestInstall, walksPlayed(stats));
    // The install suggestion waits for a visit it leads.
    const quiet = { ...news, walker: false };
    this.usualLine = walkerLineKey(stats.lastWalk, quiet, false, walksPlayed(stats));
    if (this.walkerLine === "install") {
      noteInstallNudged();
    }
    stopWakeLock();
    clearRunOverrides();
    this.nativeHome = undefined;
    this.nativeView = undefined;
    this.nativeReady = false;
    this.nativeFrame = nativeFrames();
    this.nativeSelections = [];
    this.nativeSpeechOwner = undefined;
    renderHomeBackdrop(this);
    this.root = this.add.container(0, 0);
    this.root.setVisible(false);
    this.overlayLayer = this.add.container(0, 0);
    this.cameras.main.setVisible(false);
    const layer = uiLayer();
    const stopReady = layer?.onReady(() => {
      if (this.nativeHome === undefined && this.sys.isActive()) {
        this.render();
      }
    });
    this.events.once("shutdown", () => {
      stopReady?.();
      this.nativeHome?.dispose();
      this.nativeHome = undefined;
      this.nativeView = undefined;
      this.topSection = undefined;
    });
    onSceneEvent(this, this.game.events, Core.Events.PRE_RENDER, () => {
      this.nativeHome?.setShown(this.sys.isVisible());
    });
    this.prepareArrival();
    listenOnePress(this, {
      down: (point) => {
        if (this.nativeHome?.accepts()) {
          this.homePressDown(point);
        }
      },
      move: (point) => this.homePressMove(point),
      up: (point, cancelled) => this.homePressUp(point, cancelled),
    });
    // A tap outside an open panel, on the screen or the page beside the game, closes it.
    listenOutsideTap(
      this,
      () => {
        const rect = this.overlay?.rect;
        return rect === undefined ? undefined : regionOutside("home", this.exit, 0, [rect]);
      },
      () => this.closeOverlay(),
    );
    // Back closes an open detail card, as Escape does, and with none asks Quit?.
    onBackPressed(this, () => {
      const action = homeBackAction(this.overlay !== undefined);
      if (action === "closeDetail") {
        this.closeOverlay();
      } else {
        const data: OverlayData = { resume: SCENE_KEYS.start };
        openOverlay(this, SCENE_KEYS.quit, data);
      }
    });
    // A held key acts once, so an Enter held from the end screen cannot start a walk.
    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
      if (menuKeyActs(event.repeat, event.code)) {
        this.onKey(event);
      }
    });
    // Badges earned on launch: a scene can pause itself only once it is running.
    this.time.delayedCall(0, () => this.celebrate());
    onSettingsChanged(this, ({ muted }) => this.topSection?.setMuted(muted));
    // Settings can change reduced motion or mute, so the screen is drawn again.
    onSceneEvent(this, this.game.events, SETTINGS_CLOSED_EVENT, () => this.render());
    // Sound on the top bar, tapped over an overlay, which takes the press.
    onSceneEvent(this, this.game.events, BAR_MUTED_EVENT, (muted: boolean) =>
      this.showMuted(muted),
    );
    // A page the top bar opens closes the detail card first.
    onSceneEvent(this, this.game.events, HOME_PAGE_OPENING_EVENT, () => {
      if (this.overlay !== undefined) {
        this.closeOverlay();
      }
    });
    // The shop draws under the top bar, so the bank there follows each purchase; on close
    // the walker says the shop's last purchase or refusal.
    onSceneEvent(this, this.game.events, SHOP_CHANGED_EVENT, () => this.render());
    onSceneEvent(this, this.game.events, SHOP_CLOSED_EVENT, (closed: ShopClosed) =>
      this.shopClosed(closed),
    );
    // A newer version can open the home update modal, and the update a newer save requires
    // closes Start and says what it waits for.
    for (const event of [PHONE_EVENTS.requiredUpdate, PHONE_EVENTS.updatePlate]) {
      onWindowEvent(this, event, () => {
        if (this.sys.isActive()) {
          this.render();
        }
      });
    }
    onSceneEvent(this, this.events, "resume", () => this.render());
    // A tap made while another tap's act opened help, settings or stats over this screen is
    // dropped, so it cannot act once the screen resumes, as is a press waiting for the art and
    // a press still down, whose release lands on the overlay. The dip of the tap that opened
    // the page plays on under it, on a clock that runs while this screen is paused.
    onSceneEvent(this, this.events, "pause", () => {
      this.pending.forEach((timer) => timer.remove());
      this.pending.clear();
      this.artWait = undefined;
      this.endPlanning();
      this.entry = undefined;
      const lifted = this.closePressed();
      const dipping = this.press?.held === false ? this.press : undefined;
      this.hold = undefined;
      this.overlayPress = undefined;
      this.press = dipping;
      this.pressedTarget = undefined;
      if (lifted) {
        this.render();
      }
      if (dipping !== undefined) {
        // Drawn now, for a tap too quick for a frame to have shown it.
        this.place(this.time.now);
        afterMsUnderOverlay(this, settleDelay(this.time.now, dipping.startedMs), () => {
          if (this.press === dipping) {
            this.press = undefined;
            this.place(this.time.now);
          }
        });
      }
    });
  }
  private homePressDown(pointer: { x: number; y: number }): void {
    addTapBurst(this, pointer.x, pointer.y);
    // The top bar stays lit over an open card, and its buttons take their presses.
    if (
      this.overlay !== undefined &&
      homeBarButtonAt(this.exit, pointer.x, pointer.y) === undefined
    ) {
      this.overlayPress = { x: pointer.x, y: pointer.y };
      if (this.closePressed() || this.updatePressed()) {
        this.render();
      }
      return;
    }
    this.pressedTarget = this.targetAt(pointer.x, pointer.y);
    const kind = this.pressedTarget?.kind;
    this.hold =
      kind === "dog" || kind === "gear" || kind === "walker"
        ? startHold(
            holdRule(gameData.tuning, TILE_SLOP_PX),
            { x: pointer.x, y: pointer.y },
            this.time.now,
          )
        : undefined;
    this.press =
      this.pressedTarget === undefined
        ? undefined
        : { held: true, id: targetId(this.pressedTarget), startedMs: this.time.now };
  }
  private homePressMove(pointer: { x: number; y: number; isDown: boolean }): void {
    if (this.hold !== undefined && pointer.isDown) {
      this.hold = moveHold({ x: pointer.x, y: pointer.y }, this.hold);
    }
  }
  private homePressUp(
    pointer: {
      x: number;
      y: number;
    },
    cancelled: boolean,
  ): void {
    const down = this.overlayPress;
    const controlDown = this.closePressed() || this.updatePressed();
    this.overlayPress = undefined;
    if (down !== undefined) {
      if (!cancelled) {
        this.releaseOnOverlay(down, pointer.x, pointer.y);
      }
      // A press on a control that ended elsewhere lifts it again.
      if (controlDown && this.overlay !== undefined) {
        this.render();
      }
      return;
    }
    const target = cancelled ? undefined : this.targetAt(pointer.x, pointer.y);
    const pressed = this.pressedTarget;
    const release = this.hold === undefined ? "tap" : releaseHold(this.time.now, this.hold);
    this.hold = undefined;
    this.pressedTarget = undefined;
    if (this.press !== undefined) {
      this.press.held = false;
    }
    if (target === undefined || pressed === undefined || targetId(target) !== targetId(pressed)) {
      return;
    }
    if (release === "hold") {
      this.openDetail(pressed);
    } else if (release === "tap") {
      this.actAfterDip(target);
    }
  }
  private onKey({ code, shiftKey }: Pick<KeyboardEvent, "code" | "shiftKey">): void {
    if (!this.nativeReady || (this.overlay === undefined && this.nativeHome?.accepts() !== true)) {
      return;
    }
    if (this.overlay !== undefined) {
      if (isConfirmKey(code) && "update" in this.overlay) {
        acceptUpdate();
      } else if (isPauseKey(code) || isConfirmKey(code)) {
        this.closeOverlay();
      }
      return;
    }
    const direction = focusDirectionForKey(code);
    if (direction !== undefined) {
      const rows = focusRows(this.shownControls());
      this.focus = moveFocus(
        rows.map((row) => row.length),
        direction,
        this.focus,
      );
      this.action = this.focusAction(this.focused()?.target);
      this.render();
      return;
    }
    if (isConfirmKey(code)) {
      const target = this.focused()?.target ?? { kind: "start" };
      this.press = { held: false, id: targetId(target), startedMs: this.time.now };
      this.actAfterDip(target);
      return;
    }
    if (isHelpKey(shiftKey, code)) {
      this.act({ kind: "help" });
    } else if (code === "KeyS") {
      this.act({ kind: "settings" });
    } else if (code === "KeyL") {
      this.act({ kind: "logbook" });
    } else if (isMuteKey(code)) {
      this.act({ kind: "mute" });
    } else if (isExitKey(code) && this.exit) {
      this.act({ kind: "exit" });
    }
  }
  private save(): SaveDocument {
    return profileSave(this);
  }
  // The focused item, its column kept inside its row: the top row loses the dog slot sign once
  // the last slot is bought.
  private focused(): Focusable | undefined {
    if (this.focus === null) {
      return undefined;
    }
    const row = focusRows(this.shownControls())[this.focus.row] ?? [];
    return row[clampIndex(row.length, this.focus.column)];
  }
  // Whether the dog slot sign shows: while a dog slot is for sale.
  private signShown(): boolean {
    const { bankCents, owned } = this.save();
    return slotSign(gameData, owned, bankCents) !== null;
  }
  // CREATE fires after Phaser marks the scene active, so a waiting offer opens on this visit.
  private prepareArrival(): void {
    arriveHome();
    this.events.once(Scenes.Events.CREATE, () => this.render());
  }
  // Whether the update notice is eligible: a newer version waits, or its notice opened this visit.
  private updateOffered(): boolean {
    return (
      requiredUpdate() === undefined &&
      !updateAccepting() &&
      (updatePlateShown() || this.shownUpdate)
    );
  }
  // The dog slot sign comes and goes while a slot is for sale.
  private shownControls(): {
    sign: boolean;
  } {
    return { sign: this.signShown() };
  }
  // A focused dog or gear item in words, so a keyboard player has what a hold shows, and a
  // walker's agility and perk or goal, as a tap says them.
  private focusAction(target: Target | undefined): HomeAction {
    const { bankCents, owned } = this.save();
    if (target?.kind === "dog") {
      return { kind: "focus", text: dogInfo(gameData, owned, bankCents, target.dog) };
    }
    if (target?.kind === "gear") {
      return { kind: "focus", text: gearInfo(gameData, owned, bankCents, target.gear) };
    }
    if (target?.kind === "walker") {
      // With none picked, a tap never drops, so the focus always has words.
      const tap = tapWalker(gameData, owned, null, target.walker);
      return tap.kind === "drop" ? { kind: "none" } : { kind: "focus", text: tap.text };
    }
    return { kind: "none" };
  }
  private openDetail(target: Target): void {
    if (target.kind !== "dog" && target.kind !== "gear" && target.kind !== "walker") {
      return;
    }
    this.press = undefined;
    this.overlay = { rect: undefined, target };
    this.render();
  }
  private closeOverlay(): void {
    const update = this.overlay !== undefined && "update" in this.overlay;
    this.overlay = undefined;
    if (update) {
      dismissUpdateOffer();
    }
    this.render();
  }
  // Whether the press under way started on the open card's close control.
  private closePressed(): boolean {
    const rect = this.overlay?.rect;
    const down = this.overlayPress;
    return (
      rect !== undefined &&
      down !== undefined &&
      containsPoint(closeControl(rect).hit, down.x, down.y)
    );
  }
  private updateTitle(): string {
    const text = gameData.homeText.update;
    return updateAcceptanceFailed() ? text.failure : text.title;
  }
  private updateLayout() {
    const { button } = gameData.homeText.update;
    const title = this.updateTitle();
    const ink = {
      action: modalTextWidth(this, "title", [button]),
      cancel: modalTextWidth(this, "title", [gameData.homeText.shop.confirmCancel]),
      title: modalTextWidth(this, "title", [title]),
    };
    const layout = updateModalLayout(HOME_REGION, ink);
    const { extraHeight } = measureModalTitle(
      this,
      barTitleRoom(cardTitleRow(layout.panel), closeControl(layout.panel)),
      title,
    );
    return extraHeight === 0
      ? layout
      : updateModalLayout(HOME_REGION, { ...ink, titleExtraHeight: extraHeight });
  }
  private updatePressed(action?: "cancel" | "update"): boolean {
    const down = this.overlayPress;
    const overlay = this.overlay;
    if (overlay === undefined || !("update" in overlay) || down === undefined) {
      return false;
    }
    const { cancel, hit } = this.updateLayout();
    return (
      (action !== "cancel" && containsPoint(hit, down.x, down.y)) ||
      (action !== "update" && containsPoint(cancel, down.x, down.y))
    );
  }
  // Detail cards close on their body. The update notice acts only on its own controls.
  private releaseOnOverlay(
    down: {
      x: number;
      y: number;
    },
    x: number,
    y: number,
  ): void {
    const overlay = this.overlay;
    const rect = overlay?.rect;
    if (overlay === undefined || rect === undefined) {
      return;
    }
    if ("update" in overlay) {
      const { cancel, hit } = this.updateLayout();
      const close = closeControl(rect).hit;
      if (containsPoint(close, down.x, down.y) && containsPoint(close, x, y)) {
        this.closeOverlay();
      } else if (containsPoint(cancel, down.x, down.y) && containsPoint(cancel, x, y)) {
        this.closeOverlay();
      } else if (containsPoint(hit, down.x, down.y) && containsPoint(hit, x, y)) {
        acceptUpdate();
      }
    } else if (containsPoint(rect, down.x, down.y) && containsPoint(rect, x, y)) {
      this.closeOverlay();
    }
  }
  private targetAt(x: number, y: number): Target | undefined {
    const tile = rectIndexAt(dogTiles(), x, y);
    if (tile !== undefined) {
      return { dog: itemAt(rosterOrder(), tile), kind: "dog" };
    }
    const slot = rectIndexAt(gearSlots(), x, y);
    if (slot !== undefined) {
      return { gear: itemAt(gearIds(), slot), kind: "gear" };
    }
    const walker = rectIndexAt(walkerTiles(), x, y);
    if (walker !== undefined) {
      return { kind: "walker", walker: itemAt(walkerIds(), walker) };
    }
    const bar = homeBarButtons(this.exit).map(([kind, { hit }]): [Rect, Target] => [hit, { kind }]);
    const fixed: readonly [Rect, Target][] = [[START_BUTTON, { kind: "start" }], ...bar];
    if (this.signShown() && containsPoint(SLOT_SIGN.hit, x, y)) {
      return { kind: "slotSign" };
    }
    const control = fixed.find(([rect]) => containsPoint(rect, x, y))?.[1];
    if (control !== undefined) {
      return control;
    }
    // Under the top bar, and over the Pet shop, the bubble and the walker at the gate take taps
    // only on a visit with walkers to name, with a walker picked to name them.
    const naming = this.joined.length > 0 && this.save().walker !== null;
    if (naming && this.bubbleHits.some((hit) => containsPoint(hit, x, y))) {
      return { kind: "bubble" };
    }
    return containsPoint(HOME_LAYOUT.petShop.hit, x, y) ? { kind: "petShop" } : undefined;
  }
  // The shop over everything below the top bar, framing the item tapped.
  private openShop(open: { focus?: Purchase }): void {
    const data: ShopSceneData = { ...open, resume: SCENE_KEYS.start };
    openOverlay(this, SCENE_KEYS.shop, data);
  }
  // The shop's last purchase or refusal, which its plate has said: a bought dog hops in and its
  // owner says a parting line in the walker's bubble.
  private shopClosed(closed: ShopClosed): void {
    const { action } = closed;
    if (action.kind === "bought" && action.purchase.kind === "dog") {
      this.pops.set(targetId({ dog: action.purchase.dog, kind: "dog" }), this.time.now);
      this.drawQuip(action.purchase.dog);
    }
    this.action = action;
    this.render();
  }
  // The speaking owner beside their parting line in the walker's bubble: their happy face over
  // tan in a 1px ink frame, and their name, already set in name, centred under it.
  // A dog's owner says a parting line when it is picked or bought; it is drawn once a visit.
  private drawQuip(dog: DogId): void {
    this.quips.set(dog, partingSpeech(gameData, Math.random, dog));
  }
  // A tap's result, such as the selected state, shows once its press has dipped. A tap that
  // opens a page opens it at once, its dip playing on under the page.
  private actAfterDip(target: Target): void {
    const press = this.press;
    const delay = press === undefined ? 0 : settleDelay(this.time.now, press.startedMs);
    if (delay === 0 || this.opensPage(target)) {
      this.act(target);
      return;
    }
    const timer = this.time.delayedCall(delay, () => {
      this.pending.delete(timer);
      this.act(target);
    });
    this.pending.add(timer);
  }
  // Whether act opens a page for target, or leaves the game: help, the Logbook, the settings or
  // the Pet shop, which a dog or gear not yet bought opens too, and Exit.
  private opensPage(target: Target): boolean {
    switch (target.kind) {
      case "dog":
      case "gear": {
        const { owned } = this.save();
        const tap =
          target.kind === "dog"
            ? tapDog(gameData, owned, target.dog, this.loadout)
            : tapGear(owned, target.gear, this.loadout);
        return tap.kind === "shop";
      }
      case "exit":
      case "help":
      case "logbook":
      case "menu":
      case "petShop":
      case "settings":
      case "slotSign":
        return true;
      case "bubble":
      case "mute":
      case "start":
      case "walker":
        return false;
      default:
        target satisfies never;
        return false;
    }
  }
  private emphasiseRefusal(id: string): void {
    const started = this.refusals.get(id);
    if (started === undefined || this.time.now - started >= REFUSE.flashMs * REFUSE.flashes) {
      this.refusals.set(id, this.time.now);
    }
  }
  private act(target: Target): void {
    if (updateAccepting()) {
      return;
    }
    const id = targetId(target);
    const now = this.time.now;
    switch (target.kind) {
      case "bubble":
        this.tapBubble();
        return;
      case "dog":
      case "gear": {
        const { owned } = this.save();
        const tap =
          target.kind === "dog"
            ? tapDog(gameData, owned, target.dog, this.loadout)
            : tapGear(owned, target.gear, this.loadout);
        if (tap.kind === "shop") {
          this.openShop({ focus: tap.purchase });
        } else if (tap.kind === "full") {
          this.shakes.set(id, now);
          this.action = {
            kind: "notice",
            text: gameData.homeText.noticePackFull,
          };
          this.render();
          this.emphasiseRefusal(id);
        } else {
          this.setLoadout(tap.loadout);
        }
        return;
      }
      case "petShop":
        this.openShop({});
        return;
      case "slotSign": {
        const focus = slotSignPurchase(gameData, this.save().owned);
        this.openShop(focus === null ? {} : { focus });
        return;
      }
      case "walker": {
        // A locked walker shakes and says its goal; nothing else changes. An owned one is
        // picked and says its agility and perk, or unpicked when it was the picked one.
        const save = this.save();
        const tap = tapWalker(gameData, save.owned, save.walker, target.walker);
        if (tap.kind === "locked") {
          this.shakes.set(id, now);
          this.action = { kind: "notice", text: tap.text };
          this.render();
          this.emphasiseRefusal(id);
          return;
        }
        const walker = tap.kind === "pick" ? tap.walker : null;
        if (tap.kind === "pick") {
          this.pops.set(id, now);
        }
        this.action = tap.kind === "pick" ? { kind: "notice", text: tap.text } : { kind: "none" };
        void updateProfile(this, (current) => ({ ...current, walker }));
        this.render();
        return;
      }
      case "menu":
        openHomePage(this, "menu");
        return;
      case "exit":
        exitGame();
        return;
      case "mute":
        this.showMuted(toggleMuted(this));
        return;
      case "help":
        this.afterArt("help", () => openHomePage(this, "help"));
        return;
      case "logbook":
        // The Logbook opens on its first tab, Badges.
        openHomePage(this, "logbook");
        return;
      case "settings":
        openHomePage(this, "settings");
        return;
      case "start":
        this.startWalk();
        return;
      default:
        target satisfies never;
    }
  }
  // The walker says sound went off or on, and the top bar's Sound button follows.
  private showMuted(muted: boolean): void {
    const { noticeSoundOff, noticeSoundOn } = gameData.homeText;
    this.action = { kind: "notice", text: muted ? noticeSoundOff : noticeSoundOn };
    this.render();
  }
  // Picks or drops a dog or gear item, and keeps the result as the last loadout.
  private setLoadout(next: HomeLoadout): void {
    const now = this.time.now;
    for (const dog of next.dogs.filter((picked) => !this.loadout.dogs.includes(picked))) {
      this.pops.set(targetId({ dog, kind: "dog" }), now);
      this.drawQuip(dog);
    }
    if (next.gear !== null && next.gear !== this.loadout.gear) {
      this.pops.set(targetId({ gear: next.gear, kind: "gear" }), now);
    }
    this.loadout = next;
    this.action = { kind: "none" };
    const lastLoadout = { dogs: [...next.dogs], gear: next.gear };
    void updateProfile(this, (save) => ({ ...save, lastLoadout }));
    this.render();
  }
  // Badges earned on launch burst in over the home screen, with the owners of the dogs
  // picked cheering.
  private celebrate(): void {
    const achievements = takeCelebrations(this);
    if (achievements.length === 0) {
      return;
    }
    const data: CelebrationSceneData = {
      achievements,
      owners: [...this.loadout.dogs],
      resume: SCENE_KEYS.start,
    };
    openOverlay(this, SCENE_KEYS.celebration, data);
  }
  // A new player's first walk opens help unless it was read from ?, then sets off when it
  // closes. Before then, a tap shakes the button: the neutral sections' bands say what is
  // missing.
  private startWalk(): void {
    const save = this.save();
    const dogs = packDogsOf(this.loadout.dogs);
    const { walker } = save;
    if (dogs === undefined || walker === null || !this.startOpen(this.sections(save))) {
      this.shakes.set("start", this.time.now);
      this.emphasiseRefusal("start");
      return;
    }
    if (!artReady(this)) {
      this.afterArt("start", () => this.startWalk());
      return;
    }
    const pick: RunPick = {
      dogSlots: save.owned.dogSlots.length,
      loadout: { dogs, gear: this.loadout.gear, walker },
    };
    const go = () => {
      if (this.entry !== undefined) {
        return;
      }
      const entry = {};
      this.entry = entry;
      startWakeLock();
      this.artWait = { action: () => undefined, kind: "start" };
      // Planning has no denominator, so its line travels; paint it before planning blocks.
      this.planning = waitedLoad.begin();
      this.planning.progress(undefined);
      this.render();
      onceSceneEvent(this, this.game.events, Core.Events.POST_RENDER, () => {
        if (this.entry !== entry) {
          return;
        }
        const timer = this.time.delayedCall(0, () => {
          this.pending.delete(timer);
          if (this.entry !== entry) {
            return;
          }
          this.scene.start(SCENE_KEYS.run, runSceneData(nextRunStart(), pick));
        });
        this.pending.add(timer);
      });
    };
    if (!startWalkOpensHelp(save)) {
      go();
      return;
    }
    // The listener is added only if help opens, so a dropped open leaves none behind.
    if (openHelp(this, SCENE_KEYS.start)) {
      onceSceneEvent(this, this.game.events, HELP_CLOSED_EVENT, go);
    }
  }
  // Runs action now if every asset has loaded, else once it has, in place of any press already
  // waiting.
  private endPlanning(): void {
    this.planning?.finish();
    this.planning = undefined;
  }
  private afterArt(kind: "help" | "start", action: () => void): void {
    if (artReady(this)) {
      action();
      return;
    }
    const waiting = this.artWait !== undefined;
    this.artWait = { action, kind };
    if (kind === "start") {
      waitForWalkArt();
    }
    this.render();
    if (!waiting) {
      whenArtReady(this, () => {
        const wait = this.artWait;
        this.artWait = undefined;
        this.render();
        wait?.action();
      });
    }
  }
  override update(): void {
    const now = this.time.now;
    if (this.hold !== undefined) {
      const { fire, press } = tickHold(now, this.hold);
      this.hold = press;
      if (fire && this.pressedTarget !== undefined) {
        this.openDetail(this.pressedTarget);
      }
    }
    this.place(now);
  }
  // Moves what dips, bobs, shakes, hops and pops to where it is at now.
  private place(now: number): void {
    const reduced = currentSettings(this).reducedMotion;
    const refusing = (id: string) => {
      const at = this.refusals.get(id);
      const elapsed = at === undefined ? Infinity : now - at;
      return (
        elapsed >= 0 &&
        elapsed < REFUSE.flashMs * REFUSE.flashes &&
        (reduced || Math.floor(elapsed / REFUSE.flashMs) % 2 === 1)
      );
    };
    const pressed = this.press;
    const dip = (id: string) =>
      pressed?.id === id ? pressDip(pressed.held, now, pressed.startedMs) : 0;
    const shop = this.petShop;
    if (shop !== undefined) {
      shop.iconButton?.setPressed(dip("petShop") > 0);
      shop.shopBoard?.place(reduced, now);
      shop.shopIdle?.update(
        !reduced && this.overlay === undefined && this.artWait === undefined && this.sys.isActive(),
      );
      shop.container.setPosition(
        shakeOffset(reduced, now, this.shakes.get("petShop")),
        shop.iconButton === undefined ? dip("petShop") : 0,
      );
    }
    const scale = uiLayer()?.scale();
    const view = this.nativeView;
    if (scale !== undefined && view !== undefined) {
      for (const model of this.nativeSelections) {
        const item = view.selections.get(model.id);
        model.pictures.forEach((picture, index) => {
          if (picture.tag !== undefined) {
            const frame = this.nativeFrame(picture.key, picture.tag, !picture.moving, now);
            if (frame !== undefined) {
              item?.setFrame(index, frame);
            }
          }
        });
        item?.setOrbit(
          model.tile.kind !== "picked" || reduced
            ? []
            : selectionOrbitSegments(
                this.textures.exists("ui-tile")
                  ? model.rect
                  : insetRect(-HOME_LAYOUT.tileSelectOutset, model.rect),
                this.textures.exists("ui-tile") ? "tile" : "frame",
                now,
              ).map(({ colour, rect }) => ({
                colour: PALETTE[colour],
                rect,
              })),
        );
      }
      if (this.nativeSpeechOwner !== undefined) {
        const frame = this.nativeFrame(this.nativeSpeechOwner, "happy", reduced, now);
        if (frame !== undefined) {
          view.speech.setOwnerFrame(frame);
        }
      }
      const afford = this.nativeFrame("ui-afford", "glint", reduced, now);
      if (afford !== undefined) {
        view.slot?.setAffordFrame(afford);
      }
      view.place(scale, (id) => ({
        faceY: hopOffset(reduced, now, this.pops.get(id)),
        markY: badgePopOffset(reduced, now, this.pops.get(id)),
        refusing: refusing(id),
        x: shakeOffset(reduced, now, this.shakes.get(id)),
        y:
          dip(id) +
          (this.nativeSelections.find((model) => model.id === id)?.tile.kind === "picked"
            ? -FEEDBACK.liftPx
            : 0),
      }));
      const ready = this.startOpen(this.sections(this.save()));
      const waiting = this.artWait?.kind === "start";
      const down = (dip("start") > 0 && ready) || waiting;
      view.start.place(scale, {
        down,
        refusing: refusing("start"),
        waiting,
        x: shakeOffset(reduced, now, this.shakes.get("start")),
        y: down ? 0 : bobOffset(reduced, now, ready),
      });
      view.slot?.place(scale, { pressed: dip("slotSign") > 0, x: 0, y: 0 });
      const gear = this.loadout.gear;
      view.gearBadge?.place(scale, {
        x: 0,
        y:
          gear === null
            ? 0
            : badgePopOffset(reduced, now, this.pops.get(targetId({ gear, kind: "gear" }))),
      });
      this.nativeHome?.setShown(this.sys.isVisible());
    }
    for (const { dog, footY, sprite } of this.gateDogs) {
      sprite.setY(footY + hopOffset(reduced, now, this.pops.get(targetId({ dog, kind: "dog" }))));
    }
  }
  // Text at the 2x body size unless told otherwise.
  // The update notice opens once per home visit while a newer version waits and home is active,
  // and closes once none does.
  private syncUpdateNotice(): void {
    if (!this.updateOffered()) {
      if (this.overlay !== undefined && "update" in this.overlay) {
        this.overlay = undefined;
        if (updateAccepting()) {
          this.shownUpdate = false;
        }
      }
    } else if (this.overlay === undefined && !this.shownUpdate && this.sys.isActive()) {
      this.overlay = { rect: this.updateLayout().panel, update: true };
      this.shownUpdate = true;
    }
  }
  // Whether Start walk takes a walk: the sections are ready and no newer version is required.
  private startOpen(sections: Sections): boolean {
    return startReady(sections) && requiredUpdate() === undefined && !updateAccepting();
  }
  private render(): void {
    const root = this.root;
    if (root === undefined) {
      return;
    }
    root.removeAll(true);
    this.petShop = undefined;
    this.gateDogs = [];
    const save = this.save();
    this.registry.set(LAST_VISIT_BANK_KEY, save.bankCents);
    this.registry.set(LAST_VISIT_WALKERS_KEY, [...save.owned.walkers]);
    // The porch's shadows, under the figures on the canvas.
    const yard = addGraphicsIn(this, root);
    this.drawTopBar(save);
    this.drawPetShop(root, save);
    this.syncUpdateNotice();
    this.drawPackAtGate(root, yard, save);
    this.renderNativeHome(save);
    root.setVisible(this.nativeReady);
    this.drawOverlay(save);
  }
  private renderNativeHome(save: SaveDocument): void {
    const place = htmlPanelPlace(this);
    if (place === undefined) {
      return;
    }
    const { fonts, layer } = place;
    const toGame = (event: PointerEvent) =>
      htmlPanelInput(place).toGame({ x: event.clientX, y: event.clientY });
    this.nativeHome ??= createNativeHomeSession(layer, {
      accepts: () =>
        this.nativeReady && this.sys.isActive() && this.input.enabled && this.overlay === undefined,
      activate: (id) => {
        const target = this.nativeTarget(id);
        if (target !== undefined) {
          this.actAfterDip(target);
        }
      },
      cancel: () => {
        this.hold = undefined;
        this.pressedTarget = undefined;
        if (this.press?.held) {
          this.press = undefined;
        }
      },
      down: (event) => this.homePressDown(toGame(event)),
      move: (event) => this.homePressMove({ ...toGame(event), isDown: event.buttons !== 0 }),
      painted: () => {
        if (!this.nativeReady) {
          this.nativeReady = true;
          this.cameras.main.setVisible(true);
          this.root?.setVisible(true);
          this.topSection?.setShown(true);
          this.game.events.emit(NATIVE_HOME_READY);
        }
      },
      scaled: () => this.place(this.time.now),
      up: (event, cancelled) => this.homePressUp(toGame(event), cancelled),
    });
    const reduced = currentSettings(this).reducedMotion;
    const selection = <Id>(
      ids: readonly Id[],
      rects: Rect[],
      face: (rect: Rect) => Rect,
      target: (id: Id) => Target,
    ) =>
      ids.map((id, index) => {
        const hit = itemAt(rects, index);
        return { feedbackId: targetId(target(id)), hit, id, rect: face(hit) };
      });
    const selections = homeSelectionViews(gameData, fontMetrics(fonts.body), reduced, {
      dogs: selection(rosterOrder(), dogTiles(), dogFace, (dog) => ({ dog, kind: "dog" })),
      gear: selection(gearIds(), gearSlots(), pocketTile, (gear) => ({ gear, kind: "gear" })),
      loadout: this.loadout,
      save,
      walkers: selection(walkerIds(), walkerTiles(), walkerFace, (walker) => ({
        kind: "walker",
        walker,
      })),
    });
    const notices = [
      ...requiredNotice(gameData.homeText, requiredUpdate()),
      ...storageNotice(gameData.homeText, storageState(this)),
    ];
    const speech = homeSpeechView(
      gameData,
      fonts.body,
      downTail((key) => this.textures.exists(key)),
      noticeOrSpeech(notices, this.speech(save)),
    );
    this.bubbleHits.push(speech.rect);
    const sign = slotSign(gameData, save.owned, save.bankCents);
    const focused = this.focused();
    const gear = this.loadout.gear;
    const smallGearKey = gear === null ? undefined : gearSmallIconKey(gear);
    const smallGear = smallGearKey !== undefined && this.textures.exists(smallGearKey);
    const gearKey = gear === null ? undefined : smallGear ? smallGearKey : gearIconKey(gear);
    const gearRect = this.nativeGearRect();
    const manifest = this.cache.json.get(MANIFEST_CACHE_KEY) as
      | {
          sprites?: {
            key: string;
          }[];
        }
      | undefined;
    const sheetKeys = new Set((manifest?.sprites ?? []).map(({ key }) => key));
    const source = {
      artUrl,
      disabledKey: disabledArtKey,
      hasArt: (key: string) => this.textures.exists(key),
      imageSize: (key: string) => {
        const frame = this.textures.getFrame(key);
        return { height: frame?.realHeight ?? 16, width: frame?.realWidth ?? 16 };
      },
      isSheet: (key: string) => sheetKeys.has(key),
      loadSheet,
    };
    const view = createNativeHomeView(
      layer.element.ownerDocument,
      source,
      fonts,
      {
        pillColours: (index) => {
          const kind = pillKind(index);
          return kind === undefined ? undefined : pillColours(kind);
        },
        platePadding: PLATE_PAD,
      },
      {
        bonus: packBonusLine(gameData, this.loadout),
        bubbleInteractive: this.joined.length > 0 && save.walker !== null,
        focus:
          focused === undefined
            ? undefined
            : {
                outset:
                  focused.target.kind === "start"
                    ? Math.min(FOCUS_OUTSET, HOME_LAYOUT.startFocusOutset)
                    : FOCUS_OUTSET,
                rect: focused.rect,
              },
        gearBadge:
          gearKey === undefined || gearRect === undefined || gear === null
            ? undefined
            : {
                fallback: gearPictureFallback(gameData, {
                  gear,
                  scale: 0.5,
                  x: gearRect.x + 1,
                  y: gearRect.y + 1,
                }),
                key: gearKey,
                rect: gearRect,
                scale: smallGear ? 1 : 0.5,
              },
        sections: this.sections(save),
        selections,
        slot: sign === null ? undefined : { crop: HERO_CROP, sign },
        speech,
        start: {
          label: gameData.homeText.startWalk,
          loading: gameData.homeText.startLoading,
          ready: this.startOpen(this.sections(save)),
          waitingAlpha: WAITING_ALPHA,
        },
        streetSign: gameData.homeText.gateSign,
      },
    );
    this.nativeSelections = selections;
    this.nativeSpeechOwner = speech.owner?.key;
    this.nativeView = view;
    this.nativeHome.replace(view, this.topSection?.revealed);
    this.place(this.time.now);
  }
  private nativeTarget(id: string): Target | undefined {
    const targets: Target[] = [
      ...rosterOrder().map((dog): Target => ({ dog, kind: "dog" })),
      ...gearIds().map((gear): Target => ({ gear, kind: "gear" })),
      ...walkerIds().map((walker): Target => ({ kind: "walker", walker })),
      { kind: "bubble" },
      { kind: "start" },
      { kind: "slotSign" },
    ];
    return targets.find((target) => targetId(target) === id);
  }
  private nativeGearRect(): Rect | undefined {
    if (this.loadout.gear === null) {
      return undefined;
    }
    const clear = Math.max(
      GEAR_BADGE.x,
      ...this.loadout.dogs.flatMap((dog, rank) => {
        const placement = itemAt(GATE_SPOTS, rank);
        const footY = WALKER_AT_GATE.footY + placement.footDy;
        const x = WALKER_AT_GATE.x + placement.dx;
        return footY > GEAR_BADGE.y
          ? [x + Math.ceil(spriteMetrics(dogSpriteKey(gameData, dog)).opaqueWidth / 2) + 1]
          : [];
      }),
    );
    return { ...GEAR_BADGE, x: Math.min(clear, PET_SHOP.x - GEAR_BADGE.width) };
  }
  // Each section's state and band text. The saved walker counts as picked, so a first visit
  // needs only a dog.
  private sections(save: SaveDocument): Sections {
    return homeSections(gameData, save.owned, { loadout: this.loadout, walker: save.walker });
  }
  // The detail card over everything else, recording its rect for taps.
  private drawOverlay(save: SaveDocument): void {
    const layer = this.overlayLayer;
    if (layer === undefined) {
      return;
    }
    layer.removeAll(true);
    const overlay = this.overlay;
    if (overlay === undefined || !("update" in overlay)) {
      this.htmlNotice?.destroy();
      this.htmlNotice = undefined;
    }
    if (overlay === undefined || "update" in overlay) {
      this.htmlDetail?.panel?.destroy();
      this.htmlDetail = undefined;
    }
    if (overlay === undefined || this.nativeView === undefined) {
      return;
    }
    if ("update" in overlay) {
      this.drawUpdateModal(layer);
      return;
    }
    const { target } = overlay;
    const card = this.detailCard(save, target);
    const picture = this.detailPicture(target);
    const view = detailView(this, HOME_REGION, { card, kind: target.kind, picture });
    const close = () => this.closeOverlay();
    this.htmlDetail = keepPanel(this.htmlDetail, JSON.stringify([view, this.closePressed()]), () =>
      addHtmlDetailCard(this, view, close, this.closePressed(), {
        area: HOME_REGION,
        dismiss: close,
      }),
    );
    layer.add(addModalShade(this, HOME_REGION));
    this.overlay = { ...overlay, rect: view.card.panel };
  }
  // A dog, gear item or walker's full card, owned or not.
  private detailCard(save: SaveDocument, target: DetailTarget): DetailCard {
    const { bankCents, owned } = save;
    if (target.kind === "dog") {
      return dogDetail(gameData, owned, bankCents, target.dog);
    }
    if (target.kind === "gear") {
      return gearDetail(gameData, owned, bankCents, this.loadout, target.gear);
    }
    return walkerDetail(gameData, owned, target.walker);
  }
  private detailPicture(target: DetailTarget): DetailPicture {
    if (target.kind !== "walker") {
      return purchasePicture(target);
    }
    return {
      fallback: gameData.walkers[target.walker].portraitKey,
      key: walkerPortraitKey(target.walker),
      scale: 1,
    };
  }
  // The shared section owns chrome, currency and controls; this scene supplies its bank.
  private drawTopBar(save: SaveDocument): void {
    if (uiLayer()?.ready() !== true) {
      return;
    }
    if (this.topSection === undefined) {
      this.topSection = addNativeTopSection(this, {
        accepts: () => this.nativeReady,
        buttons: homeBarButtons(this.exit).map(([id]) => id),
        currency: true,
        labels: {
          exit: gameData.homeText.quit.quit,
          menu: gameData.menuText.menu.title,
          mute: gameData.menuText.settings.sound,
          pause: gameData.menuText.pause.title,
        },
        muted: isMuted(this),
        press: (id, metadata) => {
          if (
            ((id === "menu" || id === "mute" || id === "exit") && routeHomeBar(this, id)) ||
            !this.sys.isActive() ||
            !this.input.enabled
          ) {
            return;
          }
          const elapsed =
            metadata.startedAt === undefined
              ? 0
              : Math.max(0, metadata.completedAt - metadata.startedAt);
          this.press = { held: false, id, startedMs: this.time.now - elapsed };
          if (id !== "pause") {
            this.actAfterDip({ kind: id });
          }
        },
      });
      this.topSection?.setShown(false);
    }
    this.topSection?.setAmount(
      dollarAmountText(save.bankCents),
      shortDollarAmountText(save.bankCents),
    );
    this.topSection?.setMuted(isMuted(this));
  }
  // The starter owners waiting at the gate until the first walk; a picked dog has gone to the
  // walker and leaves its owner standing alone.
  private drawPorch(
    root: GameObjects.Container,
    g: GameObjects.Graphics,
    save: SaveDocument,
    reduced: boolean,
  ): void {
    const waiting = porchOwners(gameData, save.stats, this.loadout.dogs).flatMap((owner) => {
      const at = PORCH_SPOTS[owner.dog];
      return at === undefined ? [] : [{ ...owner, at }];
    });
    // Owners first, then the dogs in front of them.
    for (const { at, dog } of waiting) {
      drawShadow(g, PALETTE.darkGreen, at.x, at.footY, 20);
      root.add(addOwnerFigure(this, gameData, reduced, dog, at, ["idle"]));
    }
    for (const { at, dog } of waiting.filter(({ withDog }) => withDog)) {
      const key = dogSpriteKey(gameData, dog);
      const x = at.x + PORCH_DOG_OFFSET.dx;
      const footY = at.footY + PORCH_DOG_OFFSET.footDy;
      drawShadow(g, PALETTE.darkGreen, x, footY, spriteMetrics(key).opaqueWidth);
      root.add(addFigure(this, reduced, "idle", key).sprite.setPosition(x, footY));
    }
  }
  // The walker and pack at the gate on the canvas, their shadows on yard, the walker's bubble over
  // them when bubble is true, and the gear badge.
  private drawPackAtGate(
    root: GameObjects.Container,
    yard: GameObjects.Graphics,
    save: SaveDocument,
  ): void {
    const { footY, x } = WALKER_AT_GATE;
    const reduced = currentSettings(this).reducedMotion;
    this.drawPorch(root, yard, save, reduced);
    const walkerKey = save.walker === null ? undefined : walkerSpriteKey(this, save.walker);
    const dogs = this.loadout.dogs.map((dog, rank) => {
      const placement = itemAt(GATE_SPOTS, rank);
      return {
        dog,
        feet: { footY: footY + placement.footDy, x: x + placement.dx },
        placement,
        rank,
      };
    });
    // With no walker picked, the dogs stand without leashes.
    const figures = new PackFigures(
      this,
      { still: reduced, tag: "walk" },
      walkerKey,
      this.loadout.dogs,
    );
    figures.standInYard(yard, { path: PATH, shadows: false }, { dogs, walker: { footY, x } });
    root.add(figures.layers());
    const walkerSprite = figures.walker?.sprite;
    this.bubbleHits = walkerSprite !== undefined ? [walkerSprite.getBounds()] : [];
    const now = this.time.now;
    for (const { dog, feet } of dogs) {
      const sprite = figures.dogs.get(dog);
      if (sprite !== undefined) {
        this.gateDogs.push({ dog, footY: feet.footY, sprite });
      }
      // A dog that just joined hops onto the path in a puff of dust.
      const popped = this.pops.get(targetId({ dog, kind: "dog" }));
      if (!reduced && popped !== undefined && now - popped < FEEDBACK.dustFrameMs) {
        playEffect(this, "fx-dust", "play", { x: feet.x, y: feet.footY - 6 }, 0);
      }
    }
  }
  // The walker's own line (walkerSays): with walkers unlocked since the last visit, the one
  // bubbleTurn has reached.
  private walkerSaid(save: SaveDocument): string {
    if (save.walker === null) {
      return walkerSays(gameData, "noWalker", null);
    }
    if (this.joined.length === 0) {
      return walkerSays(gameData, this.walkerLine, null);
    }
    const { joined, line } = bubbleTurnLine(this.joined, this.usualLine, this.bubbleTurn);
    return walkerSays(gameData, line, joined);
  }
  // What the walker's bubble says (bubbleSpeech).
  private speech(save: SaveDocument): ReturnType<typeof bubbleSpeech> {
    const state = { action: this.action, loadout: this.loadout };
    return bubbleSpeech(gameData.homeText, this.walkerSaid(save), state, this.quips);
  }
  // A tap on the bubble or the walker at the gate: while the walker's own line shows, the next
  // turn (tappedBubbleTurn); else the message or owner's line clears and the walker's line
  // comes back.
  private tapBubble(): void {
    const save = this.save();
    const speech = this.speech(save);
    const own = speech.owner === null && speech.paragraphs.join("") === this.walkerSaid(save);
    this.bubbleTurn = tappedBubbleTurn(this.bubbleTurn, own);
    this.action = { kind: "none" };
    this.quips.clear();
    this.render();
  }
  // A waiting version opens once per home visit. Closing leaves the home screen usable; Update
  // now takes the waiting version (acceptUpdate).
  private drawUpdateModal(root: GameObjects.Container): void {
    const { button, cancel, panel } = this.updateLayout();
    const text = gameData.homeText.update;
    // Canvas actors and native controls each receive their existing palette treatment.
    if (this.htmlNotice !== undefined) {
      root.add(addModalShade(this, HOME_REGION));
      return;
    }
    const update = { label: text.button, press: acceptUpdate, primary: true, rect: button };
    const close = () => this.closeOverlay();
    const entries = [
      { label: gameData.homeText.shop.confirmCancel, press: close, primary: false, rect: cancel },
      update,
    ];
    const card = addHtmlModalCard(this, panel, this.updateTitle(), entries, close, {
      label: gameData.menuText.common.close,
      primary: false,
    });
    if (card !== undefined) {
      this.htmlNotice = card;
      this.events.once(Scenes.Events.SHUTDOWN, () => {
        this.htmlNotice = undefined;
      });
      root.add(addModalShade(this, HOME_REGION));
    }
  }
  // The Pet shop on the yard's right lot: ui-pet-shop, its front sinking while pressed, under
  // ui-pet-shop-board, which bobs while up, with the gold outline while anything inside is
  // affordable. Drawn in code while the art is missing, when the whole building dips instead.
  private drawPetShop(root: GameObjects.Container, save: SaveDocument): void {
    const container = this.add.container(0, 0);
    root.add(container);
    const view: NonNullable<StartScene["petShop"]> = { container };
    this.petShop = view;
    maskToRect(this, HERO_MASK_KEY, HERO_CROP, view.container);
    const faces = this.addPressFaces(SHOP_ART.petShop, PET_SHOP);
    if (faces !== undefined) {
      const [normal, pressed] = faces;
      view.container.add(faces);
      const idle = addShopIdle(this, view.container, faces);
      if (idle !== undefined) {
        view.shopIdle = idle;
      }
      const shop: IconButton = idle ?? {
        setPressed: (down) => {
          normal.setVisible(!down);
          pressed.setVisible(down);
        },
      };
      // The board draws over the door-wave.
      const board = this.addPressFaces(SHOP_ART.petShopBoard, PET_SHOP_BOARD);
      if (board === undefined) {
        view.iconButton = shop;
      } else {
        view.container.add(board);
        view.shopBoard = addShopBoard(shop, board);
        view.iconButton = view.shopBoard;
      }
      view.iconButton.setPressed(false);
    } else {
      drawPetShopFallback(this, view.container, PET_SHOP, gameData.homeText.shop.title);
    }
    if (shopAffordable(gameData, save.owned, save.bankCents)) {
      addAffordFrame(this, view.container, PET_SHOP, currentSettings(this).reducedMotion);
    }
  }
  // The dog slot sign hung across the Pet shop's front while a dog slot is for sale: ui-slot-sign,
  // its board and text dropping while pressed, with its call to buy over the cheapest slot's price,
  // and the gold outline while the bank covers that slot. A cream board in
  // an ink frame stands in while the art is missing, when the whole sign dips instead.
  // key's normal and pressed faces with their top-left corner at at, or none, with nothing left
  // drawn, while either is missing.
  private addPressFaces(
    key: string,
    at: {
      x: number;
      y: number;
    },
  ): [GameObjects.Image, GameObjects.Image] | undefined {
    const normal = addTagImage(this, key, "normal", at.x, at.y);
    const pressed = addTagImage(this, key, "pressed", at.x, at.y);
    if (normal === undefined || pressed === undefined) {
      normal?.destroy();
      pressed?.destroy();
      return undefined;
    }
    return [normal, pressed];
  }
}
