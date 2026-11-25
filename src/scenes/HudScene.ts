import type { Point, Rect } from "@andornaut/game-kit/runtime/rect";
import { inkWidth } from "@andornaut/game-kit/runtime/text/bitmapFont";
import { fittingText } from "@andornaut/game-kit/runtime/text/textFit";
import { Core, Scene } from "phaser";

import { domArtUrl } from "../assets/domArtFiles.ts";
import { gameData } from "../data/index.ts";
import { SCREEN_CONFIG, SCREEN_LAYOUT } from "../data/screen.ts";
import type { AchievementId, DebuffId, DogId, HintTrigger } from "../data/types.ts";
import { FEEDBACK as MENU_FEEDBACK } from "../home/feedback.ts";
import { charmRing } from "../hud/charmRing.ts";
import { createHudCards, type HudCards } from "../hud/dom/hudCards.ts";
import { createHudChrome } from "../hud/dom/hudChrome.ts";
import { createHudMoments, type HudMoment, type HudMomentPainter } from "../hud/dom/hudMoments.ts";
import {
  projectHudCards,
  projectHudMoments,
  projectHudTopSections,
} from "../hud/dom/hudProjection.ts";
import type { DomQuestionPanel } from "../hud/dom/questionPanel.ts";
import { effectIconKey, type EffectItem, effectItems, perkIconKey } from "../hud/effectIcons.ts";
import { pillKind } from "../hud/effectNames.ts";
import { explainDetail } from "../hud/explain.ts";
import { FEEDBACK } from "../hud/feedback.ts";
import { runHintTriggers } from "../hud/hintTriggers.ts";
import {
  CHANGE_LABEL_STYLE,
  changeChipPlace,
  changeLabelRoom,
  type HudLanes,
  hudLanes,
  REACH_ICON,
  reachChipPlace,
} from "../hud/hudLanes.ts";
import type { ChangeLabel } from "../hud/hudView.ts";
import type { MessageLine } from "../hud/messageStrip.ts";
import { FORGIVEN_EVENT, type ForgivenCue } from "../hud/moments.ts";
import {
  cashChipPlace,
  freeCashSlot,
  LABEL_FADE_MS,
  mergeTips,
  MONEY_LABEL,
  moneyChipPlace,
  moneyFlightPath,
  stackOrders,
} from "../hud/moneyLabels.ts";
import { achievementLine } from "../hud/stripLines.ts";
import {
  pauseButtonIcon,
  playerPaused,
  type RunPause,
  topBarAction,
  topBarKey,
  walkPaused,
} from "../hud/topBar.ts";
import {
  cardHearts,
  type ExplainTarget,
  WALK_BAR_BUTTONS,
  type WalkBarButtonId,
  walkBarLayout,
} from "../hud/walkHud.ts";
import { BUFF_POP, sparkleAt } from "../layout/buffLayout.ts";
import { dollarAmountText, shortDollarAmountText } from "../presentation/currency.ts";
import { ownerMaxHearts } from "../rules/dogs.ts";
import { hintFor, hintJumpsQueue } from "../rules/hints.ts";
import { walkEarnings } from "../rules/run.ts";
import { faceMood } from "../rules/treats.ts";
import { heartsOf, slotIndexOf } from "../state/pack.ts";
import type { RunState } from "../state/runState.ts";
import {
  createNativeTopSection,
  type NativeTopSection,
  type NativeTopSectionConfig,
} from "../ui/dom/nativeTopSection.ts";
import { dimDrawn, followModalUnderlay } from "../ui/dom/rampDim.ts";
import { loadSheet } from "../ui/dom/sheetFrames.ts";
import { uiLayer } from "../ui/dom/uiLayer.ts";
import { displayBitmapFont } from "../ui/phaser/displayText.ts";
import { pixelBitmapFont, pixelFontMetrics } from "../ui/phaser/pixelText.ts";
import { type Cents, cents } from "../units.ts";
import { arcFlight } from "./arcFlight.ts";
import { BumpBorder } from "./bumpBorder.ts";
import { CardScene } from "./CardScene.ts";
import { changeLabelColour } from "./changeLabelColours.ts";
import type { CheatsScene } from "./CheatsScene.ts";
import { DEBUFF_COLOURS } from "./debuffColours.ts";
import { pillColours } from "./effectNameColours.ts";
import { HudFeedback } from "./feedbackMoments.ts";
import { HeartFeedback, heartPops } from "./heartFeedback.ts";
import type { HelpScene } from "./HelpScene.ts";
import { detailView } from "./homePanels.ts";
import { HUD_DEPTH } from "./hudDepth.ts";
import type { HudRun, HudWalk, RunHudView } from "./hudWalk.ts";
import { MESSAGE_EVENT, MessageStrip } from "./messageStripView.ts";
import { createNativePicture } from "./nativePicture.ts";
import { BAR_MUTED_EVENT, onSceneEvent } from "./overlay.ts";
import { OwnerTabs } from "./ownerTabs.ts";
import {
  isMuted,
  markHintShown,
  onSettingsChanged,
  profileSave,
  shownHints,
  toggleMuted,
} from "./profileStore.ts";
import { addHtmlDetailCard } from "./questionPanel.ts";
import { cancelRoadShake } from "./run/hitFx.ts";
import {
  ACHIEVEMENTS_EVENT,
  BUFF_GLINT_EVENT,
  BUMP_FLASH_EVENT,
  CHANGE_LABELS_EVENT,
  HINT_EVENT,
  type OwnerQuip,
  QUIPS_EVENT,
  type RaisedHint,
} from "./run/runMoments.ts";
import { SCENE_KEYS, type SceneKey } from "./sceneKeys.ts";
import { type ScenePicture } from "./scenePicture.ts";
import type { SettingsScene } from "./SettingsScene.ts";
import { soundboardOf } from "./soundboard.ts";
import { TimedGroup } from "./timedGroup.ts";
import { addNativeTopSection, joinTopSection } from "./topSection.ts";
const LAYOUT = SCREEN_LAYOUT;
const BAR = walkBarLayout(LAYOUT.topBar);
// A change label's parts on screen, and its chip's rect.
interface ChangeChip {
  parts: HudMoment[];
  rect: Rect;
}
// The tip label showing by the cash before it goes in: its label, its chip, its slot in the
// cash's column, and the money it keeps off the counter until it lands.
interface ShowingTip {
  chip: ChangeChip;
  held: number;
  label: ChangeLabel;
  slot: number;
}
const NOT_EXPLAINED = { key: "", scene: undefined };
const HEART_TAB_MS = 1200;
interface DebuffBarView {
  debuff: DebuffId;
  rect: Rect;
}
// The HUD shows run's walk and its buttons act on run; a picture of the HUD shows source's walk
// in view's strips, and takes no input or hints.
export type HudSceneData =
  | {
      picture: {
        source: HudWalk;
        stillFrames?: Readonly<Record<string, number>>;
        view: ScenePicture;
      };
    }
  | {
      run: HudRun;
    };
