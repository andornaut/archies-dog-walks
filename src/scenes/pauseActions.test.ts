import { expect, it, vi } from "vitest";

import { gameData } from "../data/index.ts";
import { PauseScene, type PauseSceneData } from "./PauseScene.ts";
import type { QuestionPanel } from "./questionPanel.ts";
import { QuitScene } from "./QuitScene.ts";
import { SCENE_KEYS } from "./sceneKeys.ts";

const questionPanel = vi.fn<(scene: unknown, area: unknown, question: QuestionPanel) => undefined>(
  () => undefined,
);
const stopMusic = vi.fn();
vi.mock("phaser", () => ({
  Core: { Events: {} },
  Scene: class {},
  Scenes: { Events: {} },
}));
vi.mock("./questionPanel.ts", async (original) => ({
  ...(await original<typeof import("./questionPanel.ts")>()),
  addHtmlQuestionPanel: (...args: Parameters<typeof questionPanel>) => questionPanel(...args),
  pauseDimsHtml: () => () => undefined,
}));
vi.mock("./soundboard.ts", async (original) => ({
  ...(await original<typeof import("./soundboard.ts")>()),
  soundboardOf: () => ({ stopMusic }),
}));

it("keeps only the existing safe Keep walking and End walk answers in the confirmation", () => {
  questionPanel.mockClear();
  const onResume = vi.fn();
  const onHeadHome = vi.fn();
  const mount = (
    PauseScene.prototype as unknown as {
      mount: (data: PauseSceneData) => boolean;
    }
  ).mount;
  mount.call(
    { scene: { get: () => ({ hudView: () => undefined }) } },
    {
      mode: "homeQuestion",
      note: [],
      onHeadHome,
      onResume,
    },
  );
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
});
