# Tomate — Chrome Extension Pomodoro Timer

## TL;DR
> **Summary**: Build a Chrome extension (MV3) Pomodoro timer called "Tomate" with configurable durations, task labels, GitHub-style heatmap visualization, and sound + confetti celebrations on popup open.
> **Deliverables**: Fully functional Chrome extension loadable from `.output/chrome-mv3/`, with popup UI (timer, controls, heatmap, settings), background service worker (alarms, badges, notifications), and test suite.
> **Effort**: Medium
> **Parallel**: YES — 4 waves
> **Critical Path**: Scaffold → Timer State Machine → Storage Layer → Background SW → Popup UI → Heatmap → Settings → Stats → E2E

## Context

### Original Request
Build a Pomodoro timer Chrome extension called "Tomate" (Spanish for tomato). Core technique: 25 min work → short break → repeat 4x → long break. Pomodoro is indivisible. Visualization of completed tomates per day + historical view.

### Interview Summary
- **Durations**: Configurable (defaults 25m work / 5m short break / 30m long break)
- **Task tracking**: Short text label per tomate, persists until user clears it
- **Visualization**: GitHub-style calendar heatmap
- **Celebration**: Sound + confetti, both deferred to next popup open (no offscreen document needed)
- **Badge idle**: Shows today's completed tomate count
- **Browser close mid-timer**: Counts as completed
- **Long break**: Suggested with Start/Skip buttons after 4th tomate
- **Mid-timer settings change**: Immediately adjusts current timer (recalculate endTime)
- **UI**: Solid.js (~7KB) for reactive popup
- **Build**: WXT framework with `@wxt-dev/module-solid`
- **CSS**: Tailwind CSS
- **Testing**: Vitest (unit, tests-after) + Playwright (E2E)

### Metis Review (gaps addressed)
- **Sound architecture**: No offscreen document — both sound + confetti deferred to popup open via `pendingCelebration` storage flag. Simplifies entrypoints.
- **Missed alarm recovery**: On SW startup, check if stored `endTime` < `Date.now()` → complete the session automatically.
- **Cross-midnight pomodoros**: Credit the start time's date for heatmap.
- **Mid-timer settings**: Recalculate `endTime = Date.now() + (newDuration - elapsedTime)` when duration changes. If elapsed > newDuration, complete immediately.
- **Storage growth**: ~730KB/year at heavy usage. Well within 10MB. No cleanup needed for V1.
- **Heatmap**: Custom CSS Grid component (~50 lines). No external library.
- **Date keys**: ISO `YYYY-MM-DD` strings derived from session start time.

## Work Objectives

### Core Objective
A Chrome extension that implements the Pomodoro technique with a clean Solid.js popup UI, reliable alarm-based timer that survives service worker termination, configurable durations, task labeling, and a GitHub-style heatmap for visualizing productivity over time.

### Deliverables
- Chrome extension loadable from `.output/chrome-mv3/`
- Popup: timer display, start/abandon controls, task label input, today's count, mini heatmap, settings link
- Full stats page: 365-day heatmap, totals, opens in new tab
- Settings: configurable work/short break/long break durations
- Background: alarm-based timer, badge updates, notifications
- Test suite: Vitest unit tests + Playwright E2E

### Definition of Done (verifiable conditions with commands)
- `bun run build` produces valid MV3 extension with `manifest.json` in `.output/chrome-mv3/`
- `bun test` passes all unit tests (timer state machine, storage, badge, notifications, components)
- `bunx playwright test` passes E2E tests (full pomodoro cycle, settings, heatmap)
- Extension can be loaded in Chrome via `chrome://extensions` → Load unpacked → `.output/chrome-mv3/`
- Complete pomodoro cycle works: start → 25m countdown → notification → badge update → open popup → confetti + sound → short break countdown → repeat 4x → long break suggested

### Must Have
- Reliable timer that survives service worker termination (chrome.alarms + absolute timestamps)
- Configurable durations with immediate effect on running timer
- Task label input persisting across tomates
- GitHub-style heatmap (120 days in popup, 365 in stats tab)
- Sound + confetti deferred to popup open via `pendingCelebration` flag
- Badge: remaining minutes during work, tomate count during idle/break
- Browser notification on timer completion
- Long break suggestion with Start/Skip after 4th tomate
- Missed alarm recovery on SW startup
- Cross-midnight tomates credited to start date

### Must NOT Have (guardrails)
- No full task/to-do list management — label is a plain string, max 50 chars, no categories/tags/filtering
- No abstract timer framework, plugin system, or strategy patterns — keep it direct
- No internationalization (English only)
- No theming system — one visual design, Tailwind utilities only
- No data export/import/sync
- No keyboard shortcuts in V1
- No content scripts or website blocking
- No offscreen documents (sound deferred to popup)
- No external heatmap library — custom CSS Grid component
- No JSDoc on every function — types are documentation, comment only non-obvious logic

## Verification Strategy
> ZERO HUMAN INTERVENTION — all verification is agent-executed.
- **Test approach**: Tests-after with Vitest. Timer state machine tests first (pure logic), then chrome API integration, then component tests.
- **QA policy**: Every task has agent-executed scenarios (happy + failure paths)
- **Evidence**: `.sisyphus/evidence/task-{N}-{slug}.{ext}`
- **Unit tests**: `WxtVitest` plugin with `@webext-core/fake-browser` for chrome API mocking
- **E2E**: Playwright loading extension from `.output/chrome-mv3/`
- **Build**: `bun run build` must succeed after every task

## Execution Strategy

### Parallel Execution Waves

**Wave 1 — Foundation (3 tasks)**: Project scaffold, timer state machine, storage schema
**Wave 2 — Chrome Integration (3 tasks)**: Background service worker, badge logic, notifications
**Wave 3 — UI (5 tasks)**: Popup shell + timer, task labels, heatmap component, settings page, celebration effects
**Wave 4 — Polish & Integration (3 tasks)**: Stats tab page, E2E test suite, final build verification

### Dependency Matrix
| Task | Depends On | Blocks |
|------|-----------|--------|
| 1. Project Scaffold | — | ALL |
| 2. Timer State Machine | 1 | 4, 7, 11 |
| 3. Storage Layer | 1 | 4, 5, 6, 7, 8, 9, 10, 11 |
| 4. Background Service Worker | 2, 3 | 6, 7, 13 |
| 5. Badge Updates | 3 | 13 |
| 6. Notifications | 3, 4 | 13 |
| 7. Popup Shell + Timer Display | 2, 3, 4 | 8, 10, 12, 13 |
| 8. Task Labels | 3, 7 | 13 |
| 9. Heatmap Component | 1 | 10, 12 |
| 10. Heatmap Integration + Today Count | 3, 7, 9 | 12, 13 |
| 11. Settings Page | 2, 3 | 13 |
| 12. Stats Tab Page | 9, 10 | 13 |
| 13. E2E Test Suite | 4, 5, 6, 7, 8, 10, 11, 12 | — |
| 14. Celebration Effects | 3, 7 | 13 |

### Agent Dispatch Summary
| Wave | Tasks | Count | Categories |
|------|-------|-------|------------|
| 1 | 1, 2, 3 | 3 | quick, deep, deep |
| 2 | 4, 5, 6, 9 | 4 | deep, quick, quick, visual-engineering |
| 3 | 7, 8, 10, 11, 14 | 5 | visual-engineering, quick, unspecified-low, visual-engineering, visual-engineering |
| 4 | 12, 13 | 2 | visual-engineering, deep |

## TODOs

