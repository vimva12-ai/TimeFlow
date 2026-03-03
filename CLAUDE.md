# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start development server (Next.js 16 + Turbopack)
npm run build        # Production build (runs tsc + next build)
npm run typecheck    # TypeScript check without emit
npm run perf         # Lighthouse audit (requires running dev server)
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
- **`src/app/(app)/layout.tsx`** — Server Component; performs full cryptographic verification via `adminAuth.verifySessionCookie(session, true)`. This is the real auth enforcement.
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
- **`todos`** — `users/{uid}/todos/{YYYY-MM-DD}`: `{ items: Array<{ id, text, checked }>, date }`. Written by `useTodo` via `setDoc` (full replace). One document per calendar day; old days are preserved for weekly report history.
- **`time_slots`** — stores `uid` (for Collection Group queries) and `planId` fields.
- **`actual_logs`** — subcollection of each slot; stores real start/end times.
- **`templates`** — `users/{uid}/templates/{id}`: `name` string + `slots_json` array of `{ title, offsetMinutes, durationMinutes, sort_order }`.
- **`push_subscriptions`** — `users/{uid}/push_subscriptions/{endpointHash}`.

All types are in `src/types/database.ts`. Key composites: `DailyPlanWithSlots`, `TimeSlotWithLogs`.

### State Management

Two layers:
1. **React Query** (`src/lib/providers.tsx`) — server state. `staleTime: 30s`, `gcTime: 5min`.
   - Query keys: `['dailyPlan', date]`, `['weeklyReport']`, `['periodStats', from, to]`, `['templates']`, `['todo', date]`, `['todoHistory']`.
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

- **`SidebarPomodoro.tsx`** — compact sidebar pomodoro timer (in `src/components/nav/`). Pure client state via `useReducer`. Phases: focus(25min) → break(5min), every 4th focus becomes long-break(15min). Plays a Web Audio API beep on phase completion (`try/catch` for iOS/unsupported environments). SVG circular progress ring. Session dot indicators (4 dots; filled count = `session % 4`, shows all 4 during long-break). `SKIP` and auto `ADVANCE_PHASE` share the same reducer case via fall-through. **Fullscreen mode**: `Maximize2` button renders a `createPortal` overlay to `document.body` (z-index 100) with a 280px SVG timer; closed via `X` button, backdrop click, or `ESC` key. Shared `state`/`dispatch` means the timer keeps running across both views.

- **`SidebarTodo.tsx`** — sidebar daily todo list (in `src/components/nav/`). Reads/writes via `useTodo(date)` hook. Max 15 items. Progress bar + bottom completion rate (`checked/total · N%`) shown when items exist. **Local-first state pattern**: `localItems: TodoItem[] | null` holds the working copy; `initializedRef` prevents re-initialization after the first Firebase load. All mutations (`addItem`, `toggleItem`, `deleteItem`, `resetAll`) call `setLocalItems()` synchronously first, then `save()` for Firebase persistence — this prevents React Query async timing issues (stale `query.data` race). `isReady = !isLoading && localItems !== null` guards the input field. Schedules a `setTimeout` to `setDate(todayStr())` at local midnight so the list auto-switches to the new day without a page reload.

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
- **`useTodo(date)`** — React Query read + Firebase write for `todos/{date}`. Exposes `{ items, isLoading, save }`. **localStorage 캐시 레이어** (`timeflow-todo-{date}` 키): `initialData: () => readTodoStorage(date)` — 페이지 로드 시 Firebase 대기 없이 즉시 표시. `initialDataUpdatedAt: 0` — 항상 stale 처리 → 백그라운드 Firebase 동기화. `onMutate` (동기): `writeTodoStorage` → localStorage 즉시 저장 + `setQueryData` 동기 업데이트 → 새로고침 후에도 항목 유지. `onError`: React Query 캐시 롤백. `onSettled`: `['todoHistory']` invalidate만 수행. `fetchTodo`도 `writeTodoStorage`로 Firebase 조회 결과를 localStorage에 반영.
- **`useTodoHistory()`** — fetches the past 7 days of `todos/{date}` docs in parallel; returns `DayTodoStats[]` (`{ date, total, checked, rate }`). Used by the weekly report page to render the todo completion history section.
- Weekly page uses **Recharts `ComposedChart`** (required to mix `Bar` + `Line`; `BarChart` with `Line` fails).

### Push Notifications

`subscribeUser()` → Firestore `push_subscriptions` → Cron hits `/api/cron/notify` (Bearer `CRON_SECRET`) → `collectionGroup('time_slots')` finds slots starting within 5min → `web-push` sends.

Requires **Collection Group Composite Index**: collection `time_slots`, fields `status ASC, start_at ASC`.

Generate VAPID keys: `npx web-push generate-vapid-keys`

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
- `scrollbar-hide` utility defined in `globals.css`
