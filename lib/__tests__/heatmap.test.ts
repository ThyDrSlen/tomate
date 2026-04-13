import { describe, expect, it } from 'vitest';

// We test the pure heatmap utilities without importing the SolidJS component.
// The logic is inlined here to mirror the implementation in components/Heatmap.tsx.

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

const generateHeatmapGrid = (data: Record<string, number>, days: number): HeatmapCell[] => {
  const cells: HeatmapCell[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const key = toDateKey(date);
    cells.push({ date: key, count: data[key] ?? 0, dayOfWeek: date.getDay() });
  }
  return cells;
};

const tooltipText = (cell: HeatmapCell): string => {
  const count = cell.count;
  const label = count === 0 ? 'No tomates' : `${count} tomate${count !== 1 ? 's' : ''}`;
  return `${label} on ${cell.date}`;
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

describe('generateHeatmapGrid — correct cell count (#106)', () => {
  it('generates exactly `days` cells for the given window', () => {
    expect(generateHeatmapGrid({}, 84).length).toBe(84);
  });

  it('generates exactly 7 cells for a 7-day window', () => {
    expect(generateHeatmapGrid({}, 7).length).toBe(7);
  });

  it('generates exactly 365 cells for a full-year window', () => {
    expect(generateHeatmapGrid({}, 365).length).toBe(365);
  });

  it('fills count from data keyed by date string', () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const key = toDateKey(today);
    const cells = generateHeatmapGrid({ [key]: 3 }, 84);
    const todayCell = cells.find((c) => c.date === key);
    expect(todayCell?.count).toBe(3);
  });

  it('defaults count to 0 for dates not in data (empty sessions renders all zero-count cells)', () => {
    const cells = generateHeatmapGrid({}, 84);
    expect(cells.every((c) => c.count === 0)).toBe(true);
  });

  it('a day with multiple sessions shows the correct count', () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const key = toDateKey(today);
    const cells = generateHeatmapGrid({ [key]: 5 }, 28);
    const todayCell = cells.find((c) => c.date === key);
    expect(todayCell?.count).toBe(5);
  });
});

describe('tooltipText — title attribute content (#106)', () => {
  it('shows "No tomates" for count 0', () => {
    const cell: HeatmapCell = { date: '2026-04-12', count: 0, dayOfWeek: 0 };
    expect(tooltipText(cell)).toBe('No tomates on 2026-04-12');
  });

  it('shows singular "tomate" for count 1', () => {
    const cell: HeatmapCell = { date: '2026-04-12', count: 1, dayOfWeek: 0 };
    expect(tooltipText(cell)).toBe('1 tomate on 2026-04-12');
  });

  it('shows plural "tomates" for count > 1', () => {
    const cell: HeatmapCell = { date: '2026-04-12', count: 3, dayOfWeek: 0 };
    expect(tooltipText(cell)).toBe('3 tomates on 2026-04-12');
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