- [ ] 1. Project Scaffold — WXT + Solid.js + Tailwind + Vitest

  **What to do**:
  1. Initialize WXT project with Solid.js template: `pnpm dlx wxt@latest init tomate-ext --template solid` (or `bun create wxt@latest` and select Solid). If the CLI doesn't offer a Solid template directly, init with vanilla and add `@wxt-dev/module-solid` manually.
  2. Install dependencies: `@wxt-dev/module-solid`, `solid-js`, `tailwindcss`, `postcss`, `autoprefixer`, `canvas-confetti`, `@types/canvas-confetti`
  3. Configure `wxt.config.ts`: add `modules: ['@wxt-dev/module-solid']`
  4. Configure Tailwind: `tailwind.config.ts` scanning `entrypoints/**/*.{ts,tsx}`, `components/**/*.{ts,tsx}`
  5. Configure Vitest: add `WxtVitest` plugin, setup file with `@webext-core/fake-browser` mocks
  6. Create directory structure:
     ```
     entrypoints/
       popup/
         index.html
         main.tsx        (Solid.js mount)
         App.tsx          (root component, "Tomate" heading placeholder)
         style.css        (Tailwind imports)
       background.ts      (empty defineBackground wrapper)
     components/          (shared Solid components)
     lib/                 (pure TS modules — timer, storage, types)
     public/
       icons/             (tomato icon 16/32/48/128)
       sounds/            (completion.mp3 — find or generate a short chime ~1s)
     ```
  7. Update `manifest.json` (via wxt.config.ts): set name "Tomate", description, permissions: `["alarms", "notifications", "storage"]`, action.default_icon
  8. Create placeholder tomato icons (solid red circle with green stem — simple SVG converted to PNG at 16/32/48/128)
  9. Verify: `bun run dev` opens popup showing "Tomate" heading, `bun run build` produces `.output/chrome-mv3/manifest.json`

  **Must NOT do**: Don't add any timer logic, don't create options page yet, don't over-engineer folder structure

  **Recommended Agent Profile**:
  - Category: `quick` — Reason: Scaffolding with CLI tools, config files, no complex logic
  - Skills: [] — no special skills needed
  - Omitted: [`frontend-design`] — no UI design yet, just placeholder

  **Parallelization**: Can Parallel: NO (Wave 1 but everything depends on it) | Wave 1 | Blocks: [2-14] | Blocked By: []

  **References**:
  - WXT docs: https://wxt.dev/guide/installation.html
  - WXT Solid module: https://wxt.dev/guide/solid.html or npm `@wxt-dev/module-solid`
  - WXT entrypoints convention: https://wxt.dev/guide/essentials/entrypoints.html
  - Tailwind + PostCSS setup: standard `postcss.config.js` with `tailwindcss` and `autoprefixer`
  - WxtVitest: https://wxt.dev/guide/testing.html

  **Acceptance Criteria** (agent-executable only):
  - [ ] `bun run build` exits 0 and `.output/chrome-mv3/manifest.json` exists with `"manifest_version": 3`
  - [ ] `bun run build` output contains `popup.html` in `.output/chrome-mv3/`
  - [ ] `bun test` runs (even if 0 tests) without config errors
  - [ ] `manifest.json` contains permissions `["alarms", "notifications", "storage"]`
  - [ ] Tailwind classes compile (verify: a test class in App.tsx like `bg-red-500` appears in built CSS)

  **QA Scenarios** (MANDATORY):
  ```
  Scenario: Build produces valid extension
    Tool: Bash
    Steps: Run `bun run build`, then `cat .output/chrome-mv3/manifest.json | jq .manifest_version`
    Expected: Output is `3`
    Evidence: .sisyphus/evidence/task-1-scaffold-build.txt

  Scenario: Build fails on invalid config
    Tool: Bash
    Steps: Temporarily break wxt.config.ts (bad module name), run `bun run build`
    Expected: Build exits non-zero with descriptive error
    Evidence: .sisyphus/evidence/task-1-scaffold-error.txt
  ```

  **Commit**: YES | Message: `feat(scaffold): init WXT + Solid.js + Tailwind project with extension manifest` | Files: [all scaffolded files]

