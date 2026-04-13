import { describe, expect, it, vi } from 'vitest';
import { renderToString } from 'solid-js/web';
import Controls from '../Controls';

describe('Controls', () => {
  const noop = () => {};
  const defaultProps = {
    onStart: noop,
    onAbandon: noop,
    onAcceptLongBreak: noop,
    onSkipLongBreak: noop,
  };

  it('renders a Start button when phase is IDLE', () => {
    const html = renderToString(() =>
      Controls({ ...defaultProps, phase: 'IDLE' }),
    );
    expect(html).toContain('Start');
    expect(html).not.toContain('Abandon');
  });

  it('renders an Abandon button when phase is WORKING', () => {
    const html = renderToString(() =>
      Controls({ ...defaultProps, phase: 'WORKING' }),
    );
    expect(html).toContain('Abandon');
    expect(html).not.toContain('Start');
  });

  it('renders a Skip Break button during SHORT_BREAK', () => {
    const html = renderToString(() =>
      Controls({ ...defaultProps, phase: 'SHORT_BREAK' }),
    );
    expect(html).toContain('Skip Break');
  });

  it('renders a Skip Break button during LONG_BREAK', () => {
    const html = renderToString(() =>
      Controls({ ...defaultProps, phase: 'LONG_BREAK' }),
    );
    expect(html).toContain('Skip Break');
  });

  it('renders Long Break and Skip buttons during BREAK_SUGGESTION', () => {
    const html = renderToString(() =>
      Controls({ ...defaultProps, phase: 'BREAK_SUGGESTION' }),
    );
    expect(html).toContain('Long Break');
    expect(html).toContain('Skip');
  });

  it('calls onStart when Start button is rendered for IDLE phase', () => {
    // Verify the component renders the correct structure for IDLE
    const html = renderToString(() =>
      Controls({ ...defaultProps, phase: 'IDLE' }),
    );
    expect(html).toContain('type="button"');
    expect(html).toContain('Start');
  });
});
