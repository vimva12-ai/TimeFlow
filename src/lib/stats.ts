import { differenceInMinutes, parseISO } from 'date-fns';
import { type DailyPlanWithSlots } from '@/types/database';
import { type Stats } from '@/types/stats';

export type { Stats };

export function calcStats(plan: DailyPlanWithSlots | null | undefined): Stats {
  if (!plan) return { timePunctuality: 0, completionRate: 0, focusMinutes: 0 };

  const slots = plan.time_slots;
  const total = slots.length;
  if (total === 0) return { timePunctuality: 0, completionRate: 0, focusMinutes: 0 };

  const done = slots.filter((s) => s.status === 'done').length;
  const completionRate = (done / total) * 100;

  // 시간 준수율: 계획 시간 ±15분 이내에 시작한 슬롯
  const punctual = slots.filter((s) => {
    const log = s.actual_logs[0];
    if (!log?.actual_start) return false;
    const diff = Math.abs(differenceInMinutes(parseISO(log.actual_start), parseISO(s.start_at)));
    return diff <= 15;
  }).length;
  const timePunctuality = (punctual / total) * 100;

  // 집중 시간: done + partial 상태 슬롯의 실제 소요 시간 합산
  const focusMinutes = slots
    .filter((s) => s.status === 'done' || s.status === 'partial')
    .reduce((acc, s) => {
      const log = s.actual_logs[0];
      if (!log?.actual_start || !log?.actual_end) return acc;
      return acc + differenceInMinutes(parseISO(log.actual_end), parseISO(log.actual_start));
    }, 0);

  return { timePunctuality, completionRate, focusMinutes };
}
