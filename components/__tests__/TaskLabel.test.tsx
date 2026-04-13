import { describe, expect, it, vi } from 'vitest';
import { renderToString } from 'solid-js/web';
import TaskLabel from '../TaskLabel';

describe('TaskLabel', () => {
  it('renders without crashing', () => {
    const html = renderToString(() =>
      TaskLabel({ value: '', onChange: () => {} }),
    );
    expect(html).toBeTruthy();
  });

  it('renders an input element', () => {
    const html = renderToString(() =>
      TaskLabel({ value: '', onChange: () => {} }),
    );
    expect(html).toContain('<input');
    expect(html).toContain('type="text"');
  });

  it('reflects the current value', () => {
    const html = renderToString(() =>
      TaskLabel({ value: 'Deep work', onChange: () => {} }),
    );
    expect(html).toContain('Deep work');
  });

  it('includes the placeholder text', () => {
    const html = renderToString(() =>
      TaskLabel({ value: '', onChange: () => {} }),
    );
    expect(html).toContain('What are you working on?');
  });

  it('enforces a maxLength of 50', () => {
    const html = renderToString(() =>
      TaskLabel({ value: '', onChange: () => {} }),
    );
    expect(html).toContain('maxlength="50"');
  });
});
