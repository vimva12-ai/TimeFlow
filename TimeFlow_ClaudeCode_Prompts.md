# TimeFlow — Claude Code 5단계 프롬프트

> **사용법**: 각 단계를 순서대로 Claude Code에 붙여넣습니다.
> 이전 단계가 완전히 완료되어 테스트까지 통과한 뒤 다음 단계로 진행하세요.

---

## STEP 1 — 프로젝트 초기화 & DB 스키마

```
당신은 Next.js 풀스택 개발자입니다. TimeFlow라는 "Plan vs Actual 타임 트래커" 앱을 처음부터 구축합니다.

## 목표
Next.js 14(App Router) + TypeScript + Tailwind CSS + Supabase 프로젝트를 초기화하고,
데이터베이스 스키마와 타입 정의를 완성하세요.

## 수행할 작업

### 1. 프로젝트 생성
다음 명령을 실행하세요:
  npx create-next-app@latest timeflow \
    --typescript --tailwind --app --src-dir \
    --import-alias "@/*" --no-eslint

### 2. 의존성 설치 (timeflow/ 디렉토리 내에서)
  npm install @supabase/supabase-js @supabase/ssr \
    zustand @tanstack/react-query \
    @radix-ui/react-dialog @radix-ui/react-tooltip \
    lucide-react clsx tailwind-merge \
    date-fns
  npm install -D @types/node

### 3. 환경변수 파일 생성
.env.local 파일을 아래 내용으로 생성하세요 (실제 값은 플레이스홀더로):
  NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
  NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY
  SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
  NEXT_PUBLIC_APP_URL=http://localhost:3000

### 4. Supabase 마이그레이션 SQL 작성
supabase/migrations/001_init.sql 파일을 생성하고 아래 스키마를 구현하세요:

  테이블 목록과 요구사항:

  [users]
  - id: uuid (Supabase Auth uid, PK)
  - email: text NOT NULL
  - timezone: text NOT NULL DEFAULT 'Asia/Seoul'
  - created_at: timestamptz DEFAULT now()
  * Auth 사용자 생성 시 자동으로 이 테이블에도 삽입되는 트리거 작성

  [daily_plans]
  - id: uuid DEFAULT gen_random_uuid() PK
  - user_id: uuid FK → users.id ON DELETE CASCADE
  - date: date NOT NULL
  - created_at: timestamptz DEFAULT now()
  * UNIQUE(user_id, date) 제약 조건 추가

  [time_slots]
  - id: uuid DEFAULT gen_random_uuid() PK
  - plan_id: uuid FK → daily_plans.id ON DELETE CASCADE
  - title: text NOT NULL
  - start_at: timestamptz NOT NULL
  - end_at: timestamptz NOT NULL
  - status: text NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned', 'done', 'partial', 'skipped'))
  - sort_order: int NOT NULL DEFAULT 0
  - created_at: timestamptz DEFAULT now()

  [actual_logs]
  - id: uuid DEFAULT gen_random_uuid() PK
  - slot_id: uuid FK → time_slots.id ON DELETE CASCADE
  - actual_start: timestamptz
  - actual_end: timestamptz
  - note: text
  - created_at: timestamptz DEFAULT now()

  [templates]
  - id: uuid DEFAULT gen_random_uuid() PK
  - user_id: uuid FK → users.id ON DELETE CASCADE
  - name: text NOT NULL
  - slots_json: jsonb NOT NULL DEFAULT '[]'
  - created_at: timestamptz DEFAULT now()

  모든 테이블에 Row Level Security(RLS)를 활성화하고,
  각 테이블에 "user_id = auth.uid()" 기반 SELECT/INSERT/UPDATE/DELETE 정책을 작성하세요.
  (actual_logs와 time_slots는 JOIN을 통해 user_id를 검증하는 정책으로 작성)

### 5. TypeScript 타입 파일 생성
src/types/database.ts 파일에 위 스키마를 반영한 타입을 작성하세요:
  - 각 테이블의 Row / Insert / Update 타입
  - SlotStatus: 'planned' | 'done' | 'partial' | 'skipped' union 타입
  - TimeSlotWithLogs: TimeSlot & { actual_logs: ActualLog[] } 복합 타입
  - DailyPlanWithSlots: DailyPlan & { time_slots: TimeSlotWithLogs[] } 복합 타입

### 6. Supabase 클라이언트 유틸리티
  - src/lib/supabase/client.ts : 브라우저용 클라이언트 (createBrowserClient)
  - src/lib/supabase/server.ts : 서버 컴포넌트용 클라이언트 (createServerClient, cookies)
  - src/lib/supabase/middleware.ts : 세션 갱신 미들웨어 로직
  - src/middleware.ts : Next.js 미들웨어, 인증 없는 /app/* 경로를 /login으로 리다이렉트

## 완료 기준
- `npm run build`가 타입 에러 없이 성공할 것
- supabase/migrations/001_init.sql이 Supabase SQL Editor에서 오류 없이 실행될 것
- src/types/database.ts의 모든 타입이 스키마와 1:1 대응될 것
```

