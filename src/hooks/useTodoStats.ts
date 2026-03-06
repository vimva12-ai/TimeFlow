import { useQuery } from '@tanstack/react-query';
import { eachDayOfInterval, format, parseISO } from 'date-fns';
import { doc, getDoc } from 'firebase/firestore';
import { db, getAuthUser } from '@/lib/firebase/client';
import { type TodoItem } from './useTodo';
import { type DayTodoStat, type TodoRangeStats } from '@/types/stats';

export type { DayTodoStat, TodoRangeStats };

/** uid 기준 단일 날짜 todo 통계를 Firestore에서 조회 */
export async function fetchDayTodoStat(uid: string, date: string): Promise<DayTodoStat> {
  try {
    const snap = await getDoc(doc(db, 'users', uid, 'todos', date));
    if (!snap.exists()) return { date, total: 0, checked: 0, rate: 0 };
    const items: TodoItem[] = snap.data().items ?? [];
    const total = items.length;
    const checked = items.filter((i) => i.checked).length;
    return { date, total, checked, rate: total > 0 ? Math.round((checked / total) * 100) : 0 };
  } catch {
    return { date, total: 0, checked: 0, rate: 0 };
  }
}

async function fetchTodoRange(from: string, to: string): Promise<TodoRangeStats> {
  const user = await getAuthUser();
  if (!user) return { avgRate: 0, totalItems: 0, checkedItems: 0, days: 0, activeDays: 0, dayStats: [] };

  const dayList = eachDayOfInterval({ start: parseISO(from), end: parseISO(to) });
  const dayStats: DayTodoStat[] = await Promise.all(
    dayList.map((d) => fetchDayTodoStat(user.uid, format(d, 'yyyy-MM-dd')))
  );

  const active = dayStats.filter((d) => d.total > 0);
  const totalItems = dayStats.reduce((s, d) => s + d.total, 0);
  const checkedItems = dayStats.reduce((s, d) => s + d.checked, 0);
  const avgRate =
    active.length > 0
      ? Math.round(active.reduce((s, d) => s + d.rate, 0) / active.length)
      : 0;

  return {
    avgRate,
    totalItems,
    checkedItems,
    days: dayList.length,
    activeDays: active.length,
    dayStats,
  };
}

export function useTodoStats(from: string, to: string) {
  return useQuery({
    queryKey: ['todoStats', from, to],
    queryFn: () => fetchTodoRange(from, to),
    staleTime: 5 * 60 * 1000,
    enabled: !!from && !!to && from <= to,
  });
}
