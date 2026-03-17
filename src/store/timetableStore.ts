import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { format } from 'date-fns';

interface TimetableState {
  // UI 상태 (미저장)
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  editingSlotId: string | null;
  setEditingSlotId: (id: string | null) => void;
  // 할 일 사이드바 → PLAN 모달 연동: 할 일 추가 시 PLAN 모달을 열기 위한 pending 상태
  pendingTodoForPlan: { text: string; todoId: string } | null;
  setPendingTodoForPlan: (data: { text: string; todoId: string } | null) => void;

  // 그리드 설정 (localStorage 영구저장)
  startHour: number;   // 시작 시간 (기본: 5)
  endHour: number;     // 종료 시간 (기본: 24)
  slotHeight: number;  // 슬롯 높이px (32=작게 / 48=보통 / 64=넓게)
  setStartHour: (h: number) => void;
  setEndHour: (h: number) => void;
  setSlotHeight: (h: number) => void;
}

export const useTimetableStore = create<TimetableState>()(
  persist(
    (set) => ({
      selectedDate: format(new Date(), 'yyyy-MM-dd'),
      setSelectedDate: (date) => set({ selectedDate: date }),
      editingSlotId: null,
      setEditingSlotId: (id) => set({ editingSlotId: id }),
      pendingTodoForPlan: null,
      setPendingTodoForPlan: (data) => set({ pendingTodoForPlan: data }),

      startHour: 5,
      endHour: 24,
      slotHeight: 36,
      setStartHour: (h) => set({ startHour: h }),
      setEndHour: (h) => set({ endHour: h }),
      setSlotHeight: (h) => set({ slotHeight: h }),
    }),
    {
      name: 'timeflow-grid-settings',
      // 설정만 영구저장 (날짜/모달 상태 제외)
      partialize: (state) => ({
        startHour: state.startHour,
        endHour: state.endHour,
        slotHeight: state.slotHeight,
      }),
    }
  )
);
