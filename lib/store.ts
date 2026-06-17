import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DailyEntry, User, Task, PlannedTask, UserGamification, Badge, BadgeType, JiraConnection, JiraTicket, PlannedJiraTicket, FrozenDaySchedule } from '@/types';
import { generateId } from '@/lib/utils';
import { calculateStreak, calculateLevel, calculateExperience } from '@/lib/calculations';

interface AppState {
  // Hydration
  _hasHydrated: boolean;
  setHasHydrated: (v: boolean) => void;

  // User
  user: User | null;
  isAuthenticated: boolean;

  // Daily Entries
  entries: DailyEntry[];
  currentEntry: DailyEntry | null;

  // UI State
  isLoading: boolean;
  error: string | null;

  // Actions - Auth
  login: (pin: string) => Promise<boolean>;
  logout: () => void;
  createUser: (name: string, pin: string) => Promise<void>;
  updateUserSettings: (settings: Partial<User['settings']>) => void;

  // Actions - Entries
  loadEntries: () => Promise<void>;
  getOrCreateTodayEntry: () => DailyEntry;
  setCurrentEntry: (entryId: string) => void;
  updateEntry: (entryId: string, data: Partial<DailyEntry>) => Promise<void>;
  validateDay: (entryId: string) => Promise<void>;
  unlockDay: (entryId: string) => Promise<void>;

  // Actions - Tasks
  addTask: (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateTask: (taskId: string, data: Partial<Task>) => void;
  removeTask: (taskId: string) => void;

  // Actions - Planned Tasks
  addPlannedTask: (task: Omit<PlannedTask, 'id' | 'createdAt'>) => void;
  updatePlannedTask: (taskId: string, data: Partial<PlannedTask>) => void;
  removePlannedTask: (taskId: string) => void;

  // Actions - Gamification
  updateGamification: () => void;
  checkBadges: () => BadgeType[];

  // Actions - Jira
  connectJira: (connection: JiraConnection) => void;
  disconnectJira: () => void;
  setJiraTickets: (tickets: JiraTicket[]) => void;
  jiraTickets: JiraTicket[];

  // Timeblocking
  plannedTickets: PlannedJiraTicket[];
  frozenSchedules: FrozenDaySchedule[];
  /** Merges raw Jira tickets into plannedTickets, preserving existing enriched fields. */
  initPlannedTickets: (raw: JiraTicket[]) => void;
  updatePlannedTicket: (key: string, updates: Partial<PlannedJiraTicket>) => void;
  /** Freezes a day's current schedule snapshot (local only, no Jira write). */
  freezeDaySchedule: (date: string, tickets: PlannedJiraTicket[]) => void;

  // Utilities
  setError: (error: string | null) => void;
  clearError: () => void;
}

const getToday = () => {
  const now = new Date();
  return now.toISOString().split('T')[0];
};

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Initial State
      _hasHydrated: false,
      setHasHydrated: (v) => set({ _hasHydrated: v }),

      user: null,
      isAuthenticated: false,
      entries: [],
      currentEntry: null,
      isLoading: false,
      error: null,

      // Auth Actions
      login: async (pin: string) => {
        const { user } = get();
        if (!user) return false;

        // Simple hash comparison (in production, use proper hashing)
        const hashedInput = hashSimple(pin);
        if (hashedInput === user.pin) {
          set({ isAuthenticated: true });
          return true;
        }
        return false;
      },

      logout: () => {
        set({ isAuthenticated: false });
      },

