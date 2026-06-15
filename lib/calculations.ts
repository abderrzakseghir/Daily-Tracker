import { Category, DURATION_MINUTES, DailyEntry, Duration, Task } from '@/types';

export function calculateTotalMinutes(tasks: Task[]): number {
  return tasks.reduce((total, task) => {
    if (task.duration === 'custom') {
      return total + (task.customDuration || 0);
    }
    return total + DURATION_MINUTES[task.duration];
  }, 0);
}

export function calculateCategoryBreakdown(tasks: Task[]): Record<Category, number> {
  const breakdown: Record<Category, number> = {
    development: 0,
    meeting: 0,
    support: 0,
    training: 0,
    documentation: 0,
    research: 0,
    personal: 0,
    other: 0,
  };

  tasks.forEach((task) => {
    const minutes = task.duration === 'custom'
      ? (task.customDuration || 0)
      : DURATION_MINUTES[task.duration];
    breakdown[task.category] += minutes;
  });

  return breakdown;
}

export function calculateStreak(entries: DailyEntry[]): number {
  if (entries.length === 0) return 0;

  // Sort entries by date descending
  const sortedEntries = [...entries]
    .filter((e) => e.validated)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  if (sortedEntries.length === 0) return 0;

  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let currentDate = new Date(today);

  for (const entry of sortedEntries) {
    const entryDate = new Date(entry.date);
    entryDate.setHours(0, 0, 0, 0);

    // Skip weekends
    while (currentDate.getDay() === 0 || currentDate.getDay() === 6) {
      currentDate.setDate(currentDate.getDate() - 1);
    }

    const diffDays = Math.floor(
      (currentDate.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diffDays === 0) {
      streak++;
      currentDate.setDate(currentDate.getDate() - 1);
    } else if (diffDays === 1) {
      // Allow for yesterday if today is not validated yet
      streak++;
      currentDate.setDate(currentDate.getDate() - 1);
    } else {
      break;
    }
  }

  return streak;
}

export function calculateCompletionScore(
  entries: DailyEntry[],
  daysInPeriod: number
): number {
  const validatedCount = entries.filter((e) => e.validated).length;
  return Math.round((validatedCount / daysInPeriod) * 100);
}

export function calculateExperience(gamification: {
  totalTasks: number;
  totalMinutes: number;
  streak: number;
  longestStreak: number;
}): number {
  const taskXp = gamification.totalTasks * 10;
  const minuteXp = Math.floor(gamification.totalMinutes / 60) * 5;
  const streakXp = gamification.longestStreak * 50;
  return taskXp + minuteXp + streakXp;
}

export function calculateLevel(experience: number): number {
  // Level formula: level = sqrt(experience / 100)
  return Math.floor(Math.sqrt(experience / 100)) + 1;
}

export function getExperienceForLevel(level: number): number {
  return Math.pow(level - 1, 2) * 100;
}

export function getExperienceProgress(experience: number): {
  current: number;
  required: number;
  percentage: number;
} {
  const level = calculateLevel(experience);
  const currentLevelXp = getExperienceForLevel(level);
  const nextLevelXp = getExperienceForLevel(level + 1);
  const required = nextLevelXp - currentLevelXp;
  const current = experience - currentLevelXp;
  const percentage = Math.round((current / required) * 100);

  return { current, required, percentage };
}

export function generateLocalSummary(entries: DailyEntry[]): string {
  if (entries.length === 0) {
    return "Aucune donnée pour cette période.";
  }

  const categoryBreakdown: Record<Category, number> = {
    development: 0,
    meeting: 0,
    support: 0,
    training: 0,
    documentation: 0,
    research: 0,
    personal: 0,
    other: 0,
  };

  let totalTasks = 0;
  let totalMinutes = 0;

  entries.forEach((entry) => {
    entry.tasks.forEach((task) => {
      const minutes = task.duration === 'custom'
        ? (task.customDuration || 0)
        : DURATION_MINUTES[task.duration];
      categoryBreakdown[task.category] += minutes;
      totalMinutes += minutes;
      totalTasks++;
    });
  });

  // Find top categories
  const sortedCategories = Object.entries(categoryBreakdown)
    .filter(([_, minutes]) => minutes > 0)
    .sort((a, b) => b[1] - a[1]);

  if (sortedCategories.length === 0) {
    return "Aucune tâche enregistrée pour cette période.";
  }

  const categoryLabels: Record<Category, string> = {
    development: 'le développement',
    meeting: 'les réunions',
    support: 'le support',
    training: 'la formation',
    documentation: 'la documentation',
    research: 'la recherche',
    personal: 'les tâches personnelles',
    other: 'diverses activités',
  };

  const topCategory = sortedCategories[0][0] as Category;
  const hours = Math.floor(totalMinutes / 60);

  let summary = `Cette période, vous avez enregistré ${totalTasks} tâche${totalTasks > 1 ? 's' : ''} `;
  summary += `pour un total de ${hours > 0 ? `${hours} heure${hours > 1 ? 's' : ''}` : `${totalMinutes} minutes`}. `;
  summary += `Vous avez principalement travaillé sur ${categoryLabels[topCategory]}`;

  if (sortedCategories.length > 1) {
    const secondCategory = sortedCategories[1][0] as Category;
    summary += ` et ${categoryLabels[secondCategory]}`;
  }

  summary += '.';

  return summary;
}
