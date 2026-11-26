import {
  type FixedStepLimits,
  frameSteps,
  holdStepClock,
  startStepClock,
  STEP_SECONDS,
  type StepClock,
} from "@andornaut/game-kit/runtime/clock/fixedStep";
import { Scene } from "phaser";

import { musicKey } from "../audio/index.ts";
import {
  type InputEvent,
  type RunSetup,
  timeScaleOf,
  WALK_CHEATS_OFF,
  type WalkCheat,
  type WalkCheats,
  withCheats,
  withSetupStart,
} from "../cheats/index.ts";
import type { DogId, ZoneId } from "../data/ids.ts";
import { gameData, LANE_COUNT } from "../data/index.ts";
import {
  cardHintTriggers,
  type ExplainShown,
  homeQuestionNote,
  newWalkerCelebrations,
  NOTHING_PAUSED,
  pauseNote,
  type RunPause,
  startHintTriggers,
  walkBackAction,
  walkPaused,
  zoneCelebration,
} from "../hud/index.ts";
import { effectItems } from "../presentation/index.ts";
import {
  onFrameTurnChange,
  PHONE_EVENTS,
  requestGameUpdateCheck,
  startWakeLock,
  stopWakeLock,
} from "../pwa/index.ts";
import {
  type CardView,
  type Choice,
  currentZone,
  currentZoneId,
  newRun,
  outcomeChanges,
} from "../rules/index.ts";
import { pageZonePlanner } from "../runner/dom/index.ts";
import {
  awaitsZonePlan,
  chooseShownCard,
  forkPoint,
  headHomeSession,
  resumeSession,
  type RunStreams,
  runStreams,
  screenRoadGeometry,
  type Session,
  type SessionEvent,
  type SessionStep,
  startRoad,
  startSession,
  stepSession,
  unplannedStart,
  type Walk,
  withZonePlan,
  zoneStartPoint,
} from "../runner/index.ts";
import { checkpointOf, dogsFinishedWith, type ResumeWalk, runResultOf } from "../save/index.ts";
import type { Loadout, RunState } from "../state/index.ts";
import { PALETTE } from "../ui/index.ts";
import { noteWalkStarted } from "./cheatChoices.ts";
import type { HudSceneData } from "./HudScene.ts";
import type { HudRun, RunHudView } from "./hudWalk.ts";
import { onWindowEvent } from "./overlay.ts";
import type { PauseSceneData } from "./PauseScene.ts";
import {
  checkpointRun,
  currentSettings,
  finishRun,
  onSettingsChanged,
  profileSave,
  type Settings,
} from "./profileStore.ts";
import { type EndDestination, endSceneFor } from "./run/endDestination.ts";
import { blendWalk, leadWalk, stepAlpha } from "./run/interpolate.ts";
import { ensureRoadPlaceholders } from "./run/itemViews.ts";
import { MenuFlow } from "./run/menuFlow.ts";
import { ZoneBanner, zoneBannerMs } from "./run/roadBanners.ts";
import { RoadArt } from "./run/roadView.ts";
import {
  activeCheatsOf,
  applyWalkCheat,
  cheatZoneJump,
  cheatZonePlan,
  liveCheatRun,
} from "./run/runCheats.ts";
import { RunInput } from "./run/runInput.ts";
import { RunMoments, showHint } from "./run/runMoments.ts";
import { RunRecorder } from "./run/runRecorder.ts";
import { type RunRandom, runRandom } from "./run/runStart.ts";
import { clearRunZoneViews, createRunViews, drawRunViews, type RunViews } from "./run/runViews.ts";
import { ShadowPool } from "./run/shadowPool.ts";
import { LAYOUT, overPack, packPoint } from "./run/stage.ts";
import { UpdateHold } from "./run/updateHold.ts";
import { type CelebrationBatch, createZoneCelebrations } from "./run/zoneCelebrations.ts";
import { SCENE_KEYS } from "./sceneKeys.ts";
import { soundboardOf } from "./soundboard.ts";

