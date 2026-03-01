'use client';

import { useState } from 'react';
import { useTimetableStore } from '@/store/timetableStore';
import { useDailyPlan } from '@/hooks/useDailyPlan';
import { useSlotMutations } from '@/hooks/useSlotMutations';
import { useWeeklyReport } from '@/hooks/useWeeklyReport';
import { useQueryClient } from '@tanstack/react-query';
import { format, addDays, parseISO } from 'date-fns';
import AchievementBadges from '@/components/stats/AchievementBadges';
import TimeGrid from '@/components/timetable/TimeGrid';
import PlanColumn from '@/components/timetable/PlanColumn';
import ActualColumn from '@/components/timetable/ActualColumn';
import SlotEditModal from '@/components/timetable/SlotEditModal';
import AddSlotModal from '@/components/timetable/AddSlotModal';
import { calcStats } from '@/lib/stats';
import { type SlotStatus } from '@/types/database';
import { auth, db } from '@/lib/firebase/client';
import { doc, collection, setDoc, addDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { ChevronDown, ChevronUp, TrendingUp } from 'lucide-react';

function formatFocus(minutes: number) {
  if (minutes < 60) return `${minutes}분`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

interface ModalState {
  type: 'plan' | 'actual';
  initialHour?: number;
  initialMin?: number;
}

export default function TodayPage() {
  const { selectedDate } = useTimetableStore();
  const { data: plan, isLoading } = useDailyPlan(selectedDate);
  const { createSlot, updateSlotStatus, logActual, createActualEntry, updateActualLog, updateSlotTime } = useSlotMutations(selectedDate);
  const { data: weeklyReport } = useWeeklyReport();
  const queryClient = useQueryClient();
  const stats = calcStats(plan);

  const [statsOpen, setStatsOpen] = useState(false);
  const [modal, setModal] = useState<ModalState | null>(null);

  const weeklyAvg = weeklyReport
    ? Math.round(weeklyReport.reduce((a, d) => a + d.completionRate, 0) / weeklyReport.length)
    : null;

  function handleCreateSlot(start: string, end: string, title: string) {
    if (!plan) return;
    createSlot.mutate({ title, start_at: start, end_at: end, status: 'planned', sort_order: plan.time_slots.length });
  }

  function handleCreateActual(start: string, end: string, title: string) {
    if (!plan) return;
    createActualEntry.mutate({ title, start_at: start, end_at: end, sort_order: plan.time_slots.length });
  }

  function handleStart(slotId: string) {
    logActual.mutate({ slotId, start: new Date().toISOString() });
  }

  async function handleComplete(slotId: string, status: SlotStatus, end: string) {
    updateSlotStatus.mutate({ slotId, status });
    const slot = plan?.time_slots.find((s) => s.id === slotId);
    const log = slot?.actual_logs[0];
    if (log?.actual_start) {
      const uid = auth.currentUser?.uid ?? '';
      const planId = `${uid}_${selectedDate}`;
      const logRef = doc(db, 'users', uid, 'daily_plans', planId, 'time_slots', slotId, 'actual_logs', log.id);
      await updateDoc(logRef, { actual_end: end });
      queryClient.invalidateQueries({ queryKey: ['dailyPlan', selectedDate] });
    }
  }

  async function handleCarryOver() {
    if (!plan) return;
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const tomorrow = format(addDays(parseISO(selectedDate), 1), 'yyyy-MM-dd');
    const tomorrowPlanId = `${uid}_${tomorrow}`;
    const tomorrowPlanRef = doc(db, 'users', uid, 'daily_plans', tomorrowPlanId);
    await setDoc(tomorrowPlanRef, { uid, date: tomorrow, created_at: serverTimestamp() }, { merge: true });
    const carry = plan.time_slots.filter((s) => s.status === 'planned' || s.status === 'skipped');
    if (carry.length === 0) return;
    await Promise.all(
      carry.map((s, i) =>
        addDoc(collection(tomorrowPlanRef, 'time_slots'), {
          uid, planId: tomorrowPlanId, title: s.title,
          start_at: s.start_at.replace(selectedDate, tomorrow),
          end_at: s.end_at.replace(selectedDate, tomorrow),
          status: 'planned' as SlotStatus, sort_order: i, created_at: serverTimestamp(),
        })
      )
    );
    queryClient.invalidateQueries({ queryKey: ['dailyPlan', tomorrow] });
    alert(`${carry.length}개 항목을 내일로 이월했습니다.`);
  }

  const total = plan?.time_slots.length ?? 0;
  const done = plan?.time_slots.filter((s) => s.status === 'done').length ?? 0;

  return (
    <div className="flex flex-col h-full">
      {/* 날짜 헤더 — 압축 */}
      <div className="px-3 py-1.5 flex items-center justify-between border-b border-gray-200 dark:border-gray-800">
        <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">{selectedDate}</span>
        <div className="flex items-center gap-1.5">
          <AchievementBadges
            timePunctuality={stats.timePunctuality}
            completionRate={stats.completionRate}
            focusMinutes={stats.focusMinutes}
            isLoading={isLoading}
          />
          <button
            onClick={() => setStatsOpen((v) => !v)}
            className="flex items-center gap-0.5 text-xs text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            <TrendingUp className="w-3.5 h-3.5" />
            {statsOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {/* 통계 패널 */}
      {statsOpen && (
        <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-2 text-center border border-gray-200 dark:border-gray-700">
              <div className="text-[10px] text-gray-500 dark:text-gray-400 mb-0.5">오늘 달성률</div>
              <div className="text-base font-bold text-blue-600 dark:text-blue-400">
                {total > 0 ? Math.round(stats.completionRate) : 0}%
              </div>
              <div className="text-[10px] text-gray-400">{done}/{total}개</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-2 text-center border border-gray-200 dark:border-gray-700">
              <div className="text-[10px] text-gray-500 dark:text-gray-400 mb-0.5">집중 시간</div>
              <div className="text-base font-bold text-green-600 dark:text-green-400">
                {formatFocus(stats.focusMinutes)}
              </div>
              <div className="text-[10px] text-gray-400">준수 {Math.round(stats.timePunctuality)}%</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-2 text-center border border-gray-200 dark:border-gray-700">
              <div className="text-[10px] text-gray-500 dark:text-gray-400 mb-0.5">주간 평균</div>
              <div className="text-base font-bold text-purple-600 dark:text-purple-400">
                {weeklyAvg !== null ? `${weeklyAvg}%` : '—'}
              </div>
              <div className="text-[10px] text-gray-400">7일</div>
            </div>
          </div>
          {total > 0 && (
            <div className="mt-1.5">
              <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${(done / total) * 100}%` }} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* 타임테이블 */}
      <TimeGrid
        onAddPlan={() => setModal({ type: 'plan' })}
        onAddActual={() => setModal({ type: 'actual' })}
        onPlanCellClick={(h, m) => setModal({ type: 'plan', initialHour: h, initialMin: m })}
        onActualCellClick={(h, m) => setModal({ type: 'actual', initialHour: h, initialMin: m })}
        planColumn={
          plan ? (
            <PlanColumn
              slots={plan.time_slots}
              planId={plan.id}
              date={selectedDate}
              onMoveSlot={(slotId, newStart, newEnd) =>
                updateSlotTime.mutate({ slotId, start_at: newStart, end_at: newEnd })
              }
            />
          ) : null
        }
        actualColumn={
          plan ? (
            <ActualColumn
              slots={plan.time_slots}
              onStart={handleStart}
              onComplete={handleComplete}
              onChangeStatus={(slotId, status) => updateSlotStatus.mutate({ slotId, status })}
              onUpdateLog={(slotId, logId, actualStart, actualEnd) =>
                updateActualLog.mutate({ slotId, logId, actual_start: actualStart, actual_end: actualEnd })
              }
              onMoveSlot={(slotId, newStart, newEnd) =>
                updateSlotTime.mutate({ slotId, start_at: newStart, end_at: newEnd })
              }
            />
          ) : null
        }
      />

      {/* 미완료 이월 */}
      <div className="px-3 py-2 border-t border-gray-200 dark:border-gray-800">
        <button
          onClick={handleCarryOver}
          className="w-full py-1.5 text-xs text-gray-500 dark:text-gray-400 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          미완료 항목 내일로 이월
        </button>
      </div>

      {plan && <SlotEditModal slots={plan.time_slots} date={selectedDate} />}

      <AddSlotModal
        type={modal?.type ?? 'plan'}
        open={modal !== null}
        onClose={() => setModal(null)}
        date={selectedDate}
        slotCount={plan?.time_slots.length ?? 0}
        onCreatePlan={handleCreateSlot}
        onCreateActual={handleCreateActual}
        initialHour={modal?.initialHour}
        initialMin={modal?.initialMin}
      />
    </div>
  );
}
