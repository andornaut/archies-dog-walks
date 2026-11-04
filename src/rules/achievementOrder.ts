import type { Achievement, AchievementDifficulty, GameData } from "../data/types.ts";

const DIFFICULTY_ORDER: Readonly<Record<AchievementDifficulty, number>> = {
  easy: 0,
  hard: 2,
  medium: 1,
};

// Sorting is stable within each tier and leaves authored data order unchanged.
export function orderedAchievements<T extends Pick<Achievement, "difficulty">>(
  achievements: readonly T[],
): T[] {
  return [...achievements].sort(
    (a, b) => DIFFICULTY_ORDER[a.difficulty] - DIFFICULTY_ORDER[b.difficulty],
  );
}

export function achievementLabel(
  data: Pick<GameData, "menuText">,
  achievement: Pick<Achievement, "difficulty" | "name">,
): string {
  return `${achievement.name} (${data.menuText.stats.badgeDifficulty[achievement.difficulty]})`;
}