// How the walk starts, from runSceneData: the cheats it plays by, its setup, the loadout and dog
// slots it walks with, and the inputs that drive it when it replays a log. A walk the launch
// resumes (resumedRunSceneData) goes on from resume, where it was saved, under the pause menu.
export interface RunSceneData {
  cheats: WalkCheats;
  dogSlots: number;
  loadout: Loadout;
  replay: readonly InputEvent[] | undefined;
  resume?: ResumeWalk;
  setup: RunSetup;
}

// Steps of 1/60 s. A frame catches up at most a second of steps (60), which covers a frame held
// up by garbage collection or a slow device; a longer stall drops the rest rather than jumping
// the walk ahead.
const STEP_MS = STEP_SECONDS * 1000;
const STEPPING: FixedStepLimits = { maxFrameMs: 1000, stepMs: STEP_MS };

// Before the walk starts, the HUD shows nothing to explain.
const NOTHING_SHOWN: ExplainShown = { debuffs: [], dogs: [], effects: [] };

// One run's views, input, menus and cheat hooks, made as it starts.
interface RunWorld extends RunViews {
  banner: ZoneBanner;
  input: RunInput;
  menus: MenuFlow;
  moments: RunMoments;
  random: RunRandom;
  recorder: RunRecorder;
  setup: RunSetup;
  shadows: ShadowPool;
  streams: RunStreams;
}

// The walk: backdrop, road, walker, pack and everything spawned on the road. The session steps
// at a fixed rate and stops while walkPaused says so; the scene draws it, feeds it input and
// plays its events. A walk's first zone is planned as the scene starts; a zone that falls due
// later, after a fork's path or a neighbourhood cheat, is planned by the page's zone planner in its
// worker while the walk holds.
export class RunScene extends Scene implements HudRun {
  // The ambient movers' clock: the walk's simulated time less its firings' holds, in which
  // they stand still.
  private ambientMs = 0;
  private readonly celebrations = createZoneCelebrations(this, () => this.openPause());
  // The cheats the walk plays by, initially from the Start screen.
  private cheats: WalkCheats = WALK_CHEATS_OFF;
  private endDestination: EndDestination = "end";
  // Where the next launch resumes the walk, saved with each checkpoint: the walk's start, its
  // last fork, or the start of the zone it is in, whichever came last.
  private resumePoint: ResumeWalk | null = null;
  private readonly roadArt = new RoadArt(this);
  private session: Session | undefined;
  private settings: Settings | undefined;
  private stepClock: StepClock = startStepClock;
  private readonly updateHold = new UpdateHold({
    close: () => this.closePause(),
    isClosed: () => this.runPause().menu === "closed",
    open: () => this.openPause(),
  });
  // The walk one step before the session's, which a frame blends from; undefined draws the
  // session's walk as it is.
  private stepBefore: Walk | undefined;
  private world: RunWorld | undefined;

  constructor() {
    super(SCENE_KEYS.run);
  }

