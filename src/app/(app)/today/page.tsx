'use client';

import { useState } from 'react';
import { useTimetableStore } from '@/store/timetableStore';
import { useDailyPlan } from '@/hooks/useDailyPlan';
import { useSlotMutations } from '@/hooks/useSlotMutations';
import { useWeeklyReport } from '@/hooks/useWeeklyReport';
import { usePlanFavorites } from '@/hooks/usePlanFavorites';
import { useTodo, type TodoItem } from '@/hooks/useTodo';
import { useQueryClient } from '@tanstack/react-query';
import { format, addDays, addMinutes, parseISO } from 'date-fns';
import AchievementBadges from '@/components/stats/AchievementBadges';
import TimeGrid from '@/components/timetable/TimeGrid';
import PlanColumn from '@/components/timetable/PlanColumn';
import ActualColumn from '@/components/timetable/ActualColumn';
import FavoritesPanel from '@/components/timetable/FavoritesPanel';
import SlotEditModal from '@/components/timetable/SlotEditModal';
import AddSlotModal from '@/components/timetable/AddSlotModal';
import { calcStats } from '@/lib/stats';
import { type SlotStatus } from '@/types/database';
import { auth, db } from '@/lib/firebase/client';
import { doc, collection, setDoc, addDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { ChevronDown, ChevronUp, TrendingUp } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

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
  const { createSlot, updateSlotStatus, logActual, createActualEntry, updateActualLog, updateSlotTime, updateActualDispTime } = useSlotMutations(selectedDate);
  const { data: weeklyReport } = useWeeklyReport();
  const { addFavorite } = usePlanFavorites();
  const { save: saveTodo } = useTodo(selectedDate);
  const queryClient = useQueryClient();
  const stats = calcStats(plan);
  const { t } = useI18n();

  const [statsOpen, setStatsOpen] = useState(false);
  const [modal, setModal] = useState<ModalState | null>(null);
  // 즐겨찾기 패널 표시 여부
  const [favoritesOpen, setFavoritesOpen] = useState(false);

  const weeklyAvg = weeklyReport
    ? Math.round(weeklyReport.reduce((a, d) => a + d.completionRate, 0) / weeklyReport.length)
    : null;

  function handleCreateSlot(start: string, end: string, title: string) {
    if (!plan) return;
    // 새 할 일 ID를 미리 생성해 슬롯-할 일을 양방향으로 연결
    const newTodoId = Math.random().toString(36).slice(2, 10);
    createSlot.mutate(
      { title, start_at: start, end_at: end, status: 'planned', sort_order: plan.time_slots.length, linkedTodoId: newTodoId },
      {
        onSuccess: (slot) => {
          // 현재 캐시에서 최신 할 일 목록을 가져와 새 항목 추가
          const current = queryClient.getQueryData<TodoItem[]>(['todo', selectedDate]) ?? [];
          saveTodo([...current, { id: newTodoId, text: title, checked: false, linkedSlotId: slot.id }]);
        },
      }
    );
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
    // 연결된 할 일이 있으면 완료/부분완료 시 체크 처리
    if (slot?.linkedTodoId && (status === 'done' || status === 'partial')) {
      const current = queryClient.getQueryData<TodoItem[]>(['todo', selectedDate]) ?? [];
      const todo = current.find((t) => t.id === slot.linkedTodoId);
      if (todo && !todo.checked) {
        const others = current.filter((t) => t.id !== todo.id);
        saveTodo([...others, { ...todo, checked: true }]);
      }
    }
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
    alert(t.carryOverDone(carry.length));
  }

  /** 사이드바 할 일 → PLAN 드롭: 해당 시간에 1시간짜리 슬롯 생성 + 할 일 연동 */
  function handleTodoDrop(h: number, m: number, title: string, todoId?: string) {
    if (!plan) return;
    const start = new Date(
      `${selectedDate}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`,
    ).toISOString();
    const end = addMinutes(new Date(start), 60).toISOString();
    createSlot.mutate(
      { title, start_at: start, end_at: end, status: 'planned', sort_order: plan.time_slots.length, linkedTodoId: todoId },
      {
        onSuccess: (slot) => {
          if (!todoId) return;
          // 드래그한 기존 할 일에 linkedSlotId 추가 (새 항목 생성 없이 연결만)
          const current = queryClient.getQueryData<TodoItem[]>(['todo', selectedDate]) ?? [];
          saveTodo(current.map((t) => t.id === todoId ? { ...t, linkedSlotId: slot.id } : t));
        },
      }
    );
  }

  /** 즐겨찾기 → PLAN 드롭: 즐겨찾기의 지속 시간으로 슬롯 생성 */
  function handleFavoriteDrop(h: number, m: number, title: string, durationMin: number) {
    if (!plan) return;
    const start = new Date(
      `${selectedDate}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`,
    ).toISOString();
    const end = addMinutes(new Date(start), durationMin).toISOString();
    createSlot.mutate({ title, start_at: start, end_at: end, status: 'planned', sort_order: plan.time_slots.length });
  }

  const total = plan?.time_slots.length ?? 0;
  const done = plan?.time_slots.filter((s) => s.status === 'done').length ?? 0;

  return (
    <div className="flex flex-col h-full">
      {/* 날짜 헤더 */}
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
              <div className="text-[10px] text-gray-500 dark:text-gray-400 mb-0.5">{t.todayRate}</div>
              <div className="text-base font-bold text-blue-600 dark:text-blue-400">
                {total > 0 ? Math.round(stats.completionRate) : 0}%
              </div>
              <div className="text-[10px] text-gray-400">{done}/{total}</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-2 text-center border border-gray-200 dark:border-gray-700">
              <div className="text-[10px] text-gray-500 dark:text-gray-400 mb-0.5">{t.focusTime}</div>
              <div className="text-base font-bold text-green-600 dark:text-green-400">
                {formatFocus(stats.focusMinutes)}
              </div>
              <div className="text-[10px] text-gray-400">{t.punctuality(Math.round(stats.timePunctuality))}</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-2 text-center border border-gray-200 dark:border-gray-700">
              <div className="text-[10px] text-gray-500 dark:text-gray-400 mb-0.5">{t.weeklyAvg}</div>
              <div className="text-base font-bold text-purple-600 dark:text-purple-400">
                {weeklyAvg !== null ? `${weeklyAvg}%` : '—'}
              </div>
              <div className="text-[10px] text-gray-400">{t.sevenDays}</div>
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
        favoritesOpen={favoritesOpen}
        onToggleFavorites={() => setFavoritesOpen((v) => !v)}
        favoritesPanel={<FavoritesPanel />}
        onTodoDrop={handleTodoDrop}
        onFavoriteDrop={handleFavoriteDrop}
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
              onChangeStatus={(slotId, status) => {
                updateSlotStatus.mutate({ slotId, status });
                // 완료/부분완료 → 연결된 할 일 체크
                if (status === 'done' || status === 'partial') {
                  const slot = plan.time_slots.find((s) => s.id === slotId);
                  if (slot?.linkedTodoId) {
                    const current = queryClient.getQueryData<TodoItem[]>(['todo', selectedDate]) ?? [];
                    const todo = current.find((t) => t.id === slot.linkedTodoId);
                    if (todo && !todo.checked) {
                      const others = current.filter((t) => t.id !== todo.id);
                      saveTodo([...others, { ...todo, checked: true }]);
                    }
                  }
                }
              }}
              onUpdateLog={(slotId, logId, actualStart, actualEnd) =>
                updateActualLog.mutate({ slotId, logId, actual_start: actualStart, actual_end: actualEnd })
              }
              onUpdateSlotTime={(slotId, newStart, newEnd) =>
                updateSlotTime.mutate({ slotId, start_at: newStart, end_at: newEnd })
              }
              onMoveSlot={(slotId, newStart, newEnd) => {
                // ACTUAL drag routing:
                // - Completed slots: update actual_log times (ACTUAL display only)
                // - Not-started slots: update actual_disp_start/end (PLAN unaffected)
                const slot = plan.time_slots.find((s) => s.id === slotId);
                const log = slot?.actual_logs[0];
                if (log?.actual_start) {
                  updateActualLog.mutate({ slotId, logId: log.id, actual_start: newStart, actual_end: newEnd });
                } else {
                  updateActualDispTime.mutate({ slotId, actual_disp_start: newStart, actual_disp_end: newEnd });
                }
              }}
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
          {t.carryOver}
        </button>
      </div>

      {plan && <SlotEditModal slots={plan.time_slots} date={selectedDate} />}

      <AddSlotModal
        type={modal?.type ?? 'plan'}
        open={modal !== null}
        onClose={() => setModal(null)}
        date={selectedDate}
        onCreatePlan={handleCreateSlot}
        onCreateActual={handleCreateActual}
        initialHour={modal?.initialHour}
        initialMin={modal?.initialMin}
        onSaveFavorite={(title, durationMinutes) =>
          addFavorite.mutate({ title, durationMinutes })
        }
      />
    </div>
  );
}
