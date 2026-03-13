# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start development server (Next.js 16 + Turbopack)
npm run build        # Production build (runs tsc + next build)
npm run typecheck    # TypeScript check without emit
npm run perf         # Lighthouse audit (requires running dev server)
npx vercel --prod    # Deploy to production
npx firebase deploy --only firestore:rules  # Deploy Firestore security rules only
```

Build must pass with zero TypeScript errors before any feature is considered complete.

## Architecture Overview

**TimeFlow** is a "Plan vs Actual" time tracker — a Next.js 16 (App Router) full-stack app using Firebase (Firestore + Firebase Auth) for database and auth, React Query v5 for server state, and Zustand v5 for UI state.

### Route Structure

`(app)` and `(auth)` are Next.js **route groups** — the parentheses mean they don't appear in the URL:

| File path | URL |
|-----------|-----|
| `src/app/(app)/today/page.tsx` | `/today` |
| `src/app/(app)/weekly/page.tsx` | `/weekly` |
| `src/app/(app)/settings/page.tsx` | `/settings` |
| `src/app/(auth)/login/page.tsx` | `/login` |

All internal links and redirects must use `/today`, `/weekly`, `/settings` — **never** `/app/today`.

### Auth & Middleware

- **`src/proxy.ts`** — Next.js 16 middleware entry point. Checks `__session` cookie exists on protected routes; redirects to `/login` if absent.
- **`src/app/(app)/layout.tsx`** — Server Component; performs full cryptographic verification via `adminAuth.verifySessionCookie(session, true)`. This is the real auth enforcement. Renders `AppClientLayout` as its only output after auth passes.
- **`src/components/nav/AppClientLayout.tsx`** — Client Component that owns the entire app shell UI (header, desktop sidebar, mobile drawer, bottom nav). Separating it from `layout.tsx` allows sidebar open/close state (`useState`) while keeping auth server-only. **Do not define sub-components inside this component** — any inner component function is recreated on every render, causing React to unmount/remount its children (e.g. the pomodoro timer resets). Inline JSX directly instead.
- **`src/lib/firebase/client.ts`** — Browser Firebase SDK: `auth`, `db`, `getAuthUser()`. Use `getAuthUser()` instead of `auth.currentUser` in hooks because `getAuthUser()` awaits auth state resolution via `onAuthStateChanged`.
- **`src/lib/firebase/admin.ts`** — Server-only Admin SDK: `adminAuth`, `adminDb`.
- **`src/app/api/auth/session/route.ts`** — POST: exchanges idToken for a 7-day `__session` cookie; DELETE: clears it.

### Auth Flow

```
Google login → signInWithPopup(GoogleAuthProvider)
  → result.user.getIdToken()
  → POST /api/auth/session  (creates __session cookie via adminAuth.createSessionCookie)
  → router.push('/today')

Page load → proxy.ts checks __session exists
  → layout.tsx verifies signature with adminAuth.verifySessionCookie
  → if invalid: redirect /login + delete cookie
