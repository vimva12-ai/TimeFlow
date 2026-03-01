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
- **`time_slots`** — stores `uid` (for Collection Group queries) and `planId` fields.
- **`actual_logs`** — subcollection of each slot; stores real start/end times.
- **`templates`** — `users/{uid}/templates/{id}`: `name` string + `slots_json` array of `{ title, offsetMinutes, durationMinutes, sort_order }`.
- **`push_subscriptions`** — `users/{uid}/push_subscriptions/{endpointHash}`.

All types are in `src/types/database.ts`. Key composites: `DailyPlanWithSlots`, `TimeSlotWithLogs`.

### State Management

Two layers:
1. **React Query** (`src/lib/providers.tsx`) — server state. `staleTime: 30s`, `gcTime: 5min`.
   - Query keys: `['dailyPlan', date]`, `['weeklyReport']`, `['periodStats', from, to]`, `['templates']`.
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

- **`ActualColumn.tsx`** — renders actual slot containers with `data-slot="true"`. Props: `slots`, `onStart`, `onComplete`, `onChangeStatus`, `onUpdateLog`, `onMoveSlot`.
  - **Display position priority** (`getDisplayTimes`):
    1. Not started + `actual_disp_start` set → use `actual_disp_start`/`actual_disp_end` (ACTUAL-only position)
    2. Not started, no override → fall back to PLAN `start_at`/`end_at`
    3. In-progress (has `actual_start`, no `actual_end`) → `actual_start` + planned duration
    4. Completed → `actual_start`/`actual_end` from log
  - **`actual_disp_start`/`actual_disp_end`** on `TimeSlot` — optional fields for ACTUAL-only display position. Set via `updateActualDispTime` when a not-started slot is dragged. PLAN position (`start_at`/`end_at`) is never modified by ACTUAL drag.
  - **Three render modes** based on slot state and height:
    1. **Not started**: Play button → calls `onStart(slotId)`. `canDrag = true`.
    2. **In-progress, height ≥ `ACTION_THRESHOLD` (60px)**: inline 완료/부분/건너뜀 buttons → calls `onComplete(slotId, status, end)`. `canDrag = false`.
    3. **In-progress, height < 60px**: compact `▶ HH:mm` button → opens portal popup. `canDrag = false`.
  - **Completed slots**: `canDrag = true`. Short press → right-side portal popup with status buttons + "시간 수정". Drag → calls `onMoveSlot` → routed to `updateActualLog` in today/page.tsx.
  - **Popup** uses `createPortal` to `document.body` with `position: fixed` — necessary to escape the scroll container's `overflow-y: auto` clipping. Position calculated from `e.currentTarget.getBoundingClientRect()`.

### Drag System (PlanColumn & ActualColumn)

Both columns use the **Pointer Events API** with a long-press drag pattern:

```typescript
const LONG_PRESS_MS = 300;
const CANCEL_MOVE_PX = 8;  // (10 in ActualColumn)

function handlePointerDown(e, slot, top) {
  // Start a 300ms timer
  timerRef.current = setTimeout(() => {
    longPressedRef.current = true;
    dragDataRef.current = { slotId, durationMin, offsetY, columnRect, ... };
    el.setPointerCapture(pointerId);  // routes all future pointer events to this element
    setDraggingSlotId(slot.id);
  }, LONG_PRESS_MS);
}
// pointerMove before 300ms cancels timer if moved > CANCEL_MOVE_PX (allows normal scroll)
// pointerUp after 300ms → commits drag via onMoveSlot; before → treated as tap/click
```

Key rules:
- **No `e.preventDefault()`** in `handlePointerDown` — prevents cancelling subsequent `click` events on child buttons (Play button, etc.)
- `setPointerCapture` inside `setTimeout` ensures capture happens only after long-press threshold
- `touch-action: none` CSS on draggable elements prevents browser scroll interference
- Drag preview shown while dragging (dashed border overlay, z-index 5)
- **`today/page.tsx` routes `onMoveSlot`**: PLAN drag → `updateSlotTime`; ACTUAL completed drag → `updateActualLog`; ACTUAL not-started drag → `updateActualDispTime`

### Modal Architecture

- **`AddSlotModal.tsx`** — Radix UI Dialog (portal-based, always centered regardless of scroll). Used for both PLAN and ACTUAL entry creation. Accepts `initialHour?` and `initialMin?` to pre-fill from cell clicks. Timestamp creation: `new Date(`${date}T${HH}:${mm}:00`).toISOString()` (local time → UTC).

- **`SlotEditModal.tsx`** — Radix UI Dialog for editing/deleting existing slots. Triggered by `editingSlotId` in timetableStore.

- **`TemplateDrawer.tsx`** — Radix UI Dialog (bottom sheet on mobile, side panel on desktop). Save current plan slots as a named template, apply/delete saved templates. Uses `useTemplates` hook; `applyTemplate` writes slots to the selected date using `offsetMinutes` + `durationMinutes` from `slots_json`.

### Additional UI Components

- **`PomodoroTimer.tsx`** — fixed-position widget (bottom-right). Pure client state via `useReducer`. Phases: focus(25min) → break(5min), every 4th break becomes long-break(15min). Sends browser `Notification` when each phase ends (requires `Notification.permission === 'granted'`).

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

### Environment Variables

```
# Firebase Client SDK (public)
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID

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

### UI Conventions

- All user-visible text must go through the i18n system (`useI18n()`) — no hardcoded Korean/English strings in components
- Dark mode: `dark:` Tailwind prefix, toggled via `.dark` class on `<html>`, persisted to `localStorage`
- Slot status colors: planned=blue, done=green, partial=orange, skipped=gray
- Layout: sidebar (desktop, `w-52`) + bottom nav (mobile). Sidebar contains monthly `DatePicker` calendar then nav links.
- `scrollbar-hide` utility defined in `globals.css`
