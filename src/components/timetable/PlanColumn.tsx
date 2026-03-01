'use client';

import { useState, useRef } from 'react';
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

const LONG_PRESS_MS = 300;
const CANCEL_MOVE_PX = 8;

export default function PlanColumn({ slots, date, onMoveSlot }: PlanColumnProps) {
  const { setEditingSlotId, startHour, endHour, slotHeight } = useTimetableStore();
  const totalSlots = ((endHour - startHour) * 60) / SLOT_MINUTES;
  const columnRef = useRef<HTMLDivElement>(null);

  const [draggingSlotId, setDraggingSlotId] = useState<string | null>(null);
  const [previewIdx, setPreviewIdx] = useState(0);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const longPressedRef = useRef(false);
  const dragDataRef = useRef<DragData | null>(null);

  function clearTimer() {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
  }

  function snapMin(clientY: number, d: DragData): number {
    const relY = clientY - d.columnRect.top - d.offsetY;
    const totalMins = totalSlots * SLOT_MINUTES;
    return Math.max(0, Math.min(totalMins - 1, Math.round(relY / (slotHeight / SLOT_MINUTES))));
  }

  function buildNewTimes(offsetMin: number, durationMin: number) {
    const totalMins = startHour * 60 + offsetMin;
    const h = Math.floor(totalMins / 60) % 24;
    const m = totalMins % 60;
    const newStart = new Date(`${date}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`);
    return { newStart: newStart.toISOString(), newEnd: addMinutes(newStart, durationMin).toISOString() };
  }

  function handlePointerDown(e: React.PointerEvent, slot: TimeSlotWithLogs, top: number) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    startPosRef.current = { x: e.clientX, y: e.clientY };
    longPressedRef.current = false;
    clearTimer();

    const el = e.currentTarget as HTMLElement;
    const pointerId = e.pointerId;
    const initY = e.clientY;

    timerRef.current = setTimeout(() => {
      const rect = columnRef.current?.getBoundingClientRect();
      if (!rect) return;
      const durationMin = Math.max(1, differenceInMinutes(parseISO(slot.end_at), parseISO(slot.start_at)));
      longPressedRef.current = true;
      dragDataRef.current = { slotId: slot.id, durationMin, offsetY: initY - rect.top - top, columnRect: rect };
      try { el.setPointerCapture(pointerId); } catch {}
      setPreviewIdx(Math.round(top / (slotHeight / SLOT_MINUTES)));
      setDraggingSlotId(slot.id);
    }, LONG_PRESS_MS);
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!longPressedRef.current) {
      if (startPosRef.current) {
        const dx = Math.abs(e.clientX - startPosRef.current.x);
        const dy = Math.abs(e.clientY - startPosRef.current.y);
        if (dx > CANCEL_MOVE_PX || dy > CANCEL_MOVE_PX) clearTimer();
      }
      return;
    }
    const d = dragDataRef.current;
    if (d) setPreviewIdx(snapMin(e.clientY, d));
  }

  function handlePointerUp(e: React.PointerEvent, slot: TimeSlotWithLogs) {
    clearTimer();
    if (longPressedRef.current) {
      const d = dragDataRef.current;
      if (d && onMoveSlot) {
        const { newStart, newEnd } = buildNewTimes(snapMin(e.clientY, d), d.durationMin);
        onMoveSlot(d.slotId, newStart, newEnd);
      }
      dragDataRef.current = null;
      longPressedRef.current = false;
      setDraggingSlotId(null);
    } else {
      setEditingSlotId(slot.id);
    }
    startPosRef.current = null;
  }

  function handlePointerCancel() {
    clearTimer();
    dragDataRef.current = null;
    longPressedRef.current = false;
    setDraggingSlotId(null);
    startPosRef.current = null;
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
            onPointerDown={(e) => handlePointerDown(e, slot, top)}
            onPointerMove={handlePointerMove}
            onPointerUp={(e) => handlePointerUp(e, slot)}
            onPointerCancel={handlePointerCancel}
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
            style={{ top: previewIdx * (slotHeight / SLOT_MINUTES) + 1, height: h - 2 }}
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
