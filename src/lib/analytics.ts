import { logEvent as fbLogEvent } from 'firebase/analytics';
import { getAnalyticsInstance } from '@/lib/firebase/client';

function logEvent(name: string, params?: Record<string, unknown>) {
  const a = getAnalyticsInstance();
  if (!a) return;
  fbLogEvent(a, name, params);
}

export const analytics = {
  /** 로그인 성공 */
  login: (method: string) => logEvent('login', { method }),

  /** 페이지 뷰 (SPA 라우트 변경 시) */
  pageView: (pagePath: string, pageTitle: string) =>
    logEvent('page_view', { page_path: pagePath, page_title: pageTitle }),

  /** 타임슬롯 생성 */
  slotCreated: (type: 'plan' | 'actual') => logEvent('slot_created', { type }),

  /** 타임슬롯 상태 변경 (done / partial / skipped) */
  slotStatusChanged: (status: string) =>
    logEvent('slot_status_changed', { status }),

  /** 포모도로 타이머 시작 */
  timerStarted: (phase: string) => logEvent('pomodoro_timer_started', { phase }),

  /** 포모도로 타이머 완료 */
  timerCompleted: (phase: string) =>
    logEvent('pomodoro_timer_completed', { phase }),
};
