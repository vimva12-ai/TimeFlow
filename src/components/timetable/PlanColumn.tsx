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

interface ResizeData {
  slotId: string;
  edge: 'top' | 'bottom';
  fixedOffsetMin: number; // minutes from startHour*60
  date: string;
}

interface ResizePreview {
  top: number;
  height: number;
}

const LONG_PRESS_MS = 300;
const CANCEL_MOVE_PX = 8;
const HANDLE_PX = 8;
const MIN_DURATION_MIN = 5;

export default function PlanColumn({ slots, date, onMoveSlot }: PlanColumnProps) {
  const { setEditingSlotId, startHour, endHour, slotHeight } = useTimetableStore();
  const totalSlots = ((endHour - startHour) * 60) / SLOT_MINUTES;
  const columnRef = useRef<HTMLDivElement>(null);
  const ppm = slotHeight / SLOT_MINUTES; // pixels per minute

  // Drag state
  const [draggingSlotId, setDraggingSlotId] = useState<string | null>(null);
  const [previewIdx, setPreviewIdx] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const longPressedRef = useRef(false);
  const dragDataRef = useRef<DragData | null>(null);

  // Resize state
  const [resizingSlotId, setResizingSlotId] = useState<string | null>(null);
  const [resizePreview, setResizePreview] = useState<ResizePreview | null>(null);
  const resizeDataRef = useRef<ResizeData | null>(null);

  function clearTimer() {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
  }

  // ---- Drag helpers ----
  function snapMin(clientY: number, d: DragData): number {
    const relY = clientY - d.columnRect.top - d.offsetY;
    const totalMins = totalSlots * SLOT_MINUTES;
    const raw = Math.max(0, Math.min(totalMins - 1, Math.round(relY / ppm)));
    const nearest30 = Math.round(raw / SLOT_MINUTES) * SLOT_MINUTES;
    return Math.abs(raw - nearest30) <= 5
      ? Math.max(0, Math.min(totalMins - 1, nearest30))
      : raw;
  }

  function buildNewTimes(offsetMin: number, durationMin: number) {
    const totalMins = startHour * 60 + offsetMin;
    const h = Math.floor(totalMins / 60) % 24;
    const m = totalMins % 60;
    const newStart = new Date(`${date}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`);
    return { newStart: newStart.toISOString(), newEnd: addMinutes(newStart, durationMin).toISOString() };
  }

  // ---- Resize helpers ----
  function snapMinForResize(clientY: number): number {
    const rect = columnRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    const relY = clientY - rect.top;
    const totalMins = totalSlots * SLOT_MINUTES;
    const raw = Math.max(0, Math.min(totalMins, Math.round(relY / ppm)));
    const nearest30 = Math.round(raw / SLOT_MINUTES) * SLOT_MINUTES;
    return Math.abs(raw - nearest30) <= 5
      ? Math.max(0, Math.min(totalMins, nearest30))
      : raw;
  }

  function calcResizePreview(movingOffsetMin: number, fixedOffsetMin: number, edge: 'top' | 'bottom'): ResizePreview {
    if (edge === 'top') {
      const startMin = Math.min(movingOffsetMin, fixedOffsetMin - MIN_DURATION_MIN);
      return { top: startMin * ppm + 1, height: Math.max(2, (fixedOffsetMin - startMin) * ppm - 2) };
    } else {
      const endMin = Math.max(movingOffsetMin, fixedOffsetMin + MIN_DURATION_MIN);
      return { top: fixedOffsetMin * ppm + 1, height: Math.max(2, (endMin - fixedOffsetMin) * ppm - 2) };
    }
  }

  function buildResizeTimes(movingOffsetMin: number, fixedOffsetMin: number, edge: 'top' | 'bottom', dateStr: string) {
    const startOffsetMin = edge === 'top' ? Math.min(movingOffsetMin, fixedOffsetMin - MIN_DURATION_MIN) : fixedOffsetMin;
    const endOffsetMin = edge === 'top' ? fixedOffsetMin : Math.max(movingOffsetMin, fixedOffsetMin + MIN_DURATION_MIN);
    const absStart = startHour * 60 + startOffsetMin;
    const absEnd = startHour * 60 + endOffsetMin;
    const fmt = (mins: number) =>
      `${String(Math.floor(mins / 60) % 24).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
    const newStart = new Date(`${dateStr}T${fmt(absStart)}:00`);
    const newEnd = new Date(`${dateStr}T${fmt(absEnd)}:00`);
    return { newStart: newStart.toISOString(), newEnd: newEnd.toISOString() };
  }

  // ---- Drag handlers ----
  function handlePointerDown(e: React.PointerEvent, slot: TimeSlotWithLogs, top: number) {
    if (resizeDataRef.current) return; // don't start drag during resize
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
      setPreviewIdx(Math.round(top / ppm));
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
      e.preventDefault();
      const d = dragDataRef.current;
      // 손가락이 실제로 충분히 이동했을 때만 드래그 커밋
      const totalDy = startPosRef.current ? Math.abs(e.clientY - startPosRef.current.y) : CANCEL_MOVE_PX;
      const didDrag = totalDy >= CANCEL_MOVE_PX;
      if (d && onMoveSlot && didDrag) {
        const { newStart, newEnd } = buildNewTimes(snapMin(e.clientY, d), d.durationMin);
        onMoveSlot(d.slotId, newStart, newEnd);
      } else if (!didDrag) {
        // 이동 없는 롱프레스 → 탭으로 간주하여 편집창 열기
        setEditingSlotId(slot.id);
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

  // ---- Resize handlers ----
  function handleResizePointerDown(e: React.PointerEvent, slot: TimeSlotWithLogs, edge: 'top' | 'bottom') {
    e.stopPropagation();
    e.preventDefault();
    const rect = columnRef.current?.getBoundingClientRect();
    if (!rect) return;

    const top = slotIndex(slot.start_at, startHour) * slotHeight;
    const height = slotSpan(slot.start_at, slot.end_at) * slotHeight;
    const startOffsetMin = Math.round(top / ppm);
    const endOffsetMin = Math.round((top + height) / ppm);
    const fixedOffsetMin = edge === 'top' ? endOffsetMin : startOffsetMin;

    resizeDataRef.current = { slotId: slot.id, edge, fixedOffsetMin, date: slot.start_at.slice(0, 10) };
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch {}

    const movingOffsetMin = edge === 'top' ? startOffsetMin : endOffsetMin;
    setResizingSlotId(slot.id);
    setResizePreview(calcResizePreview(movingOffsetMin, fixedOffsetMin, edge));
  }

  function handleResizePointerMove(e: React.PointerEvent) {
    const d = resizeDataRef.current;
    if (!d) return;
    setResizePreview(calcResizePreview(snapMinForResize(e.clientY), d.fixedOffsetMin, d.edge));
  }

  function handleResizePointerUp(e: React.PointerEvent) {
    const d = resizeDataRef.current;
    if (!d) return;
    e.preventDefault();
    const { newStart, newEnd } = buildResizeTimes(snapMinForResize(e.clientY), d.fixedOffsetMin, d.edge, d.date);
    onMoveSlot?.(d.slotId, newStart, newEnd);
    resizeDataRef.current = null;
    setResizingSlotId(null);
    setResizePreview(null);
  }

  function handleResizePointerCancel() {
    resizeDataRef.current = null;
    setResizingSlotId(null);
    setResizePreview(null);
  }

  const dragSlot = draggingSlotId ? slots.find((s) => s.id === draggingSlotId) : null;

  return (
    <div ref={columnRef} className="relative w-full" style={{ height: totalSlots * slotHeight }}>
      {slots.map((slot) => {
        const top = slotIndex(slot.start_at, startHour) * slotHeight;
        const height = slotSpan(slot.start_at, slot.end_at) * slotHeight;
        const isDragging = draggingSlotId === slot.id;
        const isResizing = resizingSlotId === slot.id;
        const busy = (draggingSlotId !== null && !isDragging) || (resizingSlotId !== null && !isResizing);

        return (
          <div
            key={slot.id}
            data-slot="true"
            data-plan-slot={slot.id}
            className={clsx(
              'absolute left-0.5 right-0.5 rounded-sm border-l-4 px-1.5 text-left text-[11px] overflow-hidden z-[2] select-none',
              statusColor(slot.status),
              (isDragging || isResizing) ? 'opacity-30' : 'hover:opacity-80',
              busy ? 'pointer-events-none' : 'cursor-grab active:cursor-grabbing',
            )}
            style={{ top: top + 1, height: height - 2, touchAction: 'none' }}
            onPointerDown={(e) => handlePointerDown(e, slot, top)}
            onPointerMove={handlePointerMove}
            onPointerUp={(e) => handlePointerUp(e, slot)}
            onPointerCancel={handlePointerCancel}
          >
            {/* 상단 리사이즈 핸들 */}
            <div
              data-slot="true"
              data-resize-handle="top"
              className="absolute top-0 left-0 right-0 z-[3] flex items-start justify-center cursor-ns-resize"
              style={{ height: HANDLE_PX, touchAction: 'none' }}
              onPointerDown={(e) => handleResizePointerDown(e, slot, 'top')}
              onPointerMove={handleResizePointerMove}
              onPointerUp={handleResizePointerUp}
              onPointerCancel={handleResizePointerCancel}
            >
              <div className="w-5 h-px bg-current opacity-25 hover:opacity-60 mt-[3px] transition-opacity" />
            </div>

            <div className="font-semibold truncate leading-tight pointer-events-none" style={{ paddingTop: 3 }}>{slot.title}</div>
            {height >= 36 && (
              <div className="opacity-70 text-[10px] leading-tight pointer-events-none">
                {format(parseISO(slot.start_at), 'HH:mm')}–{format(parseISO(slot.end_at), 'HH:mm')}
              </div>
            )}
            {height >= 52 && (
              <div className="text-[9px] opacity-60 leading-tight pointer-events-none">{statusLabel(slot.status)}</div>
            )}

            {/* 하단 리사이즈 핸들 */}
            <div
              data-slot="true"
              data-resize-handle="bottom"
              className="absolute bottom-0 left-0 right-0 z-[3] flex items-end justify-center cursor-ns-resize"
              style={{ height: HANDLE_PX, touchAction: 'none' }}
              onPointerDown={(e) => handleResizePointerDown(e, slot, 'bottom')}
              onPointerMove={handleResizePointerMove}
              onPointerUp={handleResizePointerUp}
              onPointerCancel={handleResizePointerCancel}
            >
              <div className="w-5 h-px bg-current opacity-25 hover:opacity-60 mb-[3px] transition-opacity" />
            </div>
          </div>
        );
      })}

      {/* 드래그 미리보기 */}
      {draggingSlotId && dragSlot && (() => {
        const h = slotSpan(dragSlot.start_at, dragSlot.end_at) * slotHeight;
        return (
          <div
            className="absolute left-0.5 right-0.5 rounded-sm border-2 border-dashed border-blue-500 bg-blue-100/70 dark:bg-blue-900/50 z-[5] pointer-events-none"
            style={{ top: previewIdx * ppm + 1, height: h - 2 }}
          >
            <div className="text-[10px] font-semibold text-blue-700 dark:text-blue-300 px-1 pt-0.5 truncate">
              {dragSlot.title}
            </div>
          </div>
        );
      })()}

      {/* 리사이즈 미리보기 */}
      {resizingSlotId && resizePreview && (
        <div
          className="absolute left-0.5 right-0.5 rounded-sm border-2 border-dashed border-violet-500 bg-violet-100/70 dark:bg-violet-900/50 z-[5] pointer-events-none"
          style={{ top: resizePreview.top, height: resizePreview.height }}
        />
      )}
    </div>
  );
}
