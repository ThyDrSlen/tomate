const { describe, it, expect } =
  typeof Bun !== 'undefined' ? await import('bun:test') : await import('vitest');

describe('Tomate scaffold', () => {
  it('boots the test runner', () => {
    expect(true).toBe(true);
  });
});
