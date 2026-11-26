import {
  type AchievementPreview,
  NOTHING_PREVIEWED,
  previewAchievements,
} from "@andornaut/game-kit/runtime/achievements/preview";
import type { Random } from "@andornaut/game-kit/runtime/random";
import type { Point } from "@andornaut/game-kit/runtime/rect";
import type { Scene } from "phaser";

import { playEffect } from "../../assets/phaser/index.ts";
import { choiceCues, contactCues, debuffSoundCue, pullCues, stepCues } from "../../audio/index.ts";
import { minorObstacleName } from "../../content/index.ts";
import type { AchievementId, DogId } from "../../data/ids.ts";
import { gameData, type HintTrigger } from "../../data/index.ts";
import {
  bumpLines,
  cashLostLabel,
  cashLostMs,
  changeLabels,
  debuffChanges,
  debuffLines,
  endScreenDelayMs,
  firedLine,
  FIRING_EVENT,
  type FiringCue,
  firingTimeline,
  FORGIVEN_EVENT,
  type ForgivenCue,
  forgivenLines,
  fullPackLine,
  gearFoundLine,
  heartPopDogs,
  heartPopFrame,
  leashPops,
  luckyLine,
  type MessageLine,
  type Payout,
  PAYOUT_EVENT,
  type PayoutCue,
  payoutFlights,
  payoutMs,
  pullLine,
  reachedLabels,
  reachIcons,
  roadMarks,
  SPARE_TREAT_EVENT,
  type SpareTreatCue,
  spareTreatUsedLine,
  stepHintTriggers,
  stepValues,
  totalLabel,
  TREAT_EVENT,
  type TreatCue,
  treatGrabLine,
  walkStartMarks,
} from "../../hud/index.ts";
import {
  BUFF_POP,
  contactDebuffBatch,
  ContactImpactFrame,
  contactImpacts,
  DOG_REACTIONS,
} from "../../layout/index.ts";
import { type EffectItem, effectItems, gearWell } from "../../presentation/index.ts";
import {
  type Change,
  type ChoiceOutcome,
  type HeartChange,
  heartsForgiven,
  hintFor,
  type MoneyChange,
  outcomeChanges,
  type QuipCue,
  quipLine,
  spareTreatGiver,
  spareTreatSource,
  walkEarnings,
  walkLength,
} from "../../rules/index.ts";
import type { PullStep, WalkItem, WalkStep } from "../../runner/index.ts";
import { previewedEarned, previewKey, type RunResult } from "../../save/index.ts";
import { type EffectSource, type EndReason, packDogs, type RunState } from "../../state/index.ts";
import { sayMessage } from "../messageStripView.ts";
import { type HeartPopPlace, playDodge, playForgiven } from "../packFeedback.ts";
import { earnedIfBanked, shownHints } from "../profileStore.ts";
import { SCENE_KEYS } from "../sceneKeys.ts";
import { soundboardOf } from "../soundboard.ts";
import { playContactDebuff } from "./contactDebuffFx.ts";
import type { ItemViews } from "./itemViews.ts";
import type { PackView } from "./packView.ts";
import { showDebuffPopup, showGearPopup, showInstantPopup } from "./roadBanners.ts";
import { markRoad, popBuffs, popInkTop } from "./runBuffMoments.ts";
import { flashBump, playBumpHit, playContactHit, playHit } from "./runHitMoments.ts";
import {
  ACHIEVEMENTS_EVENT,
  BUFF_GLINT_EVENT,
  CHANGE_LABELS_EVENT,
  HINT_EVENT,
  type OwnerQuip,
  QUIPS_EVENT,
} from "./runMomentEvents.ts";
import { DEPTH, firingSeconds, overPack } from "./stage.ts";
import { stepSparkles } from "./tipSparkle.ts";

export {
  ACHIEVEMENTS_EVENT,
  BUFF_GLINT_EVENT,
  BUMP_FLASH_EVENT,
  CHANGE_LABELS_EVENT,
  HINT_EVENT,
  type OwnerQuip,
  QUIPS_EVENT,
  type RaisedHint,
} from "./runMomentEvents.ts";

