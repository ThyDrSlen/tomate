import { describe, expect, it } from 'vitest';
import { renderToString } from 'solid-js/web';
import TodayCount from '../TodayCount';

// Strip SSR hydration comment markers so assertions can match the visible text.
const strip = (html: string) => html.replace(/<!--.*?-->/g, '');

describe('TodayCount', () => {
  it('renders without crashing', () => {
    const html = renderToString(() => TodayCount({ count: 0 }));
    expect(html).toBeTruthy();
  });

  it('displays the count', () => {
    const text = strip(renderToString(() => TodayCount({ count: 3 })));
    expect(text).toContain('3');
  });

  it('uses plural "tomates" when count is not 1', () => {
    const text = strip(renderToString(() => TodayCount({ count: 2 })));
    expect(text).toContain('tomates');
    expect(text).toContain('today');
  });

  it('uses singular "tomate" (no trailing s) when count is 1', () => {
    const text = strip(renderToString(() => TodayCount({ count: 1 })));
    expect(text).toContain('tomate');
    expect(text).not.toContain('tomates');
  });

  it('shows goal text when goal is provided', () => {
    const text = strip(renderToString(() => TodayCount({ count: 2, goal: 4 })));
    expect(text).toContain('/ 4');
  });

  it('does not show goal text when goal is not provided', () => {
    const text = strip(renderToString(() => TodayCount({ count: 2 })));
    expect(text).not.toContain(' / ');
  });

  it('shows goal reached message when count meets goal', () => {
    const text = strip(renderToString(() => TodayCount({ count: 4, goal: 4 })));
    expect(text).toContain('Goal reached');
  });

  it('does not show goal reached when count is below goal', () => {
    const text = strip(renderToString(() => TodayCount({ count: 3, goal: 4 })));
    expect(text).not.toContain('Goal reached');
  });
});
