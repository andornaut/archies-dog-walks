import type { Rect } from "@andornaut/game-kit/runtime/rect";
import { Core, Scene } from "phaser";

import { perkIconKey } from "../assets/index.ts";
import type { AchievementId, DebuffId, DogId } from "../data/ids.ts";
import { gameData, type HintTrigger } from "../data/index.ts";
import { FEEDBACK as MENU_FEEDBACK } from "../home/index.ts";
import {
  createHudChrome,
  type DomQuestionPanel,
  type HudCards,
  type HudMomentPainter,
} from "../hud/dom/index.ts";
import {
  achievementLine,
  cardHearts,
  type ChangeLabel,
  charmRing,
  explainDetail,
  type ExplainTarget,
  FORGIVEN_EVENT,
  type ForgivenCue,
  type HudLanes,
  hudLanes,
  type MessageLine,
  pauseButtonIcon,
  playerPaused,
  runHintTriggers,
  type RunPause,
  topBarAction,
  topBarKey,
  WALK_BAR_BUTTONS,
  type WalkBarButtonId,
  walkBarLayout,
  walkPaused,
} from "../hud/index.ts";
import { BUFF_POP, SCREEN_LAYOUT, sparkleAt } from "../layout/index.ts";
import {
  dollarAmountText,
  effectIconKey,
  type EffectItem,
  effectItems,
  shortDollarAmountText,
} from "../presentation/index.ts";
import { faceMood, hintFor, hintJumpsQueue, ownerMaxHearts, walkEarnings } from "../rules/index.ts";
import { heartsOf, type RunState, slotIndexOf } from "../state/index.ts";
import {
  dimDrawn,
  followModalUnderlay,
  type NativeTopSection,
  type NativeTopSectionConfig,
  uiLayer,
} from "../ui/dom/index.ts";
import { type Cents, cents } from "../units.ts";
import { BumpBorder } from "./bumpBorder.ts";
import { CardScene } from "./CardScene.ts";
import type { CheatsScene } from "./CheatsScene.ts";
import { DEBUFF_COLOURS } from "./debuffColours.ts";
import { HudFeedback } from "./feedbackMoments.ts";
import { HeartFeedback, heartPops } from "./heartFeedback.ts";
import type { HelpScene } from "./HelpScene.ts";
import { detailView } from "./homePanels.ts";
import { HudChangeLabels } from "./hudChangeLabels.ts";
import { HUD_DEPTH } from "./hudDepth.ts";
import { createHudSceneProjection } from "./hudSceneProjection.ts";
import type { HudRun, HudWalk, RunHudView } from "./hudWalk.ts";
import { MESSAGE_EVENT, MessageStrip } from "./messageStripView.ts";
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
} from "./run/runMomentEvents.ts";
import { SCENE_KEYS, type SceneKey } from "./sceneKeys.ts";
import type { ScenePicture } from "./scenePicture.ts";
import type { SettingsScene } from "./SettingsScene.ts";
import { soundboardOf } from "./soundboard.ts";
import { TimedGroup } from "./timedGroup.ts";
import { joinTopSection } from "./topSection.ts";
const LAYOUT = SCREEN_LAYOUT;
const BAR = walkBarLayout(LAYOUT.topBar);
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
  private changeLabels: HudChangeLabels | undefined;
  private messages: MessageStrip | undefined;
  private owners: OwnerTabs | undefined;
  private picture: HudWalk | undefined;
  private run: HudRun | undefined;
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
    if (layer === undefined) {
      throw new Error("The native HUD requires its prepared UI context");
    }
    const projection = createHudSceneProjection(this, layer, picture);
    const { painter } = projection;
    painter.update({ firingNow: this.time.now, momentNow: this.time.now, now: this.time.now });
    const stopUnderlays =
      picture === undefined
        ? projection.roots.map((root) => followModalUnderlay(layer.input, root))
        : [];
    this.debuffBars = [];
    this.explained = NOT_EXPLAINED;
    this.messages = new MessageStrip(painter);
    this.labels = new TimedGroup();
    const changeLabels = new HudChangeLabels(this, {
      labels: this.labels,
      painter,
      reducedMotion: () => this.walk().reducedMotion(),
    });
    this.changeLabels = changeLabels;
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
    const { bar, barRoots, cards, disposePainters, iconRoots, icons, section } =
      projection.mountTopSection(barConfig);
    this.topSection = section;
    this.iconPainter = icons;
    this.cards = cards;
    const topRoots = [...iconRoots, ...barRoots];
    if (picture === undefined) {
      stopUnderlays.push(...topRoots.map((root) => followModalUnderlay(layer.input, root)));
      // Help keeps the effect icons in view with the live bar.
      joinTopSection(this, iconRoots);
    }
    const now = { firingNow: this.time.now, momentNow: this.time.now, now: this.time.now };
    icons.update(now);
    bar.update(now);
    const chrome = createHudChrome(painter, icons, DEBUFF_COLOURS);
    this.chrome = chrome;
    const roots = [...projection.roots, ...topRoots];
    onSceneEvent(this, this.game.events, Core.Events.PRE_RENDER, () => {
      const time = { firingNow: this.firingNow, momentNow: this.momentNow, now: this.time.now };
      painter.update(time);
      icons.update(time);
      bar.update(time);
      if (picture === undefined) {
        roots.forEach((root) => dimDrawn(root, !layer.input.accepts()));
      }
    });
    this.events.once("shutdown", () => {
      stopUnderlays.forEach((stop) => stop());
      section?.dispose();
      cards.dispose();
      chrome.dispose();
      disposePainters();
    });
    onSettingsChanged(this, ({ muted }) => this.topSection?.setMuted(muted));
    for (const id of WALK_BAR_BUTTONS) {
      const button = this.topSection?.buttons.get(id);
      if (button !== undefined) {
        this.barButtons.set(id, button);
      }
    }
    const border = new BumpBorder(this, { border: bar, tint: painter });
    const run = this.walk();
    const firingRects = () => this.feedback?.firingRects() ?? [];
    this.owners = new OwnerTabs(this, {
      group: this.labels,
      painter,
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
      painter,
      payTotal: (label, timing) => changeLabels.showPayTotal(label, timing),
      popOwner: (dog, mood, ms) => this.popOwner(dog, mood, ms),
    });
    this.hearts = new HeartFeedback(this, {
      clearOf: firingRects,
      flashCard: (slot) =>
        this.cards?.flashCard({ now: this.momentNow, reducedMotion: run.reducedMotion() }, slot),
      landed: (label, lane) => changeLabels.showHeartLabel(label, lane),
      painter,
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
    const landed = cents(kept - (this.changeLabels?.inFlight ?? 0));
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
    this.changeLabels?.showMoneyChanges(labels);
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
