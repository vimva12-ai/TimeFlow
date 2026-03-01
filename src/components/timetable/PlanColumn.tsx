'use client';

import { useState, useRef, useCallback, useEffect, memo } from 'react';
import clsx from 'clsx';
import { format, parseISO, addMinutes } from 'date-fns';
import { useTimetableStore } from '@/store/timetableStore';
import { type TimeSlotWithLogs } from '@/types/database';
import { SLOT_MINUTES, slotIndex, slotSpan } from './TimeGrid';
import { useLongPress } from '@/hooks/useLongPress';

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

interface SlotButtonProps {
  slot: TimeSlotWithLogs;
  top: number;
  height: number;
  isDragging: boolean;
  isAnyDragging: boolean;
  onLongPressStart: (e: React.MouseEvent | React.TouchEvent) => void;
  onClickSlot: () => void;
}

const SlotButton = memo(function SlotButton({
  slot, top, height, isDragging, isAnyDragging, onLongPressStart, onClickSlot,
}: SlotButtonProps) {
  const handlers = useLongPress({
    threshold: 500,
    onLongPress: onLongPressStart,
    onClick: onClickSlot,
  });

  return (
    <button
      data-slot="true"
      {...handlers}
      className={clsx(
        'absolute left-0.5 right-0.5 rounded-sm border-l-4 px-1.5 text-left text-[11px] overflow-hidden transition-opacity z-[2] select-none',
        statusColor(slot.status),
        isDragging ? 'opacity-30' : 'hover:opacity-80',
        isAnyDragging && !isDragging ? 'pointer-events-none' : '',
      )}
      style={{ top: top + 1, height: height - 2, cursor: isDragging ? 'grabbing' : 'grab', touchAction: 'none' }}
    >
      <div className="font-semibold truncate leading-tight">{slot.title}</div>
      {height >= 36 && (
        <div className="opacity-70 text-[10px] leading-tight">
          {format(parseISO(slot.start_at), 'HH:mm')}–{format(parseISO(slot.end_at), 'HH:mm')}
        </div>
      )}
      {height >= 52 && (
        <div className="text-[9px] opacity-60 leading-tight">{statusLabel(slot.status)}</div>
      )}
    </button>
  );
});

interface PlanColumnProps {
  slots: TimeSlotWithLogs[];
  planId: string;
  date: string;
  onMoveSlot?: (slotId: string, newStart: string, newEnd: string) => void;
}

interface DragState {
  slotId: string;
  slotHeightPx: number;
  slotDurationMin: number;
  offsetY: number;
  currentY: number;
  columnRect: DOMRect;
}

export default function PlanColumn({ slots, planId, date, onMoveSlot }: PlanColumnProps) {
  const { setEditingSlotId, startHour, endHour, slotHeight } = useTimetableStore();
  const totalSlots = ((endHour - startHour) * 60) / SLOT_MINUTES;
  const columnRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);

  useEffect(() => { dragRef.current = drag; }, [drag]);

  const snapIndex = useCallback((clientY: number, offsetY: number, rect: DOMRect) => {
    const relY = clientY - rect.top - offsetY;
    return Math.max(0, Math.min(totalSlots - 1, Math.floor(relY / slotHeight)));
  }, [totalSlots, slotHeight]);

  const commitDrop = useCallback((clientY: number) => {
    const d = dragRef.current;
    if (!d || !onMoveSlot) { setDrag(null); return; }
    const idx = snapIndex(clientY, d.offsetY, d.columnRect);
    const totalMins = startHour * 60 + idx * SLOT_MINUTES;
    const h = Math.floor(totalMins / 60) % 24;
    const m = totalMins % 60;
    const newStart = new Date(`${date}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`);
    const newEnd = addMinutes(newStart, d.slotDurationMin);
    onMoveSlot(d.slotId, newStart.toISOString(), newEnd.toISOString());
    setDrag(null);
  }, [date, snapIndex, startHour, onMoveSlot]);

  useEffect(() => {
    if (!drag) return;
    const onMouseMove = (e: MouseEvent) => {
      setDrag((prev) => prev ? { ...prev, currentY: e.clientY } : null);
    };
    const onMouseUp = (e: MouseEvent) => commitDrop(e.clientY);
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      setDrag((prev) => prev ? { ...prev, currentY: e.touches[0].clientY } : null);
    };
    const onTouchEnd = (e: TouchEvent) => commitDrop(e.changedTouches[0].clientY);

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
  }, [drag, commitDrop]);

  // 드래그 미리보기 위치
  let dragPreviewTop = 0;
  let dragSlot: TimeSlotWithLogs | null = null;
  if (drag) {
    dragSlot = slots.find((s) => s.id === drag.slotId) ?? null;
    const idx = snapIndex(drag.currentY, drag.offsetY, drag.columnRect);
    dragPreviewTop = idx * slotHeight;
  }

  return (
    <div ref={columnRef} className="relative w-full" style={{ height: totalSlots * slotHeight }}>
      {slots.map((slot) => {
        const top = slotIndex(slot.start_at, startHour) * slotHeight;
        const height = slotSpan(slot.start_at, slot.end_at) * slotHeight;
        const isDragging = drag?.slotId === slot.id;

        function handleLongPressStart(e: React.MouseEvent | React.TouchEvent) {
          e.stopPropagation();
          const rect = columnRef.current?.getBoundingClientRect();
          if (!rect) return;
          const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
          const durationMin = (new Date(slot.end_at).getTime() - new Date(slot.start_at).getTime()) / 60000;
          const offsetY = clientY - rect.top - top;
          setDrag({ slotId: slot.id, slotHeightPx: height, slotDurationMin: durationMin, offsetY, currentY: clientY, columnRect: rect });
        }

        return (
          <SlotButton
            key={slot.id}
            slot={slot}
            top={top}
            height={height}
            isDragging={isDragging}
            isAnyDragging={!!drag}
            onLongPressStart={handleLongPressStart}
            onClickSlot={() => setEditingSlotId(slot.id)}
          />
        );
      })}

      {/* 드래그 미리보기 */}
      {drag && dragSlot && (
        <div
          className="absolute left-0.5 right-0.5 rounded-sm border-2 border-dashed border-blue-500 bg-blue-200/50 dark:bg-blue-900/40 z-[5] pointer-events-none"
          style={{ top: dragPreviewTop + 1, height: drag.slotHeightPx - 2 }}
        >
          <div className="text-[10px] font-semibold text-blue-700 dark:text-blue-300 px-1 pt-0.5 truncate">
            {dragSlot.title}
          </div>
        </div>
      )}
    </div>
  );
}
