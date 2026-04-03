# Learnings — Tomate Extension

## Conventions & Patterns
<!-- Append new learnings below -->

- `lib/timer.ts` is intentionally pure: every time-sensitive function accepts an optional `now` argument and defaults to `Date.now()` so tests can avoid fake timers.
- Pomodoro cycle behavior is split across work completion and break completion: finishing work at cycle positions 0-2 auto-starts `SHORT_BREAK`, `SHORT_BREAK` completion increments `cyclePosition`, and the fourth completed work session yields `BREAK_SUGGESTION` until the user accepts or skips the long break.
