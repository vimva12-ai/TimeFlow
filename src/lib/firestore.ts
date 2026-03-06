// Firestore 공통 유틸리티 — 여러 훅에서 공유하는 fetch/정렬 헬퍼
import { collection, getDocs, DocumentReference } from 'firebase/firestore';
import { type DailyPlanWithSlots } from '@/types/database';

/**
 * planRef의 time_slots 컬렉션과 각 슬롯의 actual_logs를 병렬로 조회한 뒤
 * sort_order → start_at 순으로 정렬해서 반환한다.
 * Firestore 복합 인덱스 없이 JS에서 정렬하므로 별도 인덱스 설정 불필요.
 */
export async function fetchSlotsWithLogs(planRef: DocumentReference): Promise<DailyPlanWithSlots['time_slots']> {
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

  // sort_order → start_at 순 정렬 (Firestore 복합 인덱스 불필요)
  (slots as DailyPlanWithSlots['time_slots']).sort((a, b) => {
    const so = (a.sort_order ?? 0) - (b.sort_order ?? 0);
    return so !== 0 ? so : (a.start_at ?? '').localeCompare(b.start_at ?? '');
  });

  return slots as DailyPlanWithSlots['time_slots'];
}
