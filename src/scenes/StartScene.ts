import { clampIndex } from "@andornaut/game-kit/runtime/arrays";
import { containsPoint, type Rect } from "@andornaut/game-kit/runtime/rect";
import { Core, type GameObjects, Scene, Scenes, type Time } from "phaser";

import { walkerPortraitKey } from "../assets/index.ts";
import { clearRunOverrides } from "../cheats/dom/index.ts";
import type { DogId, WalkerId } from "../data/ids.ts";
import { gameData } from "../data/index.ts";
import { startWalkOpensHelp } from "../help/index.ts";
import { createNativeHomeSession, type NativeHomeView } from "../home/dom/index.ts";
import {
  answerPurchase,
  badgePopOffset,
  bankAtLastVisit,
  bobOffset,
  bubbleSpeech,
  bubbleTurnLine,
  type DetailPicture,
  dogInfo,
  FEEDBACK,
  type Focus,
  gearInfo,
  type HomeAction,
  homeBackAction,
  type HomeLoadout,
  homeSections,
  type HomeSelectionView,
  hopOffset,
  itemModal,
  moveFocus,
  newlyAffordable,
  overlayRegion,
  partingSpeech,
  type PendingPurchase,
  pressDip,
  type Purchase,
  type Sections,
  settleDelay,
  shakeOffset,
  slotSign,
  slotSignPurchase,
  tapDog,
  tapGear,
  tappedBubbleTurn,
  tapWalker,
  walkerDetail,
  type WalkerLine,
  walkerLineKey,
  walkerSays,
  walkersUnlockedSince,
} from "../home/index.ts";
import { nativeFrames, renderHomeBackdrop } from "../home/phaser/index.ts";
import {
  focusDirectionForKey,
  type HoldPress,
  holdRule,
  isExitKey,
  isForegroundConfirmKey,
  isHelpKey,
  isMuteKey,
  isPauseKey,
  menuKeyActs,
  moveHold,
  releaseHold,
  sceneKeyAllowed,
  screenArea,
  startHold,
  tickHold,
  TILE_SLOP_PX,
} from "../input/index.ts";
import {
  exitShown,
  installNudgeDue,
  noteInstallNudged,
  PHONE_EVENTS,
  requestGameUpdateCheck,
  requiredUpdate,
  stopWakeLock,
  updateAccepting,
} from "../pwa/index.ts";
import { type SaveDocument, walksFinished, walksPlayed } from "../save/index.ts";
import { packDogsOf } from "../state/index.ts";
import { type NativeTopSection, uiLayer } from "../ui/dom/index.ts";
import { refusalRed, REFUSE } from "../ui/index.ts";
import type { Cents } from "../units.ts";
import { artReady } from "./boot/artReady.ts";
import type { CelebrationSceneData } from "./CelebrationScene.ts";
import { CHEATS_CHANGED_EVENT, clearNextWalkAfterWalk } from "./cheatChoices.ts";
import { exitGame, HOME_PAGE_OPENING_EVENT, openHomePage } from "./homeBarPress.ts";
import { detailView } from "./homePanels.ts";
import { purchasePicture } from "./itemArt.ts";
import { NATIVE_HOME_READY } from "./nativeHomeReady.ts";
import { listenOnePress } from "./onePress.ts";
import {
  BAR_MUTED_EVENT,
  listenOutsideTap,
  onBackPressed,
  onSceneEvent,
  onWindowEvent,
  openOverlay,
  type OverlayData,
} from "./overlay.ts";
import { afterMsUnderOverlay } from "./overlayClock.ts";
import {
  currentSettings,
  onSettingsChanged,
  profileSave,
  purchaseInProfile,
  takeCelebrations,
  toggleMuted,
  updateProfile,
} from "./profileStore.ts";
import {
  addHtmlDetailCard,
  htmlPanelInput,
  htmlPanelPlace,
  keepPanel,
  type KeptPanel,
} from "./questionPanel.ts";
import type { RunPick } from "./run/runStart.ts";
import { SCENE_KEYS } from "./sceneKeys.ts";
import { SETTINGS_CLOSED_EVENT } from "./SettingsScene.ts";
import {
  SHOP_CHANGED_EVENT,
  SHOP_CLOSED_EVENT,
  type ShopClosed,
  type ShopSceneData,
} from "./ShopScene.ts";
import { createStartHomeView } from "./start/nativeHome.ts";
import {
  type DetailTarget,
  focusRows,
  homeTargetAt,
  nativeTarget,
  type Target,
  targetId,
} from "./start/targets.ts";
import { createStartTopBar, refreshStartTopBar } from "./start/topBar.ts";
import { createWalkLaunch } from "./start/walkLaunch.ts";
import { drawStartGate, drawStartShop, type GateDog, type YardShop } from "./start/yard.ts";
import { addGraphicsIn, addTapBurst } from "./uiKit.ts";
const HOME_REGION = overlayRegion("home");
// A held item's detail card, above the home screen.
interface Overlay {
  rect: Rect | undefined;
  target: DetailTarget;
}
// The heart after the Dogs band's pack-size bonus.
// The bank the last time the home screen was shown this session, so the walker can say
// when something new became affordable.
const LAST_VISIT_BANK_KEY = "homeLastVisitBank";
// The walkers owned the last time the home screen was shown this session, so the walker can
// say when one has just been unlocked. A session's first visit has none to compare with.
const LAST_VISIT_WALKERS_KEY = "homeLastVisitWalkers";
// The screen before a walk: the bank at the top bar's left and Logbook, Help, Sound, Settings
// and Exit at its right (Exit where exitShown); the walker and pack at the gate beside the Pet
// shop; the Walker, Dogs and Pocket sections and Start walk. Affordable items open their detail
// purchase actions, while the building and unavailable item routes open
// it on that item. Holding a dog or gear tile opens its detail card.
// The arrow keys move a focus ring, Enter or Space picks, Escape, P or back closes a card, ?
// opens help, S settings, L the logbook, M mutes and Q leaves the game as Exit does, where the
// top bar shows Exit. Start walk and help wait for boot to load the rest of the art, which it
// does behind this screen. Native controls sit above the canvas yard and its actors.
export class StartScene extends Scene {
  // The last action, for the message line and the bubble.
  private action: HomeAction = { kind: "none" };
  private launch!: ReturnType<typeof createWalkLaunch>;
  // Whether keyboard Quit is offered by the current browser or installed window.
  private exit = true;
  private focus: Focus | null = null;
  private gateDogs: GateDog[] = [];
  // A press on a dog or gear tile that may become a hold.
  private hold: HoldPress | undefined;
  private loadout: HomeLoadout = { dogs: [], gear: null };
  private overlay: Overlay | undefined;
  // The detail card drawn in HTML, while one is open.
  private htmlDetail: KeptPanel | undefined;
  private detailFocus: string | undefined;
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
  private petShop: YardShop | undefined;
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
    requestGameUpdateCheck();
    // Back from a walk, the next walk's choices are off.
    clearNextWalkAfterWalk(this);
    this.action = { kind: "none" };
    this.pending = new Set();
    this.launch = createWalkLaunch(this, { pending: this.pending, redraw: () => this.render() });
    this.events.once("shutdown", this.launch.finishPlanning);
    this.exit = exitShown();
    this.focus = null;
    this.hold = undefined;
    // The scene's shutdown destroyed any HTML card.
    this.htmlDetail = undefined;
    this.detailFocus = undefined;
    this.overlay = undefined;
    this.overlayPress = undefined;
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
          this.homePressDown(false, point);
        }
      },
      move: (point) => this.homePressMove(point),
      up: (point, cancelled) => this.homePressUp(point, cancelled),
    });
    // A tap outside an open panel closes it: the panel's backdrop takes the game frame, the
    // dimmed top bar included, and this takes the page beside the game.
    listenOutsideTap(
      this,
      () => {
        const rect = this.overlay?.rect;
        return rect === undefined ? undefined : screenArea([rect]);
      },
      () => this.closeOverlay(),
    );
    // Back closes an open detail card, as Escape does, and with none asks Quit? where Exit is
    // offered.
    onBackPressed(this, () => {
      const action = homeBackAction(this.exit, this.overlay !== undefined);
      if (action === "closeDetail") {
        this.closeOverlay();
      } else if (action === "askQuit") {
        const data: OverlayData = { resume: SCENE_KEYS.start };
        openOverlay(this, SCENE_KEYS.quit, data);
      }
    });
    // A held key acts once, so an Enter held from the end screen cannot start a walk.
    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
      if (!sceneKeyAllowed(event)) {
        return;
      }
      if (menuKeyActs(event.repeat, event.code)) {
        if (focusDirectionForKey(event.code) !== undefined || isForegroundConfirmKey(event.code)) {
          event.preventDefault();
        }
        this.onKey(event);
      }
    });
    // Badges earned on launch: a scene can pause itself only once it is running.
    this.time.delayedCall(0, () => this.celebrate());
    onSettingsChanged(this, ({ muted }) => this.topSection?.setMuted(muted));
    // Settings can change reduced motion or mute, so the screen is drawn again.
    onSceneEvent(this, this.game.events, SETTINGS_CLOSED_EVENT, () => this.render());
    onSceneEvent(this, this.game.events, CHEATS_CHANGED_EVENT, () => this.render());
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
    // The update a newer save requires closes Start and says what it waits for, and Update now
    // closes it while it switches.
    for (const event of [PHONE_EVENTS.requiredUpdate, PHONE_EVENTS.updateReady]) {
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
      // The Start control focused as an overlay opens is focused again once it closes.
      this.nativeHome?.holdFocus();
      this.pending.forEach((timer) => timer.remove());
      this.pending.clear();
      this.launch.cancel();
      const dipping = this.press?.held === false ? this.press : undefined;
      this.hold = undefined;
      this.overlayPress = undefined;
      this.press = dipping;
      this.pressedTarget = undefined;
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
  private homePressDown(native: boolean, pointer: { x: number; y: number }): void {
    addTapBurst(this, pointer.x, pointer.y);
    // Over an open card the top bar is dimmed and inactive with the rest of the home screen.
    if (this.overlay !== undefined) {
      this.overlayPress = { x: pointer.x, y: pointer.y };
      return;
    }
    this.pressedTarget = this.targetAt(pointer.x, pointer.y);
    this.hold =
      this.pressedTarget !== undefined && !native
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
    native = false,
  ): boolean {
    const down = this.overlayPress;
    this.overlayPress = undefined;
    if (down !== undefined) {
      if (!cancelled) {
        this.releaseOnOverlay(down, pointer.x, pointer.y);
      }
      return true;
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
      return true;
    }
    // The native button owns the click, after this matching release clears the game press.
    if (
      native &&
      (pressed.kind === "start" ||
        pressed.kind === "slotSign" ||
        pressed.kind === "walker" ||
        pressed.kind === "dog" ||
        pressed.kind === "gear")
    ) {
      return false;
    }
    if (release === "hold") {
      this.dispatchHeld(pressed);
    } else if (release === "tap") {
      this.actAfterDip(target);
    }
    return true;
  }
  private dispatchHeld(target: Target): void {
    if (target.kind === "dog" || target.kind === "gear" || target.kind === "walker") {
      this.openDetail(target);
      return;
    }
    this.hold = undefined;
    this.pressedTarget = undefined;
    if (this.press !== undefined) {
      this.press.held = false;
    }
    this.actAfterDip(target);
  }
  private onKey({
    code,
    shiftKey,
    target: origin,
  }: Pick<KeyboardEvent, "code" | "shiftKey"> & Partial<Pick<KeyboardEvent, "target">>): void {
    if (!this.nativeReady || (this.overlay === undefined && this.nativeHome?.accepts() !== true)) {
      return;
    }
    if (this.overlay !== undefined) {
      if (isPauseKey(code) || isForegroundConfirmKey(code)) {
        this.closeOverlay();
      }
      return;
    }
    const direction = focusDirectionForKey(code);
    if (direction !== undefined) {
      const rows = this.keyboardRows();
      if (origin != null && this.topSection?.element.contains(origin as Node)) {
        const buttons = [...this.topSection.element.querySelectorAll<HTMLButtonElement>("button")];
        const column = buttons.findIndex((button) => button.contains(origin as Node));
        if (column !== -1) {
          this.focus = { column, row: 0 };
        }
      }
      this.focus = moveFocus(
        rows.map((row) => row.length),
        direction,
        this.focus,
      );
      this.action = this.focusAction(this.focused());
      this.nativeHome?.element.focus();
      const target = this.focused();
      this.detailFocus = target === undefined ? undefined : targetId(target);
      this.render();
      if (target?.kind === "menu" || target?.kind === "mute" || target?.kind === "exit") {
        const section = this.topSection;
        const id = target.kind;
        void section?.revealed.then((ready) => {
          if (
            ready &&
            section !== undefined &&
            this.topSection === section &&
            this.focused()?.kind === id
          ) {
            const index = [...section.buttons.keys()].indexOf(id);
            section.element.querySelectorAll<HTMLButtonElement>("button")[index]?.focus();
          }
        });
      }
      return;
    }
    if (isForegroundConfirmKey(code)) {
      const target = this.focused() ?? { kind: "start" };
      this.press = { held: false, id: targetId(target), startedMs: this.time.now };
      this.actAfterDip(target);
      return;
    }
    if (isHelpKey(shiftKey, code)) {
      this.act({ kind: "help" });
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
  private keyboardRows(): Target[][] {
    const bar = [...(this.topSection?.buttons.keys() ?? [])].flatMap((kind): Target[] =>
      kind === "menu" || kind === "mute" || kind === "exit" ? [{ kind }] : [],
    );
    return [...(bar.length === 0 ? [] : [bar]), ...focusRows(this.shownControls())];
  }
  private focused(): Target | undefined {
    if (this.focus === null) {
      return undefined;
    }
    const row = this.keyboardRows()[this.focus.row] ?? [];
    return row[clampIndex(row.length, this.focus.column)];
  }
  // Whether the dog slot sign shows: while a dog slot is for sale.
  private signShown(): boolean {
    const { bankCents, owned } = this.save();
    return slotSign(gameData, owned, bankCents) !== null;
  }
  // CREATE fires after Phaser marks the scene active, so this render sees the screen active.
  private prepareArrival(): void {
    this.events.once(Scenes.Events.CREATE, () => this.render());
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
  private openDetail(target: Target | Extract<Purchase, { kind: "dogSlot" }>): void {
    if (
      target.kind !== "dog" &&
      target.kind !== "gear" &&
      target.kind !== "walker" &&
      target.kind !== "dogSlot"
    ) {
      return;
    }
    this.press = undefined;
    this.overlay = { rect: undefined, target };
    this.render();
  }
  private closeOverlay(): void {
    const target = this.overlay?.target;
    this.overlay = undefined;
    this.detailFocus =
      target === undefined ? undefined : target.kind === "dogSlot" ? "slotSign" : targetId(target);
    this.render();
  }
  // Detail cards close on their body.
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
    if (containsPoint(rect, down.x, down.y) && containsPoint(rect, x, y)) {
      this.closeOverlay();
    }
  }
  private targetAt(x: number, y: number): Target | undefined {
    return homeTargetAt(
      {
        bubbleHits: this.bubbleHits,
        exit: this.exit,
        naming: () => this.joined.length > 0 && this.save().walker !== null,
        signShown: () => this.signShown(),
      },
      x,
      y,
    );
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
          if (itemModal(gameData, this.save(), this.loadout, tap.purchase).pending !== undefined) {
            this.openDetail(tap.purchase);
          } else {
            this.openShop({ focus: tap.purchase });
          }
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
        if (
          focus !== null &&
          itemModal(gameData, this.save(), this.loadout, focus).pending !== undefined
        ) {
          this.openDetail(focus);
        } else {
          this.openShop(focus === null ? {} : { focus });
        }
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
        this.launch.afterArt("help", () => openHomePage(this, "help"));
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
  private celebrate(owners: readonly DogId[] = this.loadout.dogs): void {
    const achievements = takeCelebrations(this);
    if (achievements.length === 0) {
      return;
    }
    const data: CelebrationSceneData = {
      achievements,
      owners: [...owners],
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
    if (dogs === undefined || walker === null || this.startUnavailable(this.sections(save))) {
      this.shakes.set("start", this.time.now);
      this.emphasiseRefusal("start");
      return;
    }
    if (!artReady(this)) {
      this.launch.afterArt("start", () => this.startWalk());
      return;
    }
    const pick: RunPick = {
      dogSlots: save.owned.dogSlots.length,
      loadout: { dogs, gear: this.loadout.gear, walker },
    };
    this.launch.begin(startWalkOpensHelp(save), pick);
  }
  override update(): void {
    const now = this.time.now;
    if (this.hold !== undefined) {
      const target = this.pressedTarget;
      const current = this.targetAt(this.hold.start.x, this.hold.start.y);
      if (
        this.nativeHome?.accepts() !== true ||
        target === undefined ||
        current === undefined ||
        targetId(current) !== targetId(target)
      ) {
        this.hold = undefined;
        this.pressedTarget = undefined;
        if (this.press !== undefined) {
          this.press.held = false;
        }
      } else {
        const { fire, press } = tickHold(now, this.hold);
        this.hold = press;
        if (fire) {
          this.dispatchHeld(target);
        }
      }
    }
    this.place(now);
  }
  // Moves what dips, bobs, shakes, hops and pops to where it is at now.
  private place(now: number): void {
    const reduced = currentSettings(this).reducedMotion;
    const refusing = (id: string) => {
      const at = this.refusals.get(id);
      return at !== undefined && refusalRed(reduced, now - at);
    };
    const pressed = this.press;
    const dip = (id: string) =>
      pressed?.id === id ? pressDip(pressed.held, now, pressed.startedMs) : 0;
    const shop = this.petShop;
    if (shop !== undefined) {
      const down = dip("petShop") > 0;
      shop.iconButton?.setPressed(down);
      shop.focusFallback?.setVisible(!down);
      shop.shopBoard?.place(reduced, now);
      shop.shopIdle?.update(
        !reduced &&
          this.overlay === undefined &&
          this.launch.waiting() === undefined &&
          this.sys.isActive(),
      );
      shop.container.setPosition(0, shop.iconButton === undefined ? dip("petShop") : 0);
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
        pressed: dip(id) > 0,
        refusing: refusing(id),
        x: shakeOffset(reduced, now, this.shakes.get(id)),
        y:
          dip(id) +
          (this.nativeSelections.find((model) => model.id === id)?.tile.kind === "picked"
            ? -FEEDBACK.liftPx
            : 0),
      }));
      const ready = this.startUnavailable(this.sections(this.save())) === undefined;
      const waiting = this.launch.waiting() === "start";
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
  // Use the visible pick headings as the reason when a required selection is missing.
  private startUnavailable(sections: Sections): string | undefined {
    if (requiredUpdate() !== undefined || updateAccepting()) {
      return gameData.homeText.noticeUpdateNeeded;
    }
    if (sections.walker.state !== "complete") {
      return sections.walker.heading;
    }
    return sections.dogs.state === "complete" ? undefined : sections.dogs.heading;
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
    this.petShop = drawStartShop(
      this,
      { focus: () => this.focused()?.kind === "petShop", root },
      save,
    );
    const gate = drawStartGate(this, { pops: this.pops, root, save, yard }, this.loadout);
    this.bubbleHits = gate.bubbleHits;
    this.gateDogs = gate.gateDogs;
    this.renderNativeHome(save);
    root.setVisible(this.nativeReady);
    this.drawOverlay(save);
  }
  private renderNativeHome(save: SaveDocument): void {
    const place = htmlPanelPlace(this);
    if (place === undefined) {
      return;
    }
    const { layer } = place;
    const toGame = (event: PointerEvent) =>
      htmlPanelInput(place).toGame({ x: event.clientX, y: event.clientY });
    const activate = (id: string) => {
      const target = nativeTarget(id);
      if (target !== undefined) {
        this.actAfterDip(target);
      }
    };
    this.nativeHome ??= createNativeHomeSession(layer, {
      accepts: () =>
        this.nativeReady && this.sys.isActive() && this.input.enabled && this.overlay === undefined,
      activate,
      cancel: () => {
        this.hold = undefined;
        this.pressedTarget = undefined;
        if (this.press?.held) {
          this.press = undefined;
        }
      },
      down: (event) => this.homePressDown(true, toGame(event)),
      focused: (id) => {
        const rows = this.keyboardRows();
        for (const [row, controls] of rows.entries()) {
          const column = controls.findIndex((target) => targetId(target) === id);
          if (column !== -1) {
            this.focus = { column, row };
            break;
          }
        }
      },
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
      up: (event, cancelled) => this.homePressUp(toGame(event), cancelled, true),
    });
    const { selections, speech, view } = createStartHomeView(
      this,
      place,
      {
        activate,
        fallbackSpeech: () => this.speech(save),
        hold: (id) => {
          const target = nativeTarget(id);
          if (target !== undefined) {
            this.dispatchHeld(target);
          }
        },
        startUnavailable: (sections) => this.startUnavailable(sections),
      },
      {
        bubbleInteractive: this.joined.length > 0 && save.walker !== null,
        focused: this.focused(),
        loadout: this.loadout,
        reduced: currentSettings(this).reducedMotion,
        save,
        sections: this.sections(save),
      },
    );
    this.bubbleHits.push(speech.rect);
    this.nativeSelections = selections;
    this.nativeSpeechOwner = speech.owner?.key;
    this.nativeView = view;
    this.nativeHome.replace(view, this.topSection?.revealed, this.detailFocus);
    this.detailFocus = undefined;
    this.place(this.time.now);
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
    if (overlay === undefined) {
      this.htmlDetail?.panel?.destroy();
      this.htmlDetail = undefined;
    }
    if (overlay === undefined || this.nativeView === undefined) {
      return;
    }
    const { target } = overlay;
    const item =
      target.kind === "walker" ? undefined : itemModal(gameData, save, this.loadout, target);
    const card =
      target.kind === "walker" ? walkerDetail(gameData, save.owned, target.walker) : item!.card;
    const picture = this.detailPicture(target);
    const layout = () => {
      const view = detailView(this, HOME_REGION, {
        card,
        kind: target.kind,
        picture,
        ...(item === undefined ? {} : { statusLines: item.statusLines }),
        ...(item?.purchase === undefined ? {} : { purchase: item.purchase }),
      });
      if (this.overlay?.target === target) {
        this.overlay = { ...this.overlay, rect: view.card.panel };
      }
      return view;
    };
    const view = layout();
    const close = () => this.closeOverlay();
    const presses = item?.pending === undefined ? [] : [close, () => this.buyDetail(item.pending!)];
    this.htmlDetail = keepPanel(this.htmlDetail, JSON.stringify(view), () =>
      addHtmlDetailCard(this, layout, close, close, presses),
    );
    this.overlay = { ...overlay, rect: view.card.panel };
  }
  private buyDetail(pending: PendingPurchase): void {
    this.overlay = undefined;
    const result = answerPurchase(gameData, this.save(), pending, "buy");
    if (result.kind === "bought") {
      void purchaseInProfile(this, () => result.save);
      this.shopClosed({
        action: { kind: "bought", name: pending.name, purchase: pending.purchase },
      });
      this.celebrate(pending.purchase.kind === "dog" ? [pending.purchase.dog] : []);
    } else {
      this.render();
    }
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
      this.topSection = createStartTopBar(this, {
        accepts: () => this.nativeReady,
        exit: this.exit,
        press: (id, startedMs) => {
          this.press = { held: false, id, startedMs };
          if (id !== "pause") {
            this.actAfterDip({ kind: id });
          }
        },
      });
      this.topSection?.setShown(false);
    }
    if (this.topSection !== undefined) {
      refreshStartTopBar(this, this.topSection, save.bankCents);
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
}
