import {
  addDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { fr } from 'date-fns/locale';

/** Toutes les dates sont manipulées en chaînes locales "YYYY-MM-DD". */

export const toISO = (d: Date) => format(d, 'yyyy-MM-dd');
export const fromISO = (s: string) => parseISO(s);
export const todayISO = () => toISO(new Date());
export const addDaysISO = (date: string, n: number) => toISO(addDays(fromISO(date), n));

/** 1 = lundi … 7 = dimanche */
export const isoWeekday = (date: string) => ((fromISO(date).getDay() + 6) % 7) + 1;

export function weekRange(date: string) {
  const d = fromISO(date);
  return {
    from: toISO(startOfWeek(d, { weekStartsOn: 1 })),
    to: toISO(endOfWeek(d, { weekStartsOn: 1 })),
  };
}

export function monthRange(date: string) {
  const d = fromISO(date);
  return { from: toISO(startOfMonth(d)), to: toISO(endOfMonth(d)) };
}

export function daysBetween(from: string, to: string): string[] {
  return eachDayOfInterval({ start: fromISO(from), end: fromISO(to) }).map(toISO);
}

export function nextWorkday(date: string, workdays: number[], direction: 1 | -1 = 1): string {
  let d = addDaysISO(date, direction);
  for (let i = 0; i < 7 && workdays.length > 0 && !workdays.includes(isoWeekday(d)); i++) {
    d = addDaysISO(d, direction);
  }
  return d;
}

export const fmt = (date: string, pattern: string) => format(fromISO(date), pattern, { locale: fr });

/** "mardi 10 novembre" */
export const formatDayLong = (date: string) => fmt(date, 'EEEE d MMMM');

export function relativeDayLabel(date: string): string {
  const today = todayISO();
  if (date === today) return "Aujourd'hui";
  if (date === addDaysISO(today, -1)) return 'Hier';
  if (date === addDaysISO(today, 1)) return 'Demain';
  return capitalize(formatDayLong(date));
}

export const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function nowMinutes(): number {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}