---

## STEP 2 — 인증 & 레이아웃

```
TimeFlow 프로젝트(Next.js 14 App Router + Supabase)의 인증 플로우와 앱 전체 레이아웃을 구현하세요.
STEP 1에서 생성한 Supabase 클라이언트와 타입을 활용합니다.

## 수행할 작업

### 1. 인증 페이지
src/app/(auth)/login/page.tsx 를 구현하세요:
  - Google OAuth 로그인 버튼 (supabase.auth.signInWithOAuth)
  - 이메일 매직링크 로그인 폼 (supabase.auth.signInWithOtp)
  - 로그인 후 /app/today 로 리다이렉트
  - 이미 로그인된 경우 /app/today 로 즉시 리다이렉트

src/app/auth/callback/route.ts 를 구현하세요:
  - OAuth 코드 교환 처리 (exchangeCodeForSession)
  - 성공 시 /app/today 로 리다이렉트

### 2. 앱 루트 레이아웃
src/app/(app)/layout.tsx 를 구현하세요:
  - 서버 컴포넌트로 세션 확인, 미인증 시 /login 리다이렉트
  - 상단 고정 헤더: TimeFlow 로고, 날짜 표시, 달성률 요약 배지 3개(props로 받음)
  - 하단 네비게이션 바 (모바일): 오늘 / 주간 / 설정 탭
  - 사이드바 (데스크톱 768px 이상): 날짜 선택기 + 주간 달성률 미니 차트

### 3. 달성률 요약 배지 컴포넌트
src/components/stats/AchievementBadges.tsx 를 구현하세요:
  - Props: { timePunctuality: number; completionRate: number; focusMinutes: number }
  - 시간 준수율: (계획 시간 내 완료된 슬롯 수 / 전체 계획 슬롯 수) × 100
  - 할 일 완료율: (done 상태 슬롯 / planned 전체 슬롯) × 100
  - 집중 시간: done + partial 상태 슬롯의 actual_end - actual_start 합산 (분)
  - 각 배지는 퍼센트에 따라 색상 변경: ≥80% 초록, 50~79% 주황, <50% 빨강
  - Skeleton 로딩 상태 지원

### 4. React Query + Zustand 세팅
src/lib/providers.tsx 를 구현하세요:
  - QueryClientProvider (staleTime: 30s, gcTime: 5min)
  - 클라이언트 컴포넌트 래퍼로 src/app/layout.tsx에서 사용

src/store/timetableStore.ts 를 구현하세요 (Zustand):
  - selectedDate: string (YYYY-MM-DD)
  - setSelectedDate(date: string): void
  - editingSlotId: string | null
  - setEditingSlotId(id: string | null): void

### 5. 날짜 선택기 컴포넌트
src/components/nav/DatePicker.tsx 를 구현하세요:
  - 오늘 기준 ±7일 스와이프/클릭 이동
  - 선택된 날짜 강조 표시
  - Zustand의 selectedDate와 연동

## 완료 기준
- /login → Google 로그인 → /app/today 플로우가 실제 동작할 것
- 미인증 상태에서 /app/today 접근 시 /login으로 리다이렉트될 것
- 헤더의 달성률 배지가 Skeleton → 실제 값으로 전환될 것
- `npm run build` 타입 에러 0
```

