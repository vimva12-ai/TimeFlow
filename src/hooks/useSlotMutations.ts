'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  doc, collection, addDoc, updateDoc, deleteDoc, serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase/client';
import { type TimeSlotInsert, type SlotStatus, type DailyPlanWithSlots } from '@/types/database';

export function useSlotMutations(date: string) {
  const queryClient = useQueryClient();
  const qKey = ['dailyPlan', date];

  function getSlotRef(slotId: string) {
    const uid = auth.currentUser?.uid ?? '';
    const planId = `${uid}_${date}`;
    return doc(db, 'users', uid, 'daily_plans', planId, 'time_slots', slotId);
  }

  // ── createSlot ──────────────────────────────────────────────
  const createSlot = useMutation({
    mutationFn: async (slotData: TimeSlotInsert) => {
      const uid = auth.currentUser?.uid ?? '';
      const planId = `${uid}_${date}`;
      const slotsRef = collection(db, 'users', uid, 'daily_plans', planId, 'time_slots');
      const docRef = await addDoc(slotsRef, {
        uid,
        planId,
        title: slotData.title,
        start_at: slotData.start_at,
        end_at: slotData.end_at,
        status: slotData.status ?? 'planned',
        sort_order: slotData.sort_order ?? 0,
        created_at: serverTimestamp(),
        ...(slotData.linkedTodoId ? { linkedTodoId: slotData.linkedTodoId } : {}),
      });
      return {
        id: docRef.id,
        uid,
        planId,
        ...slotData,
        status: slotData.status ?? 'planned',
        sort_order: slotData.sort_order ?? 0,
        created_at: new Date().toISOString(),
        actual_logs: [],
      };
    },
    onMutate: async (slotData) => {
      await queryClient.cancelQueries({ queryKey: qKey });
      const previous = queryClient.getQueryData<DailyPlanWithSlots>(qKey);
      if (previous) {
        const uid = auth.currentUser?.uid ?? '';
        const planId = `${uid}_${date}`;
        const optimistic = {
          ...slotData,
          id: `optimistic-${Date.now()}`,
          uid,
          planId,
          status: slotData.status ?? 'planned' as SlotStatus,
          sort_order: slotData.sort_order ?? 0,
          created_at: new Date().toISOString(),
          actual_logs: [],
        };
        queryClient.setQueryData<DailyPlanWithSlots>(qKey, {
          ...previous,
          time_slots: [...previous.time_slots, optimistic],
        });
      }
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(qKey, ctx.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: qKey }),
    retry: 1,
    retryDelay: 5000,
  });

  // ── updateSlotStatus ─────────────────────────────────────────
  const updateSlotStatus = useMutation({
    mutationFn: async ({ slotId, status }: { slotId: string; status: SlotStatus }) => {
      await updateDoc(getSlotRef(slotId), { status });
    },
    onMutate: async ({ slotId, status }) => {
      await queryClient.cancelQueries({ queryKey: qKey });
      const previous = queryClient.getQueryData<DailyPlanWithSlots>(qKey);
      if (previous) {
        queryClient.setQueryData<DailyPlanWithSlots>(qKey, {
          ...previous,
          time_slots: previous.time_slots.map((s) =>
            s.id === slotId ? { ...s, status } : s
          ),
        });
      }
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(qKey, ctx.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: qKey }),
    retry: 1,
    retryDelay: 5000,
  });

  // ── updateSlotTitle ──────────────────────────────────────────
  const updateSlotTitle = useMutation({
    mutationFn: async ({ slotId, title }: { slotId: string; title: string }) => {
      await updateDoc(getSlotRef(slotId), { title });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: qKey }),
    retry: 1,
    retryDelay: 5000,
  });

  // ── deleteSlot ───────────────────────────────────────────────
  const deleteSlot = useMutation({
    mutationFn: async (slotId: string) => {
      await deleteDoc(getSlotRef(slotId));
    },
    onMutate: async (slotId) => {
      await queryClient.cancelQueries({ queryKey: qKey });
      const previous = queryClient.getQueryData<DailyPlanWithSlots>(qKey);
      if (previous) {
        queryClient.setQueryData<DailyPlanWithSlots>(qKey, {
          ...previous,
          time_slots: previous.time_slots.filter((s) => s.id !== slotId),
        });
      }
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(qKey, ctx.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: qKey }),
  });

  // ── logActual ────────────────────────────────────────────────
  const logActual = useMutation({
    mutationFn: async ({
      slotId,
      start,
      end,
      note,
    }: {
      slotId: string;
      start: string;
      end?: string;
      note?: string;
    }) => {
      const logsRef = collection(getSlotRef(slotId), 'actual_logs');
      const docRef = await addDoc(logsRef, {
        actual_start: start,
        actual_end: end ?? null,
        note: note ?? null,
        created_at: serverTimestamp(),
      });
      return {
        id: docRef.id,
        actual_start: start,
        actual_end: end ?? null,
        note: note ?? null,
        created_at: new Date().toISOString(),
      };
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: qKey }),
    retry: 1,
    retryDelay: 5000,
  });

  // ── createActualEntry: 슬롯 생성 + actual_log 즉시 기록 ───────
  const createActualEntry = useMutation({
    mutationFn: async ({
      title,
      start_at,
      end_at,
      sort_order,
    }: {
      title: string;
      start_at: string;
      end_at: string;
      sort_order: number;
    }) => {
      const uid = auth.currentUser?.uid ?? '';
      const planId = `${uid}_${date}`;
      const slotsRef = collection(db, 'users', uid, 'daily_plans', planId, 'time_slots');
      const slotDoc = await addDoc(slotsRef, {
        uid,
        planId,
        title,
        start_at,
        end_at,
        status: 'done' as SlotStatus,
        sort_order,
        created_at: serverTimestamp(),
      });
      const logRef = await addDoc(collection(slotDoc, 'actual_logs'), {
        actual_start: start_at,
        actual_end: end_at,
        note: null,
        created_at: serverTimestamp(),
      });
      return {
        id: slotDoc.id,
        uid,
        planId,
        title,
        start_at,
        end_at,
        status: 'done' as SlotStatus,
        sort_order,
        created_at: new Date().toISOString(),
        actual_logs: [{
          id: logRef.id,
          actual_start: start_at,
          actual_end: end_at,
          note: null,
          created_at: new Date().toISOString(),
        }],
      };
    },
    onMutate: async ({ title, start_at, end_at, sort_order }) => {
      await queryClient.cancelQueries({ queryKey: qKey });
      const previous = queryClient.getQueryData<DailyPlanWithSlots>(qKey);
      if (previous) {
        const uid = auth.currentUser?.uid ?? '';
        const planId = `${uid}_${date}`;
        const optimistic = {
          id: `optimistic-${Date.now()}`,
          uid,
          planId,
          title,
          start_at,
          end_at,
          status: 'done' as SlotStatus,
          sort_order: sort_order ?? 0,
          created_at: new Date().toISOString(),
          actual_logs: [{
            id: `optimistic-log-${Date.now()}`,
            actual_start: start_at,
            actual_end: end_at,
            note: null,
            created_at: new Date().toISOString(),
          }],
        };
        queryClient.setQueryData<DailyPlanWithSlots>(qKey, {
          ...previous,
          time_slots: [...previous.time_slots, optimistic],
        });
      }
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(qKey, ctx.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: qKey }),
    retry: 1,
    retryDelay: 5000,
  });

  // ── updateActualLog: actual_log의 시간 수정 ──────────────────
  const updateActualLog = useMutation({
    mutationFn: async ({
      slotId,
      logId,
      actual_start,
      actual_end,
    }: {
      slotId: string;
      logId: string;
      actual_start: string;
      actual_end: string;
    }) => {
      const uid = auth.currentUser?.uid ?? '';
      const planId = `${uid}_${date}`;
      const logRef = doc(
        db,
        'users', uid,
        'daily_plans', planId,
        'time_slots', slotId,
        'actual_logs', logId,
      );
      await updateDoc(logRef, { actual_start, actual_end });
    },
    onMutate: async ({ slotId, logId, actual_start, actual_end }) => {
      await queryClient.cancelQueries({ queryKey: qKey });
      const previous = queryClient.getQueryData<DailyPlanWithSlots>(qKey);
      if (previous) {
        queryClient.setQueryData<DailyPlanWithSlots>(qKey, {
          ...previous,
          time_slots: previous.time_slots.map((s) =>
            s.id === slotId
              ? {
                  ...s,
                  actual_logs: s.actual_logs.map((l) =>
                    l.id === logId ? { ...l, actual_start, actual_end } : l
                  ),
                }
              : s
          ),
        });
      }
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(qKey, ctx.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: qKey }),
    retry: 1,
    retryDelay: 5000,
  });

  // ── updateActualDispTime: ACTUAL 전용 표시 위치 수정 ────────
  const updateActualDispTime = useMutation({
    mutationFn: async ({
      slotId,
      actual_disp_start,
      actual_disp_end,
    }: {
      slotId: string;
      actual_disp_start: string;
      actual_disp_end: string;
    }) => {
      await updateDoc(getSlotRef(slotId), { actual_disp_start, actual_disp_end });
    },
    onMutate: async ({ slotId, actual_disp_start, actual_disp_end }) => {
      await queryClient.cancelQueries({ queryKey: qKey });
      const previous = queryClient.getQueryData<DailyPlanWithSlots>(qKey);
      if (previous) {
        queryClient.setQueryData<DailyPlanWithSlots>(qKey, {
          ...previous,
          time_slots: previous.time_slots.map((s) =>
            s.id === slotId ? { ...s, actual_disp_start, actual_disp_end } : s
          ),
        });
      }
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(qKey, ctx.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: qKey }),
    retry: 1,
    retryDelay: 5000,
  });

  // ── updateSlotTime: 슬롯 시간(start_at/end_at) 수정 ─────────
  const updateSlotTime = useMutation({
    mutationFn: async ({
      slotId,
      start_at,
      end_at,
    }: {
      slotId: string;
      start_at: string;
      end_at: string;
    }) => {
      await updateDoc(getSlotRef(slotId), { start_at, end_at });
    },
    onMutate: async ({ slotId, start_at, end_at }) => {
      await queryClient.cancelQueries({ queryKey: qKey });
      const previous = queryClient.getQueryData<DailyPlanWithSlots>(qKey);
      if (previous) {
        queryClient.setQueryData<DailyPlanWithSlots>(qKey, {
          ...previous,
          time_slots: previous.time_slots.map((s) =>
            s.id === slotId ? { ...s, start_at, end_at } : s
          ),
        });
      }
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(qKey, ctx.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: qKey }),
    retry: 1,
    retryDelay: 5000,
  });

  return { createSlot, updateSlotStatus, updateSlotTitle, deleteSlot, logActual, createActualEntry, updateActualLog, updateSlotTime, updateActualDispTime };
}
