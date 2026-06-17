// ============================================================
// DAILY TRACKER - TYPE DEFINITIONS
// ============================================================

// -------------------------
// CATEGORIES & DURATIONS
// -------------------------

export const CATEGORIES = [
  'development',
  'meeting',
  'support',
  'training',
  'documentation',
  'research',
  'personal',
  'other',
] as const;

export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  development: 'Développement',
  meeting: 'Réunion',
  support: 'Support',
  training: 'Formation',
  documentation: 'Documentation',
  research: 'Recherche',
  personal: 'Personnel',
  other: 'Autre',
};

export const CATEGORY_COLORS: Record<Category, string> = {
  development: '#3B82F6', // blue
  meeting: '#8B5CF6', // purple
  support: '#F59E0B', // amber
  training: '#10B981', // emerald
  documentation: '#06B6D4', // cyan
  research: '#EC4899', // pink
  personal: '#6366F1', // indigo
  other: '#6B7280', // gray
};

export const DURATIONS = ['15min', '30min', '1h', '2h', '4h', 'custom'] as const;

export type Duration = (typeof DURATIONS)[number];

export const DURATION_LABELS: Record<Duration, string> = {
  '15min': '15 min',
  '30min': '30 min',
  '1h': '1 heure',
  '2h': '2 heures',
  '4h': '4 heures',
  custom: 'Personnalisé',
};

export const DURATION_MINUTES: Record<Duration, number> = {
  '15min': 15,
  '30min': 30,
  '1h': 60,
  '2h': 120,
  '4h': 240,
  custom: 0,
};

// -------------------------
// TASKS
// -------------------------