---

## STEP 3 — 핵심 기능: 듀얼 컬럼 타임테이블

```
TimeFlow의 핵심 화면인 "Plan vs Actual 듀얼 컬럼 타임테이블"을 구현하세요.
이것이 앱의 메인 가치를 제공하는 화면입니다.

## 화면 구조
┌──────────────────────────────────────┐
│  [날짜]  [준수율] [완료율] [집중시간]  │  ← 고정 헤더
├──────────────┬───────────────────────┤
│   PLAN       │   ACTUAL              │
│  05:00 ┤     │  05:00 ┤             │
│  05:30 ┤ 할일│  05:30 ┤ (기록 없음) │
│  06:00 ┤     │  06:00 ┤ ✓ 완료      │
│   ...        │   ...                 │
│  23:30 ┤     │  23:30 ┤             │
└──────────────┴───────────────────────┘
│  [미완료 항목 내일로 이월] 버튼        │

## 수행할 작업

### 1. 데이터 페칭 훅
src/hooks/useDailyPlan.ts 를 구현하세요 (React Query 기반):
  - 파라미터: date (YYYY-MM-DD)
  - Supabase에서 daily_plans + time_slots + actual_logs를 JOIN하여 가져옴
  - daily_plan이 없으면 자동 생성 (upsert)
  - 반환: { plan: DailyPlanWithSlots | null; isLoading; error }

src/hooks/useSlotMutations.ts 를 구현하세요:
  - createSlot(planId, slotData): time_slots INSERT + 낙관적 업데이트
  - updateSlotStatus(slotId, status): status UPDATE + 낙관적 업데이트
  - updateSlotTitle(slotId, title): title UPDATE
  - deleteSlot(slotId): DELETE
  - logActual(slotId, start, end): actual_logs INSERT
  - 모든 뮤테이션은 실패 시 자동 롤백

### 2. 타임 그리드 컴포넌트
src/components/timetable/TimeGrid.tsx 를 구현하세요:
  - 05:00 ~ 23:30 (37개 슬롯, 30분 단위)
  - 왼쪽에 시각 레이블 표시 (정시만: 05:00, 06:00 ...)
  - 현재 시각을 가리키는 빨간 선 표시 (1분마다 갱신)
  - Plan 컬럼과 Actual 컬럼을 children으로 받아 동일한 그리드에 배치
  - 모바일: 세로 스크롤, 데스크톱: 화면 높이에 맞게 가상 스크롤 적용

### 3. Plan 컬럼 컴포넌트
src/components/timetable/PlanColumn.tsx 를 구현하세요:
  - 빈 슬롯 클릭 시 인라인 입력 폼 표시 (제목 + 슬롯 수 선택)
  - 슬롯 블록: 제목, 예상 시간 표시, 상태 색상 반영
    * planned: 파란색 테두리
    * done: 초록색 배경
    * partial: 주황색 배경
    * skipped: 회색, 취소선
  - 슬롯 클릭 시 편집 모달 열기 (Zustand editingSlotId 사용)
  - 드래그로 슬롯 크기 조절 (멀티슬롯, 최소 1 최대 8 슬롯)

### 4. Actual 컬럼 컴포넌트
src/components/timetable/ActualColumn.tsx 를 구현하세요:
  - Plan과 동일한 시간 축, 기록이 없는 슬롯은 회색 점선 배경(Gap 표시)
  - Plan에 슬롯이 있는 시간대를 탭하면:
    * 아직 시작 안 함: "시작" 버튼 → actual_start = now() 기록
    * 시작함: "완료" / "부분 완료" / "건너뜀" 버튼 표시
  - actual_log가 있는 슬롯: 실제 소요 시간 표시 + 상태 뱃지
  - 시간 준수 여부: 계획 start_at ±15분 이내에 시작하면 "정시", 초과 시 "지연 Xmin" 표시

### 5. 슬롯 편집 모달
src/components/timetable/SlotEditModal.tsx 를 구현하세요:
  - Radix UI Dialog 사용
  - 제목 수정, 시작/종료 시각 수정, 상태 변경, 메모 입력
  - 삭제 버튼 (확인 다이얼로그 포함)

### 6. 메인 페이지 조립
src/app/(app)/today/page.tsx (또는 /app/[date]/page.tsx) 를 구현하세요:
  - useDailyPlan 훅으로 데이터 로드
  - AchievementBadges에 계산된 달성률 전달
  - TimeGrid 안에 PlanColumn + ActualColumn 배치
  - "미완료 항목 내일로 이월" 버튼: skipped/planned 상태 슬롯을 내일 날짜로 복사

## 완료 기준
- 슬롯 생성 → Plan 컬럼에 즉시 표시될 것 (낙관적 업데이트)
- Actual에서 "완료" 탭 시 달성률 배지가 실시간 갱신될 것
- Gap(미수행 슬롯)이 회색으로 시각적으로 명확히 구분될 것
- 현재 시각 표시선이 1분마다 정확히 이동할 것
- 모바일(390px)과 데스크톱(1280px) 레이아웃 모두 정상 동작할 것
```

