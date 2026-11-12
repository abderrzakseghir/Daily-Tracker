// ============================================================
// DAILY TRACKER - TYPE DEFINITIONS
// ============================================================

// -------------------------
// CATEGORIES
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

export const CATEGORY_EMOJIS: Record<Category, string> = {
  development: '💻',
  meeting: '🗣️',
  support: '🛟',
  training: '📚',
  documentation: '📝',
  research: '🔬',
  personal: '🌿',
  other: '✨',
};

/**
 * Palette catégorielle validée (daltonisme, contraste) — ordre fixe, ne pas réordonner.
 * Les versions sombres sont les mêmes teintes ajustées pour la surface sombre.
 */
export const CATEGORY_COLORS: Record<Category, string> = {
  development: '#2a78d6',
  meeting: '#eb6834',
  support: '#1baf7a',
  training: '#eda100',
  documentation: '#e87ba4',
  research: '#008300',
  personal: '#6250d6',
  other: '#e34948',
};

export const CATEGORY_COLORS_DARK: Record<Category, string> = {
  development: '#3987e5',
  meeting: '#d95926',
  support: '#199e70',
  training: '#c98500',
  documentation: '#d55181',
  research: '#008300',
  personal: '#9085e9',
  other: '#e66767',
};

// -------------------------
// TASKS & DAYS
// -------------------------

export const TASK_STATUSES = ['todo', 'in_progress', 'done'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'À faire',
  in_progress: 'En cours',
  done: 'Terminée',
};

export interface Task {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  title: string;
  description: string;
  category: Category;
  /** Importance / effort de 1 à 10 — détermine la durée allouée. */
  points: number;
  status: TaskStatus;
  position: number;
  /** Durée forcée à la main (null = calculée à partir des points). */
  manualDuration: number | null;
  /** Durée effective calculée par le planificateur. */
  durationMinutes: number;
  /** "HH:MM" — horaire calculé (ou fixé si pinned). */
  startTime: string | null;
  /** true quand l'utilisateur a fixé l'horaire (glisser-déposer). */
  pinned: boolean;
  /** Temps réellement mesuré via le minuteur focus. */
  actualMinutes: number;
  jiraKey: string | null;
  jiraUrl: string | null;
  jiraProjectKey: string | null;
  jiraWorklogId: string | null;
  jiraSyncedMinutes: number | null;
  /** "YYYY-MM-DD HH:MM" du dernier worklog envoyé. */
  jiraSyncedStart: string | null;
  jiraSyncedAt: string | null;
  jiraSyncError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaskInput {
  date: string;
  title: string;
  description?: string;
  category?: Category;
  points?: number;
  status?: TaskStatus;
  manualDuration?: number | null;
  startTime?: string | null;
  pinned?: boolean;
  /** Crée aussi un ticket Jira dans ce projet. */
  createInJiraProject?: string | null;
  /** Lie la tâche à un ticket Jira existant. */
  jiraKey?: string | null;
}

export type TaskPatch = Partial<
  Pick<
    Task,
    | 'title'
    | 'description'
    | 'category'
    | 'points'
    | 'status'
    | 'position'
    | 'manualDuration'
    | 'startTime'
    | 'pinned'
    | 'date'
    | 'actualMinutes'
  >
>;

export interface DayMeta {
  date: string;
  blockers: string;
  notes: string;
  mood: number | null;
  energy: number | null;
  validated: boolean;
  validatedAt: string | null;
}

export interface DayData {
  meta: DayMeta;
  tasks: Task[];
}

export interface TaskTemplate {
  id: string;
  title: string;
  category: Category;
  points: number;
  manualDuration: number | null;
  startTime: string | null;
  /** Jours ISO (1 = lundi … 7 = dimanche) où le modèle est ajouté automatiquement. */
  weekdays: number[];
}

// -------------------------
// USER
// -------------------------

export interface UserSettings {
  /** Début de journée "HH:MM" */
  workdayStart: string;
  /** Fin de journée "HH:MM" */
  workdayEnd: string;
  lunchEnabled: boolean;
  lunchStart: string;
  lunchEnd: string;
  /**
   * proportional : la journée est répartie entre les tâches au prorata des points.
   * perPoint     : chaque point vaut `minutesPerPoint` minutes.
   */
  durationMode: 'proportional' | 'perPoint';
  minutesPerPoint: number;
  /** Jours travaillés (ISO 1..7). */
  workdays: number[];
  defaultCategory: Category;
  defaultJiraProject: string | null;
  /** Créer automatiquement un ticket Jira pour chaque nouvelle tâche. */
  autoCreateJiraIssue: boolean;
  /** Envoyer le worklog Jira quand une tâche passe à "Terminée". */
  autoSyncWorklog: boolean;
  /** Passer le ticket Jira dans une colonne "Terminé" quand la tâche est terminée. */
  autoTransitionDone: boolean;
  /** Durée d'une session focus (minutes). */
  focusMinutes: number;
  reminderEnabled: boolean;
  /** Fuseau IANA — sert à dater correctement les worklogs Jira. */
  timezone: string;
}

export const DEFAULT_SETTINGS: UserSettings = {
  workdayStart: '09:00',
  workdayEnd: '18:00',
  lunchEnabled: true,
  lunchStart: '12:30',
  lunchEnd: '14:00',
  durationMode: 'proportional',
  minutesPerPoint: 30,
  workdays: [1, 2, 3, 4, 5],
  defaultCategory: 'development',
  defaultJiraProject: null,
  autoCreateJiraIssue: false,
  autoSyncWorklog: true,
  autoTransitionDone: false,
  focusMinutes: 25,
  reminderEnabled: false,
  timezone: 'Europe/Paris',
};

export interface JiraStatus {
  connected: boolean;
  displayName?: string;
  email?: string | null;
  avatar?: string | null;
  siteName?: string | null;
  cloudUrl?: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  avatar: string | null;
  settings: UserSettings;
  jira: JiraStatus;
  createdAt: string;
}

// -------------------------
// JIRA
// -------------------------

export interface JiraProject {
  key: string;
  name: string;
  avatar?: string;
}

export interface JiraIssue {
  key: string;
  summary: string;
  status: string;
  statusCategory: 'new' | 'indeterminate' | 'done' | string;
  priority: string;
  projectKey: string;
  projectName: string;
  issueType: string;
  url: string;
  updatedAt: string;
  /** Temps déjà loggé (secondes) */
  timeSpentSeconds: number;
}

// -------------------------
// STATS & REPORTS
// -------------------------

export interface PeriodStats {
  from: string;
  to: string;
  days: { date: string; minutes: number; tasks: number; done: number; points: number; validated: boolean; mood: number | null }[];
  totalMinutes: number;
  totalTasks: number;
  doneTasks: number;
  totalPoints: number;
  validatedDays: number;
  byCategory: Record<Category, number>;
}

// -------------------------
// API
// -------------------------

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
