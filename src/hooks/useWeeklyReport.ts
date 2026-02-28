'use client';

import { useQuery } from '@tanstack/react-query';
import { format, subDays } from 'date-fns';
import { doc, collection, getDoc, getDocs, query, orderBy } from 'firebase/firestore';
import { db, getAuthUser } from '@/lib/firebase/client';
import { calcStats, type Stats } from '@/lib/stats';
import { type DailyPlanWithSlots } from '@/types/database';

export interface DayReport extends Stats {
  date: string;
  dayOfWeek: string; // 월~일
}

async function fetchWeeklyReport(): Promise<DayReport[]> {
  const user = await getAuthUser();
  if (!user) return [];

  const uid = user.uid;
  const today = new Date();
  const days = Array.from({ length: 7 }, (_, i) => format(subDays(today, 6 - i), 'yyyy-MM-dd'));

  // 7일치 플랜 병렬 조회
  const planResults = await Promise.all(
    days.map(async (date): Promise<DailyPlanWithSlots | null> => {
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
            actual_logs: logsSnap.docs.map((d) => ({ ...d.data(), id: d.id })),
          };
        })
      );

      return {
        id: planId,
        uid,
        date,
        created_at: '',
        time_slots: slots as DailyPlanWithSlots['time_slots'],
      };
    })
  );

  return days.map((date, i) => {
    const plan = planResults[i];
    const stats = calcStats(plan);
    return {
      date,
      dayOfWeek: ['일', '월', '화', '수', '목', '금', '토'][new Date(date).getDay()],
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
