import { describe, expect, it } from 'vitest';

const INTENSITY_COLORS = ['#E5E7EB', '#FCA5A5', '#EF4444', '#DC2626', '#991B1B'] as const;

const getIntensityColor = (count: number): string => {
  if (count === 0) return INTENSITY_COLORS[0];
  if (count === 1) return INTENSITY_COLORS[1];
  if (count <= 3) return INTENSITY_COLORS[2];
  if (count <= 5) return INTENSITY_COLORS[3];
  return INTENSITY_COLORS[4];
};

describe('heatmap intensity colors', () => {
  it('returns lightest color for 0 sessions', () => {
    expect(getIntensityColor(0)).toBe('#E5E7EB');
  });

  it('returns correct color for 1 session', () => {
    expect(getIntensityColor(1)).toBe('#FCA5A5');
  });

  it('returns correct color for 2-3 sessions', () => {
    expect(getIntensityColor(2)).toBe('#EF4444');
    expect(getIntensityColor(3)).toBe('#EF4444');
  });

  it('returns correct color for 4-5 sessions', () => {
    expect(getIntensityColor(4)).toBe('#DC2626');
    expect(getIntensityColor(5)).toBe('#DC2626');
  });

  it('returns darkest color for 6+ sessions', () => {
    expect(getIntensityColor(6)).toBe('#991B1B');
    expect(getIntensityColor(100)).toBe('#991B1B');
  });
});

describe('heatmap day-of-week mapping', () => {
  const toMonRow = (jsDay: number) => (jsDay === 0 ? 6 : jsDay - 1);

  it('maps Monday (1) to row 0', () => expect(toMonRow(1)).toBe(0));
  it('maps Tuesday (2) to row 1', () => expect(toMonRow(2)).toBe(1));
  it('maps Wednesday (3) to row 2', () => expect(toMonRow(3)).toBe(2));
  it('maps Thursday (4) to row 3', () => expect(toMonRow(4)).toBe(3));
  it('maps Friday (5) to row 4', () => expect(toMonRow(5)).toBe(4));
  it('maps Saturday (6) to row 5', () => expect(toMonRow(6)).toBe(5));
  it('maps Sunday (0) to row 6', () => expect(toMonRow(0)).toBe(6));
});

describe('tomate pluralization', () => {
  const format = (count: number) => `${count} tomate${count !== 1 ? 's' : ''}`;

  it('uses singular for 1', () => expect(format(1)).toBe('1 tomate'));
  it('uses plural for 0', () => expect(format(0)).toBe('0 tomates'));
  it('uses plural for 2+', () => expect(format(5)).toBe('5 tomates'));
});