// Raises the first-time hint for event until it has shown once: the HUD says it on the
// message strip and marks it shown.
export function showHint(scene: Scene, event: HintTrigger): void {
  const hint = hintFor(gameData, [...shownHints(scene)], event);
  if (hint !== null) {
    // A hint raised as the run starts waits a frame for the HUD it launches.
    if (scene.scene.isActive(SCENE_KEYS.hud)) {
      scene.events.emit(HINT_EVENT, hint);
    } else {
      scene.time.delayedCall(0, () => scene.events.emit(HINT_EVENT, hint));
    }
  }
}

// Nothing for the end screen to wait for.
const NO_END_MOMENTS: Readonly<Parameters<typeof endScreenDelayMs>[0]> = {
  firingSeconds: 0,
  lossMs: 0,
  payoutMs: 0,
};

// A zone's payout: how long until its coins have landed and their amounts faded, and every
// change the zone made, its fees included.
interface ZonePayout {
  readonly changes: readonly Change[];
  readonly ms: number;
}

interface RunMomentsDeps {
  items: ItemViews;
  pack: PackView;
  quips: Random;
  // Whether animations and bursts keep still, from the player's settings.
  still: () => boolean;
}

// What the walk's events look and sound like: sounds, bursts, hit moments, labels, quips,
// hints and badge lines, and the HUD's feedback moments they cue. It keeps the money and
// heart changes the run banks, and what the end screen waits for.
export class RunMoments {
  private achievements: AchievementPreview<AchievementId> = NOTHING_PREVIEWED;
  private readonly changes: Change[] = [];
  private readonly contactFrame = new ContactImpactFrame<WalkItem>();
  private readonly deps: RunMomentsDeps;
  // How long the end screen waits for a final firing, the cash it lost, or a payout.
  private endMoments = { ...NO_END_MOMENTS };
  // The pack's point on the last step walked, for pops away from a dog or an item.
  private pack: Point | undefined;
  // The heart pops over dogs in the step being walked, which its charms and forgiven labels
  // stack over (stackOverPop).
  private heartPops = new Map<DogId, HeartPopPlace>();
  private readonly scene: Scene;
  // Where the current zone's changes start in changes.
  private zoneStart = 0;

  constructor(scene: Scene, deps: RunMomentsDeps) {
    this.scene = scene;
    this.deps = deps;
  }

  private hint(event: HintTrigger): void {
    showHint(this.scene, event);
  }

  // Every change the walk made, in order, for banking the run.
  banked(): readonly Change[] {
    return this.changes;
  }

  // How long the end screen still waits for a final firing or payout; once asked, it waits
  // no longer.
  takeEndDelayMs(): number {
    const delayMs = endScreenDelayMs(this.endMoments);
    if (delayMs > 0) {
      this.endMoments = { ...NO_END_MOMENTS };
    }
    return delayMs;
  }

  // The changes' labels, a money loss's from from, where it changed hands, and a money gain's by
  // the cash (changeLabels), each carrying reachIcon for a pickup grabbed by reach
  // (reachedLabels), and each loss the walker's perk forgave: its strip line, the forgiven label
  // over its dog forgivenAtMs on and the forgiven heart flashing back on its card.
  addChanges(
    from: Point,
    changes: readonly Change[],
    forgivenAtMs = 0,
    reachIcon: string | undefined = undefined,
  ): void {
    this.changes.push(...changes);
    const labels = reachedLabels(reachIcon, changeLabels(from, changes));
    if (labels.length > 0) {
      this.scene.events.emit(CHANGE_LABELS_EVENT, labels);
    }
    forgivenLines(gameData, changes).forEach((line) => this.say(line));
    for (const change of changes) {
      if (change.kind === "hearts" && heartsForgiven(change) > 0) {
        this.forgiven(change, forgivenAtMs);
      }
    }
  }

