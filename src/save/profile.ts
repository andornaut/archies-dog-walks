import {
  award,
  CelebrationQueue,
  type EarnedRecord,
  type EarnedStore,
  newlyEarned,
} from "@andornaut/game-kit/achievements";
import type {
  SaveStore,
  StoreLoadResult,
  StoreSaveResult,
} from "@andornaut/game-kit/save/saveStore";

import type { AchievementId, HintId } from "../data/types.ts";
import {
  type AchievementFacts,
  type AchievementJudge,
  achievementJudge,
  type AchievementScope,
} from "../rules/achievements.ts";
import type { Change } from "../rules/causes.ts";
import type { Cents } from "../units.ts";
import { earnedIfBanked } from "./achievementPreview.ts";
import {
  type AwardContext,
  bankCheckpoint,
  checkpointFacts,
  recordCheckpoint,
  recordRunEnd,
  runEndFacts,
  type RunResult,
} from "./checkpoint.ts";
import type { LaunchWalk, ResumeWalk } from "./resume.ts";
import type { Checkpoint, SaveDocument } from "./schema.ts";

// "unavailable" once storage could not be read, or while the last write failed: play goes on with
// the save in memory, and the home screen says progress won't be saved. A later write that succeeds
// makes it "available" again; a failed read lasts the session, since the store then writes nothing.
// "newer" when a later version of the game wrote the stored save or the earned record: play goes
// on with both in memory, nothing is written for the session, and the home screen's plate offers
// the newer version.
export type StorageState = "available" | "newer" | "unavailable";

// What the end screen shows beyond the saved stats: the achievements the run earned, whether
// it beat the best walk, and every change it made and the cash it lost, for the earnings
// breakdown.
export interface RunEnd {
  readonly achievements: readonly AchievementId[];
  readonly changes: readonly Change[];
  readonly lostCents: Cents;
  readonly newBestWalk: boolean;
}

interface OpenedProfile {
  load: StoreLoadResult<SaveDocument>;
  session: ProfileSession;
}

// The stores a profile keeps: the save, and the earned badges apart from it.
export interface ProfileStores {
  readonly earned: EarnedStore<AchievementId>;
  readonly save: SaveStore<SaveDocument>;
}

// How storage stands after loading the save and the earned record: a later version's or an
// unreadable one, either one's, before available.
function loadedState(
  save: StoreLoadResult<SaveDocument>,
  earned: StoreLoadResult<EarnedRecord<AchievementId>>,
): StorageState {
  const statuses = [save.status, earned.status];
  if (statuses.includes("newer")) {
    return "newer";
  }
  return statuses.includes("unavailable") ? "unavailable" : "available";
}

// What a launch does with a checkpoint: launchWalk in src/save/resume.ts. Without it, every
// checkpoint banks.
type LaunchDecision = (checkpoint: Checkpoint) => LaunchWalk;

const bankEvery: LaunchDecision = () => ({ kind: "bank", reason: "resuming is off" });

function withoutResume(checkpoint: Checkpoint): Checkpoint {
  const { resume, ...banked } = checkpoint;
  return resume === undefined ? checkpoint : banked;
}

// The player's save and earned badges for this page's life. Every change applies in memory at
// once, so a scene can read it straight after, and is then written in the order made, a run's
// badges before the save that banks it, so a run banked is never written without them.
export class ProfileSession {
  private readonly awards: AwardContext;
  private readonly stores: ProfileStores;
  // Earned and not yet celebrated: on launch, by a purchase, or before this page.
  private readonly celebrations = new CelebrationQueue<AchievementId>();
  private document: SaveDocument;
  private earnedIds: readonly AchievementId[];
  private readonly judge: AchievementJudge;
  private ended: RunEnd | null = null;
  private state: StorageState;
  private writes: Promise<void> = Promise.resolve();
  // The walk the launch resumes, until the walk takes it (takeResumedWalk).
  private resumable: ResumeWalk | null = null;
  // Set once the game has crashed: no later checkpoint keeps a resume point (stopResuming).
  private resumeStopped = false;

  private constructor(
    awards: AwardContext,
    stores: ProfileStores,
    document: SaveDocument,
    earned: readonly AchievementId[],
    state: StorageState,
  ) {
    this.awards = awards;
    this.stores = stores;
    this.document = document;
    this.earnedIds = earned;
    this.judge = achievementJudge(awards.data);
    this.state = state;
  }

  // Loads the save and the earned badges: the stored save, or else (none stored, or one that
  // could not be kept) a new player's. A run left unfinished at its last checkpoint resumes when
  // launch says so, the checkpoint kept until the run ends (takeResumedWalk); otherwise it is
  // banked as if the player had headed home, and the banked save is written back. Achievements
  // the save already meets (such as one from before they existed) are awarded, and wait to be
  // celebrated with those earned before and not yet celebrated.
  static async open(
    awards: AwardContext,
    stores: ProfileStores,
    launch: LaunchDecision = bankEvery,
  ): Promise<OpenedProfile> {
    const [load, earned] = await Promise.all([stores.save.load(), stores.earned.load()]);
    const loaded = load.save;
    const state = loadedState(load, earned);
    const session = new ProfileSession(awards, stores, loaded, earned.save.earned, state);
    session.celebrations.push(earned.save.unannounced);
    if (loaded.checkpoint !== null) {
      const decided = launch(loaded.checkpoint);
      if (decided.kind === "resume") {
        session.resumable = decided.walk;
      } else {
        if (decided.kind === "bank") {
          console.info(`The unfinished walk banks as heading home: ${decided.reason}`);
        }
        const banked = bankCheckpoint(awards, loaded);
        const run = checkpointFacts(loaded.checkpoint);
        session.celebrations.push(session.earn("bank", { run, save: banked }));
        await session.update(() => banked);
      }
    }
    session.celebrations.push(session.earn("profile", { save: session.save }));
    await session.writes;
    return { load, session };
  }

