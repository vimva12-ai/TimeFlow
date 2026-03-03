'use client';

import { useQuery } from '@tanstack/react-query';
import { format, subDays } from 'date-fns';
import { doc, getDoc } from 'firebase/firestore';
import { db, getAuthUser } from '@/lib/firebase/client';
import { type TodoItem } from './useTodo';

export interface DayTodoStats {
  date: string;
  total: number;
  checked: number;
  rate: number; // 0~100
}

async function fetchTodoHistory(): Promise<DayTodoStats[]> {
  const user = await getAuthUser();
  if (!user) return [];

  const today = new Date();
  const days = Array.from({ length: 7 }, (_, i) => format(subDays(today, 6 - i), 'yyyy-MM-dd'));

  return Promise.all(
    days.map(async (date): Promise<DayTodoStats> => {
      try {
        const ref = doc(db, 'users', user.uid, 'todos', date);
        const snap = await getDoc(ref);
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
}

export function useTodoHistory() {
  return useQuery({
    queryKey: ['todoHistory'],
    queryFn: fetchTodoHistory,
    staleTime: 5 * 60 * 1000,
  });
}
