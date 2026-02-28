'use client';

import { useQuery } from '@tanstack/react-query';
import { doc, collection, getDoc, getDocs, query, orderBy } from 'firebase/firestore';
import { eachDayOfInterval, format, parseISO } from 'date-fns';
import { db, getAuthUser } from '@/lib/firebase/client';
import { calcStats } from '@/lib/stats';
import { type DailyPlanWithSlots } from '@/types/database';

export interface PeriodStats {
  avgCompletionRate: number;
  avgFocusMinutes: number;
  totalSlots: number;
  doneSlots: number;
  days: number;
}

async function fetchPeriodStats(from: string, to: string): Promise<PeriodStats> {
  const user = await getAuthUser();
  if (!user) return { avgCompletionRate: 0, avgFocusMinutes: 0, totalSlots: 0, doneSlots: 0, days: 0 };

  const uid = user.uid;
  const days = eachDayOfInterval({ start: parseISO(from), end: parseISO(to) });

  const planResults = await Promise.all(
    days.map(async (d): Promise<DailyPlanWithSlots | null> => {
      const date = format(d, 'yyyy-MM-dd');
      const planId = `${uid}_${date}`;
      const planRef = doc(db, 'users', uid, 'daily_plans', planId);
      const planSnap = await getDoc(planRef);
      if (!planSnap.exists()) return null;

      const slotsSnap = await getDocs(
        query(collection(planRef, 'time_slots'), orderBy('sort_order'), orderBy('start_at'))
      );
      const slots = await Promise.all(
        slotsSnap.docs.map(async (slotDoc) => {
          const logsSnap = await getDocs(collection(slotDoc.ref, 'actual_logs'));
          return {
            ...slotDoc.data(),
            id: slotDoc.id,
            actual_logs: logsSnap.docs.map((ld) => ({ ...ld.data(), id: ld.id })),
          };
        })
      );
      return { id: planId, uid, date, created_at: '', time_slots: slots as DailyPlanWithSlots['time_slots'] };
    })
  );

  const statsArr = planResults.map(calcStats);
  const activeDays = statsArr.filter((s) => s.focusMinutes > 0 || s.completionRate > 0).length || 1;

  return {
    avgCompletionRate: statsArr.reduce((a, s) => a + s.completionRate, 0) / days.length,
    avgFocusMinutes: Math.round(statsArr.reduce((a, s) => a + s.focusMinutes, 0) / activeDays),
    totalSlots: planResults.reduce((a, p) => a + (p?.time_slots.length ?? 0), 0),
    doneSlots: planResults.reduce((a, p) => a + (p?.time_slots.filter((s) => s.status === 'done').length ?? 0), 0),
    days: days.length,
  };
}

export function usePeriodStats(from: string, to: string) {
  return useQuery({
    queryKey: ['periodStats', from, to],
    queryFn: () => fetchPeriodStats(from, to),
    enabled: !!from && !!to && from <= to,
    staleTime: 5 * 60 * 1000,
  });
}