  create(data: RunSceneData): void {
    this.endDestination = "end";
    this.resetState();
    ensureRoadPlaceholders(this);
    // Ink backs unavailable world art; loaded road and backdrop textures pad camera movement.
    this.cameras.main.setBackgroundColor(PALETTE.ink);

    const { resume, setup } = data;
    this.cheats = data.cheats;
    noteWalkStarted(this);
    // Started now, so its worker is ready by the walk's first fork.
    pageZonePlanner();
    const recorder = new RunRecorder(data.replay);
    const streams = runStreams(setup.seed, resume?.draws);
    if (resume === undefined) {
      const run = withCheats(
        data.cheats,
        withSetupStart(gameData, setup, newRun(gameData, data.dogSlots, data.loadout)),
      );
      // The log names the pack, gear and walker walked, whether owners were invincible and a later
      // start's route, so its replay reads neither the saved loadout nor the Next walk choices.
      // Each fork's path is a card choice in its events.
      recorder.start({
        ...setup,
        gear: data.loadout.gear,
        invincible: run.invincible ?? false,
        pack: data.loadout.dogs,
        walker: run.walker,
        ...(setup.zone === 1 ? {} : { route: run.route }),
      });
      const walk = { road: startRoad(LANE_COUNT, setup.speed), run };
      this.session = startSession(gameData, streams, screenRoadGeometry, walk);
      this.resumePoint = this.pointAt(streams, unplannedStart(walk));
    } else {
      // A resumed walk records no input log: a log replays a walk from its setup.
      this.session = resume.session;
      this.resumePoint = resume;
    }

    this.settings = currentSettings(this);
    const sound = soundboardOf(this);
    // Device preferences update the soundboard directly; this copy supplies reduced motion.
    onSettingsChanged(this, (settings) => {
      this.settings = settings;
    });

    this.world = this.createWorld(
      { random: runRandom(setup.seed), recorder, setup, streams },
      data,
    );
    this.world.input.listen();
    this.listen();

    const hud: HudSceneData = { run: this };
    this.scene.launch(SCENE_KEYS.hud, hud);
    sound.setPaused(false);
    startWakeLock();
    if (resume === undefined) {
      this.startWalk(this.session.walk.run);
    } else {
      this.resume(resume);
    }
    this.draw();
    // A resumed walk opens paused, for the player to resume when ready.
    if (resume !== undefined) {
      this.openPause();
    }
    requestGameUpdateCheck();
  }

  // A new walk's first zone starts, and the HUD hears the walk's start a frame later. The first
  // hints wait for the zone banner to leave: how to steer, the lead dog's pack-size bonus, then
  // heading home.
  private startWalk(run: RunState): void {
    this.startZone(run);
    const moments = this.world?.moments;
    this.time.delayedCall(0, () => moments?.walkStarted(run));
    this.time.delayedCall(zoneBannerMs(this.reducedMotion()), () => {
      if (this.sys.game.device.input.touch) {
        showHint(this, { kind: "drag" });
      }
      startHintTriggers(gameData.tuning, run).forEach((trigger) => showHint(this, trigger));
      showHint(this, { kind: "homeButton" });
    });
  }

  // A resumed walk goes on from where it was saved: the zone it was about to walk is planned and
  // starts, or the fork it waited at opens, its last zone's music playing as at the zone's end.
  // Its resume point is already saved, so nothing is written.
  private resume(resume: ResumeWalk): void {
    const world = this.world;
    if (world === undefined) {
      return;
    }
    const step = resumeSession(gameData, world.streams, screenRoadGeometry, resume.session);
    this.session = step.session;
    const { card, walk } = step.session;
    if (card === null) {
      this.startZone(walk.run);
      return;
    }
    soundboardOf(this).playMusic(musicKey(currentZone(gameData, walk.run)));
    this.showCard(card);
  }

  // The resume point for session, with the run's streams as they have drawn so far.
  private pointAt(streams: RunStreams, session: Session): ResumeWalk {
    return { draws: streams.draws(), seed: streams.seed, session };
  }

  // Saves the walk so far with where the next launch resumes it, unless replayed.
  private saveCheckpoint(run: RunState): void {
    if (this.world?.recorder.replaying() === false) {
      void checkpointRun(this, checkpointOf(gameData, run), this.resumePoint);
    }
  }

  private resetState(): void {
    this.ambientMs = 0;
    this.celebrations.cancel();
    this.updateHold.reset();
    this.resumePoint = null;
    this.session = undefined;
    this.stepBefore = undefined;
    this.stepClock = startStepClock;
    this.world = undefined;
  }

