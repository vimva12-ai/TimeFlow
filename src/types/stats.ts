// 통계 관련 공유 타입 — lib/stats, hooks/useTodoStats, usePeriodStats, useWeeklyReport 공유

export interface Stats {
  timePunctuality: number;
  completionRate: number;
  focusMinutes: number;
}

export interface DayTodoStat {
  date: string;
  total: number;
  checked: number;
  rate: number; // 0~100
}

export interface TodoRangeStats {
  avgRate: number;      // 활동일 기준 평균 달성률
  totalItems: number;   // 기간 내 전체 항목 수 합계
  checkedItems: number; // 기간 내 완료 항목 수 합계
  days: number;         // 기간 내 전체 일수
  activeDays: number;   // 할 일이 있었던 일수
  dayStats: DayTodoStat[]; // 일별 상세 (바차트용)
}

export interface PeriodStats {
  avgCompletionRate: number;
  avgFocusMinutes: number;
  totalSlots: number;
  doneSlots: number;
  days: number;
}

export interface DayReport extends Stats {
  date: string;
  dayOfWeek: string;
  totalSlots: number;
}
