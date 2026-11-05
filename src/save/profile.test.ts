import type { EarnedRecord } from "@andornaut/game-kit/achievements";
import { keysOf } from "@andornaut/game-kit/records";
import { memoryStorage, type SaveStorage } from "@andornaut/game-kit/save/storage";
import { encodeSave } from "@andornaut/game-kit/save/versionedSave";
import { storageFixture } from "@andornaut/game-kit/testing/storageFixture";
import { describe, expect, it, vi } from "vitest";

import { gameData } from "../data/index.ts";
import type { AchievementId } from "../data/types.ts";
import { packOf, runFactsFor, saveFor } from "../testing/achievements.ts";
import {
  quietCounters,
  testAwards,
  testContext,
  VETERAN_EARNED,
  veteranSave,
} from "../testing/saves.ts";
import { cents } from "../units.ts";
import { earnedIfBanked } from "./achievementPreview.ts";
import { ProfileSession, type ProfileStores } from "./profile.ts";
import type { LaunchWalk, ResumeWalk } from "./resume.ts";
import { type Checkpoint, DEFAULT_SETTINGS, SAVE_VERSION, type SaveDocument } from "./schema.ts";
import {
  EARNED_KEYS,
  EARNED_VERSION,
  earnedRecordFormat,
  gameEarnedStore,
  gameSaveStore,
  SAVE_KEYS,
} from "./storage.ts";

const awards = testAwards;

// The save and the earned badges, both in storage.
function storesOn(storage: SaveStorage): ProfileStores {
  return { earned: gameEarnedStore(gameData, storage), save: gameSaveStore(testContext, storage) };
}

function stored(entries: Map<string, string>): SaveDocument {
  return JSON.parse(entries.get(SAVE_KEYS.save) ?? "null") as SaveDocument;
}

function storedEarned(entries: Map<string, string>): EarnedRecord<AchievementId> {
  return JSON.parse(entries.get(EARNED_KEYS.save) ?? "null") as EarnedRecord<AchievementId>;
}

// Storage holding save, and record as the earned badges.
function entriesOf(
  save: SaveDocument | null,
  record: EarnedRecord<AchievementId> = { earned: [], unannounced: [] },
): Map<string, string> {
  const entries = new Map<string, string>();
  if (save !== null) {
    entries.set(SAVE_KEYS.save, JSON.stringify(save));
  }
  const encoded = encodeSave(earnedRecordFormat(gameData), record);
  if (!encoded.ok) {
    throw new Error(encoded.reason);
  }
  entries.set(EARNED_KEYS.save, encoded.value);
  return entries;
}

// A save, with earned the badges it has earned and celebrated.
async function opened(save: SaveDocument | null = null, earned: readonly AchievementId[] = []) {
  const entries = entriesOf(save, { earned, unannounced: [] });
  const { load, session } = await ProfileSession.open(awards, storesOn(memoryStorage(entries)));
  return { entries, load, session };
}

// veteranSave's player, with the badges it has earned.
const openedVeteran = (save: SaveDocument = veteranSave()) => opened(save, VETERAN_EARNED);

// Lets every write already asked for start.
const settle = () =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });

describe("ProfileSession.open", () => {
  it("starts a new player from the defaults, through newPlayer", async () => {
    const { session } = await ProfileSession.open(awards, storesOn(memoryStorage()), (save) => ({
      ...save,
      settings: { ...save.settings, reducedMotion: true },
    }));
    expect(session.save.settings.reducedMotion).toBe(true);
    expect(session.save.owned.dogSlots).toEqual(testContext.defaults.dogSlots);
    expect(session.save.lastLoadout.dogs).toEqual(testContext.defaults.freeDogs.slice(0, 1));
  });

  it("keeps a loaded save and its earned badges as stored", async () => {
    const { session } = await openedVeteran();
    expect(session.save).toEqual(veteranSave());
    expect(session.earned).toEqual(VETERAN_EARNED);
    expect(session.storage).toBe("available");
  });

  it("drops the earned badges the game no longer has", async () => {
    const record = { earned: ["retiredBadge", "wholeCity"], unannounced: ["retiredBadge"] };
    const entries = entriesOf(veteranSave(), record as EarnedRecord<AchievementId>);
    const { session } = await ProfileSession.open(awards, storesOn(memoryStorage(entries)));
    expect(session.earned).toEqual(["wholeCity"]);
    expect(session.takeCelebrations()).toEqual([]);
  });

  it("banks a run left at a checkpoint as headed home and writes it back", async () => {
    const checkpoint = {
      counters: quietCounters(),
      dogs: [{ firedInZone: null, id: "kilo" as const }],
      earnedCents: cents(1_000),
      route: ["distilleryDistrict" as const, "highPark" as const],
      zonesFinished: 2,
    };
    const { entries, session } = await openedVeteran({ ...veteranSave(), checkpoint });
    expect(session.save.checkpoint).toBeNull();
    expect(session.save.bankCents).toBe(12_345 + 1_000);
    expect(session.save.stats.runs.wentHome).toBe(3);
    expect(stored(entries).bankCents).toBe(12_345 + 1_000);
  });

  // A failed read leaves storage unavailable for the session, though writes would succeed.
  it.each<[string, SaveStorage]>([
    ["storage throws", storageFixture({ unavailable: true })],
    ["a read fails", storageFixture({ readThrows: new Error("blocked") })],
  ])("plays on in memory, storage unavailable, when %s", async (_, storage) => {
    const { load, session } = await ProfileSession.open(awards, storesOn(storage));
    expect(load.status).toBe("unavailable");
    await session.update((save) => ({ ...save, bankCents: cents(5) }));
    expect(session.save.bankCents).toBe(5);
    expect(session.storage).toBe("unavailable");
  });
});

describe("achievements away from a run", () => {
  it("awards on launch what the save already meets, and celebrates it once", async () => {
    const fired = saveFor(gameData, ["youreFired"], veteranSave());
    const { entries, session } = await openedVeteran(fired);
    expect(session.earned).toEqual([...VETERAN_EARNED, "youreFired"]);
    expect(storedEarned(entries).earned).toEqual([...VETERAN_EARNED, "youreFired"]);
    expect(session.takeCelebrations()).toEqual(["youreFired"]);
    expect(session.takeCelebrations()).toEqual([]);
    await settle();
    expect(storedEarned(entries).unannounced).toEqual([]);
  });

  it("celebrates on launch the badges earned before and not yet celebrated", async () => {
    const record = { earned: VETERAN_EARNED, unannounced: ["squirrel" as const] };
    const entries = entriesOf(veteranSave(), record);
    const { session } = await ProfileSession.open(awards, storesOn(memoryStorage(entries)));
    expect(session.takeCelebrations()).toEqual(["squirrel"]);
  });

  it("awards and celebrates an ownership achievement bought on the home screen", async () => {
    const { entries, session } = await openedVeteran();
    const allGear = keysOf(gameData.shopGear);
    await session.purchase((save) => ({ ...save, owned: { ...save.owned, gear: [...allGear] } }));
    expect(session.earned).toContain("kittedOut");
    expect(storedEarned(entries).earned).toContain("kittedOut");
    expect(session.takeCelebrations()).toEqual(["kittedOut"]);
  });

  it("leaves a save that meets nothing new unwritten", async () => {
    const storage = memoryStorage(
      entriesOf(veteranSave(), { earned: VETERAN_EARNED, unannounced: [] }),
    );
    const write = vi.spyOn(storage, "write");
    await ProfileSession.open(awards, storesOn(storage));
    expect(write).not.toHaveBeenCalled();
  });

  it("starts a new earned record when the stored one is from an older version", async () => {
    const entries = entriesOf(veteranSave());
    const older = { earned: VETERAN_EARNED, unannounced: [], version: EARNED_VERSION - 1 };
    entries.set(EARNED_KEYS.save, JSON.stringify(older));
    const { session } = await ProfileSession.open(awards, storesOn(memoryStorage(entries)));
    expect(session.earned).not.toContain("squirrel");
  });
});