  private createWorld(
    run: Pick<RunWorld, "random" | "recorder" | "setup" | "streams">,
    picked: Pick<RunSceneData, "loadout">,
  ): RunWorld {
    const { random, recorder } = run;
    const views = createRunViews(this, { random, roadArt: this.roadArt }, picked.loadout);
    const still = () => this.reducedMotion();
    return {
      ...run,
      ...views,
      banner: new ZoneBanner(this),
      input: new RunInput(this, {
        explainShown: () => this.explainShown(),
        replaying: () => recorder.replaying(),
        runPause: () => this.runPause(),
        walk: () => this.session?.walk,
      }),
      menus: new MenuFlow(this, {
        dropPress: () => this.world?.input.dropPress(),
        headHome: (destination) => this.headHome(destination),
        homeNote: () =>
          this.session === undefined ? [] : homeQuestionNote(gameData, this.session.walk.run),
        over: () => this.session === undefined || this.session.walk.run.phase.kind === "ended",
        pauseNote: () =>
          this.session === undefined ? "" : pauseNote(gameData, this.session.walk.run),
      }),
      moments: new RunMoments(this, {
        items: views.items,
        pack: views.pack,
        quips: random.quips,
        still,
      }),
      shadows: new ShadowPool(this),
    };
  }

  // A hidden tab, a window out of focus or the page frame turning pauses the walk under the pause
  // menu, which stays when the page comes back, so the walk resumes only on Resume.
  private listen(): void {
    // The run scene hears back before any overlay launched over it, so it reads the overlays as
    // they were when back was pressed; help and the settings close themselves.
    const onBack = () => {
      if (this.updateHold.takesBack) {
        return;
      }
      const over = this.session === undefined || this.session.walk.run.phase.kind === "ended";
      const action = walkBackAction(over, this.runPause());
      switch (action) {
        case "closeExplanation":
          this.closeExplanation();
          return;
        case "menu":
          this.openPause();
          return;
        case "none":
          return;
        case "resume":
          this.closePause();
          return;
        default:
          action satisfies never;
      }
    };
    const onHidden = () => {
      this.world?.menus.setPageHidden(true);
      this.openPause();
      const walk = this.session?.walk;
      if (walk !== undefined && walk.run.phase.kind !== "ended") {
        this.saveCheckpoint(walk.run);
      }
    };
    const onVisible = () => this.world?.menus.setPageHidden(false);
    const onBlur = () => {
      this.world?.input.dropPress();
      this.world?.menus.setPageBlurred(true);
      this.openPause();
    };
    const onFocus = () => this.world?.menus.setPageBlurred(false);
    onWindowEvent(this, "blur", onBlur);
    onWindowEvent(this, "focus", onFocus);
    onWindowEvent(this, PHONE_EVENTS.appHidden, onHidden);
    onWindowEvent(this, PHONE_EVENTS.appVisible, onVisible);
    onWindowEvent(this, PHONE_EVENTS.backPressed, onBack);
    // The page frame turning (the device turned between portrait and landscape) moves the whole
    // game on the screen, so the walk pauses as when the page loses focus.
    this.events.once(
      "shutdown",
      onFrameTurnChange(() => this.openPause()),
    );
    this.events.once("shutdown", () => stopWakeLock());
  }

  hudView(): RunHudView | undefined {
    const session = this.session;
    if (session === undefined) {
      return undefined;
    }
    const { run } = session.walk;
    return {
      affected: this.world?.menus.card()?.affected ?? [],
      explaining: this.world?.input.explanation(),
      packX: packPoint(session.walk).x,
      pressedEffect: this.world?.input.pressedEffect(),
      run,
    };
  }

  // What the HUD shows that a press can explain: the kinds of the walk's effects, its debuffs in the
  // order they began, and each card's dog.
  private explainShown(): ExplainShown {
    const run = this.session?.walk.run;
    if (run === undefined) {
      return NOTHING_SHOWN;
    }
    return {
      debuffs: run.debuffs.map(({ debuff }) => debuff),
      dogs: LAYOUT.dogSlots.map((_, i) => run.pack[i]?.dog),
      effects: effectItems(gameData, run).map((item) => item.kind),
    };
  }