  private forgiven(change: HeartChange, atMs: number): void {
    const pop = this.heartPops.get(change.dog);
    const label = () => {
      const top = this.deps.pack.dogPoint(change.dog);
      if (top !== undefined) {
        const moment = { depth: DEPTH.fx, still: this.deps.still() };
        playForgiven(this.scene, moment, { pop: pop ?? null, top });
      }
    };
    if (atMs > 0) {
      this.scene.time.delayedCall(atMs, label);
    } else {
      label();
    }
    if (change.after > 0) {
      const cue: ForgivenCue = { dog: change.dog, hearts: change.after };
      this.scene.events.emit(FORGIVEN_EVENT, cue);
    }
  }

  // A tell barks and says which dog spotted the squirrel; a strain that ends without a pull,
  // blocked or steered away from, bursts over its dog and says nothing. A landed pull plays the
  // squirrel's sound and raises its hint (pullCues). The strain, the bubble and the bark pop are
  // drawn with the pack.
  pulled(step: PullStep): void {
    const sound = soundboardOf(this.scene);
    pullCues(step).forEach((cue) => sound.play(cue));
    if (step.tells.length > 0) {
      this.hint({ kind: "pull" });
    }
    for (const tell of step.tells) {
      this.say(pullLine(gameData, tell.dog));
    }
    if (step.pulled.some(({ moved }) => moved)) {
      this.hint({ kind: "pullLanded" });
    }
    this.deps.pack.pullFailed(step.failed);
    popBuffs(
      this.scene,
      this.deps,
      { heartPops: this.heartPops, point: this.pack },
      leashPops(gameData, step.walk.run, step.leashed),
    );
  }

  // A line on the HUD's message strip, when there is one.
  say(line: MessageLine | null): void {
    if (line !== null) {
      sayMessage(this.scene, line);
    }
  }