// The walk bar, the debuff bars, the dog cards and the neighbourhood's progress line, drawn over
// the road for the whole walk and kept in view while cards are up. It reads the run every frame and
// redraws what changed, and shows the run's change labels, first-time hints, owners' pop-ins and
// what a held press explains. It keeps running while the walk is paused, so the bar's buttons and
// their keys work in every state; its animations run on too, being the bar's and not the walk's,
// except the walk's moments: while the player has paused, heart pops, change labels, owners'
// pop-ins and the message strip's ageing hold.
export class HudScene extends Scene {
  private cards: HudCards | undefined;
  private chrome: ReturnType<typeof createHudChrome> | undefined;
  private painter: HudMomentPainter | undefined;
  private barPainter: HudMomentPainter | undefined;
  // The walk bar's own marks over it: its effect icons and their glints.
  private iconPainter: HudMomentPainter | undefined;
  private debuffBars: DebuffBarView[] = [];
  private topSection: NativeTopSection | undefined;
  private barButtons = new Map<
    WalkBarButtonId,
    {
      setPressed(pressed: boolean): void;
    }
  >();
  private barPressActive: (() => boolean) | undefined;
  private momentNow = 0;
  private firingNow = 0;
  // What the open explanation explains, and its detail card as drawn, if any.
  private explained: {
    html?: DomQuestionPanel | undefined;
    key: string;
    scene: Scene | undefined;
  } = NOT_EXPLAINED;
  private feedback: HudFeedback | undefined;
  private hearts: HeartFeedback | undefined;
  // The change labels, glints and owners' pop-ins on screen, which hold while the player has
  // paused.
  private labels = new TimedGroup();
  // The slots of the cash's column that money labels showing by the cash hold.
  private cashSlots = new Set<number>();
  private messages: MessageStrip | undefined;
  // The money changes still flying to the cash, which the counter leaves out until they land.
  private moneyInFlight = 0;
  private owners: OwnerTabs | undefined;
  private picture: HudWalk | undefined;
  private run: HudRun | undefined;
  private tip: ShowingTip | undefined;
  // key names a second HUD, such as the help's picture of one.
  constructor(key: string = SCENE_KEYS.hud) {
    super(key);
  }
  private lanes(): HudLanes {
    return hudLanes(LAYOUT);
  }
  create(data: HudSceneData): void {
    const picture = "picture" in data ? data.picture : undefined;
    this.picture = picture?.source;
    this.run = "run" in data ? data.run : undefined;
    const layer = uiLayer();
    const body = pixelBitmapFont(this, "body"),
      title = pixelBitmapFont(this, "title"),
      display = displayBitmapFont(this);
    if (layer === undefined || body === undefined || title === undefined || display === undefined) {
      throw new Error("The native HUD requires its prepared UI context");
    }
    const source = { artUrl: domArtUrl, loadSheet };
    const fonts = { body, display, title };
    const colours = (index: number) => {
      const kind = pillKind(index);
      return kind === undefined ? undefined : pillColours(kind);
    };
    const hasArt = (key: string) => this.textures.exists(key);
    const projection =
      picture === undefined
        ? { dispose() {}, layers: [layer] }
        : createNativePicture(layer, picture.view);
    const painters = projection.layers.map((target) =>
      createHudMoments(target, source, fonts, hasArt, colours),
    );
    const cards = projection.layers.map((target) =>
      createHudCards(target, source, fonts, gameData),
    );
    this.painter = projectHudMoments(painters, picture?.stillFrames);
    this.painter.update({ firingNow: this.time.now, momentNow: this.time.now, now: this.time.now });
    const stopUnderlays =
      picture === undefined
        ? painters.map((painter) => followModalUnderlay(layer.input, painter.element))
        : [];
    this.debuffBars = [];
    this.tip = undefined;
    this.cashSlots = new Set();
    this.explained = NOT_EXPLAINED;
    this.messages = new MessageStrip(this.painter);
    this.moneyInFlight = 0;
    this.labels = new TimedGroup();
    this.momentNow = this.time.now;
    this.firingNow = this.time.now;
    this.barButtons = new Map();
    this.barPressActive = undefined;
    const barConfig: NativeTopSectionConfig = {
      accepts: (id) =>
        this.picture === undefined &&
        (id === "mute" || id === "pause") &&
        topBarAction(this.walk().runPause(), "tap", id) !== undefined,
      buttons: WALK_BAR_BUTTONS,
      currency: true,
      effects: BAR.effectWells.length,
      labels: {
        exit: gameData.homeText.quit.quit,
        menu: gameData.menuText.menu.title,
        mute: gameData.menuText.settings.sound,
        pause: gameData.menuText.pause.action,
      },
      muted: isMuted(this),
      press: (id, event) => {
        if (id === "mute" || id === "pause") {
          this.press(event.via === "keyboard" ? "key" : "tap", id);
        }
      },
    };
    this.topSection =
      picture === undefined
        ? addNativeTopSection(this, barConfig)
        : projectHudTopSections(
            projection.layers.map((target) =>
              createNativeTopSection(target, source, title, barConfig),
            ),
          );
    // The bar's icons on roots of their own over the bar, joined to it, so a page over the walk
    // (help) that keeps the bar in view keeps them too; the dog cards and the bump border over
    // them.
    const iconPainters = projection.layers.map((target) =>
      createHudMoments(target, source, fonts, hasArt, colours),
    );
    this.iconPainter = projectHudMoments(iconPainters, picture?.stillFrames);
    const barPainters = projection.layers.map((target) =>
      createHudMoments(target, source, fonts, hasArt, colours),
    );
    this.barPainter = projectHudMoments(barPainters, picture?.stillFrames);
    this.cards = projectHudCards(barPainters, cards);
    if (picture === undefined) {
      stopUnderlays.push(
        ...[...iconPainters, ...barPainters].map((painter) =>
          followModalUnderlay(layer.input, painter.element),
        ),
      );
      joinTopSection(
        this,
        iconPainters.map((painter) => painter.element),
      );
    }
    const now = { firingNow: this.time.now, momentNow: this.time.now, now: this.time.now };
    this.iconPainter.update(now);
    this.barPainter.update(now);
    this.chrome = createHudChrome(this.painter, this.iconPainter, DEBUFF_COLOURS);
    onSceneEvent(this, this.game.events, Core.Events.PRE_RENDER, () => {
      const time = { firingNow: this.firingNow, momentNow: this.momentNow, now: this.time.now };
      this.painter?.update(time);
      this.iconPainter?.update(time);
      this.barPainter?.update(time);
      if (picture === undefined) {
        [...painters, ...iconPainters, ...barPainters].forEach((painter) =>
          dimDrawn(painter.element, !layer.input.accepts()),
        );
      }
    });
    this.events.once("shutdown", () => {
      stopUnderlays.forEach((stop) => stop());
      this.topSection?.dispose();
      this.cards?.dispose();
      this.chrome?.dispose();
      this.painter?.dispose();
      this.iconPainter?.dispose();
      this.barPainter?.dispose();
      projection.dispose();
    });
    onSettingsChanged(this, ({ muted }) => this.topSection?.setMuted(muted));
    for (const id of WALK_BAR_BUTTONS) {
      const button = this.topSection?.buttons.get(id);
      if (button !== undefined) {
        this.barButtons.set(id, button);
      }
    }
    const border = new BumpBorder(this, { border: this.barPainter, tint: this.painter });
    const run = this.walk();
    const firingRects = () => this.feedback?.firingRects() ?? [];
    this.owners = new OwnerTabs(this, {
      group: this.labels,
      painter: this.painter,
      still: () => run.reducedMotion(),
    });
    this.feedback = new HudFeedback(this, run, {
      effectWell: (index) => {
        const run = this.shownRun();
        return run === undefined
          ? undefined
          : walkBarLayout(LAYOUT.topBar, effectItems(gameData, run).length).effectWells[index];
      },
      firingShown: () => this.hearts?.clearWay(),
      floatLabels: (ownerMs, labels) => this.floatLabels(ownerMs, labels),
      painter: this.painter,
      payTotal: (label, timing) => this.showPayTotal(label, timing),
      popOwner: (dog, mood, ms) => this.popOwner(dog, mood, ms),
    });
    this.hearts = new HeartFeedback(this, {
      clearOf: firingRects,
      flashCard: (slot) =>
        this.cards?.flashCard({ now: this.momentNow, reducedMotion: run.reducedMotion() }, slot),
      landed: (label, lane) => this.showHeartLabel(label, lane),
      painter: this.painter,
      still: () => run.reducedMotion(),
      tabTop: this.lanes().ownerTabs.y,
    });
    onSceneEvent(this, run.events, ACHIEVEMENTS_EVENT, (ids: AchievementId[]) =>
      this.sayAchievements(ids),
    );
    onSceneEvent(this, run.events, CHANGE_LABELS_EVENT, (labels: ChangeLabel[]) =>
      this.floatLabels(HEART_TAB_MS, labels),
    );
    onSceneEvent(this, run.events, FORGIVEN_EVENT, (cue: ForgivenCue) => this.forgive(cue));
    onSceneEvent(this, run.events, BUFF_GLINT_EVENT, (item: EffectItem) => this.glint(item));
    onSceneEvent(this, run.events, BUMP_FLASH_EVENT, (colour: number) => {
      cancelRoadShake(run.events);
      border.flash(run.reducedMotion(), colour);
    });
    onSceneEvent(this, run.events, HINT_EVENT, (hint: RaisedHint) => this.sayHint(hint));
    onSceneEvent(this, run.events, MESSAGE_EVENT, (line: MessageLine) => this.messages?.say(line));
    onSceneEvent(this, run.events, QUIPS_EVENT, (quips: OwnerQuip[]) => this.sayQuips(quips));
    if (picture !== undefined) {
      return;
    }
    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
      const key = topBarKey(event.repeat, event.code);
      if (key === "pause") {
        const until = this.time.now + MENU_FEEDBACK.pressDipMs;
        this.setBarPressed(key, () => this.time.now < until);
      }
      if (key !== undefined) {
        this.press("key", key);
      }
    });
  }
  // The topmost overlay over the walk that leaves the walk bar in view (Cheats, the settings, the
  // pause menu, the card or the zone celebration), else the HUD itself. A picture of the HUD has none.
  // Each counts while paused, under an explanation or an overlay over it.
  private overlayScene(): Scene {
    const shown = (key: SceneKey) => this.scene.isActive(key) || this.scene.isPaused(key);
    const overlays = [
      SCENE_KEYS.cheats,
      SCENE_KEYS.settings,
      SCENE_KEYS.pause,
      SCENE_KEYS.card,
      SCENE_KEYS.zoneCelebration,
    ] as const;
    const key = overlays.find(shown);
    return key === undefined || this.picture !== undefined ? this : this.scene.get(key);
  }
  // The walk the HUD shows: a picture's, or the run's.
  private walk(): HudWalk {
    const walk = this.picture ?? this.run;
    if (walk === undefined) {
      throw new Error("The HUD shows a walk only once it is created");
    }
    return walk;
  }
  private press(via: "key" | "tap", button: WalkBarButtonId): void {
    const run = this.run;
    if (run === undefined) {
      return;
    }
    switch (topBarAction(run.runPause(), via, button)) {
      case "closePage": {
        const page = [SCENE_KEYS.cheats, SCENE_KEYS.help, SCENE_KEYS.settings].find((key) =>
          this.scene.isActive(key),
        );
        if (page !== undefined) {
          (this.scene.get(page) as CheatsScene | HelpScene | SettingsScene).close();
        }
        break;
      }
      case "mute":
        this.game.events.emit(BAR_MUTED_EVENT, toggleMuted(this));
        break;
      case "openMenu":
        run.openPause();
        break;
      case "resume":
        run.closePause();
        break;
      default:
    }
  }
  private setBarPressed(
    button: WalkBarButtonId | undefined,
    active: () => boolean = () => false,
  ): void {
    this.barPressActive = button === undefined ? undefined : active;
    this.barButtons.forEach((control, id) => control.setPressed(id === button));
  }
  // The icon art when it is loaded, else cream pause bars or play triangle drawn on the face.
  private showPauseIcon(pausable: boolean, pause: RunPause): void {
    this.topSection?.setPaused(pauseButtonIcon(pausable, pause) === "icon-menu");
  }
  override update(_time: number, delta: number): void {
    // An overlay can consume the release; the shared pointer still records that it lifted.
    if (this.barPressActive !== undefined && !this.barPressActive()) {
      this.setBarPressed(undefined);
    }
    const run = this.walk();
    const view = run.hudView();
    if (view === undefined) {
      return;
    }
    const pause = run.runPause();
    const held = playerPaused(pause);
    if (!held) {
      this.momentNow += delta;
    }
    if (!walkPaused(pause)) {
      this.firingNow += delta;
    }
    this.feedback?.update(view.run, pause);
    this.hearts?.hold(held);
    this.labels.hold(held);
    if (this.picture === undefined) {
      this.raiseHints(runHintTriggers(view.run));
    }
    const overlay = this.overlayScene();
    this.showExplanation(view, overlay);
    this.chrome?.update(view.pressedEffect, view.run);
    this.topSection?.setEffectCount(effectItems(gameData, view.run).length);
    this.topSection?.setEffectPressed(view.pressedEffect);
    this.debuffBars = [...(this.chrome?.bars() ?? [])];
    this.topSection?.setInputBottom(
      this.debuffBars.length > 0 ? LAYOUT.topBar.y + LAYOUT.topBar.height : undefined,
    );
    this.cards?.update(
      {
        momentNow: this.momentNow,
        now: this.time.now,
        ownedSlots: profileSave(this).owned.dogSlots.length,
        reducedMotion: run.reducedMotion(),
      },
      view.run,
    );
    // The strip's lines wait under an explanation's detail card, and hide, waiting, while a card
    // is held enlarged.
    const aged = held || pause.hold ? 0 : delta;
    const hidden = overlay instanceof CardScene && overlay.holding();
    this.messages?.update(aged, HUD_DEPTH.message, this.debuffBars.length, hidden);
    this.showPauseIcon(view.run.phase.kind === "walking", pause);
    this.showMoney(this.shownMoney(view.run));
  }
  // The cash the walk keeps, all of it until it ends (walkEarnings), less fees and money changes
  // still flying to it, so the cash an early end loses counts down once its label lands.
  private shownMoney(run: RunState): Cents {
    const kept =
      run.phase.kind === "ended" ? walkEarnings(run.phase.reason, run).banked : run.money;
    const landed = cents(kept - this.moneyInFlight);
    return this.feedback?.shownMoney(landed) ?? landed;
  }
  // The "$" and the amount from the cash's x at the cash's scale, one font advance apart.
  private showMoney(amount: Cents): void {
    this.topSection?.setAmount(dollarAmountText(amount), shortDollarAmountText(amount));
  }
  // The detail card of what a held press explains, the home screen's, while it is open, in the
  // topmost scene over the walk (overlayScene), which with nothing else open is the HUD: a press
  // explains nothing under a card or overlay (walkPresses). The walk is paused under it, so it is
  // drawn once as it opens.
  private showExplanation(view: RunHudView, overlay: Scene): void {
    const target: ExplainTarget | undefined = view.explaining;
    const key = target === undefined ? "" : JSON.stringify(target);
    const shown = this.explained;
    if (shown.key === key && (shown.scene === undefined || shown.scene === overlay)) {
      return;
    }
    shown.html?.destroy();
    const detail =
      target === undefined
        ? undefined
        : explainDetail(gameData, profileSave(this), view.run, target);
    if (detail === undefined) {
      this.explained = { key, scene: undefined };
      return;
    }
    const html = addHtmlDetailCard(
      overlay,
      () => detailView(overlay, LAYOUT.screen, detail),
      undefined,
      () => this.run?.closeExplanation(),
    );
    this.explained = html === undefined ? NOT_EXPLAINED : { html, key, scene: overlay };
  }

  // An owner's tab on their dog's card, in mood, for ms.
  private popOwner(dog: DogId, mood: string, ms: number): void {
    const slot = this.slotOf(dog);
    if (slot !== undefined) {
      this.owners?.pop({ dog, mood, slot }, ms);
    }
  }
  // The run the HUD shows, while a walk is shown.
  private shownRun(): RunState | undefined {
    return this.walk().hudView()?.run;
  }
  private slotOf(dog: DogId): number | undefined {
    const index = slotIndexOf(this.shownRun()?.pack ?? [], dog);
    return index < 0 ? undefined : index;
  }
  // Each change shows where it happened: a money loss pops where it changed hands, a money gain
  // and the cash lost with the last firing by the cash, and each flies into the cash; a heart
  // change pops over its dog and flies into its card (heartFeedback.ts), its label then fading in
  // place on the card's bottom rows, while its owner pops in on the card for ownerMs.
  private floatLabels(ownerMs: number, labels: ChangeLabel[]): void {
    const run = this.walk();
    const body = pixelFontMetrics(this, "body");
    const money = labels.flatMap((label) =>
      label.target.kind === "bank" ? [{ from: label.target.from, label }] : [],
    );
    const orders = stackOrders(money.map(({ from }) => from));
    money.forEach(({ from, label }, i) => {
      const order = orders[i] ?? 0;
      this.showMoneyLabel(label, (shown) =>
        moneyChipPlace(body, SCREEN_CONFIG.width, from, order, shown),
      );
    });
    for (const label of labels) {
      if (label.target.kind === "cash") {
        if (label.target.tip) {
          this.showTipLabel(label);
        } else {
          this.showCashLabel(label);
        }
      }
    }
    const pops = heartPops({ lanes: this.lanes().heartLabels, run }, labels, (slot) =>
      this.cards?.anchor(slot),
    );
    pops.forEach((pop) => this.hearts?.play(pop));
    for (const label of labels) {
      if (label.target.kind === "dog") {
        this.popOwner(label.target.dog, label.gain ? "happy" : "upset", ownerMs);
      }
    }
  }
  // The heart a forgiven loss left on its owner's card, the last of their hearts, flashes back.
  private forgive(cue: ForgivenCue): void {
    const slot = this.slotOf(cue.dog);
    const rect = slot === undefined ? undefined : LAYOUT.dogSlots[slot];
    const run = this.shownRun();
    if (rect === undefined || run === undefined) {
      return;
    }
    const max = ownerMaxHearts(gameData, run, cue.dog);
    const cell = cardHearts(cue.hearts, max)[cue.hearts - 1];
    if (cell !== undefined) {
      const perk = perkIconKey(gameData.walkers[run.walker].perk);
      this.hearts?.forgive({ x: rect.x + cell.x, y: rect.y + cell.y }, perk);
    }
  }
  // The well of a buff that just changed the walk glints, as its charm pops.
  private glint(item: EffectItem): void {
    const run = this.shownRun();
    if (run === undefined) {
      return;
    }
    const key = effectIconKey(item);
    const items = effectItems(gameData, run);
    const well = walkBarLayout(LAYOUT.topBar, items.length).effectWells[
      items.findIndex((shown) => effectIconKey(shown) === key)
    ];
    if (well !== undefined) {
      const painter = this.iconPainter;
      if (painter === undefined) {
        return;
      }
      const marks = painter.group(1);
      const ring = charmRing(well);
      marks.ring(ring.rect, ring.colour, ring.width);
      const { blinkMs, blinks } = BUFF_POP;
      this.labels.every(this, blinkMs, 2 * blinks - 2, () => {
        marks.state.visible = !marks.state.visible;
      });
      this.labels.after(this, blinkMs * (2 * blinks - 1), () => marks.dispose());
      const sparkle = painter.group(2);
      sparkle.art({
        at: sparkleAt(well, 1),
        key: "fx-sparkle",
        onComplete: () => sparkle.dispose(),
        origin: { x: 0.5, y: 0.5 },
        tags: ["play"],
      });
    }
  }
  // A money change pops on its chip where place puts it and holds as a heart's pop does; then it
  // goes into the cash (sendMoneyLabel), calling left once it has left its place. Reduced motion
  // keeps the pop and fades it at once. depth: the chip's, as addChangeChip draws it.
  private showMoneyLabel(
    label: ChangeLabel,
    place: (shown: { lines: number; scale: number; width: number }) => {
      chip: Rect;
      text: Point;
    },
    left: () => void = () => undefined,
    depth = 0,
  ): void {
    const chip = this.addChangeChip(label, MONEY_LABEL.room, place, depth);
    const held = this.holdOffCounter(label.amount);
    if (this.walk().reducedMotion()) {
      this.sendMoneyLabel(chip, held, left);
      return;
    }
    this.labels.after(this, MONEY_LABEL.holdMs, () => this.sendMoneyLabel(chip, held, left));
  }
  // A money gain's label that is not a tip's, or the cash lost with the last firing
  // (cashLostLabel), pops by the cash in the cash column's first free slot, which it holds until
  // it leaves, and goes in as any money label does (showMoneyLabel). It never adds up with a
  // tip's.
  private showCashLabel(label: ChangeLabel): void {
    const body = pixelFontMetrics(this, "body");
    const slot = this.takeCashSlot();
    this.showMoneyLabel(
      label,
      (shown) => cashChipPlace(body, slot, shown),
      () => this.cashSlots.delete(slot),
      HUD_DEPTH.cashChip,
    );
  }
  // A tip's label pops by the cash, in the cash column's first free slot, and holds as a heart's
  // pop does, then goes into the cash (sendMoneyLabel); with reduced motion it fades after the
  // hold. A tip grabbed while one shows adds up with it on one chip in its slot and restarts the
  // hold (mergeTips); one that cannot, as a Stinky "+$0" beside a paying tip, sends the showing
  // label in now and takes the first free slot.
  private showTipLabel(label: ChangeLabel): void {
    const showing = this.tip;
    const merged = showing === undefined ? undefined : mergeTips(showing.label, label);
    if (showing !== undefined) {
      if (merged === undefined) {
        this.sendMoneyLabel(showing.chip, showing.held, () => this.cashSlots.delete(showing.slot));
      } else {
        showing.chip.parts.forEach((part) => part.dispose());
      }
    }
    const tipLabel = merged ?? label;
    const slot = merged === undefined || showing === undefined ? this.takeCashSlot() : showing.slot;
    const body = pixelFontMetrics(this, "body");
    const chip = this.addChangeChip(
      tipLabel,
      MONEY_LABEL.room,
      (shown) => cashChipPlace(body, slot, shown),
      HUD_DEPTH.cashChip,
    );
    const before = merged === undefined ? 0 : (showing?.held ?? 0);
    const held = before + this.holdOffCounter(label.amount);
    const tip = { chip, held, label: tipLabel, slot };
    this.tip = tip;
    this.labels.after(this, MONEY_LABEL.holdMs, () => {
      if (this.tip === tip) {
        this.tip = undefined;
        this.sendMoneyLabel(chip, held, () => this.cashSlots.delete(slot));
      }
    });
  }
  // A zone's pay, its total, pops by the cash in the cash column's first free slot, which it holds
  // until it has faded: it shows while the fees' coins fly, timing's holdMs, then fades in place
  // over its fadeMs. The coins carry its money to the counter, so it never flies.
  private showPayTotal(
    label: ChangeLabel,
    timing: {
      fadeMs: number;
      holdMs: number;
    },
  ): void {
    const body = pixelFontMetrics(this, "body");
    const slot = this.takeCashSlot();
    const chip = this.addChangeChip(
      label,
      MONEY_LABEL.room,
      (shown) => cashChipPlace(body, slot, shown),
      HUD_DEPTH.cashChip,
    );
    this.labels.after(this, timing.holdMs, () => {
      const fade = { ms: timing.fadeMs, rise: 0 };
      this.fadeChip(chip, fade.ms, () => this.cashSlots.delete(slot));
    });
  }
  // The cash column's first free slot, now held.
  private takeCashSlot(): number {
    const slot = freeCashSlot(this.cashSlots);
    this.cashSlots.add(slot);
    return slot;
  }
  // The money a label keeps off the counter until it lands, of amount: all of it, or none with
  // reduced motion, where the counter counts it at once.
  private holdOffCounter(amount: number): number {
    const held = this.walk().reducedMotion() ? 0 : amount;
    this.moneyInFlight += held;
    return held;
  }
  // A money label's chip flies along a heart's arc into the cash, which counts held as it lands,
  // calling left as it sets off. Reduced motion fades it in place, as a heart lands without
  // flying, and calls left once it has faded.
  private sendMoneyLabel(chip: ChangeChip, held: number, left: () => void): void {
    if (this.walk().reducedMotion()) {
      this.moneyInFlight -= held;
      this.fadeChip(chip, LABEL_FADE_MS, left);
      return;
    }
    left();
    const land = () => {
      this.moneyInFlight -= held;
      chip.parts.forEach((part) => part.dispose());
    };
    const path = moneyFlightPath(chip.rect);
    const bases = chip.parts.map(({ state }) => ({ x: state.x, y: state.y }));
    const flight = { duration: FEEDBACK.heart.flyMs, ease: "Sine.easeIn", onComplete: land };
    this.labels.tween(
      this,
      arcFlight(path, flight, (point) => {
        const dx = point.x - path.from.x;
        const dy = point.y - path.from.y;
        chip.parts.forEach((part, i) => {
          const base = bases[i] ?? part.state;
          part.state.x = base.x + dx;
          part.state.y = base.y + dy;
        });
      }),
    );
  }
  // A heart change's label in the middle of its card's bottom rows, once its heart has landed,
  // fading in place.
  private showHeartLabel(label: ChangeLabel, lane: Rect): void {
    const body = pixelFontMetrics(this, "body");
    const chip = this.addChangeChip(label, changeLabelRoom(lane.width), (shown) =>
      changeChipPlace(body, lane, shown),
    );
    this.fadeChip(chip, LABEL_FADE_MS);
  }
  // A change on a cream chip in its changeLabelColour, so it reads over anything; set within
  // room in CHANGE_LABEL_STYLE, placed by place, at depth (its text a depth over it). A label
  // with a reach icon shows it at the chip's left, over the chip as its text is, the chip widened
  // to hold it (reachChipPlace). Its parts, and its chip's rect.
  private addChangeChip(
    label: ChangeLabel,
    room: number,
    place: (shown: { lines: number; scale: number; width: number }) => {
      chip: Rect;
      text: Point;
    },
    depth = 0,
  ): ChangeChip {
    const painter = this.painter;
    if (painter === undefined) {
      throw new Error("Native HUD moments are not ready");
    }
    const reached = label.reachIcon !== undefined && painter.hasArt(label.reachIcon);
    // The icon takes its span of the room.
    const fitted = fittingText(
      CHANGE_LABEL_STYLE,
      (style, line) => inkWidth(painter.fonts.body, style.scale, line),
      room - (reached ? REACH_ICON.span : 0),
      label.text,
    );
    const scale = fitted.style.scale;
    const width = Math.max(
      ...fitted.lines.map((line) => inkWidth(painter.fonts.body, scale, line)),
    );
    const placed = reachChipPlace(place, reached, { lines: fitted.lines.length, scale, width });
    const chip = painter.group(depth);
    chip.panel(placed.chip);
    chip.text({
      anchor: "ink",
      backing:
        placed.icon === null
          ? placed.chip
          : {
              ...placed.chip,
              width: placed.chip.width - REACH_ICON.span,
              x: placed.chip.x + REACH_ICON.span,
            },
      capTop: placed.text.y,
      colour: changeLabelColour(label),
      font: "body",
      lines: fitted.lines,
      scale,
      x: placed.text.x,
    });
    if (reached && placed.icon !== null) {
      chip.art({ at: placed.icon, image: { height: 16, width: 16 }, key: label.reachIcon! });
    }
    return { parts: [chip], rect: placed.chip };
  }
  private fadeChip(chip: ChangeChip, ms: number, done: () => void = () => undefined): void {
    const parts = chip.parts;
    this.labels.tween(this, {
      alpha: 0,
      duration: ms,
      onComplete: () => {
        parts.forEach((part) => part.dispose());
        done();
      },
      targets: parts.map(({ state }) => state),
    });
  }
  // The first-time hints the run's state raises, each said on the message strip once.
  private raiseHints(triggers: readonly HintTrigger[]): void {
    if (triggers.length === 0) {
      return;
    }
    const shown = [...shownHints(this)];
    for (const trigger of triggers) {
      const hint = hintFor(gameData, shown, trigger);
      if (hint !== null) {
        this.sayHint(hint);
        shown.push(hint.id);
      }
    }
  }
  // A first-time hint on the message strip, marked shown as it is said, which waits its turn
  // however long it takes. The low-hearts hint jumps the hints waiting their turn.
  private sayHint(hint: RaisedHint): void {
    markHintShown(this, hint.id);
    const line = { icon: "hint", keepsWaiting: true, text: hint.text } as const;
    this.messages?.say(line, hintJumpsQueue(gameData, hint.id));
  }
  // Each badge earned on the way, on the message strip.
  private sayAchievements(ids: readonly AchievementId[]): void {
    for (const achievement of gameData.achievements.filter(({ id }) => ids.includes(id))) {
      soundboardOf(this).play("badge");
      this.messages?.say(achievementLine(gameData, achievement));
    }
  }
  // Each owner's quip on the message strip, led by their face, in the mood their hearts give,
  // and their name.
  private sayQuips(quips: readonly OwnerQuip[]): void {
    const run = this.shownRun();
    if (run === undefined) {
      return;
    }
    for (const { dog, text } of quips) {
      const hearts = heartsOf(run, dog) ?? 0;
      const max = ownerMaxHearts(gameData, run, dog);
      const icon = { dog, kind: "owner", mood: faceMood(gameData, max, hearts) } as const;
      this.messages?.say({ icon, text });
    }
  }
}
