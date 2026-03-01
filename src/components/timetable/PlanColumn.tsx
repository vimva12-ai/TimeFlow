'use client';

import { useState, useRef, useEffect } from 'react';
import clsx from 'clsx';
import { format, parseISO, addMinutes, differenceInMinutes } from 'date-fns';
import { useTimetableStore } from '@/store/timetableStore';
import { type TimeSlotWithLogs } from '@/types/database';
import { SLOT_MINUTES, slotIndex, slotSpan } from './TimeGrid';

function statusColor(status: string) {
  switch (status) {
    case 'done':    return 'bg-green-200 border-green-500 text-green-900 dark:bg-green-900/50 dark:border-green-400 dark:text-green-100';
    case 'partial': return 'bg-orange-200 border-orange-500 text-orange-900 dark:bg-orange-900/50 dark:border-orange-400 dark:text-orange-100';
    case 'skipped': return 'bg-gray-200 border-gray-400 text-gray-500 dark:bg-gray-700 dark:border-gray-500 line-through';
    default:        return 'bg-blue-100 border-blue-500 text-blue-900 dark:bg-blue-900/40 dark:border-blue-400 dark:text-blue-100';
  }
}

function statusLabel(status: string) {
  switch (status) {
    case 'done':    return '완료';
    case 'partial': return '부분';
    case 'skipped': return '건너뜀';
    default:        return '계획';
  }
}

interface PlanColumnProps {
  slots: TimeSlotWithLogs[];
  planId: string;
  date: string;
  onMoveSlot?: (slotId: string, newStart: string, newEnd: string) => void;
}

interface DragData {
  slotId: string;
  durationMin: number;
  offsetY: number;
  columnRect: DOMRect;
}

const LONG_PRESS_MS = 450;
const CANCEL_MOVE_PX = 8;

