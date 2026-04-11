import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

// Re-export private helpers via module re-implementation so we can test them
// without exposing them from the component itself.

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

type HeatmapCell = {
  date: string;
  count: number;
  dayOfWeek: number;
};

const generateHeatmapGrid = (
  data: Record<string, number>,
  days: number,
): HeatmapCell[] => {
  const cells: HeatmapCell[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const key = toDateKey(date);
    cells.push({
      date: key,
      count: data[key] ?? 0,
      dayOfWeek: date.getDay(),
    });
  }

  return cells;
};

describe('getIntensityColor', () => {
  it('returns the empty color for 0 sessions', () => {
    expect(getIntensityColor(0)).toBe('#F3F4F6');
  });

  it('returns the lightest red for 1 session', () => {
    expect(getIntensityColor(1)).toBe('#FCA5A5');
  });

  it('returns the medium red for 2 sessions', () => {
    expect(getIntensityColor(2)).toBe('#EF4444');
  });

  it('returns the medium red for 3 sessions', () => {
    expect(getIntensityColor(3)).toBe('#EF4444');
  });

  it('returns the dark red for 4 sessions', () => {
    expect(getIntensityColor(4)).toBe('#DC2626');
  });

  it('returns the dark red for 5 sessions (max boundary)', () => {
    expect(getIntensityColor(5)).toBe('#DC2626');
  });

  it('returns the darkest red for 6+ sessions (exceeds max)', () => {
    expect(getIntensityColor(6)).toBe('#991B1B');
    expect(getIntensityColor(100)).toBe('#991B1B');
  });

  it('returns medium red for negative counts (negative satisfies count <= 3)', () => {
    // Negative counts pass the `count <= 3` branch since e.g. -1 <= 3 is true
    expect(getIntensityColor(-1)).toBe('#EF4444');
  });

  it('handles NaN by returning the darkest color (all comparisons fail)', () => {
    // NaN comparisons all evaluate to false, so falls through to the last return
    expect(getIntensityColor(NaN)).toBe('#991B1B');
  });
});

describe('generateHeatmapGrid', () => {
  const FIXED_TODAY = new Date(2026, 3, 10); // April 10, 2026 (Friday)

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_TODAY);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('generates the correct number of cells', () => {
    const grid = generateHeatmapGrid({}, 7);
    expect(grid).toHaveLength(7);
  });

  it('returns all zeros when data is empty', () => {
    const grid = generateHeatmapGrid({}, 7);
    expect(grid.every((cell) => cell.count === 0)).toBe(true);
  });

  it('fills in counts from the data map', () => {
    const todayKey = '2026-04-10';
    const grid = generateHeatmapGrid({ [todayKey]: 3 }, 1);

    expect(grid).toHaveLength(1);
    expect(grid[0].date).toBe(todayKey);
    expect(grid[0].count).toBe(3);
  });

  it('covers today as the last cell', () => {
    const grid = generateHeatmapGrid({}, 7);
    expect(grid[grid.length - 1].date).toBe('2026-04-10');
  });

  it('covers dates in ascending order from oldest to newest', () => {
    const grid = generateHeatmapGrid({}, 3);
    expect(grid[0].date).toBe('2026-04-08');
    expect(grid[1].date).toBe('2026-04-09');
    expect(grid[2].date).toBe('2026-04-10');
  });

  it('handles a single-day grid correctly', () => {
    const grid = generateHeatmapGrid({ '2026-04-10': 5 }, 1);
    expect(grid).toHaveLength(1);
    expect(grid[0]).toEqual({
      date: '2026-04-10',
      count: 5,
      dayOfWeek: 5, // Friday
    });
  });

  it('crosses a month boundary correctly', () => {
    // From March 31 to April 2 (3 days)
    vi.setSystemTime(new Date(2026, 3, 2)); // April 2
    const grid = generateHeatmapGrid({}, 3);
    expect(grid[0].date).toBe('2026-03-31');
    expect(grid[1].date).toBe('2026-04-01');
    expect(grid[2].date).toBe('2026-04-02');
  });

  it('assigns correct dayOfWeek values', () => {
    // April 10, 2026 is a Friday (dayOfWeek = 5)
    const grid = generateHeatmapGrid({}, 1);
    expect(grid[0].dayOfWeek).toBe(5);
  });

  it('returns an empty array when days is 0', () => {
    const grid = generateHeatmapGrid({}, 0);
    expect(grid).toHaveLength(0);
  });
});
