import { useQuery } from '@tanstack/react-query';
import { eachDayOfInterval, format, parseISO } from 'date-fns';
import { doc, getDoc } from 'firebase/firestore';
import { db, getAuthUser } from '@/lib/firebase/client';
import { type TodoItem } from './useTodo';

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

async function fetchTodoRange(from: string, to: string): Promise<TodoRangeStats> {
  const user = await getAuthUser();
  if (!user) return { avgRate: 0, totalItems: 0, checkedItems: 0, days: 0, activeDays: 0, dayStats: [] };

  const dayList = eachDayOfInterval({ start: parseISO(from), end: parseISO(to) });

  const dayStats: DayTodoStat[] = await Promise.all(
    dayList.map(async (d) => {
      const date = format(d, 'yyyy-MM-dd');
      try {
        const snap = await getDoc(doc(db, 'users', user.uid, 'todos', date));
        if (!snap.exists()) return { date, total: 0, checked: 0, rate: 0 };
        const items: TodoItem[] = snap.data().items ?? [];
        const total = items.length;
        const checked = items.filter((i) => i.checked).length;
        return { date, total, checked, rate: total > 0 ? Math.round((checked / total) * 100) : 0 };
      } catch {
        return { date, total: 0, checked: 0, rate: 0 };
      }
    })
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