```

### Data Model

Firestore collection hierarchy:
```
users/{uid}/daily_plans/{planId}/time_slots/{slotId}/actual_logs/{logId}
```

- **`daily_plans`** — doc ID = `{uid}_{date}` (deterministic). Created on first access with `getDoc` check first — only `setDoc` if not exists (avoids repeated writes on refetch).
- **`todos`** — `users/{uid}/todos/{YYYY-MM-DD}`: `{ items: Array<{ id, text, checked, pinned? }>, date }`. Written by `useTodo` via `setDoc` (full replace). One document per calendar day; old days are preserved for weekly report history. `pinned: true` items are carried over to the next day (unchecked) by `applyPinnedCarryOver`.
- **`time_slots`** — stores `uid` (for Collection Group queries) and `planId` fields.
- **`actual_logs`** — subcollection of each slot; stores real start/end times.
- **`templates`** — `users/{uid}/templates/{id}`: `name` string + `slots_json` array of `{ title, offsetMinutes, durationMinutes, sort_order }`.
- **`push_subscriptions`** — `users/{uid}/push_subscriptions/{endpointHash}`.

All types are in `src/types/database.ts`. Key composites: `DailyPlanWithSlots`, `TimeSlotWithLogs`.

### State Management

Two layers:
1. **React Query** (`src/lib/providers.tsx`) — server state. `staleTime: 30s`, `gcTime: 5min`.
   - Query keys: `['dailyPlan', date]`, `['weeklyReport']`, `['periodStats', from, to]`, `['templates']`, `['todo', date]`, `['todoHistory']`, `['todoStats', from, to]`.
2. **Zustand** (`src/store/timetableStore.ts`) — UI only:
   - `selectedDate` (YYYY-MM-DD), `editingSlotId` — not persisted
   - `startHour` (default 5), `endHour` (default 24), `slotHeight` (default 36px) — persisted to `localStorage` under `'timeflow-grid-settings'`

### Mutation Pattern

All mutations in `src/hooks/useSlotMutations.ts`:
```
onMutate → cancel queries → optimistic update → onError → rollback → onSettled → invalidateQueries
```
Full mutation list:
- `createSlot` — optimistic update, adds to time_slots
- `createActualEntry` — creates slot + actual_log simultaneously (status: 'done')
- `updateSlotStatus` — optimistic update
- `updateSlotTitle` — no optimistic update
- `deleteSlot` — optimistic update
- `logActual` — creates actual_log subcollection doc
- `updateActualLog` — updates actual_log start/end; optimistic update
- `updateSlotTime` — updates PLAN `start_at`/`end_at`; optimistic update
- `updateActualDispTime` — updates `actual_disp_start`/`actual_disp_end` (ACTUAL-only display position, PLAN unaffected); optimistic update

Retry: 1× after 5s for all mutations.

### Firestore Query Patterns

**Important:** `useDailyPlan` fetches `time_slots` with a simple `getDocs(collection(...))` (no `orderBy`) and sorts in JavaScript. This avoids requiring a Firestore Composite Index for the daily plan query.

`useWeeklyReport` and `usePeriodStats` still use `orderBy('sort_order'), orderBy('start_at')` — these **require a Composite Index** in the Firebase Console: collection `time_slots`, fields `sort_order ASC, start_at ASC`.

Nested data requires parallel fetches:
```typescript
const slotsSnap = await getDocs(collection(planRef, 'time_slots'));
const slots = await Promise.all(slotsSnap.docs.map(async (slotDoc) => {
  const logsSnap = await getDocs(collection(slotDoc.ref, 'actual_logs'));
  return { ...slotDoc.data(), id: slotDoc.id, actual_logs: logsSnap.docs.map(...) };
}));
```

### Timetable Grid

The grid is built from three components working together:

- **`TimeGrid.tsx`** — layout shell with sticky header row (PLAN / ACTUAL labels + "+" buttons), time labels column, Excel-style background cells (`pointer-events-none`), and the current-time red line.
  - Reads `startHour`, `endHour`, `slotHeight` from Zustand store.
  - Exported constants: `SLOT_MINUTES = 30`.
  - Exported functions: `slotIndex(isoString, startHour)`, `slotSpan(startIso, endIso)`.
  - **Column click detection**: `onClick` on the PLAN and ACTUAL column containers uses `getTimeFromClick()` — calculates row from `e.clientY - e.currentTarget.getBoundingClientRect().top` (scroll-safe). Clicks on existing slots are ignored via `(e.target as Element).closest('[data-slot]')`.
  - Props: `planColumn`, `actualColumn`, `onAddPlan?`, `onAddActual?`, `onPlanCellClick?(h,m)`, `onActualCellClick?(h,m)`.

- **`PlanColumn.tsx`** — renders planned slot buttons with `data-slot="true"`. On click → `setEditingSlotId(slot.id)` (opens SlotEditModal). Props: `slots`, `planId`, `date`.

- **`ActualColumn.tsx`** — renders actual slot containers with `data-slot="true"`. Props: `slots`, `onStart`, `onComplete`, `onChangeStatus`, `onUpdateLog`, `onMoveSlot`, `onUpdateSlotTime`.
  - **Display position priority** (`getDisplayTimes`):
    1. Not started + `actual_disp_start` set → use `actual_disp_start`/`actual_disp_end` (ACTUAL-only position)
    2. Not started, no override → fall back to PLAN `start_at`/`end_at`
    3. In-progress (has `actual_start`, no `actual_end`) → `actual_start` + planned duration
    4. Completed → `actual_start`/`actual_end` from log
  - **`actual_disp_start`/`actual_disp_end`** on `TimeSlot` — optional fields for ACTUAL-only display position. Set via `updateActualDispTime` when a not-started slot is dragged. PLAN position (`start_at`/`end_at`) is never modified by ACTUAL drag.
  - **Three render modes** based on slot state and height:
    1. **Not started**: Play button (full area) + clock icon (top-right corner, opens time edit). `canDrag = true`.
    2. **In-progress, height ≥ `ACTION_THRESHOLD` (60px)**: inline 완료/부분/건너뜀/시간 buttons. `canDrag = false`.
    3. **In-progress, height < 60px**: compact `▶ HH:mm` button → opens portal popup with actions + 시간 수정. `canDrag = false`.
  - **Completed slots**: `canDrag = true`. Short press → portal popup with status buttons + "시간 수정" (edits `actual_log`). Drag → calls `onMoveSlot`.
  - **Time editing**: two paths — `openLogTimeEdit` (completed: edits `actual_log` start/end via `onUpdateLog`) and `openSlotTimeEdit` (all states: edits `start_at`/`end_at` via `onUpdateSlotTime`). `EditTimeState.mode` (`'slot' | 'log'`) controls which mutation fires in `handleSaveTime`.
  - **Portal event bubbling bug**: Radix/portal popups rendered to `document.body` still bubble click events through the React component tree. The popup container (`data-popup`) and edit panel (`data-edit-time`) both have `onClick={(e) => e.stopPropagation()}` to prevent triggering the column's `onActualCellClick`.
  - **Popup** uses `createPortal` to `document.body` with `position: fixed` — necessary to escape the scroll container's `overflow-y: auto` clipping. Position calculated from `e.currentTarget.getBoundingClientRect()`.
  - **Mobile popup close handler**: registered with a **400ms `setTimeout` delay** after popup opens. Mobile browsers fire a synthesized `mousedown` ~300ms after `touchend`; without the delay, it immediately closes a just-opened popup. Cleanup must `clearTimeout` the pending registration on unmount.
  - **In-progress ACTUAL slots** show an animated fill effect: left-to-right background fill + 3px bottom bar. Colors: blue (running), yellow (paused), red + `animate-pulse` (overtime). Content divs are `relative z-[1]` to appear above the overlay (`z-index: 0`). Updated every 30s via `setInterval` forcing re-render.

### Drag & Resize System (PlanColumn & ActualColumn)

Both columns support **drag-to-move** (long-press) and **resize handles** (top/bottom 8px strips).

**Drag — long-press pattern:**
```typescript
const LONG_PRESS_MS = 300;
const CANCEL_MOVE_PX = 8;  // cancels timer if finger moves before 300ms