  // Sounds (stepCues), bursts, labels, hints and strip lines for what happened in a step,
  // around the pack at pack.
  walked(before: RunState, pack: Point, step: WalkStep): void {
    this.pack = pack;
    this.heartPops = this.hudHeartPops(step);
    const marks = roadMarks(gameData, stepValues(step));
    markRoad(this.scene, this.deps, { heartPops: this.heartPops, point: this.pack }, marks);
    const reached = reachIcons(marks.reaches);
    this.deps.items.strike(step);
    const sound = soundboardOf(this.scene);
    const materials = new Set(contactCues(gameData, step));
    stepCues(gameData, step).forEach((cue) => {
      if (materials.has(cue)) {
        sound.playContact(cue);
      } else {
        sound.play(cue);
      }
    });
    if (step.tips.length > 0) {
      this.hint({ kind: "tip" });
    }
    // A tip's label pops by the cash, wherever its pickup (changeLabels), with the reaching
    // buff's icon when grabbed by reach.
    for (const { change, item } of step.tips) {
      this.addChanges(overPack(pack), [change], 0, reached.get(item.id));
    }
    // A tip, or a treat that pays cash, twinkles over the lead dog, its only sparkle; everything
    // else grabbed sparkles over the pack.
    const sparkles = stepSparkles(step);
    if (sparkles.tip) {
      this.deps.pack.tipGrabbed(this.deps.still());
    }
    sparkles.overPack.forEach(() => {
      playEffect(this.scene, "fx-sparkle", "play", overPack(pack), DEPTH.fx);
    });
    if (step.treats.length > 0) {
      this.hint({ kind: "treat" });
    }
    // A treat cheers the owner of the dog that grabbed it, or with every owner at their max goes
    // into the gear that holds spare treats, such as the Fanny pack, whose well glints, or pays
    // cash, whose label pops by the cash as a lucky find's does (changeLabels). A treat grabbed
    // by reach carries the reaching buff's icon on its heart and label, or its cash's label.
    for (const grab of step.treats) {
      const { cash, change, dog, item, stored } = grab;
      this.say(treatGrabLine(gameData, grab, step.walk.run));
      if (stored) {
        this.glintGear(spareTreatSource(step.walk.run));
        continue;
      }
      if (cash !== null) {
        this.addChanges(overPack(pack), [cash], 0, reached.get(item.id));
      }
      if (change !== null) {
        this.changes.push(change);
        const labels = changeLabels(overPack(pack), [change]);
        const cue: TreatCue = { dog, labels: reachedLabels(reached.get(item.id), labels) };
        this.scene.events.emit(TREAT_EVENT, cue);
      }
    }
    // A bump costs the owner of the dog it landed on; the dog may dodge it.
    for (const bump of step.bumps) {
      const moment = { depth: DEPTH.fx, still: this.deps.still() };
      const { kind, skin } = bump.item;
      bumpLines(gameData, bump, minorObstacleName(gameData, kind, skin)).forEach((said) => {
        this.say(said);
      });
      if (bump.dodged) {
        this.deps.pack
          .sprites([bump.dog])
          .forEach((sprite) => playDodge(this.scene, moment, sprite));
        continue;
      }
      playBumpHit(this.scene, this.deps, { ground: false }, bump.dog, bump.item, step);
      this.addChanges(
        overPack(pack),
        [bump.change, bump.cash].flatMap((change) => (change === null ? [] : [change])),
        BUFF_POP.fadeAtMs,
      );
      this.hint({ kind: "minorBump" });
    }
    this.spareTreatSpent(step.spareTreat, step.walk.run);
    // A contact obstacle, such as a puddle, plays its own hit sound, a splash at the touching
    // dog's feet, its edge flash and the bump's flash, with a plain obstacle's stop; the walker
    // stumbles and every dog reacts and shakes off. A minor obstacle with contact plays its bump's
    // cues instead (playBumpHit), as the splash, the shake-off and the edge flash strips are a
    // contact obstacle's own. Applied or refreshed debuffs add one lead-dog ground cue and
    // sound per kind in this contact batch; each contact still pops its own changes.
    const impacts = this.contactFrame.take(
      this.scene.game.loop.frame,
      contactImpacts(gameData, step),
    );
    for (const { dog, item, source } of impacts) {
      if (source.kind === "minor") {
        playBumpHit(
          this.scene,
          this.deps,
          { ground: true },
          dog,
          { ...item, kind: source.obstacle },
          step,
        );
      } else {
        playContactHit(this.scene, this.deps, dog, source.encounter, step);
      }
    }
    for (const { outcome } of step.contacts) {
      this.addChanges(overPack(pack), outcomeChanges(outcome));
      this.afterOutcome(outcome);
    }
    stepHintTriggers(step).forEach((trigger) => this.hint(trigger));
    const debuffCues = this.contactFrame.takeDebuffs(
      this.scene.game.loop.frame,
      contactDebuffBatch(
        this.deps.still(),
        before,
        step.contacts.map(({ outcome, source }) => {
          const contact =
            source.kind === "minor"
              ? gameData.minorObstacles[source.obstacle].contact
              : gameData.encounters[source.encounter].resolution;
          return {
            after: outcome.state,
            effects: contact !== undefined && "effects" in contact ? contact.effects : [],
          };
        }),
      ),
    );
    const lead = packDogs(step.walk.run)[0];
    const leadTop = lead === undefined ? undefined : this.deps.pack.dogPoint(lead);
    for (const cue of debuffCues) {
      if (leadTop !== undefined) {
        showDebuffPopup(this.scene, leadTop, cue.debuff);
      }
      sound.play(debuffSoundCue(cue.debuff));
      playContactDebuff(
        this.scene,
        {
          depth: DEPTH.sprite - 0.5,
          dogs: packDogs(step.walk.run),
          feet: (dog) => this.deps.pack.dogFeet(dog),
        },
        cue,
      );
    }
    this.sayQuips(step.fired.map((dog): QuipCue => ({ dog, moment: "fired" })));
    this.fired(step.fired, step.walk.run);
    // A lucky find's money changes hands at its pickup; a gain's label pops by the cash
    // (changeLabels), and its popup over the pickup and its strip line show the find.
    for (const { encounter, item, outcome } of step.instants) {
      const changes = outcomeChanges(outcome);
      const at = this.itemPoint(item, pack);
      this.addChanges(at, changes);
      showInstantPopup(this.scene, encounter, at, this.deps.still());
      this.say(luckyLine(gameData, encounter));
      this.afterOutcome(outcome);
      this.hint({ kind: "luckyFind" });
    }
    // A gear drop pops its art over the pickup and glints the found well, whose icon it takes.
    for (const { gear, item, replaced } of step.found) {
      showGearPopup(this.scene, gear, this.itemPoint(item, pack), this.deps.still());
      this.say(gearFoundLine(gameData, gear, replaced));
      const well: EffectItem = { found: true, gear, kind: "gear" };
      this.scene.events.emit(BUFF_GLINT_EVENT, well);
    }
    for (const hit of step.encounterHits) {
      const { kind } = gameData.encounters[hit.encounter];
      this.deps.pack.stumble(this.deps.still(), DOG_REACTIONS.hit);
      playHit(this.scene, this.deps, hit, step, pack);
      if (kind === "obstacle") {
        flashBump(this.scene, this.deps, { encounter: hit.encounter, kind: "encounter" });
      }
    }
    this.heartPops = new Map();
  }

