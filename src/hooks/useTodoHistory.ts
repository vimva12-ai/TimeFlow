'use client';

import { useQuery } from '@tanstack/react-query';
import { format, subDays } from 'date-fns';
import { getAuthUser } from '@/lib/firebase/client';
import { fetchDayTodoStat } from './useTodoStats';
import { type DayTodoStat } from '@/types/stats';

// 외부 호환성 유지용 타입 별칭
export type DayTodoStats = DayTodoStat;

async function fetchTodoHistory(): Promise<DayTodoStats[]> {
  const user = await getAuthUser();
  if (!user) return [];

  const today = new Date();
  const days = Array.from({ length: 7 }, (_, i) => format(subDays(today, 6 - i), 'yyyy-MM-dd'));

  return Promise.all(days.map((date) => fetchDayTodoStat(user.uid, date)));
}

export function useTodoHistory() {
  return useQuery({
    queryKey: ['todoHistory'],
    queryFn: fetchTodoHistory,
    staleTime: 5 * 60 * 1000,
  });
}