  // The dog's centre column and top opaque row on the road, while it is shown there.
  dogPoint(dog: DogId): { x: number; y: number } | undefined {
    return this.world?.pack.dogPoint(dog);
  }

  // Whether animations and bursts keep still, from the player's settings.
  reducedMotion(): boolean {
    return this.settings?.reducedMotion ?? false;
  }

  override update(time: number): void {
    const session = this.session;
    if (session === undefined) {
      return;
    }
    this.world?.input.tick(this.game.loop.time);
    const timeScale = timeScaleOf(this.cheats);
    this.time.timeScale = timeScale;
    this.tweens.timeScale = timeScale;
    const frame = frameSteps({ ...STEPPING, timeScale }, time, this.stepClock);
    this.stepClock = frame.clock;
    for (let step = 0; step < frame.steps && this.walking(); step++) {
      this.stepBefore = this.session?.walk;
      const stop = this.session?.walk.road.hitStop;
      if (stop?.firing !== true) {
        this.ambientMs += STEP_MS;
      }
      this.simulate();
    }
    this.world?.pack.holdTrots(walkPaused(this.runPause()));
    if (!this.walking()) {
      this.stepClock = holdStepClock(this.stepClock);
      // A held walk draws as it stands, and goes on from there without a jump.
      this.stepBefore = this.session?.walk;
    }
    this.draw();
  }

  // Whether the walk is on, for This walk's cheats: started and not ended.
  cheatsApply(): boolean {
    return liveCheatRun(this.session) !== undefined;
  }

  activeCheats(): { readonly invincible: boolean; readonly zone: ZoneId } | undefined {
    return activeCheatsOf(this.session);
  }

  toggleInvincible(): void {
    const session = this.session;
    const active = this.activeCheats();
    if (session === undefined || active === undefined) {
      return;
    }
    this.world?.recorder.abandon();
    const planned = this.planDueZoneNow(session);
    const { walk } = planned;
    this.cheats = { ...this.cheats, invincible: !active.invincible };
    const changed = { ...walk, run: withCheats(this.cheats, walk.run) };
    this.session = { ...planned, walk: changed };
    this.stepBefore = changed;
    this.draw();
  }

  jumpToZone(zone: ZoneId): void {
    const { session, world } = this;
    if (session === undefined || world === undefined || !this.cheatsApply()) {
      return;
    }
    const next = cheatZoneJump(world.streams, zone, session);
    world.recorder.abandon();
    this.celebrations.cancel();
    world.menus.closeZoneOverlays();
    world.input.dropPress();
    world.input.takePending();
    this.stepClock = holdStepClock(this.stepClock);
    this.stepBefore = next.session.walk;
    this.apply(next, { zoneReplaced: next.session !== session });
    this.draw();
  }

  // The walk as This walk's cheat leaves it; it saves like any walk, and its replay recording
  // stops, as for every live run edit.
  cheat(cheat: WalkCheat): void {
    if (this.session === undefined || !this.cheatsApply()) {
      return;
    }
    const session = this.planDueZoneNow(this.session);
    this.world?.recorder.abandon();
    this.session = { ...session, walk: applyWalkCheat(cheat, session.walk) };
    this.stepBefore = this.session.walk;
    this.draw();
  }

  // The session with the zone it awaits planned here: a cheat pressed while the planner's plan is
  // still to come applies to the planned walk, as when the step plans the zone.
  private planDueZoneNow(session: Session): Session {
    const planned = cheatZonePlan(this.world?.streams, session);
    return planned === undefined ? session : this.takePlan(planned);
  }

