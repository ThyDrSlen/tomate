import { describe, expect, it } from 'vitest';

// We test the pure heatmap utilities without importing the SolidJS component.
// The logic we need is inlined here to mirror the implementation.

type HeatmapCell = { date: string; count: number; dayOfWeek: number };

const INTENSITY_CLASSES = [
  'bg-gray-100 dark:bg-gray-700',
  'bg-red-300  dark:bg-red-900',
  'bg-red-500  dark:bg-red-800',
  'bg-red-600  dark:bg-red-700',
  'bg-red-900  dark:bg-red-600',
] as const;

const getIntensityClass = (count: number): string => {
  if (count === 0) return INTENSITY_CLASSES[0];
  if (count === 1) return INTENSITY_CLASSES[1];
  if (count <= 3) return INTENSITY_CLASSES[2];
  if (count <= 5) return INTENSITY_CLASSES[3];
  return INTENSITY_CLASSES[4];
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

describe('getIntensityClass', () => {
  it('returns the empty class for count 0', () => {
    expect(getIntensityClass(0)).toBe('bg-gray-100 dark:bg-gray-700');
  });

  it('returns the lightest red class for count 1', () => {
    expect(getIntensityClass(1)).toBe('bg-red-300  dark:bg-red-900');
  });

  it('returns the second tier class for count 2', () => {
    expect(getIntensityClass(2)).toBe('bg-red-500  dark:bg-red-800');
  });

  it('returns the second tier class for count 3', () => {
    expect(getIntensityClass(3)).toBe('bg-red-500  dark:bg-red-800');
  });

  it('returns the third tier class for count 4', () => {
    expect(getIntensityClass(4)).toBe('bg-red-600  dark:bg-red-700');
  });

  it('returns the third tier class for count 5', () => {
    expect(getIntensityClass(5)).toBe('bg-red-600  dark:bg-red-700');
  });

  it('returns the darkest red class for count 6', () => {
    expect(getIntensityClass(6)).toBe('bg-red-900  dark:bg-red-600');
  });

  it('returns the darkest red class for high counts', () => {
    expect(getIntensityClass(100)).toBe('bg-red-900  dark:bg-red-600');
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