  // The HUD's heart pop over each dog whose hearts the step changes, where heartFeedback.ts
  // plays it.
  private hudHeartPops(step: WalkStep): Map<DogId, HeartPopPlace> {
    const inkTop = popInkTop(this.scene);
    return new Map(
      heartPopDogs(step).flatMap((dog): [DogId, HeartPopPlace][] => {
        const top = this.deps.pack.dogPoint(dog);
        return top === undefined ? [] : [[dog, { frame: heartPopFrame(top), inkTop }]];
      }),
    );
  }

  // The debuffs that started and ended between two run states, on the message strip.
  debuffsChanged(before: RunState, after: RunState): void {
    debuffLines(gameData, debuffChanges(before, after)).forEach((line) => this.say(line));
  }

  // The owners' quips at a choice or find, the spare treat it spent and the firings it brought
  // about.
  afterOutcome(outcome: ChoiceOutcome): void {
    this.sayQuips(outcome.quips);
    this.spareTreatSpent(outcome.spareTreat, outcome.state);
    this.fired(outcome.fired, outcome.state);
  }

  // A spare treat given back: its strip line, the treat sound, and the treat flying from its gear's well to the
  // dog's card, where it plays as a treat grabbed (SpareTreatCue).
  private spareTreatSpent(change: HeartChange | null, run: RunState): void {
    if (change === null) {
      return;
    }
    this.changes.push(change);
    soundboardOf(this.scene).play("treat");
    this.say(spareTreatUsedLine(gameData, change));
    const cue: SpareTreatCue = {
      dog: change.dog,
      labels: changeLabels(this.pack ?? { x: 0, y: 0 }, [change]),
      well: gearWell(effectItems(gameData, run), spareTreatGiver(change)),
    };
    this.scene.events.emit(SPARE_TREAT_EVENT, cue);
  }

  // The walk bar well of the gear source names glints.
  private glintGear(source: EffectSource | undefined): void {
    if (source?.kind === "gear") {
      this.scene.events.emit(BUFF_GLINT_EVENT, source);
    }
  }

  // Each owner who fired you has their dog trot off the road over the firing's hold, with
  // their fired line. When the last one fires you, the walk loses its cash (cashLost) once the
  // firing has played.
  private fired(dogs: readonly DogId[], run: RunState): void {
    if (dogs.length === 0) {
      return;
    }
    soundboardOf(this.scene).play("fired");
    dogs.forEach((dog) => this.say(firedLine(gameData, dog)));
    const still = this.deps.still();
    const { trotMs } = firingTimeline(firingSeconds(), still);
    dogs.forEach((dog) => this.deps.pack.trotOff(dog, trotMs, still));
    if (run.phase.kind !== "ended") {
      return;
    }
    this.endMoments.firingSeconds = firingSeconds();
    this.cashLost(run.phase.reason, run);
  }

  // A walk that heads home loses its cash (cashLost).
  headedHome(run: RunState): void {
    this.cashLost("wentHome", run);
  }

