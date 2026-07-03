import { describe, it, expect } from 'vitest';
import { computeTimeAllocation } from '../timeblocking';

// Helper: sum all minutes in a result
const sum = (res: { minutes: number }[]) => res.reduce((s, r) => s + r.minutes, 0);

describe('computeTimeAllocation', () => {
  // ─── 1 ticket ──────────────────────────────────────────────────────────
  it('single ticket without override gets the whole workday', () => {
    const result = computeTimeAllocation([{ id: 'A', importance: 7 }]);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ id: 'A', minutes: 480 });
    expect(sum(result)).toBe(480);
  });

  it('single ticket with override equals the override', () => {
    const result = computeTimeAllocation([{ id: 'A', importance: 7, durationMinutes: 120 }]);
    expect(result[0]).toEqual({ id: 'A', minutes: 120 });
  });

  // ─── Equal importance ───────────────────────────────────────────────────
  it('equal importance splits evenly', () => {
    const result = computeTimeAllocation([
      { id: 'A', importance: 5 },
      { id: 'B', importance: 5 },
    ]);
    expect(result).toHaveLength(2);
    expect(sum(result)).toBe(480);
    // Each should be 240 min (480/2) — exact when divisible
    expect(result[0].minutes).toBe(240);
    expect(result[1].minutes).toBe(240);
  });

  it('three equal tickets: sum is exact and each is ~160min', () => {
    const result = computeTimeAllocation([
      { id: 'A', importance: 3 },
      { id: 'B', importance: 3 },
      { id: 'C', importance: 3 },
    ]);
    expect(sum(result)).toBe(480);
    // 480/3 = 160 exactly; rounding to 5 = 160 (no change)
    expect(result[0].minutes).toBe(160);
    expect(result[1].minutes).toBe(160);
    expect(result[2].minutes).toBe(160);
  });

  // ─── Example from spec (5, 4, 1) ───────────────────────────────────────
  it('distributes prorata for A=5, B=4, C=1 (total importance = 10)', () => {
    const result = computeTimeAllocation([
      { id: 'A', importance: 5 },
      { id: 'B', importance: 4 },
      { id: 'C', importance: 1 },
    ]);
    // Raw: A=240, B=192, C=48 — all multiples of 5 already, sum=480
    expect(sum(result)).toBe(480);
    expect(result.find((r) => r.id === 'A')!.minutes).toBe(240);
    expect(result.find((r) => r.id === 'B')!.minutes).toBe(190); // 192 rounds to 190
    expect(result.find((r) => r.id === 'C')!.minutes).toBe(50);  // 48 rounds to 50, last ticket corrects to 50 (+2 absorbed)
  });

  // ─── Manual override ────────────────────────────────────────────────────
  it('excludes manual ticket and redistributes remaining time', () => {
    // A is manual at 120 min, B and C share the remaining 360 min equally
    const result = computeTimeAllocation([
      { id: 'A', importance: 5, durationMinutes: 120 },
      { id: 'B', importance: 5 },
      { id: 'C', importance: 5 },
    ]);
    expect(sum(result)).toBe(480);
    expect(result.find((r) => r.id === 'A')!.minutes).toBe(120); // unchanged
    // B and C share 360 equally → 180 each
    expect(result.find((r) => r.id === 'B')!.minutes).toBe(180);
    expect(result.find((r) => r.id === 'C')!.minutes).toBe(180);
  });

  it('manual overrides that fill the day leave auto tickets with 0', () => {
    const result = computeTimeAllocation([
      { id: 'A', importance: 5, durationMinutes: 480 },
      { id: 'B', importance: 5 },
    ]);
    expect(result.find((r) => r.id === 'A')!.minutes).toBe(480);
    expect(result.find((r) => r.id === 'B')!.minutes).toBe(0);
  });

  // ─── Importance = 0 fallback ────────────────────────────────────────────
  it('falls back to equal distribution when all importances are 0', () => {
    const result = computeTimeAllocation([
      { id: 'A', importance: 0 },
      { id: 'B', importance: 0 },
      { id: 'C', importance: 0 },
      { id: 'D', importance: 0 },
    ]);
    expect(sum(result)).toBe(480);
    // 480/4 = 120 each
    result.forEach((r) => expect(r.minutes).toBe(120));
  });

  // ─── Custom workday ─────────────────────────────────────────────────────
  it('respects a custom workDayMinutes parameter', () => {
    const result = computeTimeAllocation(
      [{ id: 'A', importance: 1 }, { id: 'B', importance: 1 }],
      600,
    );
    expect(sum(result)).toBe(600);
  });

  // ─── Empty input ────────────────────────────────────────────────────────
  it('returns empty array for no tickets', () => {
    expect(computeTimeAllocation([])).toEqual([]);
  });
});