export interface Task {
  id: string;
  description: string;
  category: Category;
  duration: Duration;
  customDuration?: number; // in minutes, used when duration is 'custom'
  completed: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PlannedTask {
  id: string;
  description: string;
  category: Category;
  estimatedDuration?: Duration;
  createdAt: string;
}

// -------------------------
// DAILY ENTRY
// -------------------------

export interface DailyEntry {
  id: string;
  date: string; // Format: YYYY-MM-DD
  userId: string;
  tasks: Task[];
  plannedTasks: PlannedTask[];
  blockers: string;
  validated: boolean;
  validatedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DailyEntryCreateInput {
  date: string;
  userId: string;
  tasks?: Task[];
  plannedTasks?: PlannedTask[];
  blockers?: string;
}

export interface DailyEntryUpdateInput {
  tasks?: Task[];
  plannedTasks?: PlannedTask[];
  blockers?: string;
  validated?: boolean;
}

// -------------------------
// USER
// -------------------------

export interface JiraConnection {
  accountId: string;
  displayName: string;
  email: string;
  cloudId: string;
  cloudUrl: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix timestamp ms
}

export interface JiraTicket {
  key: string;          // "PROJ-123"
  summary: string;
  status: string;
  priority: string;
  project: string;
  projectKey: string;
  sprint?: string;
  updatedAt: string;
  url: string;
}

export interface User {
  id: string;
  name: string;
  pin: string; // hashed PIN
  email?: string;
  avatar?: string;
  jira?: JiraConnection;
  settings: UserSettings;
  gamification: UserGamification;
  createdAt: string;
  updatedAt: string;
}

export interface UserSettings {
  theme: 'light' | 'dark' | 'system';
  notificationsEnabled: boolean;
  notificationTimes: string[]; // e.g., ['16:55', '17:30', '18:00']
  language: 'fr' | 'en';
  weekStartsOn: 0 | 1; // 0 = Sunday, 1 = Monday
}

export interface UserGamification {
  level: number;
  experience: number;
  streak: number;
  longestStreak: number;
  totalTasks: number;
  totalMinutes: number;
  badges: Badge[];
  lastActivityDate?: string;
}

// -------------------------
// GAMIFICATION
// -------------------------

export const BADGE_TYPES = [
  'first_day',
  'week_streak',
  'month_streak',
  'hundred_tasks',
  'hundred_hours',
  'early_bird',
  'night_owl',
  'perfect_week',
] as const;

export type BadgeType = (typeof BADGE_TYPES)[number];

export interface Badge {
  type: BadgeType;
  earnedAt: string;
}

// -------------------------
// TIMEBLOCKING (JIRA PLANNING)
// -------------------------

export interface PlannedJiraTicket extends JiraTicket {
  /** User-defined importance score 1–10 (default: 5). */
  importance: number;
  /** Manually typed duration in minutes (null = auto-computed from importance). */
  durationMinutes: number | null;
  /** Day assigned to: "YYYY-MM-DD" or null (unscheduled). */
  scheduledDate: string | null;
  /** Start time assigned by autoScheduleTickets: "HH:MM" or null. */
  scheduledStartTime: string | null;
  /** Effective duration after auto-gen + proportional compression (always set). */
  computedDurationMinutes: number;
}

export interface FrozenDaySchedule {
  /** "YYYY-MM-DD" */
  date: string;
  /** Immutable snapshot of the schedule frozen by "Valider la journée". */
  tickets: PlannedJiraTicket[];
  frozenAt: string;
}

export interface BadgeDefinition {
  type: BadgeType;
  name: string;
  description: string;
  icon: string;
  requirement: string;
}

export const BADGES: BadgeDefinition[] = [
  {
    type: 'first_day',
    name: 'Premier Pas',
    description: 'Première journée complétée',
    icon: '🎯',
    requirement: 'Valider sa première journée',
  },
  {
    type: 'week_streak',
    name: 'Semaine Parfaite',
    description: '7 jours consécutifs',
    icon: '🔥',
    requirement: 'Maintenir un streak de 7 jours',
  },
  {
    type: 'month_streak',
    name: 'Champion du Mois',
    description: '30 jours consécutifs',
    icon: '🏆',
    requirement: 'Maintenir un streak de 30 jours',
  },
  {
    type: 'hundred_tasks',
    name: 'Centurion',
    description: '100 tâches enregistrées',
    icon: '💯',
    requirement: 'Enregistrer 100 tâches',
  },
  {
    type: 'hundred_hours',
    name: 'Marathonien',
    description: '100 heures documentées',
    icon: '⏱️',
    requirement: 'Documenter 100 heures de travail',
  },
  {
    type: 'early_bird',
    name: 'Lève-tôt',
    description: 'Validation avant 9h',
    icon: '🌅',
    requirement: 'Valider une journée avant 9h',
  },
  {
    type: 'night_owl',
    name: 'Noctambule',
    description: 'Validation après 22h',
    icon: '🦉',
    requirement: 'Valider une journée après 22h',
  },
  {
    type: 'perfect_week',
    name: 'Semaine Modèle',
    description: '5 jours ouvrés consécutifs',
    icon: '⭐',
    requirement: 'Valider 5 jours ouvrés consécutifs',
  },
];

// -------------------------
// NOTIFICATIONS
// -------------------------

export interface NotificationSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface UserNotification {
  userId: string;
  subscription: NotificationSubscription;
  createdAt: string;
}

// -------------------------
// STATISTICS
// -------------------------

export interface DayStats {
  date: string;
  taskCount: number;
  totalMinutes: number;
  validated: boolean;
  categories: Record<Category, number>;
}

export interface WeekStats {
  weekStart: string;
  weekEnd: string;
  totalTasks: number;
  totalMinutes: number;
  validatedDays: number;
  dailyStats: DayStats[];
  categoryBreakdown: Record<Category, number>;
}

export interface MonthStats {
  month: string; // YYYY-MM
  totalTasks: number;
  totalMinutes: number;
  validatedDays: number;
  weeklyStats: WeekStats[];
  categoryBreakdown: Record<Category, number>;
}

// -------------------------
// REPORTS
// -------------------------

export type ReportPeriod = 'daily' | 'weekly' | 'monthly' | 'custom';

export interface ReportConfig {
  period: ReportPeriod;
  startDate: string;
  endDate: string;
  includeCategories?: Category[];
  includeLogo?: boolean;
  title?: string;
  comments?: string;
}

export interface ReportData {
  config: ReportConfig;
  entries: DailyEntry[];
  stats: {
    totalTasks: number;
    totalMinutes: number;
    validatedDays: number;
    categoryBreakdown: Record<Category, number>;
  };
  generatedAt: string;
}

// -------------------------
// API RESPONSES
// -------------------------

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// -------------------------
// SEARCH
// -------------------------

export interface SearchQuery {
  keyword?: string;
  categories?: Category[];
  dateFrom?: string;
  dateTo?: string;
  validated?: boolean;
}

export interface SearchResult {
  entry: DailyEntry;
  matchedTasks: Task[];
  matchedPlannedTasks: PlannedTask[];
  score: number;
}
