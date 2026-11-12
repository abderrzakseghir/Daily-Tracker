import { describe, expect, it } from 'vitest';
import { parseQuickAdd } from '../quick-add';

describe('parseQuickAdd', () => {
  it('extrait tous les marqueurs', () => {
    expect(parseQuickAdd('Corriger le login !7 #dev 1h30 @14h +PROJ')).toEqual({
      title: 'Corriger le login',
      points: 7,
      category: 'development',
      manualDuration: 90,
      startTime: '14:00',
      jiraProject: 'PROJ',
    });
  });

  it('catégorie par libellé français, sans accents', () => {
    expect(parseQuickAdd('Point équipe #reunion').category).toBe('meeting');
    expect(parseQuickAdd('Lire doc #form').category).toBe('training');
  });

  it('garde la clé Jira dans le titre et la lie', () => {
    const r = parseQuickAdd('ABC-42 revue de code 5pts');
    expect(r.jiraKey).toBe('ABC-42');
    expect(r.title).toBe('ABC-42 revue de code');
    expect(r.points).toBe(5);
  });

  it('ignore les marqueurs invalides', () => {
    const r = parseQuickAdd('Tâche !42 #zz @99h');
    expect(r).toEqual({ title: 'Tâche !42 #zz @99h' });
  });

  it('horaire avec minutes', () => {
    expect(parseQuickAdd('Daily @9:30 15min').startTime).toBe('09:30');
    expect(parseQuickAdd('Daily @9h45').startTime).toBe('09:45');
  });
});
