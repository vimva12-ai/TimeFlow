'use client';

import { useQuery } from '@tanstack/react-query';
import { format, subDays } from 'date-fns';
import { doc, getDoc } from 'firebase/firestore';
import { db, getAuthUser } from '@/lib/firebase/client';
import { calcStats } from '@/lib/stats';
import { type DailyPlanWithSlots } from '@/types/database';
import { type DayReport } from '@/types/stats';
import { fetchSlotsWithLogs } from '@/lib/firestore';

export type { DayReport };

async function fetchWeeklyReport(): Promise<DayReport[]> {
  const user = await getAuthUser();
  if (!user) return [];

  const uid = user.uid;
  const today = new Date();
  const days = Array.from({ length: 7 }, (_, i) => format(subDays(today, 6 - i), 'yyyy-MM-dd'));

  const planResults = await Promise.all(
    days.map(async (date): Promise<DailyPlanWithSlots | null> => {
      try {
        const planId = `${uid}_${date}`;
        const planRef = doc(db, 'users', uid, 'daily_plans', planId);
        const planSnap = await getDoc(planRef);
        if (!planSnap.exists()) return null;

        const slots = await fetchSlotsWithLogs(planRef);
        return { id: planId, uid, date, created_at: '', time_slots: slots };
      } catch {
        return null;
      }
    })
  );

  return days.map((date, i) => {
    const plan = planResults[i];
    const stats = calcStats(plan);
    return {
      date,
      dayOfWeek: ['일', '월', '화', '수', '목', '금', '토'][new Date(date).getDay()],
      totalSlots: plan?.time_slots.length ?? 0,
      ...stats,
    };
  });
}

export function useWeeklyReport() {
  return useQuery({
    queryKey: ['weeklyReport'],
    queryFn: fetchWeeklyReport,
    staleTime: 5 * 60 * 1000,
  });
}