export default function PlanColumn({ slots, date, onMoveSlot }: PlanColumnProps) {
  const { setEditingSlotId, startHour, endHour, slotHeight } = useTimetableStore();
  const totalSlots = ((endHour - startHour) * 60) / SLOT_MINUTES;
  const columnRef = useRef<HTMLDivElement>(null);

  // 드래그 중인 슬롯 ID (UI 트리거 역할만, 변경 시에만 window 리스너 재등록)
  const [draggingSlotId, setDraggingSlotId] = useState<string | null>(null);
  // 미리보기 위치 (별도 state - 리스너 재등록 없이 DOM만 업데이트)
  const [previewIdx, setPreviewIdx] = useState(0);

  // ref로 관리: 렌더 트리거 없이 최신값 유지
  const dragDataRef = useRef<DragData | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const longPressedRef = useRef(false);

  function clearTimer() {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
  }

  function snapIdxFromClientY(clientY: number, d: DragData) {
    const relY = clientY - d.columnRect.top - d.offsetY;
    return Math.max(0, Math.min(totalSlots - 1, Math.floor(relY / slotHeight)));
  }

  function buildNewTimes(idx: number, durationMin: number) {
    const totalMins = startHour * 60 + idx * SLOT_MINUTES;
    const h = Math.floor(totalMins / 60) % 24;
    const m = totalMins % 60;
    const newStart = new Date(`${date}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`);
    return { newStart: newStart.toISOString(), newEnd: addMinutes(newStart, durationMin).toISOString() };
  }

  // ── window 리스너: draggingSlotId 변경 시에만 attach/detach ──
  useEffect(() => {
    if (!draggingSlotId) return;

    function onMouseMove(e: MouseEvent) {
      const d = dragDataRef.current;
      if (!d) return;
      setPreviewIdx(snapIdxFromClientY(e.clientY, d));
    }

    function onMouseUp(e: MouseEvent) {
      const d = dragDataRef.current;
      if (d && onMoveSlot) {
        const { newStart, newEnd } = buildNewTimes(snapIdxFromClientY(e.clientY, d), d.durationMin);
        onMoveSlot(d.slotId, newStart, newEnd);
      }
      dragDataRef.current = null;
      longPressedRef.current = false;
      setDraggingSlotId(null);
    }

    function onTouchMove(e: TouchEvent) {
      e.preventDefault();
      const d = dragDataRef.current;
      if (!d) return;
      setPreviewIdx(snapIdxFromClientY(e.touches[0].clientY, d));
    }

    function onTouchEnd(e: TouchEvent) {
      const d = dragDataRef.current;
      if (d && onMoveSlot) {
        const { newStart, newEnd } = buildNewTimes(snapIdxFromClientY(e.changedTouches[0].clientY, d), d.durationMin);
        onMoveSlot(d.slotId, newStart, newEnd);
      }
      dragDataRef.current = null;
      longPressedRef.current = false;
      setDraggingSlotId(null);
    }

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draggingSlotId]); // draggingSlotId 변경 시에만! mousemove마다 재등록 방지

  // ── 컨테이너 수준 non-passive touchstart (스크롤 방지) ──
  useEffect(() => {
    const el = columnRef.current;
    if (!el) return;

    function handleTouchStart(e: TouchEvent) {
      const slotEl = (e.target as Element).closest('[data-plan-slot]');
      if (!slotEl) return;
      const slotId = slotEl.getAttribute('data-plan-slot')!;
      const slot = slots.find((s) => s.id === slotId);
      if (!slot) return;

      const touch = e.touches[0];
      startPosRef.current = { x: touch.clientX, y: touch.clientY };
      longPressedRef.current = false;
      clearTimer();

      timerRef.current = setTimeout(() => {
        const rect = el!.getBoundingClientRect();
        const top = slotIndex(slot.start_at, startHour) * slotHeight;
        const durationMin = Math.max(30, differenceInMinutes(parseISO(slot.end_at), parseISO(slot.start_at)));
        longPressedRef.current = true;
        dragDataRef.current = {
          slotId: slot.id,
          durationMin,
          offsetY: touch.clientY - rect.top - top,
          columnRect: rect,
        };
        setPreviewIdx(Math.round(top / slotHeight));
        setDraggingSlotId(slot.id);
      }, LONG_PRESS_MS);
    }

    el?.addEventListener('touchstart', handleTouchStart, { passive: false });
    return () => el?.removeEventListener('touchstart', handleTouchStart);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots, slotHeight, startHour]);

  // ── 마우스 핸들러 (요소별) ──
  function handleMouseDown(e: React.MouseEvent, slot: TimeSlotWithLogs, top: number) {
    if (e.button !== 0) return;
    e.preventDefault();
    startPosRef.current = { x: e.clientX, y: e.clientY };
    longPressedRef.current = false;
    clearTimer();

    timerRef.current = setTimeout(() => {
      const rect = columnRef.current?.getBoundingClientRect();
      if (!rect) return;
      const durationMin = Math.max(30, differenceInMinutes(parseISO(slot.end_at), parseISO(slot.start_at)));
      longPressedRef.current = true;
      dragDataRef.current = {
        slotId: slot.id,
        durationMin,
        offsetY: e.clientY - rect.top - top,
        columnRect: rect,
      };
      setPreviewIdx(Math.round(top / slotHeight));
      setDraggingSlotId(slot.id);
    }, LONG_PRESS_MS);
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (longPressedRef.current || !startPosRef.current) return;
    const dx = Math.abs(e.clientX - startPosRef.current.x);
    const dy = Math.abs(e.clientY - startPosRef.current.y);
    if (dx > CANCEL_MOVE_PX || dy > CANCEL_MOVE_PX) clearTimer();
  }

  function handleMouseUp(slot: TimeSlotWithLogs) {
    clearTimer();
    if (!longPressedRef.current) {
      setEditingSlotId(slot.id);
    }
    // 드래그 중이었으면 window mouseup이 처리
  }

  const dragSlot = draggingSlotId ? slots.find((s) => s.id === draggingSlotId) : null;

  return (
    <div ref={columnRef} className="relative w-full" style={{ height: totalSlots * slotHeight }}>
      {slots.map((slot) => {
        const top = slotIndex(slot.start_at, startHour) * slotHeight;
        const height = slotSpan(slot.start_at, slot.end_at) * slotHeight;
        const isDragging = draggingSlotId === slot.id;

        return (
          <div
            key={slot.id}
            data-slot="true"
            data-plan-slot={slot.id}
            className={clsx(
              'absolute left-0.5 right-0.5 rounded-sm border-l-4 px-1.5 text-left text-[11px] overflow-hidden z-[2] select-none',
              statusColor(slot.status),
              isDragging ? 'opacity-30' : 'hover:opacity-80',
              draggingSlotId && !isDragging ? 'pointer-events-none' : 'cursor-grab active:cursor-grabbing',
            )}
            style={{ top: top + 1, height: height - 2, touchAction: 'none' }}
            onMouseDown={(e) => handleMouseDown(e, slot, top)}
            onMouseMove={handleMouseMove}
            onMouseUp={() => handleMouseUp(slot)}
            onMouseLeave={clearTimer}
          >
            <div className="font-semibold truncate leading-tight pointer-events-none">{slot.title}</div>
            {height >= 36 && (
              <div className="opacity-70 text-[10px] leading-tight pointer-events-none">
                {format(parseISO(slot.start_at), 'HH:mm')}–{format(parseISO(slot.end_at), 'HH:mm')}
              </div>
            )}
            {height >= 52 && (
              <div className="text-[9px] opacity-60 leading-tight pointer-events-none">{statusLabel(slot.status)}</div>
            )}
          </div>
        );
      })}

      {/* 드래그 미리보기 */}
      {draggingSlotId && dragSlot && (() => {
        const h = slotSpan(dragSlot.start_at, dragSlot.end_at) * slotHeight;
        return (
          <div
            className="absolute left-0.5 right-0.5 rounded-sm border-2 border-dashed border-blue-500 bg-blue-100/70 dark:bg-blue-900/50 z-[5] pointer-events-none"
            style={{ top: previewIdx * slotHeight + 1, height: h - 2 }}
          >
            <div className="text-[10px] font-semibold text-blue-700 dark:text-blue-300 px-1 pt-0.5 truncate">
              {dragSlot.title}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