---

## STEP 4 — 알림, 주간 리포트, 템플릿

```
TimeFlow의 P1 기능인 알림/타이머, 주간 리포트, 템플릿 저장 기능을 구현하세요.

## 수행할 작업

### 1. Web Push 알림 시스템
public/sw.js (Service Worker) 를 구현하세요:
  - push 이벤트 리스너: 알림 표시 (제목, 슬롯 정보, 액션 버튼)
  - notificationclick 이벤트: 해당 슬롯 날짜 페이지로 포커스/이동

src/lib/webpush.ts 를 구현하세요:
  - subscribeUser(): PushManager.subscribe() → Supabase push_subscriptions 테이블에 저장
  - unsubscribeUser(): 구독 취소 + DB에서 삭제
  - 테이블: push_subscriptions (user_id, endpoint, p256dh, auth, created_at)
  - 이 테이블의 마이그레이션 SQL을 supabase/migrations/002_push.sql에 추가

src/app/api/cron/notify/route.ts 를 구현하세요:
  - Vercel Cron Job용 GET 핸들러 (Bearer 토큰 인증)
  - 현재 시각 기준 +5분 이내에 시작하는 planned 슬롯 조회
  - web-push 라이브러리로 해당 사용자에게 Push 발송
  - vercel.json에 "0,30 * * * *" 크론 스케줄 등록

src/components/settings/NotificationToggle.tsx 를 구현하세요:
  - 알림 권한 요청 + 구독 토글 UI
  - iOS Safari 미지원 안내 메시지 표시 조건부 렌더링

### 2. 포모도로 타이머
src/components/timer/PomodoroTimer.tsx 를 구현하세요:
  - 기본값: 집중 25분 / 휴식 5분 / 긴 휴식 15분
  - 상태: idle → running → paused → break
  - 화면 하단 플로팅 위젯으로 표시 (position: fixed)
  - 타이머 완료 시 Web Push 알림 (권한 있을 경우)
  - useTimer 커스텀 훅으로 로직 분리

### 3. 주간 리포트 페이지
src/app/(app)/weekly/page.tsx 를 구현하세요:

  데이터 요구사항:
  - 최근 7일치 daily_plans + time_slots + actual_logs 조회
  - 날짜별 (timePunctuality, completionRate, focusMinutes) 계산

  UI 요구사항:
  - 7일 달성률 막대 그래프: Recharts BarChart 사용
    (completionRate를 막대, timePunctuality를 선 오버레이)
  - 베스트 데이: 7일 중 completionRate 최고 날짜 하이라이트
  - 요일별 패턴: 요일별 평균 completionRate 레이더 차트 (Recharts RadarChart)
  - 이번 주 총 집중 시간 (분 → 시간+분 변환)
  - PDF 내보내기 버튼: /api/report/pdf?from=YYYY-MM-DD&to=YYYY-MM-DD 호출

src/app/api/report/pdf/route.ts 를 구현하세요:
  - @vercel/og 또는 html-to-image + 주간 리포트 HTML 템플릿으로 PDF 생성
  - Content-Disposition: attachment; filename="timeflow-weekly.pdf" 헤더 설정

### 4. 템플릿 저장 & 불러오기
src/hooks/useTemplates.ts 를 구현하세요:
  - getTemplates(): 현재 사용자의 templates 목록
  - saveTemplate(name, slots): 현재 Plan의 time_slots를 JSONB로 저장 (최대 10개 제한)
  - applyTemplate(templateId, date): 선택한 날짜의 daily_plan에 슬롯 일괄 생성
  - deleteTemplate(templateId)

src/components/templates/TemplateDrawer.tsx 를 구현하세요:
  - 하단에서 슬라이드업하는 Drawer UI
  - 템플릿 목록 + 적용 버튼 + 삭제 버튼
  - "현재 플랜을 템플릿으로 저장" 입력 폼 (이름 입력)

## 완료 기준
- 슬롯 시작 5분 전에 브라우저 Push 알림이 수신될 것
- 포모도로 타이머가 백그라운드 탭에서도 카운트다운을 유지할 것
- 주간 차트가 실제 DB 데이터를 반영할 것
- 템플릿 적용 시 time_slots가 올바른 date로 생성될 것
- `npm run build` 타입 에러 0
```

