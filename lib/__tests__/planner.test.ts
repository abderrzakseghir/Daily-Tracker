import { describe, expect, it } from 'vitest';
import {
  computeDurations,
  dayCapacity,
  parseDuration,
  planDay,
  type PlanSettings,
  type PlanTask,
} from '../planner';

const settings: PlanSettings = {
  workdayStart: '09:00',
  workdayEnd: '17:30',
  lunchEnabled: true,
  lunchStart: '12:00',
  lunchEnd: '13:00',
  durationMode: 'proportional',
  minutesPerPoint: 30,
};

const task = (id: string, points: number, extra: Partial<PlanTask> = {}): PlanTask => ({
  id,
  points,
  position: 0,
  manualDuration: null,
  startTime: null,
  pinned: false,
  ...extra,
});

describe('dayCapacity', () => {
  it('déduit la pause déjeuner', () => {
    expect(dayCapacity(settings)).toBe(450); // 8h30 - 1h
    expect(dayCapacity({ ...settings, lunchEnabled: false })).toBe(510);
  });
});

describe('computeDurations', () => {
  it('répartit la journée au prorata des points', () => {
    const d = computeDurations([task('a', 6), task('b', 3), task('c', 1)], settings);
    expect(d.get('a')).toBe(270);
    expect(d.get('b')).toBe(135);
    expect(d.get('c')).toBe(45);
  });

  it('la somme vaut toujours la capacité restante', () => {
    const tasks = [task('a', 7), task('b', 3), task('c', 3), task('m', 5, { manualDuration: 50 })];
    const d = computeDurations(tasks, settings);
    const total = [...d.values()].reduce((s, v) => s + v, 0);
    expect(total).toBe(450);
    expect(d.get('m')).toBe(50);
    for (const v of d.values()) expect(v % 5).toBe(0);
  });

  it('mode par point', () => {
    const d = computeDurations([task('a', 4)], { ...settings, durationMode: 'perPoint' });
    expect(d.get('a')).toBe(120);
  });

  it('journée saturée par les durées manuelles → durée minimale', () => {
    const d = computeDurations(
      [task('m', 5, { manualDuration: 500 }), task('a', 4)],
      settings,
    );
    expect(d.get('a')).toBe(20);
  });
});

describe('planDay', () => {
  it('enchaîne les tâches et découpe autour de la pause', () => {
    const plan = planDay(
      [task('a', 5, { position: 0, manualDuration: 120 }), task('b', 5, { position: 1, manualDuration: 120 })],
      settings,
    );
    expect(plan.get('a')!.startTime).toBe('09:00');
    expect(plan.get('b')!.startTime).toBe('11:00');
    // b : 11h-12h puis 13h-14h
    expect(plan.get('b')!.segments).toEqual([
      { start: 660, end: 720 },
      { start: 780, end: 840 },
    ]);
  });

  it('respecte les tâches épinglées', () => {
    const plan = planDay(
      [
        task('meet', 2, { manualDuration: 30, startTime: '09:30', pinned: true }),
        task('a', 5, { position: 0, manualDuration: 60 }),
      ],
      settings,
    );
    expect(plan.get('meet')!.startTime).toBe('09:30');
    expect(plan.get('a')!.segments).toEqual([
      { start: 540, end: 570 },
      { start: 600, end: 630 },
    ]);
  });

  it('signale le débordement', () => {
    const plan = planDay([task('a', 5, { manualDuration: 600 })], settings);
    expect(plan.get('a')!.overflow).toBe(true);
  });
});

describe('parseDuration', () => {
  it.each([
    ['90', 90],
    ['45min', 45],
    ['1h', 60],
    ['1h30', 90],
    ['1,5h', 90],
    ['abc', null],
  ])('%s → %s', (input, expected) => {
    expect(parseDuration(input)).toBe(expected);
  });
});