- [ ] 2. Timer State Machine — Pure TypeScript Logic

  **What to do**:
  1. Create `lib/timer.ts` with a pure state machine (zero chrome API deps):
     - **States**: `IDLE`, `WORKING`, `SHORT_BREAK`, `LONG_BREAK`, `BREAK_SUGGESTION` (the "time for a long break" prompt state)
     - **Events**: `START`, `COMPLETE`, `ABANDON`, `ACCEPT_LONG_BREAK`, `SKIP_LONG_BREAK`, `SETTINGS_CHANGED`
     - **Core data**: `{ state, startTime, endTime, duration, sessionCount, cyclePosition (0-3) }`
     - `cyclePosition` tracks position in the 4-tomate cycle (0 = first tomate, 3 = fourth)
  2. Key functions (all pure — take state + event, return new state):
     - `startTimer(config: TimerConfig): TimerState` — creates WORKING state with `endTime = Date.now() + config.workDuration`
     - `completeTimer(state: TimerState): TimerState` — transitions WORKING→SHORT_BREAK (or →BREAK_SUGGESTION if cyclePosition === 3), BREAK→IDLE (increments cyclePosition for short breaks, resets to 0 after long break)
     - `abandonTimer(state: TimerState): TimerState` — any active state → IDLE (does NOT increment sessionCount, does NOT advance cyclePosition)
     - `acceptLongBreak(state: TimerState, config: TimerConfig): TimerState` — BREAK_SUGGESTION → LONG_BREAK with endTime
     - `skipLongBreak(state: TimerState): TimerState` — BREAK_SUGGESTION → IDLE, resets cyclePosition to 0
     - `adjustDuration(state: TimerState, newConfig: TimerConfig): TimerState` — if WORKING: `endTime = startTime + newConfig.workDuration`. If elapsed > newDuration, return completed state. If on break: same logic with break duration.
     - `recoverMissedAlarm(state: TimerState): TimerState | null` — if endTime < Date.now() and state is active, return completed state
     - `getRemainingMs(state: TimerState): number` — `Math.max(0, endTime - Date.now())`
  3. Create `lib/types.ts`:
     ```ts
     type TimerPhase = 'IDLE' | 'WORKING' | 'SHORT_BREAK' | 'LONG_BREAK' | 'BREAK_SUGGESTION'
     type TimerConfig = { workDuration: number; shortBreakDuration: number; longBreakDuration: number }
     type TimerState = { phase: TimerPhase; startTime: number | null; endTime: number | null; duration: number | null; sessionCount: number; cyclePosition: number; completedToday: number }
     type CompletedSession = { id: string; label: string; startTime: number; endTime: number; date: string; duration: number }
     ```
  4. Write tests in `lib/__tests__/timer.test.ts`:
     - Full cycle: IDLE → WORKING → SHORT_BREAK → IDLE → (repeat 3x) → BREAK_SUGGESTION → LONG_BREAK → IDLE
     - Abandon mid-work: WORKING → IDLE, sessionCount unchanged, cyclePosition unchanged
     - Abandon mid-break: SHORT_BREAK → IDLE, cyclePosition unchanged
     - Skip long break: BREAK_SUGGESTION → IDLE, cyclePosition resets to 0
     - Adjust duration mid-work (shorter than elapsed → immediate completion)
     - Adjust duration mid-work (longer → new endTime)
     - Adjust duration mid-break
     - Recover missed alarm (endTime in past)
     - Recover missed alarm (no active timer → null)
     - getRemainingMs precision (within 50ms tolerance)
     - Default config values (25/5/30 minutes in milliseconds)

  **Must NOT do**: Don't import chrome APIs. Don't import Solid.js. This is pure TS logic. Don't add audio/confetti logic. Don't persist to storage (that's task 3).

  **Recommended Agent Profile**:
  - Category: `deep` — Reason: Core state machine with many edge cases, needs thorough TDD
  - Skills: [] — pure TypeScript logic
  - Omitted: [`frontend-design`] — no UI

  **Parallelization**: Can Parallel: YES (with task 3, after task 1) | Wave 1 | Blocks: [4, 7, 11] | Blocked By: [1]

  **References**:
  - Pomodoro technique rules from user's description: 25m work, 5-10m short break, 20-30m long break after 4 pomodori
  - State machine pattern: pure functions taking (state, event) → newState
  - Vitest docs for assertions: `expect()`, `vi.useFakeTimers()`, `vi.advanceTimersByTime()`

  **Acceptance Criteria** (agent-executable only):
  - [ ] `bun test lib/__tests__/timer.test.ts` passes all tests (≥11 test cases)
  - [ ] `lib/timer.ts` has zero imports from `chrome.*`, `solid-js`, or any browser API
  - [ ] All functions are pure (deterministic given same inputs — mock `Date.now()` via `vi.useFakeTimers`)
  - [ ] TypeScript compiles with `strict: true`

  **QA Scenarios** (MANDATORY):
  ```
  Scenario: Full 4-tomate cycle
    Tool: Bash
    Steps: Run `bun test lib/__tests__/timer.test.ts -t "full cycle"` — test starts IDLE, runs 4 work+break cycles, verifies BREAK_SUGGESTION after 4th, then LONG_BREAK, then IDLE with cyclePosition reset
    Expected: All assertions pass. sessionCount incremented 4x. cyclePosition cycles 0→1→2→3→0.
    Evidence: .sisyphus/evidence/task-2-timer-cycle.txt

  Scenario: Mid-timer duration adjustment (elapsed > new duration)
    Tool: Bash
    Steps: Run `bun test lib/__tests__/timer.test.ts -t "adjust.*shorter"` — start 25m timer, advance 20m, adjust to 15m, verify immediate completion
    Expected: State transitions to SHORT_BREAK (or BREAK_SUGGESTION), endTime is now
    Evidence: .sisyphus/evidence/task-2-timer-adjust.txt
  ```

  **Commit**: YES | Message: `feat(timer): add pure state machine with full pomodoro cycle, abandon, adjust, recover` | Files: [`lib/timer.ts`, `lib/types.ts`, `lib/__tests__/timer.test.ts`]

- [ ] 3. Storage Layer — Typed Helpers for Timer State + Session History

  **What to do**:
  1. Create `lib/storage.ts` with typed read/write helpers wrapping `chrome.storage.local`:
     - `getTimerState(): Promise<TimerState>` — reads current timer state, returns IDLE default if missing
     - `setTimerState(state: TimerState): Promise<void>` — writes timer state
     - `getConfig(): Promise<TimerConfig>` — reads user config, returns defaults (25/5/30 min) if missing
     - `setConfig(config: TimerConfig): Promise<void>` — writes config
     - `addCompletedSession(session: CompletedSession): Promise<void>` — appends to session history array
     - `getSessionHistory(days?: number): Promise<CompletedSession[]>` — returns sessions, optionally filtered to last N days
     - `getHeatmapData(days: number): Promise<Record<string, number>>` — aggregates sessions into `{ "2026-03-15": 3, "2026-03-16": 1 }` format
     - `getTodayCount(): Promise<number>` — sessions completed today (using local date)
     - `getPendingCelebration(): Promise<boolean>` — reads celebration flag
     - `setPendingCelebration(pending: boolean): Promise<void>` — writes celebration flag
     - `getCurrentLabel(): Promise<string>` — reads persisted task label
     - `setCurrentLabel(label: string): Promise<void>` — writes task label (max 50 chars, truncate silently)
  2. Storage keys — define as constants:
     ```ts
     const KEYS = {
       TIMER_STATE: 'timerState',
       CONFIG: 'config',
       SESSIONS: 'sessions',
       PENDING_CELEBRATION: 'pendingCelebration',
       CURRENT_LABEL: 'currentLabel',
     } as const
     ```
  3. Date helper: `toDateKey(timestamp: number): string` — converts unix ms to `YYYY-MM-DD` in local timezone
  4. Write tests in `lib/__tests__/storage.test.ts` using `@webext-core/fake-browser`:
     - Read default state when storage is empty
     - Write + read roundtrip for timer state
     - Write + read roundtrip for config
     - Add session + retrieve
     - Heatmap aggregation with known fixture data (3 sessions on one day, 1 on another)
     - Today count accuracy
     - Label truncation at 50 chars
     - Pending celebration flag toggle

  **Must NOT do**: Don't use `window.localStorage`. Don't add migration/versioning logic (premature for V1). Don't add caching layer.

  **Recommended Agent Profile**:
  - Category: `deep` — Reason: Storage schema is foundational, needs thorough testing with fake browser
  - Skills: [] — standard TS + chrome API mocking
  - Omitted: [`frontend-design`] — no UI

  **Parallelization**: Can Parallel: YES (with task 2, after task 1) | Wave 1 | Blocks: [4, 5, 6, 7, 8, 9, 10, 11] | Blocked By: [1]

  **References**:
  - chrome.storage.local API: https://developer.chrome.com/docs/extensions/reference/api/storage
  - `@webext-core/fake-browser`: https://webext-core.aklinker1.io/guide/fake-browser/
  - `WxtVitest` plugin setup from task 1
  - Types from `lib/types.ts` (task 2)

  **Acceptance Criteria** (agent-executable only):
  - [ ] `bun test lib/__tests__/storage.test.ts` passes all tests (≥8 test cases)
  - [ ] All storage functions use `chrome.storage.local` exclusively (grep for `localStorage` returns 0 hits)
  - [ ] Heatmap data aggregation returns correct counts for fixture data
  - [ ] Label truncation verified: 51-char input → 50-char stored value

  **QA Scenarios** (MANDATORY):
  ```
  Scenario: Heatmap aggregation accuracy
    Tool: Bash
    Steps: Run `bun test lib/__tests__/storage.test.ts -t "heatmap"` — insert 3 sessions on 2026-03-15, 1 on 2026-03-16, 0 on 2026-03-17, request 7 days of heatmap data
    Expected: Returns `{"2026-03-15": 3, "2026-03-16": 1}` (days with 0 sessions omitted)
    Evidence: .sisyphus/evidence/task-3-storage-heatmap.txt

  Scenario: Empty storage returns safe defaults
    Tool: Bash
    Steps: Run `bun test lib/__tests__/storage.test.ts -t "default"` — call getTimerState() and getConfig() on fresh fake-browser
    Expected: TimerState has phase=IDLE, sessionCount=0. Config has workDuration=25*60*1000.
    Evidence: .sisyphus/evidence/task-3-storage-defaults.txt
  ```

  **Commit**: YES | Message: `feat(storage): add typed chrome.storage.local helpers with session history and heatmap aggregation` | Files: [`lib/storage.ts`, `lib/__tests__/storage.test.ts`]

- [ ] 4. Background Service Worker — Alarm-Based Timer Engine

  **What to do**:
  1. Implement `entrypoints/background.ts` inside `defineBackground(() => { ... })`:
     - **On install/startup**: Call `recoverMissedAlarm()` — check if stored endTime has passed, if so complete the session
     - **Message handler** (`chrome.runtime.onMessage`): Handle actions from popup:
       - `START_TIMER`: Read config → call `startTimer()` → save state → create `chrome.alarms.create('tomate-timer', { when: state.endTime })` → update badge
       - `ABANDON_TIMER`: Call `abandonTimer()` → save state → `chrome.alarms.clear('tomate-timer')` → update badge
       - `GET_STATE`: Read + return current timer state from storage
       - `ACCEPT_LONG_BREAK`: Call `acceptLongBreak()` → save state → create alarm → update badge
       - `SKIP_LONG_BREAK`: Call `skipLongBreak()` → save state → update badge
       - `UPDATE_CONFIG`: Read new config → if active timer, call `adjustDuration()` → save state → recreate alarm with new endTime → update badge
     - **Alarm handler** (`chrome.alarms.onAlarm`): When `tomate-timer` fires:
       - Read current state → call `completeTimer()` → save new state
       - If completing a work session: add to session history, set `pendingCelebration = true`, increment `completedToday`
       - Show notification: "Tomate complete! Time for a break." or "Break's over! Ready for another tomate?"
       - Update badge
       - If new state is `BREAK_SUGGESTION`: don't auto-start, wait for popup interaction
       - If new state is `SHORT_BREAK`: auto-start break timer alarm
  2. Badge update helper function:
     - `WORKING`: Show remaining minutes (e.g., `"24"`, `"5"`, `"<1"`)
     - `SHORT_BREAK` / `LONG_BREAK`: Show `"BRK"` with green background
     - `BREAK_SUGGESTION`: Show `"4✓"` or `"4"` with gold background
     - `IDLE`: Show today's completed count (e.g., `"3"`) with red background, or empty if 0
  3. Periodic badge refresh: Create a repeating alarm `badge-refresh` every 1 minute during active timer to update the badge text with remaining minutes
  4. Write tests in `entrypoints/__tests__/background.test.ts`:
     - Start timer: alarm created with correct `when` value
     - Alarm fires: state transitions correctly, session added to history, celebration flag set
     - Abandon: alarm cleared, state reset
     - Missed alarm recovery on startup
     - Badge text for each state
     - Settings change during active timer: alarm recreated with new `when`

  **Must NOT do**: Don't use `setInterval`/`setTimeout` for timer ticks. Don't play audio from service worker. Don't import Solid.js.

  **Recommended Agent Profile**:
  - Category: `deep` — Reason: Core extension logic with chrome API integration, alarm lifecycle, multiple message handlers
  - Skills: [] — standard Chrome extension development
  - Omitted: [`frontend-design`] — no UI

  **Parallelization**: Can Parallel: NO (needs tasks 2+3) | Wave 2 | Blocks: [6, 7, 13] | Blocked By: [2, 3]

  **References**:
  - Timer state machine: `lib/timer.ts` (task 2) — import and use all pure functions
  - Storage helpers: `lib/storage.ts` (task 3) — import all storage functions
  - chrome.alarms API: https://developer.chrome.com/docs/extensions/reference/api/alarms
  - chrome.action.setBadgeText: https://developer.chrome.com/docs/extensions/reference/api/action
  - WXT `defineBackground()`: https://wxt.dev/guide/essentials/entrypoints.html#background
  - **CRITICAL**: All runtime code must be inside `defineBackground(() => { ... })` — WXT imports entrypoints at build time in Node

  **Acceptance Criteria** (agent-executable only):
  - [ ] `bun test entrypoints/__tests__/background.test.ts` passes all tests (≥6 test cases)
  - [ ] `bun run build` still succeeds (extension remains loadable)
  - [ ] No `setInterval` or `setTimeout` used for timer logic (grep verification)
  - [ ] All message handlers return `true` for async response pattern

  **QA Scenarios** (MANDATORY):
  ```
  Scenario: Start timer creates correct alarm
    Tool: Bash
    Steps: Run `bun test entrypoints/__tests__/background.test.ts -t "start"` — send START_TIMER message, verify chrome.alarms.create called with `when` = Date.now() + 25*60*1000 (±100ms)
    Expected: Alarm created, state saved as WORKING, badge shows "25"
    Evidence: .sisyphus/evidence/task-4-background-start.txt

  Scenario: Missed alarm recovery on startup
    Tool: Bash
    Steps: Run `bun test entrypoints/__tests__/background.test.ts -t "recover"` — set storage with endTime 5 minutes in the past, trigger onInstalled, verify session completed
    Expected: State transitions to break/idle, session added to history, pendingCelebration set
    Evidence: .sisyphus/evidence/task-4-background-recover.txt
  ```

  **Commit**: YES | Message: `feat(background): add alarm-based timer engine with message handling and badge updates` | Files: [`entrypoints/background.ts`, `entrypoints/__tests__/background.test.ts`]

- [ ] 5. Badge Updates — Visual Feedback Module

  **What to do**:
  1. Extract badge logic into `lib/badge.ts` (pure function + chrome API wrapper):
     - `getBadgeConfig(state: TimerState, todayCount: number): { text: string; color: string }` — pure function:
       - `WORKING`: text = `String(Math.ceil(getRemainingMs(state) / 60000))`, color = `#DC2626` (red)
       - `SHORT_BREAK`: text = `"BRK"`, color = `#16A34A` (green)
       - `LONG_BREAK`: text = `"BRK"`, color = `#16A34A` (green)
       - `BREAK_SUGGESTION`: text = `"4✓"`, color = `#CA8A04` (gold)
       - `IDLE`: text = todayCount > 0 ? `String(todayCount)` : `""`, color = `#DC2626` (red)
     - `updateBadge(state: TimerState, todayCount: number): Promise<void>` — calls `chrome.action.setBadgeText` + `setBadgeBackgroundColor`
  2. Write tests in `lib/__tests__/badge.test.ts`:
     - Badge text for each state (use `getBadgeConfig` pure function)
     - Badge text during work with various remaining times (25m → "25", 1m → "1", 30s → "1")
     - Idle with 0 tomates → empty string
     - Idle with 5 tomates → "5"

  **Must NOT do**: Don't put this logic inline in background.ts — keep it testable as a separate module.

  **Recommended Agent Profile**:
  - Category: `quick` — Reason: Small module, pure logic + thin chrome wrapper
  - Skills: [] — simple TS
  - Omitted: all

  **Parallelization**: Can Parallel: YES (with tasks 4, 6, 9) | Wave 2 | Blocks: [13] | Blocked By: [3]

  **References**:
  - Timer types: `lib/types.ts` (task 2)
  - `getRemainingMs` from `lib/timer.ts` (task 2)
  - chrome.action badge API: https://developer.chrome.com/docs/extensions/reference/api/action#badge

  **Acceptance Criteria** (agent-executable only):
  - [ ] `bun test lib/__tests__/badge.test.ts` passes all tests (≥5 test cases)
  - [ ] `getBadgeConfig` is a pure function with zero chrome imports
  - [ ] Badge text never exceeds 4 characters

  **QA Scenarios** (MANDATORY):
  ```
  Scenario: Badge text for all timer phases
    Tool: Bash
    Steps: Run `bun test lib/__tests__/badge.test.ts` — test each phase returns expected text+color
    Expected: WORKING→minutes, SHORT_BREAK→"BRK", LONG_BREAK→"BRK", BREAK_SUGGESTION→"4✓", IDLE(3)→"3", IDLE(0)→""
    Evidence: .sisyphus/evidence/task-5-badge.txt

  Scenario: Badge text boundary — 4 char max
    Tool: Bash
    Steps: Run `bun test lib/__tests__/badge.test.ts -t "boundary"` — test with todayCount=99, todayCount=100
    Expected: "99" is fine, for 100+ either show "99+" or just "100" (3 chars fits). Never exceed 4 chars.
    Evidence: .sisyphus/evidence/task-5-badge-boundary.txt
  ```

  **Commit**: YES | Message: `feat(badge): add badge text/color logic for all timer phases` | Files: [`lib/badge.ts`, `lib/__tests__/badge.test.ts`]

- [ ] 6. Notifications — Timer Completion Alerts

  **What to do**:
  1. Create `lib/notifications.ts`:
     - `showTimerNotification(completedPhase: TimerPhase, sessionCount: number): Promise<void>`
       - Work complete: title `"🍅 Tomate Complete!"`, message `"Time for a break. You've done {n} tomate(s) today."`
       - Short break complete: title `"Break's Over"`, message `"Ready for another tomate?"`
       - Long break complete: title `"Long Break's Over"`, message `"Refreshed? Let's go!"`
       - Break suggestion: title `"🎉 4 Tomates Done!"`, message `"You've earned a long break. Open Tomate to start or skip."`
     - Use `chrome.notifications.create()` with type `'basic'`, `iconUrl: '/icons/icon-128.png'`
  2. Handle notification click in background.ts: `chrome.notifications.onClicked` → open popup (no-op, just clears notification)
  3. Write tests in `lib/__tests__/notifications.test.ts`:
     - Correct notification payload for each phase transition
     - Icon URL points to valid extension resource

  **Must NOT do**: Don't add notification sounds here (sound is handled via popup celebration). Don't add notification actions/buttons.

  **Recommended Agent Profile**:
  - Category: `quick` — Reason: Thin wrapper around chrome.notifications, straightforward
  - Skills: [] — simple chrome API usage
  - Omitted: all

  **Parallelization**: Can Parallel: YES (with tasks 4, 5, 9) | Wave 2 | Blocks: [13] | Blocked By: [3, 4]

  **References**:
  - chrome.notifications API: https://developer.chrome.com/docs/extensions/reference/api/notifications
  - Types from `lib/types.ts` (task 2)
  - Icon path: `public/icons/icon-128.png` (task 1)

  **Acceptance Criteria** (agent-executable only):
  - [ ] `bun test lib/__tests__/notifications.test.ts` passes all tests (≥4 test cases)
  - [ ] `chrome.notifications.create` called with correct payload for each phase
  - [ ] `bun run build` still succeeds

  **QA Scenarios** (MANDATORY):
  ```
  Scenario: Work completion notification
    Tool: Bash
    Steps: Run `bun test lib/__tests__/notifications.test.ts -t "work complete"` — call showTimerNotification('WORKING', 3)
    Expected: chrome.notifications.create called with title containing "Tomate Complete", message containing "3"
    Evidence: .sisyphus/evidence/task-6-notification.txt

  Scenario: Break suggestion notification
    Tool: Bash
    Steps: Run `bun test lib/__tests__/notifications.test.ts -t "suggestion"` — call showTimerNotification for break suggestion
    Expected: Title contains "4 Tomates", message mentions long break
    Evidence: .sisyphus/evidence/task-6-notification-suggestion.txt
  ```

  **Commit**: YES | Message: `feat(notifications): add timer completion notifications for all phases` | Files: [`lib/notifications.ts`, `lib/__tests__/notifications.test.ts`]

- [ ] 7. Popup Shell + Timer Display — Core UI

  **What to do**:
  1. Build the main popup UI in `entrypoints/popup/App.tsx`:
     - **Layout** (Tailwind, fixed width ~360px, auto height):
       - Top: "🍅 Tomate" title bar with settings gear icon (links to options page)
       - Center: Large circular timer display showing `MM:SS` countdown
       - Timer circle: visual ring that depletes as time passes (CSS `conic-gradient` or SVG circle with `stroke-dashoffset`)
       - Below timer: Current phase label ("Working", "Short Break", "Long Break", "Time for a long break!")
       - Below phase: Task label input (text field, placeholder "What are you working on?")
       - Controls row:
         - IDLE: "Start" button (primary, red/tomato colored)
         - WORKING: "Abandon" button (secondary, muted)
         - SHORT_BREAK / LONG_BREAK: "Skip Break" button
         - BREAK_SUGGESTION: "Start Long Break" + "Skip" buttons side by side
       - Bottom: Today's count ("3 tomates today") + mini heatmap area (placeholder for task 10)
     - **Timer logic in popup**:
       - On mount: send `GET_STATE` message to background → receive current state
       - If state is WORKING/BREAK: calculate remaining from `endTime - Date.now()`, start `setInterval(1000)` for display
       - On unmount: clear interval (cleanup)
       - Controls send messages to background: `START_TIMER`, `ABANDON_TIMER`, `ACCEPT_LONG_BREAK`, `SKIP_LONG_BREAK`
     - **Celebration check on mount**:
       - Read `pendingCelebration` from storage
       - If true: play `completion.mp3` via `new Audio()`, fire `confetti()` from canvas-confetti, clear flag
     - **Reactive updates**: Use Solid.js `createSignal` for state, `createEffect` for interval management, `onCleanup` for teardown
  2. Style with Tailwind — warm tomato color palette:
     - Primary: `#DC2626` (red-600) for tomato accents
     - Background: `#FEF2F2` (red-50) light warm background
     - Text: `#1F2937` (gray-800)
     - Timer ring: red during work, green during break, gold during suggestion
  3. Write component tests in `components/__tests__/TimerDisplay.test.tsx`:
     - Renders countdown from mock state
     - Shows correct controls per phase
     - Celebration fires when pendingCelebration is true

  **Must NOT do**: Don't implement heatmap here (task 9/10). Don't implement settings page (task 11). Don't add animations beyond the timer ring.

  **Recommended Agent Profile**:
  - Category: `visual-engineering` — Reason: Core UI with timer visualization, layout, Solid.js components
  - Skills: [`frontend-design`] — needs polished visual design for the timer display
  - Omitted: [`webapp-testing`] — unit tests sufficient, no Playwright here

  **Parallelization**: Can Parallel: NO (needs tasks 2, 3, 4) | Wave 3 | Blocks: [8, 10, 12, 13] | Blocked By: [2, 3, 4]

  **References**:
  - Timer state machine: `lib/timer.ts` (task 2) — import `getRemainingMs`, types
  - Storage helpers: `lib/storage.ts` (task 3) — import `getPendingCelebration`, `setPendingCelebration`, `getCurrentLabel`, `getTodayCount`
  - Background messages: `entrypoints/background.ts` (task 4) — message action types
  - canvas-confetti: `import confetti from 'canvas-confetti'` — call `confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } })`
  - Solid.js reactivity: `createSignal`, `createEffect`, `onMount`, `onCleanup`, `Show`, `Switch/Match`
  - Conic gradient timer ring: `background: conic-gradient(#DC2626 ${progress}%, transparent ${progress}%)`

  **Acceptance Criteria** (agent-executable only):
  - [ ] `bun run build` succeeds and popup.html exists in output
  - [ ] Popup renders timer display with MM:SS format
  - [ ] Controls change based on timer phase (verified via component test with mock state)
  - [ ] Celebration (confetti + sound) fires when pendingCelebration is true in storage (component test)
  - [ ] `setInterval` cleaned up on component unmount (no memory leaks)

  **QA Scenarios** (MANDATORY):
  ```
  Scenario: Popup shows countdown for active timer
    Tool: Bash
    Steps: Run component test — mock storage with WORKING state, endTime 15 minutes from now
    Expected: Timer displays "15:00" (±1s), phase label shows "Working"
    Evidence: .sisyphus/evidence/task-7-popup-countdown.txt

  Scenario: Celebration fires on popup open with pending flag
    Tool: Bash
    Steps: Run component test — set pendingCelebration=true in mock storage, mount App component
    Expected: confetti() called, Audio.play() called, pendingCelebration cleared to false
    Evidence: .sisyphus/evidence/task-7-popup-celebration.txt

  Scenario: BREAK_SUGGESTION shows dual buttons
    Tool: Bash
    Steps: Run component test — mock state with phase=BREAK_SUGGESTION
    Expected: Both "Start Long Break" and "Skip" buttons rendered
    Evidence: .sisyphus/evidence/task-7-popup-suggestion.txt
  ```

  **Commit**: YES | Message: `feat(popup): add timer display, controls, celebration effects, and task label input` | Files: [`entrypoints/popup/App.tsx`, `entrypoints/popup/style.css`, `components/TimerDisplay.tsx`, `components/Controls.tsx`, `components/__tests__/TimerDisplay.test.tsx`]

- [ ] 8. Task Labels — Input + History Integration

  **What to do**:
  1. Add task label input component `components/TaskLabel.tsx`:
     - Text input with placeholder "What are you working on?"
     - Max 50 chars (HTML `maxlength` + storage truncation from task 3)
     - On change: debounce 300ms → call `setCurrentLabel(value)` from storage
     - On mount: read `getCurrentLabel()` → populate input
     - Style: subtle, below timer, full width, small font
  2. Integrate label into session completion flow:
     - In `entrypoints/background.ts`: when alarm fires for WORKING phase, read `currentLabel` from storage → include in `CompletedSession` record
  3. Add recent sessions list below heatmap area in popup (simple list showing last 5 completed tomates with label + time):
     - `components/RecentSessions.tsx`: reads from `getSessionHistory(1)` (today's sessions), renders as small list
     - Each item: `"[label] — [time ago]"` (e.g., "Write README — 2h ago")
  4. Write tests:
     - Label persists across popup close/reopen (mock storage)
     - Label included in completed session record
     - Empty label stored as empty string, not undefined

  **Must NOT do**: Don't add categories, tags, or filtering. Don't add label autocomplete. Don't add label editing for past sessions.

  **Recommended Agent Profile**:
  - Category: `quick` — Reason: Simple input component + storage integration, minimal logic
  - Skills: [] — straightforward Solid.js component
  - Omitted: [`frontend-design`] — simple text input, no complex design needed

  **Parallelization**: Can Parallel: YES (with tasks 10, 11, 14) | Wave 3 | Blocks: [13] | Blocked By: [3, 7]

  **References**:
  - Storage: `lib/storage.ts` → `getCurrentLabel()`, `setCurrentLabel()`, `getSessionHistory()`
  - Types: `lib/types.ts` → `CompletedSession` (has `label` field)
  - Background: `entrypoints/background.ts` → alarm handler reads label on session completion

  **Acceptance Criteria** (agent-executable only):
  - [ ] Label input renders in popup with placeholder text
  - [ ] Label persists to storage on input (debounced)
  - [ ] Completed session includes label from storage
  - [ ] Recent sessions list shows label + relative time

  **QA Scenarios** (MANDATORY):
  ```
  Scenario: Label persists across popup lifecycle
    Tool: Bash
    Steps: Component test — set label "Write report", unmount, remount, verify input value
    Expected: Input shows "Write report" after remount (read from storage)
    Evidence: .sisyphus/evidence/task-8-label-persist.txt

  Scenario: Label included in session
    Tool: Bash
    Steps: Unit test — set currentLabel to "Code review", trigger alarm completion, read session history
    Expected: Last session has label "Code review"
    Evidence: .sisyphus/evidence/task-8-label-session.txt
  ```

  **Commit**: YES | Message: `feat(labels): add task label input and recent sessions list` | Files: [`components/TaskLabel.tsx`, `components/RecentSessions.tsx`, `components/__tests__/TaskLabel.test.tsx`]

- [ ] 9. Heatmap Component — Custom CSS Grid Visualization

  **What to do**:
  1. Build `components/Heatmap.tsx` — a pure Solid.js component:
     - **Props**: `data: Record<string, number>` (date string → count), `days: number` (how many days to show), `cellSize?: number`
     - **Layout**: CSS Grid, `grid-auto-flow: column`, 7 rows (Mon-Sun) × N columns (weeks)
     - **Each cell**: small square (`12px` default), colored by intensity:
       - 0 sessions: `#F3F4F6` (gray-100)
       - 1 session: `#FCA5A5` (red-300)
       - 2-3 sessions: `#EF4444` (red-500)
       - 4-5 sessions: `#DC2626` (red-600)
       - 6+ sessions: `#991B1B` (red-800)
     - **Tooltip on hover**: "March 15: 3 tomates" (CSS-only tooltip or tiny Solid component)
     - **Month labels**: Small text above columns at month boundaries
     - **Day labels**: Mon/Wed/Fri on the left side
  2. Component is **pure** — takes data as props, no storage access. Integration with real data is task 10.
  3. Helper function `generateHeatmapGrid(data, days)`: returns array of `{ date: string, count: number, dayOfWeek: number, weekIndex: number }` for rendering
  4. Write tests in `components/__tests__/Heatmap.test.tsx`:
     - Renders correct number of cells for 120 days (~17-18 weeks × 7 = ~120 cells)
     - Correct CSS class/color for known counts (0, 1, 3, 5, 7)
     - Empty data renders all gray cells
     - Tooltip content matches date + count

  **Must NOT do**: Don't install any heatmap library. Don't connect to storage (that's task 10). Don't add click handlers or drill-down.

  **Recommended Agent Profile**:
  - Category: `visual-engineering` — Reason: CSS Grid layout, color scale, visual component
  - Skills: [`frontend-design`] — needs polished visual matching GitHub's heatmap aesthetic
  - Omitted: [`webapp-testing`] — component tests sufficient

  **Parallelization**: Can Parallel: YES (with tasks 4, 5, 6 — only needs task 1) | Wave 2 | Blocks: [10, 12] | Blocked By: [1]

  **References**:
  - GitHub contribution graph for visual reference: green squares in a grid, 5 intensity levels
  - CSS Grid: `display: grid; grid-template-rows: repeat(7, 1fr); grid-auto-flow: column; gap: 2px`
  - Tailwind color scale: red-100 through red-900 for tomato theming
  - Solid.js `For` component for efficient list rendering

  **Acceptance Criteria** (agent-executable only):
  - [ ] `bun test components/__tests__/Heatmap.test.tsx` passes all tests (≥4 test cases)
  - [ ] Component renders correct number of grid cells for given day count
  - [ ] Color intensity matches defined thresholds (0→gray, 1→light red, 6+→dark red)
  - [ ] No external heatmap library in dependencies (check package.json)
  - [ ] CSS Grid layout verified: 7 rows visible

  **QA Scenarios** (MANDATORY):
  ```
  Scenario: Heatmap renders with fixture data
    Tool: Bash
    Steps: Run `bun test components/__tests__/Heatmap.test.tsx -t "fixture"` — pass known data with dates having 0,1,3,5,7 sessions
    Expected: 5 different color classes applied correctly to corresponding cells
    Evidence: .sisyphus/evidence/task-9-heatmap-colors.txt

  Scenario: Empty heatmap renders all gray
    Tool: Bash
    Steps: Run `bun test components/__tests__/Heatmap.test.tsx -t "empty"` — pass empty data object, 30 days
    Expected: All cells have gray background class, no red cells
    Evidence: .sisyphus/evidence/task-9-heatmap-empty.txt
  ```

  **Commit**: YES | Message: `feat(heatmap): add custom CSS Grid heatmap component with 5 intensity levels` | Files: [`components/Heatmap.tsx`, `components/__tests__/Heatmap.test.tsx`]

- [ ] 10. Heatmap Integration + Today's Count

  **What to do**:
  1. In `entrypoints/popup/App.tsx`, integrate real heatmap:
     - On mount: call `getHeatmapData(120)` from storage → pass to `<Heatmap>` component
     - Show today's count: call `getTodayCount()` → display "X tomates today" with small tomato emoji
     - Refresh both when a new session completes (listen for storage changes via `chrome.storage.onChanged`)
  2. Create `components/TodayCount.tsx`:
     - Props: `count: number`
     - Display: `"🍅 {count} tomate{s} today"` with conditional plural
     - Style: centered, below controls, warm red text
  3. Wire `<Heatmap days={120} data={heatmapData()} />` and `<TodayCount count={todayCount()} />` into popup layout
  4. Write integration test: mock storage with session data → verify heatmap + count render correctly

  **Must NOT do**: Don't refactor heatmap component. Don't add filtering by label. Don't add date range picker.

  **Recommended Agent Profile**:
  - Category: `unspecified-low` — Reason: Wiring existing components to storage, straightforward integration
  - Skills: [] — standard integration work
  - Omitted: all

  **Parallelization**: Can Parallel: YES (with tasks 8, 11, 14) | Wave 3 | Blocks: [12, 13] | Blocked By: [3, 7, 9]

  **References**:
  - Heatmap component: `components/Heatmap.tsx` (task 9)
  - Storage: `lib/storage.ts` → `getHeatmapData()`, `getTodayCount()`
  - chrome.storage.onChanged: https://developer.chrome.com/docs/extensions/reference/api/storage#event-onChanged
  - Popup layout: `entrypoints/popup/App.tsx` (task 7)

  **Acceptance Criteria** (agent-executable only):
  - [ ] Popup renders heatmap with real session data from storage
  - [ ] Today's count displays correct number
  - [ ] Heatmap + count refresh when a new session is added to storage (via onChanged listener)
  - [ ] `bun run build` succeeds

  **QA Scenarios** (MANDATORY):
  ```
  Scenario: Heatmap shows real session data
    Tool: Bash
    Steps: Integration test — seed storage with 5 sessions across 3 dates, mount popup, verify heatmap cells colored for those dates
    Expected: 3 dates have colored cells, rest are gray. TodayCount shows correct number.
    Evidence: .sisyphus/evidence/task-10-heatmap-integration.txt

  Scenario: Live update on new session
    Tool: Bash
    Steps: Integration test — mount popup, add a session to storage, verify count increments and heatmap updates
    Expected: TodayCount goes from N to N+1, heatmap cell for today changes intensity
    Evidence: .sisyphus/evidence/task-10-heatmap-live.txt
  ```

  **Commit**: YES | Message: `feat(popup): integrate heatmap and today's count with live storage updates` | Files: [`entrypoints/popup/App.tsx`, `components/TodayCount.tsx`, `components/__tests__/HeatmapIntegration.test.tsx`]

- [ ] 11. Settings Page — Configurable Durations

  **What to do**:
  1. Create WXT options page: `entrypoints/options/index.html` + `entrypoints/options/main.tsx` + `entrypoints/options/App.tsx`
  2. Settings UI:
     - Title: "Tomate Settings"
     - Three number inputs with labels:
       - "Work duration" — default 25 (minutes), min 1, max 120
       - "Short break" — default 5 (minutes), min 1, max 30
       - "Long break" — default 30 (minutes), min 5, max 60
     - "Save" button — writes to storage via `setConfig()`, sends `UPDATE_CONFIG` message to background
     - "Reset to defaults" link — restores 25/5/30
     - Visual feedback: "Settings saved ✓" toast after save
  3. **Immediate adjustment**: When `UPDATE_CONFIG` is sent to background, if a timer is active:
     - Background calls `adjustDuration(currentState, newConfig)` from timer.ts
     - If the new duration is shorter than elapsed time → complete immediately
     - Otherwise → recalculate endTime, recreate alarm
  4. Open from popup: gear icon in popup header opens `chrome.runtime.openOptionsPage()`
  5. Write tests:
     - Default values loaded on first open
     - Validation: min/max constraints enforced
     - Save persists to storage
     - Background receives UPDATE_CONFIG and adjusts timer

  **Must NOT do**: Don't add sound selection, theme picker, or notification preferences. Don't add import/export.

  **Recommended Agent Profile**:
  - Category: `visual-engineering` — Reason: Form UI with validation, options page layout
  - Skills: [`frontend-design`] — settings page needs clean, usable form design
  - Omitted: [`webapp-testing`] — unit tests sufficient

  **Parallelization**: Can Parallel: YES (with tasks 8, 10, 14) | Wave 3 | Blocks: [13] | Blocked By: [2, 3]

  **References**:
  - WXT options page: https://wxt.dev/guide/essentials/entrypoints.html#options
  - Storage: `lib/storage.ts` → `getConfig()`, `setConfig()`
  - Timer: `lib/timer.ts` → `adjustDuration()`
  - Background message: `UPDATE_CONFIG` action (task 4)
  - `chrome.runtime.openOptionsPage()`: opens the options entrypoint

  **Acceptance Criteria** (agent-executable only):
  - [ ] Options page renders with three number inputs and correct defaults
  - [ ] Validation prevents values outside min/max ranges
  - [ ] Save persists config to chrome.storage.local
  - [ ] UPDATE_CONFIG message sent to background on save
  - [ ] `bun run build` produces options.html in output

  **QA Scenarios** (MANDATORY):
  ```
  Scenario: Save custom durations
    Tool: Bash
    Steps: Component test — change work to 45, short break to 10, long break to 20, click save
    Expected: Storage contains {workDuration: 45*60*1000, shortBreakDuration: 10*60*1000, longBreakDuration: 20*60*1000}
    Evidence: .sisyphus/evidence/task-11-settings-save.txt

  Scenario: Validation rejects invalid values
    Tool: Bash
    Steps: Component test — try to set work duration to 0, -1, 121
    Expected: Input clamps to min/max, save button disabled or value corrected
    Evidence: .sisyphus/evidence/task-11-settings-validation.txt
  ```

  **Commit**: YES | Message: `feat(settings): add options page with configurable work and break durations` | Files: [`entrypoints/options/index.html`, `entrypoints/options/main.tsx`, `entrypoints/options/App.tsx`, `components/__tests__/Settings.test.tsx`]

- [ ] 12. Stats Tab Page — Full Year Heatmap + Totals

  **What to do**:
  1. Create a new tab page: `entrypoints/stats/index.html` + `entrypoints/stats/main.tsx` + `entrypoints/stats/App.tsx`
     - WXT entrypoint config: `{ matches: [] }` — opened programmatically, not on new tab
  2. Stats page UI:
     - Title: "🍅 Tomate — Your Stats"
     - Full 365-day heatmap using `<Heatmap days={365} cellSize={14} data={yearData} />`
     - Summary cards:
       - "Total tomates" (all time)
       - "Today" (count)
       - "This week" (count)
       - "Best day" (date + count)
       - "Current streak" (consecutive days with ≥1 tomate)
     - Color legend below heatmap: gray → light red → dark red with labels "Less" → "More"
  3. Open from popup: "View all stats →" link below mini heatmap → `chrome.tabs.create({ url: chrome.runtime.getURL('/stats.html') })`
  4. Compute stats from `getSessionHistory()`:
     - Create `lib/stats.ts` with pure computation functions:
       - `computeTotalCount(sessions): number`
       - `computeWeekCount(sessions): number`
       - `computeBestDay(sessions): { date: string, count: number }`
       - `computeStreak(sessions): number` — consecutive days ending today (or yesterday) with ≥1 session
  5. Write tests for stats computation functions and component rendering with fixture data

  **Must NOT do**: Don't add charts beyond the heatmap. Don't add filtering by label. Don't add date range selection. Don't add export.

  **Recommended Agent Profile**:
  - Category: `visual-engineering` — Reason: Full page layout with heatmap, summary cards, visual design
  - Skills: [`frontend-design`] — needs polished dashboard-style layout
  - Omitted: [`webapp-testing`] — component + unit tests

  **Parallelization**: Can Parallel: NO (needs heatmap component + integration) | Wave 4 | Blocks: [13] | Blocked By: [9, 10]

  **References**:
  - Heatmap component: `components/Heatmap.tsx` (task 9) — reuse with `days={365}`
  - Storage: `lib/storage.ts` → `getSessionHistory()`, `getHeatmapData(365)`
  - WXT unlisted page: https://wxt.dev/guide/essentials/entrypoints.html
  - GitHub contribution graph for layout inspiration

  **Acceptance Criteria** (agent-executable only):
  - [ ] Stats page renders 365-day heatmap
  - [ ] Summary cards show correct computed values from fixture data
  - [ ] Streak calculation correct: 3 consecutive days → streak of 3
  - [ ] `bun run build` produces stats.html in output
  - [ ] Link from popup opens stats page in new tab

  **QA Scenarios** (MANDATORY):
  ```
  Scenario: Stats page with fixture data
    Tool: Bash
    Steps: Run `bun test lib/__tests__/stats.test.ts` — compute stats from fixture: 50 sessions over 20 days
    Expected: totalCount=50, streak computed correctly, bestDay matches highest count day
    Evidence: .sisyphus/evidence/task-12-stats-compute.txt

  Scenario: Full year heatmap renders
    Tool: Bash
    Steps: Component test — mount stats App with fixture data, verify heatmap has ~365 cells
    Expected: Grid contains 52-53 columns × 7 rows worth of cells
    Evidence: .sisyphus/evidence/task-12-stats-heatmap.txt
  ```

  **Commit**: YES | Message: `feat(stats): add full-year stats page with heatmap, totals, and streak tracking` | Files: [`entrypoints/stats/`, `lib/stats.ts`, `lib/__tests__/stats.test.ts`, `components/__tests__/Stats.test.tsx`]

- [ ] 13. E2E Test Suite — Full Integration Verification

  **What to do**:
  1. Set up Playwright for Chrome extension testing:
     - `playwright.config.ts`: use chromium, load extension from `.output/chrome-mv3/`
     - Custom fixture to launch Chrome with extension loaded
  2. Write E2E tests in `e2e/`:
     - **Test 1: Full pomodoro cycle**: Open popup → start timer → verify countdown displays → (use chrome.alarms mock or short duration for test) → verify completion notification → verify badge update → verify pendingCelebration flow
     - **Test 2: Settings persistence**: Open options page → change work duration to 10m → save → open popup → start timer → verify timer shows 10:00
     - **Test 3: Popup lifecycle**: Start timer → close popup → reopen → verify countdown still accurate (calculated from stored endTime)
     - **Test 4: Heatmap renders**: Complete a session (short timer) → open popup → verify heatmap has a colored cell for today → verify today count incremented
     - **Test 5: Task label flow**: Type label → start timer → complete → open stats/recent → verify label appears in history
     - **Test 6: Long break suggestion**: Complete 4 tomates → verify "Time for a long break!" prompt → test both Start and Skip buttons
  3. For time-sensitive tests: use short durations in test config (e.g., 3s work, 2s break) to avoid 25-minute waits. Either:
     - Override config via storage before test, OR
     - Create a test-specific config that uses minimal durations

  **Must NOT do**: Don't test visual pixel accuracy. Don't test in Firefox/Safari. Don't add performance benchmarks.

  **Recommended Agent Profile**:
  - Category: `deep` — Reason: Complex E2E setup for Chrome extensions, multiple integration scenarios
  - Skills: [`webapp-testing`] — Playwright expertise for extension testing
  - Omitted: [`frontend-design`] — no UI work

  **Parallelization**: Can Parallel: NO (needs all prior tasks) | Wave 4 | Blocks: [] | Blocked By: [4, 5, 6, 7, 8, 10, 11, 12]

  **References**:
  - Playwright Chrome extension testing: https://playwright.dev/docs/chrome-extensions
  - WXT build output: `.output/chrome-mv3/` (task 1)
  - All storage keys and message actions from prior tasks
  - Short timer config: `{ workDuration: 3000, shortBreakDuration: 2000, longBreakDuration: 5000 }`

  **Acceptance Criteria** (agent-executable only):
  - [ ] `bunx playwright test` passes all 6 E2E tests
  - [ ] Tests run with short timer durations (<10s per cycle)
  - [ ] No flaky tests (run 3x to verify stability)
  - [ ] Extension loads successfully in Playwright's Chromium

  **QA Scenarios** (MANDATORY):
  ```
  Scenario: Full pomodoro cycle E2E
    Tool: Playwright
    Steps: Open popup → start timer (3s duration) → wait for completion → reopen popup → verify confetti fired (check canvas element) → verify today count incremented
    Expected: Timer completes, notification shown, badge updated, celebration on reopen
    Evidence: .sisyphus/evidence/task-13-e2e-cycle.txt

  Scenario: Popup lifecycle persistence
    Tool: Playwright
    Steps: Start timer → close popup → wait 1s → reopen popup → read displayed time
    Expected: Displayed time matches expected remaining (±2s tolerance from endTime calculation)
    Evidence: .sisyphus/evidence/task-13-e2e-lifecycle.txt
  ```

  **Commit**: YES | Message: `test(e2e): add Playwright E2E tests for full pomodoro cycle, settings, and heatmap` | Files: [`e2e/`, `playwright.config.ts`]

- [ ] 14. Celebration Effects — Sound + Confetti Polish

  **What to do**:
  1. Ensure `public/sounds/completion.mp3` exists (from task 1 — if placeholder, replace with a real short chime/bell sound, ~1s duration, royalty-free)
  2. Create `lib/celebration.ts`:
     - `playCelebration(): void` — plays sound + fires confetti
     - Sound: `new Audio(chrome.runtime.getURL('sounds/completion.mp3')).play()`
     - Confetti: `confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 }, colors: ['#DC2626', '#16A34A', '#FBBF24'] })` — red, green, gold (tomato themed)
     - Handle audio play failure gracefully (user may not have interacted yet — catch and ignore)
  3. Integrate into popup mount flow (if not already done in task 7):
     - `entrypoints/popup/App.tsx` onMount: `if (await getPendingCelebration()) { playCelebration(); await setPendingCelebration(false); }`
  4. Differentiate celebration by completion type:
     - Work complete: standard confetti burst
     - 4th tomate (entering break suggestion): larger confetti with more particles (`particleCount: 300`)
     - Long break complete: subtle confetti (fewer particles)
  5. Write unit test for `playCelebration()` — mock Audio and confetti, verify both called

  **Must NOT do**: Don't add sound selection in settings. Don't add haptic feedback. Don't add custom confetti shapes (V1 keeps defaults).

  **Recommended Agent Profile**:
  - Category: `visual-engineering` — Reason: Animation effects and audio integration
  - Skills: [] — canvas-confetti is straightforward
  - Omitted: [`frontend-design`] — no layout work

  **Parallelization**: Can Parallel: YES (with tasks 8, 10, 11) | Wave 3 | Blocks: [13] | Blocked By: [3, 7]

  **References**:
  - canvas-confetti API: https://github.com/catdad/canvas-confetti
  - chrome.runtime.getURL: for resolving extension-relative paths to sound files
  - Storage: `lib/storage.ts` → `getPendingCelebration()`, `setPendingCelebration()`
  - Popup: `entrypoints/popup/App.tsx` (task 7)

  **Acceptance Criteria** (agent-executable only):
  - [ ] Sound file exists and plays (unit test with mocked Audio)
  - [ ] Confetti fires with tomato-themed colors
  - [ ] 4th tomate gets bigger celebration (particleCount difference verified in test)
  - [ ] Audio play failure caught gracefully (no uncaught promise rejection)

  **QA Scenarios** (MANDATORY):
  ```
  Scenario: Standard celebration
    Tool: Bash
    Steps: Unit test — call playCelebration('work'), verify Audio constructed with correct URL, play() called, confetti() called with particleCount=150
    Expected: Both audio and confetti triggered with standard params
    Evidence: .sisyphus/evidence/task-14-celebration-standard.txt

  Scenario: 4th tomate mega celebration
    Tool: Bash
    Steps: Unit test — call playCelebration('milestone'), verify confetti() called with particleCount=300
    Expected: Larger particle count for milestone celebration
    Evidence: .sisyphus/evidence/task-14-celebration-milestone.txt
  ```

  **Commit**: YES | Message: `feat(celebration): add sound + confetti effects with milestone variations` | Files: [`lib/celebration.ts`, `lib/__tests__/celebration.test.ts`, `public/sounds/completion.mp3`]

## Final Verification Wave (MANDATORY — after ALL implementation tasks)
> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.
> **Do NOT auto-proceed after verification. Wait for user's explicit approval before marking work complete.**
> **Never mark F1-F4 as checked before getting user's okay.** Rejection or user feedback → fix → re-run → present again → wait for okay.
- [ ] F1. Plan Compliance Audit — oracle
- [ ] F2. Code Quality Review — unspecified-high
- [ ] F3. Real Manual QA — unspecified-high (+ playwright)
- [ ] F4. Scope Fidelity Check — deep

## Commit Strategy
Atomic commits per task (14 total), each independently buildable. Suggested branch: `feat/tomate-v1`. Each commit message follows `type(scope): description` convention.

## Success Criteria
- Extension loads in Chrome and completes a full 4-tomate cycle with breaks
- Heatmap displays historical data accurately
- Sound + confetti fire on popup open after timer completion
- Settings persist and immediately affect running timers
- All unit tests pass (`bun test`)
- All E2E tests pass (`bunx playwright test`)
- Build produces valid MV3 extension (`bun run build`)
