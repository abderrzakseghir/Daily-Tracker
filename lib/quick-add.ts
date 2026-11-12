import { parseDuration } from './planner';
import { CATEGORIES, CATEGORY_LABELS, type Category } from '@/types';

/**
 * Saisie rapide : "Corriger le login !7 #dev 1h30 @14h +PROJ"
 *   !7 ou 7pts   → points
 *   #dev         → catégorie (préfixe du nom ou du libellé français)
 *   1h30 / 45min → durée forcée
 *   @14h / @9:30 → horaire fixé
 *   +PROJ        → créer le ticket dans le projet Jira PROJ
 *   PROJ-123     → lier un ticket Jira existant
 */
export interface QuickAddResult {
  title: string;
  points?: number;
  category?: Category;
  manualDuration?: number;
  startTime?: string;
  jiraProject?: string;
  jiraKey?: string;
}

const normalize = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function matchCategory(word: string): Category | undefined {
  const w = normalize(word);
  return CATEGORIES.find(
    (c) => c.startsWith(w) || normalize(CATEGORY_LABELS[c]).startsWith(w),
  );
}

export function parseQuickAdd(input: string): QuickAddResult {
  const result: QuickAddResult = { title: '' };
  const kept: string[] = [];

  for (const token of input.trim().split(/\s+/)) {
    let m: RegExpMatchArray | null;

    if ((m = token.match(/^!(\d{1,2})$/)) || (m = token.match(/^(\d{1,2})pts?$/i))) {
      const p = parseInt(m[1], 10);
      if (p >= 1 && p <= 10) {
        result.points = p;
        continue;
      }
    }
    if ((m = token.match(/^#(\p{L}{2,})$/u))) {
      const c = matchCategory(m[1]);
      if (c) {
        result.category = c;
        continue;
      }
    }
    if ((m = token.match(/^@(\d{1,2})(?:[:h](\d{2})?)?$/i))) {
      const h = parseInt(m[1], 10);
      const min = parseInt(m[2] ?? '0', 10);
      if (h < 24 && min < 60) {
        result.startTime = `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
        continue;
      }
    }
    if ((m = token.match(/^\+([A-Z][A-Z0-9_]{1,9})$/))) {
      result.jiraProject = m[1];
      continue;
    }
    if (/^[A-Z][A-Z0-9_]{1,9}-\d+$/.test(token)) {
      result.jiraKey = token;
      kept.push(token);
      continue;
    }
    if (/^\d+(?:[.,]\d+)?h(?:\d{1,2})?$|^\d+(?:min|m)$/i.test(token)) {
      const d = parseDuration(token);
      if (d && d >= 5 && d <= 16 * 60) {
        result.manualDuration = d;
        continue;
      }
    }
    kept.push(token);
  }

  result.title = kept.join(' ').trim();
  return result;
}
