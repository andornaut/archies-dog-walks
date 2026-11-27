import { EventEmitter } from "node:events";

import { beforeEach, expect, it, vi } from "vitest";

import { gameData } from "../data/index.ts";
import { canLeaveFromBack, leaveFromBack } from "../pwa/index.ts";
import { exitGame } from "./homeBarPress.ts";
import { closeOverlay } from "./overlay.ts";
import { PauseScene, type PauseSceneData } from "./PauseScene.ts";
import type { QuestionPanel } from "./questionPanel.ts";
import { QuitScene } from "./QuitScene.ts";
import { SCENE_KEYS } from "./sceneKeys.ts";

vi.mock("../pwa/index.ts", async (original) => ({
  ...(await original<typeof import("../pwa/index.ts")>()),
  canLeaveFromBack: vi.fn(() => true),
  leaveFromBack: vi.fn(async () => false),
}));
vi.mock("./homeBarPress.ts", async (original) => ({
  ...(await original<typeof import("./homeBarPress.ts")>()),
  exitGame: vi.fn(),
}));
vi.mock("./overlay.ts", async (original) => ({
  ...(await original<typeof import("./overlay.ts")>()),
  closeOverlay: vi.fn(),
}));
beforeEach(() => {
  vi.mocked(canLeaveFromBack).mockReturnValue(true);
  vi.mocked(leaveFromBack).mockReset().mockResolvedValue(false);
  vi.mocked(closeOverlay).mockClear();
  vi.mocked(exitGame).mockClear();
});

const questionPanel = vi.fn<(scene: unknown, area: unknown, question: QuestionPanel) => undefined>(
  () => undefined,
);
const stopMusic = vi.fn();
vi.mock("phaser", () => ({
  Core: { Events: {} },
  Scene: class {},
  Scenes: { Events: { SHUTDOWN: "shutdown" } },
}));
vi.mock("./questionPanel.ts", async (original) => ({
  ...(await original<typeof import("./questionPanel.ts")>()),
  addHtmlQuestionPanel: (...args: Parameters<typeof questionPanel>) => questionPanel(...args),
}));
vi.mock("./soundboard.ts", async (original) => ({
  ...(await original<typeof import("./soundboard.ts")>()),
  soundboardOf: () => ({ stopMusic }),
}));

it("keeps only the existing safe Keep walking and End walk answers in the confirmation", () => {
  questionPanel.mockClear();
  const onResume = vi.fn();
  const onHeadHome = vi.fn();
  const events = new EventEmitter();
  const scene = Object.assign(new PauseScene(), {
    events,
    scene: { get: () => ({ hudView: () => undefined }) },
  });
  const mount = (
    PauseScene.prototype as unknown as {
      mount: (data: PauseSceneData) => boolean;
    }
  ).mount;
  mount.call(scene, {
    mode: "homeQuestion",
    note: [],
    onHeadHome,
    onResume,
  });
  const question = questionPanel.mock.calls[0]![2];
  expect("footer" in question).toBe(false);
  expect(question.entries.map(({ label }) => label)).toEqual([
    gameData.runText.homeQuestion.keepWalking,
    gameData.runText.homeQuestion.headHome,
  ]);
  question.entries[0]!.press();
  question.close();
  expect(onResume).toHaveBeenCalledTimes(2);
  question.entries[1]!.press();
  expect(onHeadHome).toHaveBeenCalledOnce();
  expect(stopMusic).toHaveBeenCalledOnce();
  events.emit("shutdown");
});

it("keeps Quit's safe answer and corner cancel without a duplicate labelled Close", () => {
  questionPanel.mockClear();
  const mount = (
    QuitScene.prototype as unknown as {
      mount: (data: { resume: string }) => boolean;
    }
  ).mount;
  mount.call({}, { resume: SCENE_KEYS.start });
  const question = questionPanel.mock.calls[0]![2];
  expect("footer" in question).toBe(false);
  expect(question.entries.map(({ label }) => label)).toEqual([
    gameData.homeText.quit.keepPlaying,
    gameData.homeText.quit.quit,
  ]);
  expect(question.close).toBe(question.entries[0]!.press);
  question.entries[1]!.press();
  expect(exitGame).toHaveBeenCalledOnce();
  expect(leaveFromBack).not.toHaveBeenCalled();
});

it.each([false, true])(
  "keeps platform Exit availability from Kit (%s) and Cancel independent",
  (available) => {
    questionPanel.mockClear();
    vi.mocked(canLeaveFromBack).mockReturnValue(available);
    const mount = (
      QuitScene.prototype as unknown as {
        mount(data: { platformBack: boolean; resume: string }): boolean;
      }
    ).mount;
    mount.call({}, { platformBack: true, resume: SCENE_KEYS.start });
    const question = questionPanel.mock.calls[0]![2];
    expect(question.title).toBe(gameData.homeText.quit.title);
    expect(question.entries.map((e) => e.label)).toEqual([
      gameData.homeText.backExit.cancel,
      gameData.homeText.backExit.exit,
    ]);
    expect(question.entries[1]!.available).toBe(available);
    expect(question.entries[0]!.available).toBeUndefined();
    if (!available) {
      question.entries[1]!.press();
      expect(leaveFromBack).not.toHaveBeenCalled();
      expect(closeOverlay).not.toHaveBeenCalled();
    }
    question.entries[0]!.press();
    expect(closeOverlay).toHaveBeenCalledOnce();
    expect(exitGame).not.toHaveBeenCalled();
  },
);

it.each(["false", "reject", "true"])(
  "delegates admitted platform leave %s without explicit Quit or repeat",
  async (outcome) => {
    questionPanel.mockClear();
    let settle!: () => void;
    vi.mocked(leaveFromBack).mockImplementation(
      () =>
        new Promise<boolean>((resolve, reject) => {
          settle = () =>
            outcome === "reject" ? reject(Error("No departure")) : resolve(outcome === "true");
        }),
    );
    const mount = (
      QuitScene.prototype as unknown as {
        mount(data: { platformBack: boolean; resume: string }): boolean;
      }
    ).mount;
    mount.call({}, { platformBack: true, resume: SCENE_KEYS.start });
    const exit = questionPanel.mock.calls[0]![2].entries[1]!.press;
    exit();
    exit();
    expect(closeOverlay).toHaveBeenCalledOnce();
    expect(leaveFromBack).toHaveBeenCalledOnce();
    expect(exitGame).not.toHaveBeenCalled();
    settle();
    await vi.waitFor(() => expect(leaveFromBack).toHaveBeenCalledOnce());
    expect(exitGame).not.toHaveBeenCalled();
  },
);
