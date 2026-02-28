'use client';

import { useQuery } from '@tanstack/react-query';
import { doc, collection, getDocs, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, getAuthUser } from '@/lib/firebase/client';
import { type DailyPlanWithSlots } from '@/types/database';

async function fetchDailyPlan(date: string): Promise<DailyPlanWithSlots | null> {
  const user = await getAuthUser();
  if (!user) return null;

  const uid = user.uid;
  const planId = `${uid}_${date}`;
  const planRef = doc(db, 'users', uid, 'daily_plans', planId);

  // daily_plan이 없을 때만 생성 (불필요한 반복 write 방지)
  const planSnap = await getDoc(planRef);
  if (!planSnap.exists()) {
    await setDoc(planRef, { uid, date, created_at: serverTimestamp() });
  }

  // time_slots 조회 — compound index 불필요하도록 JS에서 정렬
  const slotsSnap = await getDocs(collection(planRef, 'time_slots'));

  // 각 slot의 actual_logs 병렬 조회
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

  // sort_order → start_at 순 정렬 (Firestore compound index 없이도 동작)
  const sorted = (slots as DailyPlanWithSlots['time_slots']).sort((a, b) => {
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    return a.start_at < b.start_at ? -1 : a.start_at > b.start_at ? 1 : 0;
  });

  return {
    id: planId,
    uid,
    date,
    created_at: new Date().toISOString(),
    time_slots: sorted,
  };
}

export function useDailyPlan(date: string) {
  return useQuery({
    queryKey: ['dailyPlan', date],
    queryFn: () => fetchDailyPlan(date),
    enabled: !!date,
  });
}