  get save(): SaveDocument {
    return this.document;
  }

  // The achievements earned, in the order earned.
  get earned(): readonly AchievementId[] {
    return this.earnedIds;
  }

  get storage(): StorageState {
    return this.state;
  }

  // The last run finished this session, or null before one.
  get lastRunEnd(): RunEnd | null {
    return this.ended;
  }

  // Resolves once this change, and every one before it, has been written or has failed. With
  // a newer version's save stored, the change stays in memory and nothing is written.
  update(change: (save: SaveDocument) => SaveDocument): Promise<void> {
    this.document = change(this.document);
    const document = this.document;
    return this.write("save", () => this.stores.save.save(document));
  }

  // Runs write after every write before it, and resolves once it has been made or has failed;
  // write resolves to undefined when it had nothing to write. With a newer version's save or
  // earned record stored, nothing is written.
  private write(what: string, write: () => Promise<StoreSaveResult | undefined>): Promise<void> {
    if (this.state === "newer") {
      return this.writes;
    }
    this.writes = this.writes.then(async () => {
      const result = await write();
      if (result === undefined) {
        return;
      }
      if (result.status === "invalid") {
        console.error(`The ${what} was not written: ${result.reason}`);
      } else {
        this.state = result.status === "saved" ? "available" : "unavailable";
      }
    });
    return this.writes;
  }

  // The badges facts newly earn at scope, awarded: earned at once, and written in turn. Returns
  // them, in wall order.
  private earn(scope: AchievementScope, facts: AchievementFacts): AchievementId[] {
    const { achievements } = this.awards.data;
    const added = newlyEarned(this.judge, achievements, scope, facts, this.earnedIds);
    if (added.length > 0) {
      this.earnedIds = award(added, this.earnedIds);
      void this.write("earned badges", async () => (await this.stores.earned.award(added)).save);
    }
    return added;
  }

  // The badges ids, celebrated as they show.
  private announce(ids: readonly AchievementId[]): void {
    for (const id of ids) {
      void this.write("earned badges", () => this.stores.earned.announced(id));
    }
  }

  shownHints(): ReadonlySet<HintId> {
    return new Set(this.document.shownHints);
  }

  markHintShown(hint: HintId): Promise<void> {
    if (this.document.shownHints.includes(hint)) {
      return this.writes;
    }
    return this.update((save) => ({ ...save, shownHints: [...save.shownHints, hint] }));
  }

  // What banking result now would newly earn, for a mid-run preview; nothing is written.
  earnedIfBanked(result: RunResult): AchievementId[] {
    return earnedIfBanked(this.awards, this.earnedIds, this.document, result);
  }

  // The walk the launch resumes, once: its resume point leaves the stored checkpoint, so a
  // resumed walk that crashes before it saves again banks on the next launch rather than
  // resuming into the crash. null when the launch resumes none.
  takeResumedWalk(): ResumeWalk | null {
    const walk = this.resumable;
    this.resumable = null;
    if (walk !== null) {
      void this.update((save) =>
        save.checkpoint === null ? save : recordCheckpoint(save, withoutResume(save.checkpoint)),
      );
    }
    return walk;
  }

  // Whether the launch resumes a walk, which takes it with takeResumedWalk.
  get resumesWalk(): boolean {
    return this.resumable !== null;
  }

  // Saves the run so far, with the point the next launch resumes it from unless the game has
  // crashed (stopResuming).
  checkpointRun(slice: Checkpoint): Promise<void> {
    const kept = this.resumeStopped ? withoutResume(slice) : slice;
    return this.update((save) => recordCheckpoint(save, kept));
  }

  // After a crash the walk in memory may be what broke, so the checkpoints it still writes (as
  // the page hides) bank on the next launch rather than resume.
  stopResuming(): void {
    this.resumeStopped = true;
  }

  // Banks the run, and the end screen celebrates the badges it earned.
  finishRun(result: RunResult, changes: readonly Change[]): Promise<void> {
    const before = this.document;
    const banked = recordRunEnd(this.awards, before, result);
    const achievements = this.earn("bank", { run: runEndFacts(result), save: banked });
    void this.update(() => banked);
    this.announce(achievements);
    // Banking raised the best for the walk's pack size.
    const size = result.dogs.length;
    this.ended = {
      achievements,
      changes,
      lostCents: result.lostCents,
      newBestWalk:
        banked.stats.bestCentsByPackSize[size] !== before.stats.bestCentsByPackSize[size],
    };
    return this.writes;
  }

  // A purchase, or another change to what the player owns: the ownership achievements it
  // meets are awarded and wait to be celebrated. The save is written first: a badge it earns
  // that is not written is awarded again on the next launch.
  purchase(change: (save: SaveDocument) => SaveDocument): Promise<void> {
    void this.update(change);
    this.celebrations.push(this.earn("profile", { save: this.document }));
    return this.writes;
  }

  // The achievements waiting to be celebrated on the home screen, once each: they count as
  // celebrated once taken.
  takeCelebrations(): AchievementId[] {
    const taken: AchievementId[] = [];
    for (let id = this.celebrations.take(); id !== undefined; id = this.celebrations.take()) {
      taken.push(id);
    }
    this.announce(taken);
    return taken;
  }
}