      createUser: async (name: string, pin: string) => {
        const newUser: User = {
          id: generateId(),
          name,
          pin: hashSimple(pin),
          settings: {
            theme: 'system',
            notificationsEnabled: true,
            notificationTimes: ['16:55', '17:30', '18:00'],
            language: 'fr',
            weekStartsOn: 1,
          },
          gamification: {
            level: 1,
            experience: 0,
            streak: 0,
            longestStreak: 0,
            totalTasks: 0,
            totalMinutes: 0,
            badges: [],
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        set({ user: newUser, isAuthenticated: true });
      },

      updateUserSettings: (settings) => {
        const { user } = get();
        if (!user) return;

        set({
          user: {
            ...user,
            settings: { ...user.settings, ...settings },
            updatedAt: new Date().toISOString(),
          },
        });
      },

      // Entry Actions
      loadEntries: async () => {
        set({ isLoading: true });
        try {
          // In a real app, this would fetch from API/Vercel Blob
          const { entries } = get();
          const todayEntry = get().getOrCreateTodayEntry();
          set({ currentEntry: todayEntry, isLoading: false });
        } catch (error) {
          set({ error: 'Erreur lors du chargement des entrées', isLoading: false });
        }
      },

      getOrCreateTodayEntry: () => {
        const { entries, user } = get();
        const today = getToday();

        let entry = entries.find((e) => e.date === today);

        if (!entry) {
          entry = {
            id: generateId(),
            date: today,
            userId: user?.id || '',
            tasks: [],
            plannedTasks: [],
            blockers: '',
            validated: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          set({ entries: [...entries, entry] });
        }

        set({ currentEntry: entry });
        return entry;
      },

      setCurrentEntry: (entryId: string) => {
        const { entries } = get();
        const entry = entries.find((e) => e.id === entryId);
        if (entry) {
          set({ currentEntry: entry });
        }
      },

      updateEntry: async (entryId: string, data: Partial<DailyEntry>) => {
        const { entries, currentEntry } = get();

        const updatedEntries = entries.map((e) =>
          e.id === entryId
            ? { ...e, ...data, updatedAt: new Date().toISOString() }
            : e
        );

        const updatedCurrent =
          currentEntry?.id === entryId
            ? { ...currentEntry, ...data, updatedAt: new Date().toISOString() }
            : currentEntry;

        set({ entries: updatedEntries, currentEntry: updatedCurrent });
      },

      validateDay: async (entryId: string) => {
        const { entries, user } = get();
        const entry = entries.find((e) => e.id === entryId);

        if (!entry || entry.validated) return;

        const validatedAt = new Date().toISOString();

        await get().updateEntry(entryId, {
          validated: true,
          validatedAt,
        });

        // Update gamification
        get().updateGamification();
        get().checkBadges();
      },

      unlockDay: async (entryId: string) => {
        const { entries } = get();
        const entry = entries.find((e) => e.id === entryId);

        if (!entry || !entry.validated) return;

        await get().updateEntry(entryId, {
          validated: false,
          validatedAt: undefined,
        });
      },

      // Task Actions
      addTask: (taskData) => {
        const { currentEntry } = get();
        if (!currentEntry) return;

        const task: Task = {
          ...taskData,
          id: generateId(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        get().updateEntry(currentEntry.id, {
          tasks: [...currentEntry.tasks, task],
        });
      },

      updateTask: (taskId, data) => {
        const { currentEntry } = get();
        if (!currentEntry) return;

        const updatedTasks = currentEntry.tasks.map((t) =>
          t.id === taskId
            ? { ...t, ...data, updatedAt: new Date().toISOString() }
            : t
        );

        get().updateEntry(currentEntry.id, { tasks: updatedTasks });
      },

      removeTask: (taskId) => {
        const { currentEntry } = get();
        if (!currentEntry) return;

        const filteredTasks = currentEntry.tasks.filter((t) => t.id !== taskId);
        get().updateEntry(currentEntry.id, { tasks: filteredTasks });
      },

      // Planned Task Actions
      addPlannedTask: (taskData) => {
        const { currentEntry } = get();
        if (!currentEntry) return;

        const task: PlannedTask = {
          ...taskData,
          id: generateId(),
          createdAt: new Date().toISOString(),
        };

        get().updateEntry(currentEntry.id, {
          plannedTasks: [...currentEntry.plannedTasks, task],
        });
      },

      updatePlannedTask: (taskId, data) => {
        const { currentEntry } = get();
        if (!currentEntry) return;

        const updatedTasks = currentEntry.plannedTasks.map((t) =>
          t.id === taskId ? { ...t, ...data } : t
        );

        get().updateEntry(currentEntry.id, { plannedTasks: updatedTasks });
      },

      removePlannedTask: (taskId) => {
        const { currentEntry } = get();
        if (!currentEntry) return;

        const filteredTasks = currentEntry.plannedTasks.filter(
          (t) => t.id !== taskId
        );
        get().updateEntry(currentEntry.id, { plannedTasks: filteredTasks });
      },

      // Gamification
      updateGamification: () => {
        const { entries, user } = get();
        if (!user) return;

        const validatedEntries = entries.filter((e) => e.validated);
        const streak = calculateStreak(entries);

        let totalTasks = 0;
        let totalMinutes = 0;

        validatedEntries.forEach((entry) => {
          totalTasks += entry.tasks.length;
          entry.tasks.forEach((task) => {
            const mins = task.duration === 'custom'
              ? (task.customDuration || 0)
              : { '15min': 15, '30min': 30, '1h': 60, '2h': 120, '4h': 240, custom: 0 }[task.duration];
            totalMinutes += mins;
          });
        });

        const gamification: UserGamification = {
          ...user.gamification,
          streak,
          longestStreak: Math.max(user.gamification.longestStreak, streak),
          totalTasks,
          totalMinutes,
          experience: calculateExperience({ totalTasks, totalMinutes, streak, longestStreak: Math.max(user.gamification.longestStreak, streak) }),
          level: calculateLevel(calculateExperience({ totalTasks, totalMinutes, streak, longestStreak: Math.max(user.gamification.longestStreak, streak) })),
        };

        set({
          user: { ...user, gamification, updatedAt: new Date().toISOString() },
        });
      },

      checkBadges: () => {
        const { user, entries } = get();
        if (!user) return [];

        const newBadges: BadgeType[] = [];
        const earnedTypes = user.gamification.badges.map((b) => b.type);

        // First day
        if (!earnedTypes.includes('first_day') && entries.some((e) => e.validated)) {
          newBadges.push('first_day');
        }

        // Week streak
        if (!earnedTypes.includes('week_streak') && user.gamification.streak >= 7) {
          newBadges.push('week_streak');
        }

        // Month streak
        if (!earnedTypes.includes('month_streak') && user.gamification.streak >= 30) {
          newBadges.push('month_streak');
        }

        // 100 tasks
        if (!earnedTypes.includes('hundred_tasks') && user.gamification.totalTasks >= 100) {
          newBadges.push('hundred_tasks');
        }

        // 100 hours
        if (!earnedTypes.includes('hundred_hours') && user.gamification.totalMinutes >= 6000) {
          newBadges.push('hundred_hours');
        }

        if (newBadges.length > 0) {
          const badges: Badge[] = [
            ...user.gamification.badges,
            ...newBadges.map((type) => ({
              type,
              earnedAt: new Date().toISOString(),
            })),
          ];

          set({
            user: {
              ...user,
              gamification: { ...user.gamification, badges },
              updatedAt: new Date().toISOString(),
            },
          });
        }

        return newBadges;
      },

      // Jira Actions
      jiraTickets: [],

      // Timeblocking Actions
      plannedTickets: [],
      frozenSchedules: [],

      initPlannedTickets: (raw) => {
        const { plannedTickets } = get();
        const existingKeys = new Set(plannedTickets.map((t) => t.key));
        const newTickets: PlannedJiraTicket[] = raw
          .filter((t) => !existingKeys.has(t.key))
          .map((t) => ({
            ...t,
            importance: 5,
            durationMinutes: null,
            scheduledDate: null,
            scheduledStartTime: null,
            computedDurationMinutes: 60,
          }));
        set({ plannedTickets: [...plannedTickets, ...newTickets] });
      },

      updatePlannedTicket: (key, updates) => {
        const { plannedTickets } = get();
        set({
          plannedTickets: plannedTickets.map((t) =>
            t.key === key ? { ...t, ...updates } : t,
          ),
        });
      },

      freezeDaySchedule: (date, tickets) => {
        const { frozenSchedules } = get();
        set({
          frozenSchedules: [
            ...frozenSchedules.filter((s) => s.date !== date),
            { date, tickets, frozenAt: new Date().toISOString() },
          ],
        });
      },

      connectJira: (connection) => {
        const { user } = get();
        if (!user) return;
        set({ user: { ...user, jira: connection, updatedAt: new Date().toISOString() } });
      },

      disconnectJira: () => {
        const { user } = get();
        if (!user) return;
        const { jira: _, ...userWithoutJira } = user;
        set({ user: { ...userWithoutJira, updatedAt: new Date().toISOString() }, jiraTickets: [] });
      },

      setJiraTickets: (tickets) => set({ jiraTickets: tickets }),

      // Utilities
      setError: (error) => set({ error }),
      clearError: () => set({ error: null }),
    }),
    {
      name: 'daily-tracker-storage',
      partialize: (state) => ({
        user: state.user,
        entries: state.entries,
        isAuthenticated: state.isAuthenticated,
        jiraTickets: state.jiraTickets,
        plannedTickets: state.plannedTickets,
        frozenSchedules: state.frozenSchedules,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) state.setHasHydrated(true);
      },
    }
  )
);

// Simple hash function for demo purposes
function hashSimple(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}