---

## STEP 5 — 성능 최적화, PWA, 배포

```
TimeFlow의 마지막 단계입니다. 성능 최적화, PWA 설정, 접근성 개선을 완성하고 Vercel 배포를 준비하세요.

## 수행할 작업

### 1. 가상 스크롤 최적화
src/components/timetable/TimeGrid.tsx 에 @tanstack/react-virtual을 적용하세요:
  - 37개 슬롯(05:00~23:30) 중 뷰포트에 보이는 것만 렌더링
  - 슬롯 높이: 48px (30분 단위), overscan: 5
  - 현재 시각 슬롯으로 초기 스크롤 (scrollToIndex)
  - 스크롤 시 시각 레이블과 Plan/Actual 컬럼이 완벽하게 동기화될 것

### 2. PWA 설정
public/manifest.json 을 생성하세요:
  {
    name: "TimeFlow",
    short_name: "TimeFlow",
    start_url: "/app/today",
    display: "standalone",
    theme_color: "#2563EB",
    background_color: "#FFFFFF",
    icons: 192px, 512px, maskable 아이콘 포함
  }

src/app/layout.tsx 의 metadata에 PWA 관련 메타태그를 추가하세요:
  - apple-mobile-web-app-capable, apple-mobile-web-app-status-bar-style
  - manifest 링크

public/sw.js 에 Workbox 캐싱 전략을 추가하세요:
  - App Shell (HTML, CSS, JS): CacheFirst
  - Supabase API 응답: NetworkFirst, 오프라인 시 캐시 반환
  - 오프라인 페이지: /offline.html 별도 생성

### 3. 낙관적 업데이트 강화
src/hooks/useSlotMutations.ts 를 검토하고 아래를 보장하세요:
  - 모든 뮤테이션에 onMutate → onError(롤백) → onSettled(무효화) 패턴 적용
  - 네트워크 오류 시 토스트 알림 표시 (react-hot-toast 또는 shadcn Toast)
  - 5초 이내 재시도 1회 자동 수행

### 4. 접근성 (WCAG 2.1 AA)
다음 접근성 요건을 전체 컴포넌트에 적용하세요:
  - 모든 슬롯 블록에 role="button", aria-label="HH:MM 슬롯: [제목], 상태: [상태]" 추가
  - 슬롯 상태 변경 시 aria-live="polite" 영역으로 상태 변경 알림
  - 포커스 트랩: 모달 열릴 때 모달 내부에만 포커스 이동 (Radix 자동 처리 확인)
  - 색상만으로 상태를 구분하지 않도록 아이콘 또는 텍스트 레이블 병행 표시
  - 키보드 네비게이션: Tab으로 슬롯 이동, Enter로 편집, Space로 완료 토글

### 5. 다크 모드
src/app/globals.css 에 CSS 변수 기반 다크 모드를 구현하세요:
  - @media (prefers-color-scheme: dark) 또는 Tailwind dark: 클래스 방식
  - 슬롯 상태 색상(파랑/초록/주황/회색)이 다크 모드에서도 명확히 구분될 것
  - 수동 토글 버튼: localStorage에 테마 설정 저장

### 6. 성능 측정 스크립트
package.json 에 아래 스크립트를 추가하세요:
  "perf": "npx lighthouse http://localhost:3000/app/today --output=json --output-path=./lighthouse-report.json --chrome-flags='--headless'"

그리고 다음 성능 목표를 맞추기 위해 필요한 최적화를 적용하세요:
  - Performance ≥ 90
  - Accessibility ≥ 95
  - LCP < 2.5s: 달성률 헤더를 서버 컴포넌트로, 타임테이블만 클라이언트로 분리
  - CLS < 0.1: 슬롯 높이를 고정값(48px)으로 명시, 스켈레톤 높이를 실제와 동일하게

### 7. Vercel 배포 설정
vercel.json 을 생성하세요:
  {
    "crons": [{ "path": "/api/cron/notify", "schedule": "0,30 * * * *" }],
    "headers": [
      { "source": "/sw.js", "headers": [{ "key": "Cache-Control", "value": "public, max-age=0, must-revalidate" }] },
      { "source": "/(.*)", "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" }
      ]}
    ]
  }

README.md 를 작성하세요:
  - 로컬 개발 환경 설정 (Supabase CLI, 환경변수)
  - Vercel One-Click Deploy 버튼
  - 마이그레이션 실행 방법
  - 주요 기능 스크린샷 섹션 (플레이스홀더)

### 8. 최종 점검 체크리스트 실행
다음을 순서대로 실행하고 결과를 출력하세요:
  1. npm run build → 빌드 성공 확인
  2. npx tsc --noEmit → 타입 에러 0 확인
  3. find src -name "*.tsx" | xargs grep -l "TODO\|FIXME\|HACK" → 미완성 코드 확인
  4. grep -r "any" src --include="*.ts" --include="*.tsx" | grep -v "// eslint" → 명시적 any 사용 확인

## 완료 기준
- Lighthouse Performance ≥ 90, Accessibility ≥ 95
- PWA: 모바일 Chrome에서 "홈 화면에 추가" 프롬프트 표시
- 오프라인 상태에서 당일 플랜 조회 가능 (캐시 히트)
- vercel.json 크론 스케줄 등록 완료
- README에 로컬 실행 가이드 완성
- `npm run build` 최종 성공
```

---

## 단계별 체크리스트 요약

| 단계 | 범위 | 예상 소요 | 핵심 산출물 |
|------|------|----------|------------|
| STEP 1 | 프로젝트 초기화 + DB 스키마 | 30~45분 | Next.js 앱, SQL 마이그레이션, TS 타입 |
| STEP 2 | 인증 + 레이아웃 | 45~60분 | 로그인 플로우, 헤더, Zustand 스토어 |
| STEP 3 | 듀얼 컬럼 타임테이블 | 90~120분 | Plan/Actual 컬럼, 달성률 계산, 메인 페이지 |
| STEP 4 | 알림 + 주간 리포트 + 템플릿 | 60~90분 | Web Push, 차트, 포모도로, 템플릿 저장 |
| STEP 5 | 성능 + PWA + 배포 | 45~60분 | Lighthouse ≥90, vercel.json, README |