  // A zone that fell due starts at once, as when its step planned it: its banner and music, and the
  // resume point and checkpoint at its start. The walk holds (runPause) until the planner's plan
  // for this session comes back; one for a session since replaced is dropped.
  private planDueZone(): void {
    const session = this.session;
    const world = this.world;
    if (session === undefined || world === undefined || !awaitsZonePlan(session)) {
      return;
    }
    this.zoneStarted(session, session.walk);
    pageZonePlanner().plan(world.streams.seed, session.walk, (planned) => {
      if (this.session === session) {
        this.takePlan(withZonePlan(session, planned));
      }
    });
  }

  private takePlan(session: Session): Session {
    this.session = session;
    this.stepBefore = session.walk;
    return session;
  }

  private walking(): boolean {
    const session = this.session;
    return (
      session !== undefined &&
      session.card === null &&
      session.walk.run.phase.kind === "walking" &&
      this.world !== undefined &&
      !walkPaused(this.runPause())
    );
  }

  // One fixed step with the inputs due now: replayed, or queued by the player.
  private simulate(): void {
    const session = this.session;
    const world = this.world;
    if (session === undefined || world === undefined) {
      return;
    }
    const inputs = world.recorder.due(session.timeMs) ?? world.input.takePending();
    this.apply(
      stepSession(gameData, world.streams, screenRoadGeometry, STEP_SECONDS, inputs, session),
    );
  }

  // Ends the walk with what the finished zones earned, as the Home answer or a replayed one does.
  private headHome(destination: EndDestination = "end"): void {
    this.endDestination = destination;
    if (this.session !== undefined) {
      this.apply(headHomeSession(this.session));
    }
  }

  // Takes the session's next state and plays its events, then ends the walk, or previews the
  // badges earned so far and shows the card it opened.
  private apply(step: SessionStep, options?: { readonly zoneReplaced: boolean }): void {
    const before = this.session?.walk.run;
    const { run } = step.session.walk;
    const { world } = this;
    this.session = step.session;
    // The fork reserves the next index before the player chooses its neighbourhood. Its
    // interim draw still uses the old neighbourhood; retire those visuals when the choice lands.
    if (
      world !== undefined &&
      (options?.zoneReplaced === true ||
        (before !== undefined && currentZoneId(gameData, before) !== currentZoneId(gameData, run)))
    ) {
      clearRunZoneViews(world);
    }
    if (before !== undefined) {
      world?.moments.debuffsChanged(before, run);
    }
    let opened: CardView | undefined;
    let celebration: CelebrationBatch | undefined;
    for (const event of step.events) {
      if (event.kind === "cardOpened") {
        opened = event.view;
      } else if (event.kind === "zoneEnded") {
        celebration = this.endZone(event);
      } else {
        this.react(before ?? step.session.walk.run, event);
      }
    }
    if (run.phase.kind === "ended") {
      if (run.phase.reason === "wentHome") {
        this.world?.moments.headedHome(run);
      }
      // Each walker a finished walk unlocks joins before the end screen.
      if (celebration === undefined) {
        this.endWalk();
      } else {
        this.celebrations.play(this.world?.menus, celebration, () => this.endWalk());
      }
      return;
    }
    this.world?.moments.previewAchievements(run);
    if (opened === undefined) {
      this.planDueZone();
      return;
    }
    const card = opened;
    if (celebration === undefined) {
      this.showCard(card);
    } else {
      this.celebrations.play(this.world?.menus, celebration, () => this.showCard(card));
    }
  }