describe("ProfileSession.update", () => {
  it("changes the save at once and writes the changes in order, each after the last", async () => {
    // The first write waits until released, so a second write not chained after it lands first.
    const written: number[] = [];
    let release = () => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const storage: SaveStorage = {
      read: async () => null,
      write: async (_key, value) => {
        const { bankCents } = JSON.parse(value) as SaveDocument;
        if (bankCents === 100) {
          await held;
        }
        written.push(bankCents);
      },
    };
    const { session } = await ProfileSession.open(awards, storesOn(storage));
    const first = session.update((save) => ({ ...save, bankCents: cents(100) }));
    expect(session.save.bankCents).toBe(100);
    const second = session.update((save) => ({ ...save, bankCents: cents(200) }));
    await settle();
    release();
    await Promise.all([first, second]);
    expect(written.slice(-2)).toEqual([100, 200]);
  });

  it("reports storage unavailable while writes fail, and available once one succeeds", async () => {
    const flaky = storageFixture({ quota: 0 });
    const { session } = await ProfileSession.open(awards, storesOn(flaky));
    await session.update((save) => save);
    expect(session.storage).toBe("unavailable");
    delete flaky.failures.quota;
    await session.update((save) => save);
    expect(session.storage).toBe("available");
  });
});

describe("settings", () => {
  it("saves new settings and tells every listener until it stops listening", async () => {
    const { entries, session } = await opened();
    const listener = vi.fn();
    const off = session.onSettingsChanged(listener);
    const quiet = { ...DEFAULT_SETTINGS, musicVolume: 0 };
    await session.setSettings(quiet);
    expect(listener).toHaveBeenCalledWith(quiet);
    expect(stored(entries).settings).toEqual(quiet);
    off();
    await session.setSettings(DEFAULT_SETTINGS);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe("hints", () => {
  it("marks a hint shown once", async () => {
    const { entries, session } = await opened();
    await session.markHintShown("tip");
    await session.markHintShown("tip");
    expect([...session.shownHints()]).toEqual(["tip"]);
    expect(stored(entries).shownHints).toEqual(["tip"]);
  });
});

const result = {
  counters: quietCounters(),
  dogs: [{ firedInZone: null, id: "kilo" as const }],
  earnedCents: cents(9_500),
  lastHeartOwners: 0,
  lostCents: cents(0),
  outcome: "finished" as const,
  route: [
    "distilleryDistrict" as const,
    "highPark" as const,
    "kensingtonMarket" as const,
    "yongeStreet" as const,
  ],
  walker: "casey" as const,
  zone: 4,
};

describe("runs", () => {
  it("saves a checkpoint, then banks the finished run and clears it", async () => {
    const { entries, session } = await openedVeteran();
    await session.checkpointRun({
      counters: quietCounters(),
      dogs: result.dogs,
      earnedCents: cents(500),
      route: ["distilleryDistrict"],
      zonesFinished: 1,
    });
    expect(stored(entries).checkpoint?.zonesFinished).toBe(1);
    await session.finishRun(result, []);
    expect(stored(entries).checkpoint).toBeNull();
    expect(stored(entries).bankCents).toBe(12_345 + 9_500);
  });

  it("lists the achievements the run earned for the end screen", async () => {
    // A finished walk as Not a Scratch's goal asks.
    const goal = runFactsFor(gameData, ["notAScratch"]);
    const walk = {
      ...result,
      dogs: packOf(gameData, goal.packSize).map((id) => ({ firedInZone: null, id })),
      earnedCents: goal.earnedCents,
    };
    const { entries, session } = await openedVeteran();
    await session.finishRun(walk, []);
    const earned = earnedIfBanked(awards, VETERAN_EARNED, veteranSave(), walk);
    expect(earned).toContain("notAScratch");
    expect(session.lastRunEnd?.achievements).toEqual(earned);
    expect(session.earned).toEqual([...VETERAN_EARNED, ...earned]);
    expect(storedEarned(entries)).toMatchObject({ earned: session.earned, unannounced: [] });
    expect(session.takeCelebrations()).toEqual([]);
  });

  it("writes a run's badges before the save that banks it", async () => {
    const goal = runFactsFor(gameData, ["notAScratch"]);
    const walk = {
      ...result,
      dogs: packOf(gameData, goal.packSize).map((id) => ({ firedInZone: null, id })),
      earnedCents: goal.earnedCents,
    };
    const storage = memoryStorage(
      entriesOf(veteranSave(), { earned: VETERAN_EARNED, unannounced: [] }),
    );
    const { session } = await ProfileSession.open(awards, storesOn(storage));
    const write = vi.spyOn(storage, "write");
    await session.finishRun(walk, []);
    const announced = (session.lastRunEnd?.achievements ?? []).map(() => EARNED_KEYS.save);
    expect(announced.length).toBeGreaterThan(0);
    expect(write.mock.calls.map(([key]) => key)).toEqual([
      EARNED_KEYS.save,
      SAVE_KEYS.save,
      ...announced,
    ]);
  });

  it("flags a new best walk from the stats before the run is banked", async () => {
    const { session } = await openedVeteran();
    expect(session.lastRunEnd).toBeNull();
    void session.finishRun(result, []);
    expect(session.lastRunEnd?.newBestWalk).toBe(true);
    void session.finishRun({ ...result, earnedCents: cents(100) }, []);
    expect(session.lastRunEnd?.newBestWalk).toBe(false);
  });
});

// A walk left in its first zone after zone 1's fork, with where it resumes; ProfileSession keeps
// the resume point as the text it is.
const leftAt: Checkpoint = {
  counters: quietCounters(),
  dogs: result.dogs,
  earnedCents: cents(500),
  resume: "the resume point",
  route: ["distilleryDistrict", "highPark"],
  zonesFinished: 1,
};
const bankedPart: Checkpoint = {
  counters: leftAt.counters,
  dogs: leftAt.dogs,
  earnedCents: leftAt.earnedCents,
  route: leftAt.route,
  zonesFinished: leftAt.zonesFinished,
};
const WALK = { draws: { cards: 0, forks: 0, upgrades: 0 }, seed: 1 } as unknown as ResumeWalk;

describe("a walk left unfinished", () => {
  async function openedWith(decision: LaunchWalk) {
    const entries = entriesOf(
      { ...veteranSave(), checkpoint: leftAt },
      { earned: VETERAN_EARNED, unannounced: [] },
    );
    const launch = vi.fn(() => decision);
    const { session } = await ProfileSession.open(
      awards,
      storesOn(memoryStorage(entries)),
      undefined,
      launch,
    );
    expect(launch).toHaveBeenCalledWith(leftAt);
    return { entries, session };
  }

  it.each<{ bank: number; checkpoint: Checkpoint | null; decision: LaunchWalk; wentHome: number }>([
    {
      bank: 12_345,
      checkpoint: leftAt,
      decision: { kind: "resume", walk: WALK },
      wentHome: 2,
    },
    {
      bank: 12_345 + 500,
      checkpoint: null,
      decision: { kind: "bank", reason: "the checkpoint has no resume point" },
      wentHome: 3,
    },
  ])(
    "on a launch that decides $decision.kind, keeps the checkpoint or banks it",
    async ({ bank, checkpoint, decision, wentHome }) => {
      vi.spyOn(console, "info").mockImplementation(() => undefined);
      const { entries, session } = await openedWith(decision);
      expect(session.resumesWalk).toBe(decision.kind === "resume");
      expect(session.save.checkpoint).toEqual(checkpoint);
      expect(session.save.bankCents).toBe(bank);
      expect(session.save.stats.runs.wentHome).toBe(wentHome);
      expect(stored(entries).checkpoint).toEqual(checkpoint);
    },
  );

  it("hands the resumed walk over once and drops its resume point from the stored checkpoint", async () => {
    const { entries, session } = await openedWith({ kind: "resume", walk: WALK });
    expect(session.takeResumedWalk()).toBe(WALK);
    expect(session.takeResumedWalk()).toBeNull();
    expect(session.resumesWalk).toBe(false);
    await settle();
    expect(stored(entries).checkpoint).toEqual(bankedPart);
  });

  // The launch banks nothing for a walk it resumes; the walk's own end banks it, once.
  it("counts a resumed walk once, as a walk never left unfinished", async () => {
    const resumed = await openedWith({ kind: "resume", walk: WALK });
    resumed.session.takeResumedWalk();
    await resumed.session.checkpointRun({ ...leftAt, zonesFinished: 2 });
    await resumed.session.finishRun(result, []);
    const never = await openedVeteran();
    await never.session.finishRun(result, []);
    expect(resumed.session.save).toEqual(never.session.save);
    expect(stored(resumed.entries)).toEqual(stored(never.entries));
  });

  it("keeps the resume point in later checkpoints until the game crashes", async () => {
    const { entries, session } = await openedVeteran();
    await session.checkpointRun(leftAt);
    expect(stored(entries).checkpoint).toEqual(leftAt);
    session.stopResuming();
    await session.checkpointRun(leftAt);
    expect(stored(entries).checkpoint).toEqual(bankedPart);
  });
});

const newerRaw = JSON.stringify({ ...veteranSave(), version: SAVE_VERSION + 1 });

describe("a save from a newer version", () => {
  async function openedNewer() {
    const entries = new Map([[SAVE_KEYS.save, newerRaw]]);
    const storage = memoryStorage(entries);
    const write = vi.spyOn(storage, "write");
    const { load, session } = await ProfileSession.open(awards, storesOn(storage));
    return { entries, load, session, write };
  }

  it("plays from a default save in memory and writes nothing on open", async () => {
    const { entries, load, session, write } = await openedNewer();
    expect(load.status).toBe("newer");
    expect(session.storage).toBe("newer");
    expect(session.save.bankCents).toBe(0);
    expect(write).not.toHaveBeenCalled();
    expect(entries.get(SAVE_KEYS.save)).toBe(newerRaw);
  });

  it.each<[string, (session: ProfileSession) => Promise<void>]>([
    [
      "checkpointRun",
      (session) =>
        session.checkpointRun({
          counters: quietCounters(),
          dogs: result.dogs,
          earnedCents: cents(500),
          route: ["distilleryDistrict"],
          zonesFinished: 1,
        }),
    ],
    ["finishRun", (session) => session.finishRun(result, [])],
    ["markHintShown", (session) => session.markHintShown("tip")],
    ["purchase", (session) => session.purchase((save) => ({ ...save, bankCents: cents(5) }))],
    ["setSettings", (session) => session.setSettings({ ...DEFAULT_SETTINGS, muted: true })],
    ["update", (session) => session.update((save) => ({ ...save, bankCents: cents(5) }))],
  ])("keeps %s in memory and leaves the stored save untouched", async (_name, change) => {
    const { entries, session, write } = await openedNewer();
    const before = session.save;
    await change(session);
    expect(session.save).not.toEqual(before);
    expect(session.storage).toBe("newer");
    expect(write).not.toHaveBeenCalled();
    expect(entries.get(SAVE_KEYS.save)).toBe(newerRaw);
  });
});

describe("an earned record from a newer version", () => {
  it("plays on in memory and writes nothing, the save included", async () => {
    const entries = entriesOf(veteranSave());
    const newer = JSON.stringify({ earned: [], unannounced: [], version: EARNED_VERSION + 1 });
    entries.set(EARNED_KEYS.save, newer);
    const storage = memoryStorage(entries);
    const write = vi.spyOn(storage, "write");
    const { session } = await ProfileSession.open(awards, storesOn(storage));
    expect(session.storage).toBe("newer");
    await session.finishRun(result, []);
    expect(write).not.toHaveBeenCalled();
    expect(entries.get(EARNED_KEYS.save)).toBe(newer);
  });
});

it("keeps the saved bank when a zero-payout interruption cannot resume", async () => {
  const { entries, session } = await openedVeteran({ ...veteranSave(), bankCents: cents(20_000) });
  session.stopResuming();
  await session.checkpointRun({ ...leftAt, earnedCents: cents(0) });
  expect(stored(entries).checkpoint?.resume).toBeUndefined();
  const reopened = await opened(stored(entries), VETERAN_EARNED);
  expect(reopened.session.save.bankCents).toBe(session.save.bankCents);
  expect(reopened.session.save.checkpoint).toBeNull();
  expect(stored(reopened.entries).bankCents).toBe(20_000);
});
