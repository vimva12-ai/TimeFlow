'use client';

import { useQuery } from '@tanstack/react-query';
import { format, subDays } from 'date-fns';
import { doc, collection, getDoc, getDocs } from 'firebase/firestore';
import { db, getAuthUser } from '@/lib/firebase/client';
import { calcStats, type Stats } from '@/lib/stats';
import { type DailyPlanWithSlots } from '@/types/database';

export interface DayReport extends Stats {
  date: string;
  dayOfWeek: string;
  totalSlots: number;
}

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

        // orderBy 없이 조회 후 JS에서 정렬 (Firestore 복합 인덱스 불필요)
        const slotsSnap = await getDocs(collection(planRef, 'time_slots'));
        const slots = await Promise.all(
          slotsSnap.docs.map(async (slotDoc) => {
            const logsSnap = await getDocs(collection(slotDoc.ref, 'actual_logs'));
            return {
              ...slotDoc.data(),
              id: slotDoc.id,
              actual_logs: logsSnap.docs.map((d) => ({ ...d.data(), id: d.id })),
            };
          })
        );

        // JS에서 정렬
        (slots as Array<{ sort_order?: number; start_at?: string; [k: string]: unknown }>).sort((a, b) => {
          const so = (a.sort_order ?? 0) - (b.sort_order ?? 0);
          if (so !== 0) return so;
          return (a.start_at ?? '').localeCompare(b.start_at ?? '');
        });

        return {
          id: planId,
          uid,
          date,
          created_at: '',
          time_slots: slots as DailyPlanWithSlots['time_slots'],
        };
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