  // The cash a walk ending for reason carried and lost (walkEarnings) pops by the cash and the
  // counter counts down to what the walk keeps, before the end screen opens. The loss stays out
  // of the banked changes: the end screen's breakdown takes it from the run's result.
  private cashLost(reason: EndReason, run: RunState): void {
    const { lost } = walkEarnings(reason, run);
    if (lost > 0) {
      this.scene.events.emit(CHANGE_LABELS_EVENT, [cashLostLabel(lost)]);
      this.endMoments.lossMs = cashLostMs(this.deps.still(), lost);
    }
  }

  // Each owner who reacted says one of their lines on the message strip; an owner who fired you
  // says theirs in the firing moment.
  sayQuips(quips: readonly QuipCue[]): void {
    const random = this.deps.quips;
    const lines = quips.map((cue) => ({ cue, text: quipLine(gameData, random, cue) }));
    const said = lines.flatMap(({ cue, text }): OwnerQuip[] =>
      cue.moment === "fired" ? [] : [{ dog: cue.dog, text }],
    );
    if (said.length > 0) {
      this.scene.events.emit(QUIPS_EVENT, said);
    }
    for (const { cue, text } of lines) {
      if (cue.moment === "fired") {
        const firing: FiringCue = { dog: cue.dog, line: text, seconds: firingSeconds() };
        this.scene.events.emit(FIRING_EVENT, firing);
      }
    }
  }

  // Badges the walk so far would earn on heading home show on the HUD's message strip; nothing
  // is awarded until the walk is banked.
  previewAchievements(run: RunState): void {
    const banked = (result: RunResult) => earnedIfBanked(this.scene, result);
    const earned = (subject: RunState) => previewedEarned(gameData, banked, subject);
    const preview = previewAchievements(previewKey, earned, this.achievements, run);
    this.achievements = preview.preview;
    if (preview.earned.length > 0) {
      this.scene.events.emit(ACHIEVEMENTS_EVENT, preview.earned);
    }
  }

  // A card choice's heart loss sound (choiceCues), and its values a buff changed, such as a loss
  // forgiven or a debuff shortened: a pop over the owner's dog, or the pack.
  chosen(outcome: ChoiceOutcome): void {
    const sound = soundboardOf(this.scene);
    choiceCues(outcomeChanges(outcome)).forEach((cue) => sound.play(cue));
    const values = outcome.modified.map((value) => ({
      bump: false,
      dog: value.subject.kind === "hearts" ? value.subject.dog : null,
      item: null,
      value,
    }));
    markRoad(
      this.scene,
      this.deps,
      { heartPops: this.heartPops, point: this.pack },
      roadMarks(gameData, values),
    );
  }

  // The walk's start: a strip line for each gear that changes it from the start, its well
  // glinting, and a line for each large dog.
  walkStarted(run: RunState): void {
    const marks = walkStartMarks(gameData, run);
    marks.lines.forEach((line) => this.say(line));
    marks.glints.forEach((item) => this.scene.events.emit(BUFF_GLINT_EVENT, item));
  }

  // Where an item is on screen, else over the pack at pack.
  private itemPoint(item: WalkItem, pack: Point): Point {
    return this.deps.items.point(item.id) ?? overPack(pack);
  }

  // At a zone's end, each dog's pay flies as a coin from its card to the bank while the total
  // the zone's end pays shows by the cash. Returns the zone's changes, for its celebration, and
  // how long the coins take to land and the total to fade.
  payOut(fees: readonly MoneyChange[], run: RunState): ZonePayout {
    this.changes.push(...fees);
    const payout: Payout = {
      fees: fees.flatMap((fee): PayoutCue[] =>
        fee.dog === null ? [] : [{ amount: fee.amount, dog: fee.dog }],
      ),
      total: totalLabel(fees),
    };
    this.scene.events.emit(PAYOUT_EVENT, payout);
    this.say(fullPackLine(gameData, fees));
    const flights = payoutFlights(payout.fees, run.pack, this.deps.still());
    const ms = payout.total === null ? 0 : payoutMs(flights);
    if (run.zoneIndex >= walkLength(gameData) - 1) {
      this.endMoments.payoutMs = ms;
    }
    const changes = this.changes.slice(this.zoneStart);
    this.zoneStart = this.changes.length;
    return { changes, ms };
  }
}