function handlePointerDown(e, slot, top) {
  timerRef.current = setTimeout(() => {
    longPressedRef.current = true;
    dragDataRef.current = { slotId, durationMin, offsetY, columnRect, originalOffsetMin, ... };
    el.setPointerCapture(pointerId);
    setDraggingSlotId(slot.id);
  }, LONG_PRESS_MS);
}
// pointerMove before 300ms → cancels timer if moved > CANCEL_MOVE_PX (allows scroll)
// pointerUp after 300ms → commits drag only if slot moved ≥ 5 minutes (ActualColumn)
//                       → otherwise treated as tap/click (opens popup or edit)
```

Key rules:
- **No `e.preventDefault()`** in `handlePointerDown` — keeps child button clicks working.
- **`e.preventDefault()` IS called in `handlePointerUp` (drag branch only)** — prevents synthesized click from triggering inner buttons after drag.
- `setPointerCapture` inside `setTimeout` — capture only activates after long-press threshold.
- `touch-action: none` on draggable/resizable elements prevents browser scroll interference.
- **ActualColumn drag commit** uses minutes moved (`movedMin >= 5`), not pixels — prevents mobile touch jitter (~10px natural drift) from accidentally committing drags.
- **`today/page.tsx` routes `onMoveSlot`**: PLAN drag → `updateSlotTime`; ACTUAL completed drag → `updateActualLog`; ACTUAL not-started drag → `updateActualDispTime`.

**Resize handles:**
- 8px strips (`HANDLE_PX = 8`) at the top and bottom of each slot block.
- `onPointerDown` on a handle calls `e.stopPropagation()` to prevent the parent slot's drag timer from firing.
- Resize uses immediate `setPointerCapture` (no long-press delay). `fixedOffsetMin` = the edge that stays put; the dragged edge snaps to 1-min precision with ±5-min magnetic snap to 30-min boundaries.
- Minimum slot duration: `MIN_DURATION_MIN = 5`.
- In-progress ACTUAL slots: resize handles hidden (`canDrag = false`).
- z-index stack: content=1, resize handles=3, drag/resize preview=5.

**Snap logic (`snapMin` in both columns):**
```typescript
// 1분 단위 자유 이동 + 30분 경계 ±5분 이내 마그네틱 스냅
const raw = Math.round(relY / (slotHeight / SLOT_MINUTES));   // 1-min precision
const nearest30 = Math.round(raw / SLOT_MINUTES) * SLOT_MINUTES;
return Math.abs(raw - nearest30) <= 5 ? nearest30 : raw;
```
- `slotHeight / SLOT_MINUTES` = pixels per minute (e.g. 36px/30 = 1.2px/min at default size)
- `previewIdx` stores **minutes offset** from `startHour * 60`, not slot index. Preview top = `previewIdx * ppm`
- `getTimeFromClick` in TimeGrid uses the same pixel-per-minute calculation for 1-min precision on cell clicks

### Modal Architecture

- **`AddSlotModal.tsx`** — Radix UI Dialog for creating PLAN and ACTUAL entries. Accepts `initialHour?`/`initialMin?` to pre-fill from cell clicks. Has two input modes toggled by a "직접 입력" pill button:
  - **기본 mode**: hour/minute selects (0 or 30 min) + duration presets (PLAN) or end-time selects (ACTUAL)
  - **직접 입력 mode**: `<input type="time">` for start + end, supports 1-minute precision
  - Switching modes syncs current values; switching back to 기본 rounds minutes to nearest 30.
  - Timestamp creation: `new Date(\`${date}T${HH}:${mm}:00\`).toISOString()` (local time → UTC).

- **`SlotEditModal.tsx`** — Radix UI Dialog for editing existing slots. Triggered by `editingSlotId` in timetableStore. Editable fields: title, status, **time range** (`start_at`/`end_at` via `<input type="time">`). Calls `updateSlotTime` on save if times changed.

- **`TemplateDrawer.tsx`** — Radix UI Dialog (bottom sheet on mobile, side panel on desktop). Save current plan slots as a named template, apply/delete saved templates. Uses `useTemplates` hook; `applyTemplate` writes slots to the selected date using `offsetMinutes` + `durationMinutes` from `slots_json`.

### Additional UI Components

- **`PomodoroTimer.tsx`** — fixed-position widget (bottom-right). Pure client state via `useReducer`. Phases: focus(25min) → break(5min), every 4th break becomes long-break(15min). Sends browser `Notification` when each phase ends (requires `Notification.permission === 'granted'`).

- **`SidebarPomodoro.tsx`** — compact sidebar pomodoro timer (in `src/components/nav/`). `useReducer` with a `RESTORE` action for localStorage hydration. Phases: focus(25min) → break(5min), every 4th focus becomes long-break(15min). Plays a Web Audio API beep on phase completion (`try/catch` for iOS/unsupported environments). SVG circular progress ring. Session dot indicators (4 dots; filled count = `session % 4`, shows all 4 during long-break). `SKIP` and auto `ADVANCE_PHASE` share the same reducer case via fall-through. **Fullscreen mode**: `Maximize2` button renders a `createPortal` overlay to `document.body` (z-index 100) with a 280px SVG timer; closed via `X` button, backdrop click, or `ESC` key. Shared `state`/`dispatch` means the timer keeps running across both views. **localStorage persistence** (`timeflow-pomodoro` key): `savePomodoroState()` stores `{ phase, remaining, running, session, savedAt: Date.now() }` on every state change. On mount, `loadPomodoroState()` reads the key, computes `elapsed = Date.now() - savedAt`, and subtracts it from `remaining` if the timer was running — if remaining goes ≤ 0, advances to next phase and sets `running: false`. Dispatched via `{ type: 'RESTORE', state }` in a mount-only `useEffect` (avoids SSR hydration mismatch with the default initial state).

- **`SidebarTodo.tsx`** — sidebar daily todo list (in `src/components/nav/`). Reads/writes via `useTodo(date)` hook. Max 15 items. Progress bar shown when items exist. `isReady = !isLoading` guards the input and list. **Midnight handling**: `setTimeout` fires at local midnight to call `setDate(todayStr())` AND `queryClient.invalidateQueries(['todoHistory', 'todoStats'])`. **Expand/collapse**: `isExpanded` state toggles between `max-h-44` and `max-h-80` with internal scroll. **Achievement rate**: displayed inline next to the title (`오늘 할 일 ● 3/5 60%`) — no separate stats section. **Pin button**: each row has a pin toggle (`Pin` icon from lucide-react) — blue when pinned (always visible), gray on hover when not pinned. **Drag-and-drop reorder**: `draggable` is set on the grip handle `<span>` only — **never on the parent row `<div>`**, because `draggable` on a parent intercepts click events on all children (checkbox, text) and breaks them. `onDragOver`/`onDrop` go on the parent div (`data-drag-row`). `setDragImage` points to the whole row for a natural ghost image. **Inline editing**: clicking the text span enters edit mode (input replaces span). `editSavedRef` (ref, not state) prevents double-save when Enter fires `saveEdit()` and the subsequent unmount-triggered `onBlur` fires again. `cancelEdit()` also sets `editSavedRef.current = true` so ESC doesn't accidentally save via `onBlur`. **Auto-move on check**: `toggleItem` reorders the array — checked items move to the end; unchecked items move to just before the first checked item. Period stats tabs (week/month/custom) live exclusively in the Weekly Report page.

### Dark Mode

Tailwind v4 defaults to `prefers-color-scheme` for `dark:` utilities. Class-based dark mode (`.dark` on `<html>`) requires this line in `src/app/globals.css`:
```css
@variant dark (&:where(.dark, .dark *));
```
Without it, `ThemeToggle` has no effect.

### Statistics

- **`src/lib/stats.ts`** — `calcStats(plan)` → `{ timePunctuality, completionRate, focusMinutes }`. Punctuality = actual start within ±15 min of planned start. Focus minutes = sum of done/partial slot durations from actual_logs.
- **`src/components/stats/AchievementBadges.tsx`** — badge system shown in the today page header.
- **`useWeeklyReport`** — 7-day report, `staleTime: 5min`. `DayReport extends Stats` with `date` and `dayOfWeek`.
- **`usePeriodStats(from, to)`** — arbitrary date range stats, `staleTime: 5min`.
- **`useTodo(date)`** — React Query read + Firestore real-time sync for `todos/{date}`. Exposes `{ items, isLoading, save }`.
  - **Auth rule**: Always use `resolveUser()` (not `auth.currentUser` directly) in async Firebase ops — `auth.currentUser` is `null` during the brief async session restoration on page load, causing mutations to fail silently.
  - **Real-time sync**: `onAuthStateChanged` fires once auth is ready → sets up `onSnapshot` listener. `onSnapshot` fires on every Firestore change and updates the React Query cache directly (`setQueryData`). When `snap.exists() = false`, the cache is NOT overwritten (protects optimistic updates in flight).
  - **localStorage cache** (`timeflow-todo-{date}` key): `initialData` for instant display, `writeTodoStorage` on every confirmed Firebase read/write.
  - **Optimistic updates** (`onMutate`): `writeTodoStorage` + `setQueryData` synchronously → UI instant. `onError` rolls back cache. `onSettled` invalidates `['todoHistory']` + `['todoStats']`.
  - **Pinned carryover**: `applyPinnedCarryOver(uid, date)` runs on mount (today only) — if today's doc doesn't exist, copies `pinned: true` items from yesterday with `checked: false`.
- **`useTodoHistory()`** — fetches the past 7 days of `todos/{date}` docs in parallel; returns `DayTodoStats[]` (`{ date, total, checked, rate }`). Used by the weekly report page for the 7-day per-day bar rows.
- **`useTodoStats(from, to)`** — arbitrary date range todo statistics (`staleTime: 5min`). Fetches each day's `todos/{date}` doc in parallel. Returns `TodoRangeStats`: `{ avgRate, totalItems, checkedItems, days, activeDays, dayStats: DayTodoStat[] }`. `DayTodoStat` has `{ date, total, checked, rate }` for mini bar chart rendering. `enabled` only when both `from`/`to` are non-empty and `from <= to`, so the hook is safe to call unconditionally — pass empty strings to disable.
- **Weekly page todo section** (`/weekly`) — the "할 일 달성률" card has two sub-sections: (1) period tabs `week | month | custom` backed by `useTodoStats`, showing avgRate + mini bar chart; (2) a "최근 7일 상세" section backed by `useTodoHistory`, showing per-day progress bars. Period tabs default to `week`; `custom` shows date pickers. This is where the full stats UI lives — `SidebarTodo` only shows today.
- Weekly page uses **Recharts `ComposedChart`** (required to mix `Bar` + `Line`; `BarChart` with `Line` fails).

### Push Notifications

`subscribeUser()` → Firestore `push_subscriptions` → Cron hits `/api/cron/notify` (Bearer `CRON_SECRET`) → `collectionGroup('time_slots')` finds slots starting within 5min → `web-push` sends.

Requires **Collection Group Composite Index**: collection `time_slots`, fields `status ASC, start_at ASC`.

Generate VAPID keys: `npx web-push generate-vapid-keys`

### Firestore Security Rules

`firestore.rules` — deployed separately from Vercel via Firebase CLI:
```
npx firebase deploy --only firestore:rules
```
Current rules: authenticated users can read/write all their own subcollections (`users/{uid}/{document=**}`). This covers `todos`, `daily_plans`, `templates`, `push_subscriptions`. Rules changes take effect immediately — no Vercel redeploy needed.

### Deployment

Deployed on **Vercel** (Hobby plan). Firebase Hosting is not used — SSR requires the Blaze (paid) plan for Cloud Functions.

- Vercel project: `timeflow` under `vimva12-2168s-projects`
- Production URL: https://timeflow-nine-mu.vercel.app
- Cron jobs are **not available** on Hobby plan (push notification cron at `/api/cron/notify` exists in code but is not scheduled via Vercel)
- After adding env vars: `vercel env add KEY production` or use the Vercel dashboard

### Firebase Analytics

- **`src/lib/firebase/client.ts`** — exports `getAnalyticsInstance()`: lazy, browser-only getter (returns `null` on SSR or when `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` is unset).
- **`src/lib/analytics.ts`** — thin wrapper around `logEvent`. Import `analytics` and call named helpers: `analytics.login(method)`, `analytics.pageView(path, title)`, `analytics.slotCreated(type)`, `analytics.slotStatusChanged(status)`, `analytics.timerStarted(phase)`, `analytics.timerCompleted(phase)`.
- **`src/components/AnalyticsInit.tsx`** — client component mounted in `Providers`. Initializes Analytics on first render and fires `page_view` on every route change via `usePathname`.

Adding a new tracked event: call `logEvent` inside `analytics.ts` and add a named helper. No changes to `client.ts` needed.

### Environment Variables

```
# Firebase Client SDK (public)
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID   # G-XXXXXXXXXX — Analytics disabled if unset

# Firebase Admin SDK (server-only)
FIREBASE_PROJECT_ID
FIREBASE_CLIENT_EMAIL
FIREBASE_PRIVATE_KEY        # full PEM string with literal \n

# Other
NEXT_PUBLIC_APP_URL
NEXT_PUBLIC_VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY
CRON_SECRET
```

When adding a new authorized domain for Firebase Auth (e.g., new deployment URL), add it in Firebase Console → Authentication → Settings → Authorized domains.

### i18n

`src/lib/i18n.tsx` — React Context-based internationalization. Supports `ko` (Korean), `en` (English), `ja` (Japanese). Locale persisted to `localStorage` under key `'timeflow-locale'`.

Usage:
```typescript
const { t, locale, setLocale } = useI18n();
// t.save → '저장' | 'Save' | '保存'
// t.daysBasis(7) → '7일 기준' (function keys exist too)
```

**When adding any user-visible string:**
1. Add to `translations.ko`, `translations.en`, `translations.ja` in `src/lib/i18n.tsx`
2. Add the key + type to the `Translations` interface in the same file
3. Use `t.yourKey` in the component

The `Translations` interface must stay in sync with all three locale objects — TypeScript will catch mismatches.

### Timezone Critical Rule

**Never use `.slice(0, 10)` to extract a date from an ISO UTC string.** UTC ISO strings like `"2026-03-01T22:00:00.000Z"` represent `2026-03-02 07:00 KST`. Slicing gives `"2026-03-01"` (yesterday), which when used to construct `new Date(\`${dateStr}T07:00:00\`)` produces a timestamp one day too early. Each drag/edit compounds the error.

**Always use:**
```typescript
import { format, parseISO } from 'date-fns';
const dateStr = format(parseISO(isoString), 'yyyy-MM-dd'); // local date ✓
```

This applies everywhere a date string is derived from an ISO timestamp for use in `new Date(\`${date}T...\`)` — drag `dateStr`, resize `date`, time-edit modal `date`.

### UI Conventions

- All user-visible text must go through the i18n system (`useI18n()`) — no hardcoded Korean/English strings in components. **Exception**: `ActualColumn.tsx` uses hardcoded Korean throughout (legacy); new strings added to it may follow the existing pattern rather than forcing a full refactor.
- Dark mode: `dark:` Tailwind prefix, toggled via `.dark` class on `<html>`, persisted to `localStorage`
- Slot status colors: planned=blue, done=green, partial=orange, skipped=gray
- Layout: sidebar (desktop, `w-52`) + bottom nav (mobile). Sidebar order: `DatePicker` → `SidebarPomodoro` → `SidebarTodo` → `NavLinks`. Each section separated by a border-t divider. Sidebar has `overflow-y-auto` so it scrolls if content overflows.
- **Mobile sidebar**: hidden by default. A `Menu`/`X` toggle button (Lucide icons) in the header (left of "TimeFlow" logo, `md:hidden`) controls `sidebarOpen` state in `AppClientLayout`. The drawer slides in from the left (`transition-transform`, `translate-x-0` / `-translate-x-full`), sits above everything (`z-50`), starts at `top-10` (header height) and ends at `bottom-14` (bottom nav height). A `z-40` backdrop closes it on click. ESC key also closes it.
- `scrollbar-hide` utility defined in `globals.css`
- **모바일 hover 규칙 (중요)**: `opacity-0 group-hover:opacity-100` 패턴은 PC에서만 동작하며, 터치 기기에서는 hover가 없어 버튼이 영구적으로 숨겨진다. **기능적 UI 요소(버튼, 아이콘 등)를 숨기거나 표시할 때 반드시 `can-hover:opacity-0 can-hover:group-hover:opacity-100`을 사용한다.** `can-hover` variant는 `globals.css`에 `@variant can-hover (@media (hover: hover))`로 정의되어 있으며, 마우스/트랙패드 기기에서만 적용된다. 순수 스타일 변경(hover 색상 변경 등)은 기존 `hover:` prefix를 그대로 사용해도 무방하다.

---

## 크로스 플랫폼 / 브라우저 호환성 (Cross-Platform Compatibility)

이 섹션은 Chrome, Firefox, Safari, Comet, 모바일 웹(iOS/Android), macOS, Windows 등 다양한 환경에서 일관된 동작을 보장하기 위한 필수 규칙이다.

### 1. HTML5 Drag & Drop

**원칙: DnD는 데스크톱 전용 기능이다.**

| 환경 | HTML5 DnD 지원 |
|------|----------------|
| Chrome / Edge (desktop) | ✅ 완전 지원 |
| Firefox (desktop) | ✅ 완전 지원 |
| Safari macOS (desktop) | ✅ 지원 (커스텀 MIME 타입 포함) |
| **iOS Safari** | ❌ 미지원 |
| **Android Chrome** | ❌ 미지원 |
| Comet | ✅ Chromium 기반, 완전 지원 |

```typescript
// ✅ 올바른 패턴: dataTransfer.types 교차 브라우저 처리
// DOMStringList(Firefox) / ReadonlyArray(Chrome) 모두 대응
const types = Array.from(e.dataTransfer.types);
if (types.includes('text/x-my-type')) { ... }

// ❌ 틀린 패턴 (Firefox에서 DOMStringList에는 .includes가 없음)
if (e.dataTransfer.types.includes('text/x-my-type')) { ... }
```

**onDragLeave 깜빡임 방지 — counter 패턴 필수:**
```typescript
// Safari에서 relatedTarget은 null이 되거나 자식 요소를 잘못 보고함
// relatedTarget 체크 금지 → dragEnter/Leave counter 방식 사용

const dragCountRef = useRef(0);

onDragEnter={() => { dragCountRef.current++; setDragOver(true); }}
onDragLeave={() => {
  dragCountRef.current--;
  if (dragCountRef.current <= 0) { dragCountRef.current = 0; setDragOver(false); }
}}
onDrop={() => { dragCountRef.current = 0; setDragOver(false); /* ... */ }}
```

**모바일 DnD가 필요한 기능은 반드시 `hidden md:` 클래스로 데스크톱 전용 처리:**
```tsx
{/* 모바일에서는 숨김 — HTML5 DnD는 iOS/Android 미지원 */}
<div className="hidden md:block">
  <FavoritesPanel />
</div>
```

### 2. localStorage / SSR 안전 패턴

Next.js는 서버에서 컴포넌트를 렌더링한다. `localStorage`는 브라우저에서만 존재하므로 **항상 `useEffect` 안에서만 읽어야** 한다.

```typescript
// ✅ 올바른 패턴 — mounted 상태로 SSR hydration mismatch 방지
const [mounted, setMounted] = useState(false);
const [value, setValue] = useState<string>('');

useEffect(() => {
  setMounted(true);
  setValue(localStorage.getItem('key') ?? '');
}, []);

// JSX에서: mounted 전까지 placeholder 렌더 (레이아웃 변이 방지)
{!mounted ? <div className="h-12 animate-pulse bg-gray-100 rounded" /> : <ActualUI />}

// ❌ 틀린 패턴 — SSR에서 ReferenceError 발생
const [value] = useState(localStorage.getItem('key') ?? '');
```

### 3. Safari 특이 사항

| 이슈 | 대응 |
|------|------|
| IME 조합 중 Enter 이중 처리 | `!e.nativeEvent.isComposing` 가드 필수 |
| 모바일 touch → 300ms synthesized click | popup close handler에 **400ms setTimeout 딜레이** 적용 |
| `onDragLeave` relatedTarget 부정확 | dragEnter counter 패턴 사용 (위 참조) |
| `scrollbar-hide` | `-webkit-scrollbar: none` + `scrollbar-width: none` 모두 작성 필요 |
| iOS Web Push | iOS 16.4+, 홈 화면 추가 시에만 지원 |

### 4. 터치 디바이스 / 모바일 웹

```
✅ 기능 버튼 가시성: can-hover:opacity-0 can-hover:group-hover:opacity-100
   (터치 기기에서는 항상 보이도록 — hover 없음)

✅ 탭 딜레이 제거: touch-manipulation 클래스 (300ms 지연 제거)

✅ 드래그 가능 요소: touch-action: none (touch-none 클래스)
   → 브라우저 스크롤과 커스텀 드래그 충돌 방지

❌ hover: 전용 색상 변경은 모바일에서도 허용 (기능적 요소만 can-hover: 사용)
```

### 5. dataTransfer 커스텀 MIME 타입

같은 페이지(동일 origin) 내 DnD에서는 커스텀 MIME 타입이 모든 모던 브라우저에서 지원된다.

```typescript
// 타입 명명 규칙: 'text/x-{기능명}' (소문자 kebab-case)
e.dataTransfer.setData('text/x-todo-title', title);    // 할 일 → PLAN
e.dataTransfer.setData('text/x-favorite', JSON.stringify({ title, durationMinutes })); // 즐겨찾기 → PLAN

// dragover/dragenter에서 types 확인 (실제 데이터는 drop에서만 읽기 가능)
const types = Array.from(e.dataTransfer.types);
if (types.includes('text/x-todo-title')) { e.preventDefault(); }
```

### 6. CSS 호환성 체크리스트

| CSS 기능 | Chrome | Firefox | Safari | 비고 |
|----------|--------|---------|--------|------|
| `scrollbar-width: none` | ✅ | ✅ | ❌ | `-webkit-scrollbar` 병행 필수 |
| `line-clamp` (Tailwind `line-clamp-N`) | ✅ | ✅ | ✅ | `-webkit-line-clamp` 내부 사용 |
| `touch-action: none` | ✅ | ✅ | ✅ | iOS에서도 동작 |
| `@media (hover: hover)` | ✅ | ✅ | ✅ | `can-hover:` variant 기반 |
| CSS `aspect-ratio` | ✅ | ✅ | ✅ | Safari 15+ |
| `backdrop-filter: blur` | ✅ | ✅ | ✅ | `-webkit-backdrop-filter` 불필요 |

### 7. 기능별 플랫폼 지원 매트릭스

| 기능 | 데스크톱 | iOS Safari | Android Chrome |
|------|----------|------------|----------------|
| 타임테이블 기본 기능 | ✅ | ✅ | ✅ |
| PLAN/ACTUAL 드래그 & 리사이즈 | ✅ | ✅ (pointer events) | ✅ |
| 즐겨찾기 패널 + 드래그 | ✅ | ❌ (hidden) | ❌ (hidden) |
| 할 일 → PLAN 드래그 | ✅ | ❌ (HTML5 DnD 미지원) | ❌ |
| 할 일 사이드바 재정렬 | ✅ | ❌ (HTML5 DnD 미지원) | ❌ |
| 뽀모도로 타이머 | ✅ | ✅ | ✅ |
| 메모 (Firebase 동기화) | ✅ | ✅ | ✅ |
| Web Push 알림 | ✅ | iOS 16.4+ (홈화면) | ✅ |
| 다크모드 | ✅ | ✅ | ✅ |

> **iOS/Android에서 HTML5 DnD 미지원은 알려진 제한 사항이며, 향후 touch-based DnD 구현으로 개선 가능.**

---

## 코딩 원칙 (General Coding Principles)

- **주석은 한국어로** 작성한다. 코드를 처음 보는 사람도 이해할 수 있도록 설명한다.
- 함수와 변수 이름은 **기능을 명확히 설명**하는 영어 이름을 사용한다.
- 한 함수는 **하나의 역할만** 수행한다 (Single Responsibility).
- 불필요한 `console.log`, 주석 처리된 코드(dead code), 사용하지 않는 import는 **즉시 제거**한다.
- 에러 처리는 반드시 포함한다 (`try/catch` 또는 `.catch()`).

---

## Refactoring 가이드라인

Claude Code로 리팩토링 작업을 할 때 아래 원칙을 따른다.

### 1. 불필요한 코드 제거 체크리스트

리팩토링 전, 아래 항목을 파일별로 확인한다:

- [ ] 사용되지 않는 `import` 문
- [ ] 호출되지 않는 함수 또는 변수
- [ ] 주석 처리된 오래된 코드 블록
- [ ] 중복된 로직 (같은 기능을 하는 함수가 2개 이상)
- [ ] 하드코딩된 값 (마법 숫자/문자열) → 상수로 분리
- [ ] `TODO`, `FIXME` 주석이 달린 미완성 코드

### 2. 코드 흐름 개선 원칙

- **컴포넌트 분리**: 100줄 이상의 컴포넌트는 더 작은 단위로 분리한다.
- **훅(Hook) 추출**: 반복되는 상태 로직은 커스텀 훅으로 추출한다.
- **타입 정의 통합**: 중복된 TypeScript 타입/인터페이스는 `types/` 폴더에 통합한다.
- **유틸 함수 분리**: 컴포넌트 안의 순수 함수는 `utils/` 또는 `lib/` 폴더로 이동한다.
- **상수 파일 관리**: 반복 사용되는 값은 `constants/` 파일로 분리한다.

### 3. 리팩토링 순서 (안전한 작업 흐름)

```
1단계: 현재 코드 파악  → 파일 구조 및 의존성 확인
2단계: 불필요한 코드 제거 → 빌드 테스트 (npm run build)
3단계: 로직 분리/정리   → 다시 빌드 테스트
4단계: 타입 정리        → TypeScript 체크 (npm run typecheck)
5단계: 최종 확인        → npm run dev 로 동작 확인
```

> ⚠️ 각 단계마다 반드시 빌드/타입체크를 통과한 뒤 다음 단계로 넘어간다.
> 한 번에 너무 많은 파일을 수정하지 않는다.

### 4. 리팩토링 금지 사항

- 동작 중인 기능의 **외부 동작(UI/UX)을 바꾸지 않는다** (내부 구현만 개선).
- 리팩토링과 **새 기능 추가를 동시에 하지 않는다**.
- 테스트 없이 **핵심 데이터 흐름(auth, Firestore 쿼리)을 변경하지 않는다**.

---

## Claude Code 전용 프롬프트 모음

아래 프롬프트를 Claude Code 터미널에서 복사해서 사용한다.

### 🔍 [분석] 불필요한 코드 탐색

```
src/ 폴더 전체를 분석해줘.
다음 항목을 파일별로 정리해서 보여줘:
1. 사용되지 않는 import
2. 호출되지 않는 함수/변수
3. 주석 처리된 dead code
4. 중복된 로직
실제로 수정하지 말고, 목록만 먼저 보여줘.
```

### 🧹 [정리] 안전한 불필요 코드 제거

```
방금 분석한 내용 중, 제거해도 안전한 항목부터 제거해줘.
- 사용되지 않는 import 먼저 제거
- 각 파일 수정 후 npm run typecheck 실행해서 오류 없는지 확인
- 오류 발생하면 해당 파일 수정을 중단하고 나에게 알려줘
```

### 🏗️ [구조 개선] 컴포넌트 분리

```
src/components/ 폴더에서 100줄이 넘는 컴포넌트 파일 목록을 보여줘.
각 파일에 대해 어떤 부분을 분리할 수 있는지 제안해줘.
실제 수정은 내가 확인한 뒤에 진행해줘.
```

### 🔄 [리팩토링] 특정 파일 개선

```
[파일 경로]를 리팩토링해줘.
조건:
- 외부 동작(UI/기능)은 바꾸지 말 것
- 불필요한 코드 제거
- 함수가 너무 길면 분리
- 주석을 한국어로 추가
- 수정 후 npm run build 통과 여부 확인
```

### 📦 [타입 정리] TypeScript 타입 통합

```
src/ 전체에서 중복 정의된 TypeScript 타입과 인터페이스를 찾아줘.
통합할 수 있는 타입은 types/ 폴더에 모아서 정리하는 방안을 제안해줘.
```

### ✅ [최종 검증] 리팩토링 완료 체크

```
리팩토링이 끝났어. 아래 순서로 최종 확인해줘:
1. npm run typecheck → 타입 오류 없는지
2. npm run build → 빌드 성공하는지
3. 수정된 파일 목록과 변경 내용 요약해줘
4. 혹시 더 개선할 수 있는 부분이 있으면 제안해줘
```

---

## 작업 기록 (Change Log)

> 작업을 진행할 때마다 아래에 날짜와 내용을 기록한다.

| 날짜 | 작업 내용 | 담당 |
|------|----------|------|
| 2026-03-13 | 친구 피드백 8가지 기능 추가 (날짜별 할 일, 미달성 배지, 할 일→PLAN 드래그, 다크모드 개선, 즐겨찾기, 메모, 약관 UX, 자동완성 X버튼) | Claude |
| 2026-03-13 | 크로스 플랫폼 점검 (Safari dragLeave counter 패턴 수정, SSR hydration 안전화, CLAUDE.md 크로스 플랫폼 가이드 추가) | Claude |