  // Pays out the zone's fees. Unless replayed, saves the walk at the fork, where the next launch
  // resumes it, and returns the celebrations that play once the coins land: Neighbourhood done
  // between zones, and after the last zone a New walker for each walker the walk unlocks
  // (newWalkerCelebrations).
  private endZone(
    event: Extract<SessionEvent, { kind: "zoneEnded" }>,
  ): CelebrationBatch | undefined {
    const world = this.world;
    if (world === undefined) {
      return undefined;
    }
    const { after, before } = event;
    const payout = world.moments.payOut(event.fees, before);
    if (world.recorder.replaying()) {
      return undefined;
    }
    if (after.phase.kind === "ended") {
      const finishedWith = dogsFinishedWith(runResultOf(gameData, after));
      const owned = profileSave(this).owned.walkers;
      const celebrations = newWalkerCelebrations(gameData, owned, finishedWith);
      return celebrations.length === 0 ? undefined : { celebrations, delayMs: payout.ms };
    }
    if (this.session !== undefined) {
      this.resumePoint = this.pointAt(world.streams, forkPoint(this.session));
    }
    this.saveCheckpoint(after);
    const celebration = zoneCelebration({
      changes: payout.changes,
      walker: before.walker,
      zone: currentZone(gameData, before).name,
    });
    return { celebrations: [celebration], delayMs: payout.ms };
  }

  // An event's sounds, bursts, hints and labels, and the input log.
  private react(
    before: RunState,
    event: Exclude<SessionEvent, { kind: "cardOpened" | "zoneEnded" }>,
  ): void {
    const world = this.world;
    if (world === undefined) {
      return;
    }
    const { moments, recorder } = world;
    switch (event.kind) {
      case "chosen": {
        const { choice, outcome, timeMs } = event;
        recorder.log({ choice, kind: "card", timeMs });
        world.menus.closeCard();
        const over = overPack(packPoint(this.session?.walk));
        moments.addChanges(over, outcomeChanges(outcome));
        moments.chosen(outcome);
        moments.afterOutcome(outcome);
        return;
      }
      case "input":
        recorder.log({ ...event.input, timeMs: event.timeMs });
        return;
      case "drifted":
        return;
      case "pulled":
        moments.pulled(event.step);
        return;
      case "walked":
        moments.walked(before, packPoint(event.step.walk), event.step);
        return;
      case "zonePlanned":
        if (this.session !== undefined) {
          this.zoneStarted(this.session, event.unplanned);
        }
    }
  }

  // The zone session is about to walk starts. Its start, the fork taken, is where the next launch
  // resumes the walk, from unplanned, the walk before its plan.
  private zoneStarted(session: Session, unplanned: Walk): void {
    const world = this.world;
    if (world === undefined) {
      return;
    }
    this.startZone(session.walk.run);
    this.resumePoint = this.pointAt(world.streams, zoneStartPoint(session, unplanned));
    this.saveCheckpoint(session.walk.run);
  }

  // A zone starts with its banner and its own music loop, which plays until the next zone's
  // banner: through the celebration and the fork.
  private startZone(run: RunState): void {
    this.world?.banner.show(run, this.reducedMotion());
    soundboardOf(this).playMusic(musicKey(currentZone(gameData, run)));
  }

  private showCard(view: CardView): void {
    const world = this.world;
    if (world === undefined) {
      return;
    }
    world.menus.holdForCard(view);
    world.input.dropPress();
    cardHintTriggers(view.source).forEach((trigger) => showHint(this, trigger));
    const replayed = world.recorder.cardChoice();
    if (replayed === "home") {
      this.headHome();
      return;
    }
    if (replayed !== undefined) {
      this.choose(view, replayed);
      return;
    }
    world.menus.showCard(view, (choice) => this.choose(view, choice));
  }

  // A choice on a card that is no longer open picks nothing.
  private choose(view: CardView, choice: Choice): void {
    const session = this.session;
    const world = this.world;
    if (session === undefined || world === undefined) {
      return;
    }
    this.apply(
      chooseShownCard(
        gameData,
        world.streams,
        screenRoadGeometry,
        "deferred",
        view,
        choice,
        session,
      ),
    );
  }

  // What holds the walk still, for the walk's steps, the HUD's top bar, and lane moves: an
  // explanation's detail card or the zone plan the walk awaits holds it.
  runPause(): RunPause {
    const session = this.session;
    const hitStop = session?.walk.road.hitStop != null;
    const hold =
      this.world?.input.explanation() !== undefined ||
      (session !== undefined && awaitsZonePlan(session));
    return { ...(this.world?.menus.pause() ?? NOTHING_PAUSED), hitStop, hold };
  }

