import { describe, expect, it } from 'vitest';

// We test the pure heatmap utilities without importing the SolidJS component.
// The logic we need is inlined here to mirror the implementation.

type HeatmapCell = { date: string; count: number; dayOfWeek: number };

const INTENSITY_COLORS = [
  '#F3F4F6',
  '#FCA5A5',
  '#EF4444',
  '#DC2626',
  '#991B1B',
] as const;

const getIntensityColor = (count: number): string => {
  if (count === 0) return INTENSITY_COLORS[0];
  if (count === 1) return INTENSITY_COLORS[1];
  if (count <= 3) return INTENSITY_COLORS[2];
  if (count <= 5) return INTENSITY_COLORS[3];
  return INTENSITY_COLORS[4];
};

const toDateKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const MIN_DISPLAY_DAYS = 12 * 7;

const generateHeatmapGrid = (data: Record<string, number>, days: number): HeatmapCell[] => {
  const cells: HeatmapCell[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const effectiveDays = Math.max(days, MIN_DISPLAY_DAYS);
  for (let i = effectiveDays - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const key = toDateKey(date);
    cells.push({ date: key, count: data[key] ?? 0, dayOfWeek: date.getDay() });
  }
  return cells;
};

describe('getIntensityColor', () => {
  it('returns the empty colour for count 0', () => {
    expect(getIntensityColor(0)).toBe('#F3F4F6');
  });

  it('returns the lightest red for count 1', () => {
    expect(getIntensityColor(1)).toBe('#FCA5A5');
  });

  it('returns the second tier for count 2', () => {
    expect(getIntensityColor(2)).toBe('#EF4444');
  });

  it('returns the second tier for count 3', () => {
    expect(getIntensityColor(3)).toBe('#EF4444');
  });

  it('returns the third tier for count 4', () => {
    expect(getIntensityColor(4)).toBe('#DC2626');
  });

  it('returns the third tier for count 5', () => {
    expect(getIntensityColor(5)).toBe('#DC2626');
  });

  it('returns the darkest red for count 6', () => {
    expect(getIntensityColor(6)).toBe('#991B1B');
  });

  it('returns the darkest red for high counts', () => {
    expect(getIntensityColor(100)).toBe('#991B1B');
  });
});

describe('generateHeatmapGrid — minimum display days (#104)', () => {
  it('generates at least 84 cells (12 weeks) even when days is 1', () => {
    const cells = generateHeatmapGrid({}, 1);
    expect(cells.length).toBeGreaterThanOrEqual(MIN_DISPLAY_DAYS);
  });

  it('generates at least 84 cells when days is 7', () => {
    const cells = generateHeatmapGrid({}, 7);
    expect(cells.length).toBeGreaterThanOrEqual(MIN_DISPLAY_DAYS);
  });

  it('honours a larger days value and generates more than 84 cells', () => {
    const cells = generateHeatmapGrid({}, 365);
    expect(cells.length).toBe(365);
  });

  it('returns 84 cells when days is exactly 84', () => {
    const cells = generateHeatmapGrid({}, 84);
    expect(cells.length).toBe(84);
  });

  it('fills count from data keyed by date string', () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const key = toDateKey(today);
    const cells = generateHeatmapGrid({ [key]: 3 }, MIN_DISPLAY_DAYS);
    const todayCell = cells.find((c) => c.date === key);
    expect(todayCell?.count).toBe(3);
  });

  it('defaults count to 0 for dates not in data', () => {
    const cells = generateHeatmapGrid({}, MIN_DISPLAY_DAYS);
    expect(cells.every((c) => c.count === 0)).toBe(true);
  });
});

describe('toDateKey', () => {
  it('formats a date as YYYY-MM-DD', () => {
    expect(toDateKey(new Date(2026, 3, 5))).toBe('2026-04-05');
  });

  it('pads single-digit month and day', () => {
    expect(toDateKey(new Date(2026, 0, 1))).toBe('2026-01-01');
  });
});
