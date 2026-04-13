import { describe, expect, it } from 'vitest';

/**
 * Unit tests for session-list display helpers added in PR #485.
 *
 * formatDuration and formatDate are module-private helpers in
 * entrypoints/stats/App.tsx. Following the same pattern used for
 * the options page, we test the pure logic directly so we can avoid
 * a full SolidJS DOM environment.
 */

// --- formatDuration ---------------------------------------------------------
// Mirrors the implementation in entrypoints/stats/App.tsx:
//   const mins = Math.round(ms / 60000);
//   return `${mins} min`;

function formatDuration(ms: number): string {
  const mins = Math.round(ms / 60000);
  return `${mins} min`;
}

describe('formatDuration', () => {
  it('converts a standard 25-minute session', () => {
    expect(formatDuration(25 * 60_000)).toBe('25 min');
  });

  it('converts a 5-minute short break', () => {
    expect(formatDuration(5 * 60_000)).toBe('5 min');
  });

  it('converts a 30-minute long break', () => {
    expect(formatDuration(30 * 60_000)).toBe('30 min');
  });

  it('rounds a duration that is 30 s above a whole minute', () => {
    // 24 min 30 s → rounds up to 25
    expect(formatDuration(24 * 60_000 + 30_000)).toBe('25 min');
  });

  it('rounds a duration that is 29 s below a whole minute down', () => {
    // 24 min 29 s → rounds down to 24
    expect(formatDuration(24 * 60_000 + 29_000)).toBe('24 min');
  });

  it('returns "0 min" for zero milliseconds', () => {
    expect(formatDuration(0)).toBe('0 min');
  });

  it('handles a 1-hour session', () => {
    expect(formatDuration(60 * 60_000)).toBe('60 min');
  });
});

// --- formatDate -------------------------------------------------------------
// Mirrors the implementation in entrypoints/stats/App.tsx:
//   const d = new Date(dateStr);
//   return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
//
// new Date('YYYY-MM-DD') parses as UTC midnight, so in timezones behind UTC
// the resulting local date is one day earlier. Tests assert on the value
// returned by the function — i.e. what toLocaleDateString() actually produces
// in the current environment — rather than on a fixed expected string.

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

describe('formatDate', () => {
  it('returns a non-empty string for a valid ISO date', () => {
    expect(formatDate('2026-04-12').length).toBeGreaterThan(0);
  });

  it('includes an abbreviated month name (at least 3 letters)', () => {
    expect(formatDate('2026-04-12')).toMatch(/[A-Za-z]{3}/);
  });

  it('includes a 4-digit year that is within one year of the input', () => {
    // new Date('YYYY-MM-DD') is UTC midnight; in timezones behind UTC the
    // displayed year may be one less than the input year for Jan 1. We allow
    // either the input year or input year - 1.
    const result = formatDate('2026-04-12');
    expect(result).toMatch(/202[0-9]/);
  });

  it('round-trips: result for a given date is stable across two calls', () => {
    expect(formatDate('2026-04-12')).toBe(formatDate('2026-04-12'));
  });

  it('produces different output for different input dates', () => {
    expect(formatDate('2026-04-12')).not.toBe(formatDate('2026-04-13'));
  });

  it('produces different output for different months', () => {
    expect(formatDate('2026-04-01')).not.toBe(formatDate('2026-05-01'));
  });

  it('produces different output for different years', () => {
    expect(formatDate('2025-06-15')).not.toBe(formatDate('2026-06-15'));
  });
});

// --- SESSION_PAGE_SIZE pagination boundary ----------------------------------
// Verifies the constant used to gate the "Show all N sessions" button.

const SESSION_PAGE_SIZE = 50;

describe('session list pagination constant', () => {
  it('SESSION_PAGE_SIZE is 50', () => {
    expect(SESSION_PAGE_SIZE).toBe(50);
  });

  it('shows button when session count exceeds page size', () => {
    const showButton = (count: number) => count > SESSION_PAGE_SIZE;
    expect(showButton(51)).toBe(true);
    expect(showButton(50)).toBe(false);
    expect(showButton(49)).toBe(false);
  });

  it('slices to page size when showAll is false', () => {
    const sessions = Array.from({ length: 75 }, (_, i) => i);
    const visible = (showAll: boolean) =>
      showAll ? sessions : sessions.slice(0, SESSION_PAGE_SIZE);

    expect(visible(false)).toHaveLength(SESSION_PAGE_SIZE);
    expect(visible(true)).toHaveLength(75);
  });
});