  openPause(mode: PauseSceneData["mode"] = "menu"): void {
    this.world?.menus.openPause(mode);
  }

  // Update now's prompt holds the walk under the pause menu, as a hidden page does, and takes back
  // while it shows. opened says whether the prompt opened the menu, which then launches at
  // Phaser's next step; the release closes it again.
  holdForUpdate(): { readonly opened: boolean; release(): void } {
    return this.updateHold.hold();
  }

  // Update now's save: the walk so far with where the next launch resumes it, as a hidden page
  // writes it. A finished or replayed walk writes nothing here.
  checkpointForUpdate(): Promise<void> {
    const walk = this.session?.walk;
    if (walk === undefined || walk.run.phase.kind === "ended" || this.world?.recorder.replaying()) {
      return Promise.resolve();
    }
    return checkpointRun(this, checkpointOf(gameData, walk.run), this.resumePoint);
  }

  // The walk bar's Help and Settings buttons.
  openFromBar(open: "help" | "settings"): void {
    this.world?.menus.openFromBar(open);
  }

  openTitleQuestion(): void {
    this.world?.menus.openTitleQuestion();
  }

  closeExplanation(): void {
    this.world?.input.dropPress();
  }

  closePause(): void {
    this.world?.menus.closePause();
  }

  // The walk bar's Settings button over the settings.
  closeSettings(): void {
    this.world?.menus.closeSettings();
  }

  // Saves the walk and its input log before its chosen destination, after the final payout.
  private endWalk(): void {
    const walk = this.session?.walk;
    const world = this.world;
    if (walk === undefined || world === undefined) {
      return;
    }
    const delayMs = world.moments.takeEndDelayMs();
    if (delayMs > 0) {
      this.time.delayedCall(delayMs, () => this.endWalk());
      return;
    }
    this.session = undefined;
    const sound = soundboardOf(this);
    sound.stopMusic();
    stopWakeLock();
    world.recorder.save();
    const overlays = [SCENE_KEYS.card, SCENE_KEYS.zoneCelebration, SCENE_KEYS.pause];
    for (const key of [SCENE_KEYS.hud, ...overlays]) {
      this.scene.stop(key);
    }
    // A replay banks nothing, so the save keeps the walk it plays again and has no end to show.
    if (world.recorder.replaying()) {
      this.scene.start(SCENE_KEYS.start);
      return;
    }
    const destination = endSceneFor(this.endDestination, walk.run.phase);
    const showDestination = () => this.scene.start(destination);
    finishRun(this, runResultOf(gameData, walk.run), world.moments.banked()).then(
      showDestination,
      (error: unknown) => {
        console.error("The run could not be saved.", error);
        showDestination();
      },
    );
  }

  // While a card or the pause menu holds the walk, or a firing holds it in its stop, the road's
  // sprites, the pack, the ambient movers and the distraction movers stand still.
  private draw(): void {
    const session = this.session;
    const world = this.world;
    if (session === undefined || world === undefined) {
      return;
    }
    const { distanceBeforeZone, pulls } = session;
    const before = this.stepBefore ?? session.walk;
    const halted = !this.walking();
    const alpha = stepAlpha(this.stepClock.bankedMs, STEP_MS);
    const lead = halted
      ? session.walk
      : leadWalk(gameData, LANE_COUNT, alpha * STEP_SECONDS, world.input.queued(), session.walk);
    const walk = blendWalk(alpha, before, lead);
    const still = this.reducedMotion();
    const held = halted || session.walk.road.hitStop?.firing === true;
    const ambientMs = this.ambientMs + (held ? 0 : alpha * STEP_MS);
    drawRunViews(world, { ambientMs, distanceBeforeZone, held, pulls, still }, walk);
  }
}
