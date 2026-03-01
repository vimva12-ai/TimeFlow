'use client';

import { useState, useEffect, useRef, memo } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { format, parseISO, differenceInMinutes, addMinutes } from 'date-fns';
import { CheckCircle, SkipForward, AlertCircle, Play, Pause, RotateCcw, Clock } from 'lucide-react';
import { type TimeSlotWithLogs, type SlotStatus } from '@/types/database';
import { SLOT_MINUTES, slotIndex, slotSpan } from './TimeGrid';
import { useTimetableStore } from '@/store/timetableStore';

interface ActualColumnProps {
  slots: TimeSlotWithLogs[];
  onStart: (slotId: string) => void;
  onComplete: (slotId: string, status: SlotStatus, end: string) => void;
  onChangeStatus: (slotId: string, status: SlotStatus) => void;
  onUpdateLog?: (slotId: string, logId: string, actualStart: string, actualEnd: string) => void;
  onMoveSlot?: (slotId: string, newStart: string, newEnd: string) => void;
}

function punctualityLabel(plannedStart: string, actualStart: string): string {
  const diffMin = differenceInMinutes(parseISO(actualStart), parseISO(plannedStart));
  if (Math.abs(diffMin) <= 15) return '정시';
  if (diffMin > 0) return `${diffMin}분 지연`;
  return `${Math.abs(diffMin)}분 일찍`;
}

function getDisplayTimes(slot: TimeSlotWithLogs): { displayStart: string; displayEnd: string } {
  const log = slot.actual_logs[0] ?? null;
  if (!log?.actual_start) return { displayStart: slot.start_at, displayEnd: slot.end_at };
  if (log.actual_end) return { displayStart: log.actual_start, displayEnd: log.actual_end };
  const plannedDurationMin = differenceInMinutes(parseISO(slot.end_at), parseISO(slot.start_at));
  return { displayStart: log.actual_start, displayEnd: addMinutes(parseISO(log.actual_start), plannedDurationMin).toISOString() };
}

const ACTION_THRESHOLD = 60;
const LONG_PRESS_MS = 450;
const CANCEL_MOVE_PX = 8;

type PopupState = { slotId: string; type: 'progress' | 'edit'; x: number; y: number } | null;
type EditTimeState = { slotId: string; logId: string; startVal: string; endVal: string; date: string } | null;
type PauseMap = Record<string, string>;

interface DragData {
  slotId: string;
  durationMin: number;
  offsetY: number;
  columnRect: DOMRect;
}

// ── 슬롯 내부 UI (메모화, 드래그 핸들러는 부모에서 주입) ──────────
interface SlotContentProps {
  slot: TimeSlotWithLogs;
  height: number;
  isPaused: boolean;
  isDragging: boolean;
  isAnyDragging: boolean;
  onOpenPopup: (e: React.MouseEvent, type: 'progress' | 'edit') => void;
  onStartSlot: () => void;
  onPause: () => void;
  onResume: () => void;
  onComplete: (status: SlotStatus) => void;
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseMove: (e: React.MouseEvent) => void;
  onMouseUp: (e: React.MouseEvent) => void;
  onMouseLeave: () => void;
  top: number;
}

const SlotContent = memo(function SlotContent({
  slot, height, isPaused, isDragging, isAnyDragging,
  onOpenPopup, onStartSlot, onPause, onResume, onComplete,
  onMouseDown, onMouseMove, onMouseUp, onMouseLeave, top,
}: SlotContentProps) {
  const log = slot.actual_logs[0] ?? null;
  const hasStarted = !!log?.actual_start;
  const hasEnded = !!log?.actual_end;
  const showInline = hasStarted && !hasEnded && height >= ACTION_THRESHOLD;
  const showCompact = hasStarted && !hasEnded && height < ACTION_THRESHOLD;
  const canDrag = !hasStarted || hasEnded;

  return (
    <div
      data-slot="true"
      data-actual-slot={slot.id}
      className={clsx(
        'absolute left-0.5 right-0.5 rounded-sm border border-gray-300 dark:border-gray-600 overflow-hidden z-[2] select-none',
        isDragging ? 'opacity-30' : '',
        isAnyDragging && !isDragging ? 'pointer-events-none' : '',
        canDrag && !isDragging ? 'cursor-grab active:cursor-grabbing' : '',
      )}
      style={{ top: top + 1, height: height - 2, touchAction: 'none' }}
      onMouseDown={canDrag ? onMouseDown : undefined}
      onMouseMove={canDrag ? onMouseMove : undefined}
      onMouseUp={canDrag ? onMouseUp : undefined}
      onMouseLeave={canDrag ? onMouseLeave : undefined}
    >
      {!hasStarted ? (
        <button
          onClick={onStartSlot}
          className="w-full h-full flex items-center justify-center gap-1 text-[11px] text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
        >
          <Play className="w-3 h-3 shrink-0" />
          {height >= 32 ? '시작' : ''}
        </button>
      ) : showInline ? (
        <div className={clsx('flex flex-col h-full p-0.5 gap-0.5', isPaused ? 'bg-yellow-50/80 dark:bg-yellow-900/20' : 'bg-blue-50/80 dark:bg-blue-900/20')}>
          <div className={clsx('text-[9px] font-semibold leading-tight px-0.5 flex items-center gap-0.5 pointer-events-none', isPaused ? 'text-yellow-600 dark:text-yellow-400' : 'text-blue-600 dark:text-blue-400')}>
            {isPaused ? <Pause className="w-2 h-2" /> : <Play className="w-2 h-2" />}
            {format(parseISO(log!.actual_start!), 'HH:mm')}{isPaused ? ' 일시정지' : ' ▶'}
          </div>
          <div className="flex gap-0.5 flex-wrap">
            {isPaused ? (
              <button onClick={onResume} className="flex items-center gap-0.5 text-[9px] px-1 py-0.5 rounded bg-blue-200 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200 hover:opacity-80">
                <RotateCcw className="w-2 h-2" />재개
              </button>
            ) : (
              <button onClick={onPause} className="flex items-center gap-0.5 text-[9px] px-1 py-0.5 rounded bg-yellow-200 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-200 hover:opacity-80">
                <Pause className="w-2 h-2" />정지
              </button>
            )}
            <button onClick={() => onComplete('done')} className="flex items-center gap-0.5 text-[9px] px-1 py-0.5 rounded bg-green-200 text-green-800 dark:bg-green-900/50 dark:text-green-200 hover:opacity-80">
              <CheckCircle className="w-2 h-2" />완료
            </button>
            <button onClick={() => onComplete('partial')} className="flex items-center gap-0.5 text-[9px] px-1 py-0.5 rounded bg-orange-200 text-orange-800 dark:bg-orange-900/50 dark:text-orange-200 hover:opacity-80">
              <AlertCircle className="w-2 h-2" />부분
            </button>
            <button onClick={() => onComplete('skipped')} className="flex items-center gap-0.5 text-[9px] px-1 py-0.5 rounded bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300 hover:opacity-80">
              <SkipForward className="w-2 h-2" />건너뜀
            </button>
          </div>
        </div>
      ) : showCompact ? (
        <button
          onClick={(e) => onOpenPopup(e, 'progress')}
          className={clsx('w-full h-full flex items-center px-1 gap-0.5 transition-colors', isPaused ? 'bg-yellow-50/80 dark:bg-yellow-900/20 hover:bg-yellow-100/80' : 'bg-blue-50/80 dark:bg-blue-900/20 hover:bg-blue-100/80 dark:hover:bg-blue-800/30')}
        >
          {isPaused ? <Pause className="w-2.5 h-2.5 shrink-0 text-yellow-500" /> : <Play className="w-2.5 h-2.5 shrink-0 text-blue-500" />}
          <span className={clsx('text-[9px] font-semibold truncate', isPaused ? 'text-yellow-600 dark:text-yellow-400' : 'text-blue-600 dark:text-blue-400')}>
            {format(parseISO(log!.actual_start!), 'HH:mm')}
          </span>
        </button>
      ) : (
        <div
          onClick={(e) => onOpenPopup(e, 'edit')}
          className={clsx('w-full h-full flex flex-col justify-center px-1.5 text-[11px] cursor-pointer hover:opacity-75 transition-opacity',
            slot.status === 'done' && 'bg-green-100 dark:bg-green-900/30',
            slot.status === 'partial' && 'bg-orange-100 dark:bg-orange-900/30',
            slot.status === 'skipped' && 'bg-gray-100 dark:bg-gray-800/40',
          )}
        >
          <div className="font-medium text-gray-800 dark:text-gray-200 leading-tight pointer-events-none">
            {log?.actual_start && format(parseISO(log.actual_start), 'HH:mm')}
            {log?.actual_end && `–${format(parseISO(log.actual_end), 'HH:mm')}`}
            {height >= 36 && log?.actual_start && log?.actual_end && (
              <span className="ml-1 text-[9px] opacity-60">
                ({differenceInMinutes(parseISO(log.actual_end), parseISO(log.actual_start))}분)
              </span>
            )}
          </div>
          {height >= 48 && log?.actual_start && (
            <div className="text-[9px] opacity-60 leading-tight pointer-events-none">{punctualityLabel(slot.start_at, log.actual_start)}</div>
          )}
        </div>
      )}
    </div>
  );
});

// ── 메인 컴포넌트 ──────────────────────────────────────────────
export default function ActualColumn({ slots, onStart, onComplete, onChangeStatus, onUpdateLog, onMoveSlot }: ActualColumnProps) {
  const { startHour, endHour, slotHeight } = useTimetableStore();
  const totalSlots = ((endHour - startHour) * 60) / SLOT_MINUTES;
  const columnRef = useRef<HTMLDivElement>(null);

  const [popup, setPopup] = useState<PopupState>(null);
  const [editTime, setEditTime] = useState<EditTimeState>(null);
  const [pauseMap, setPauseMap] = useState<PauseMap>({});
  const [draggingSlotId, setDraggingSlotId] = useState<string | null>(null);
  const [previewIdx, setPreviewIdx] = useState(0);
  const [, forceUpdate] = useState(0);

  const dragDataRef = useRef<DragData | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const longPressedRef = useRef(false);

  // 진행중 슬롯 경과시간 갱신
  useEffect(() => {
    const id = setInterval(() => forceUpdate((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  // 팝업/편집 바깥 클릭 닫기
  useEffect(() => {
    if (!popup && !editTime) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as Element;
      if (!t.closest('[data-popup]') && !t.closest('[data-edit-time]')) {
        setPopup(null); setEditTime(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [popup, editTime]);

  function clearTimer() {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
  }

  function snapIdxFromClientY(clientY: number, d: DragData) {
    const relY = clientY - d.columnRect.top - d.offsetY;
    return Math.max(0, Math.min(totalSlots - 1, Math.floor(relY / slotHeight)));
  }

  function buildNewTimes(idx: number, durationMin: number, dateStr: string) {
    const totalMins = startHour * 60 + idx * SLOT_MINUTES;
    const h = Math.floor(totalMins / 60) % 24;
    const m = totalMins % 60;
    const newStart = new Date(`${dateStr}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`);
    return { newStart: newStart.toISOString(), newEnd: addMinutes(newStart, durationMin).toISOString() };
  }

  // window 리스너 – draggingSlotId 변경 시에만 재등록
  useEffect(() => {
    if (!draggingSlotId) return;
    const slot = slots.find((s) => s.id === draggingSlotId);
    const dateStr = (slot?.start_at ?? '').slice(0, 10);

    function onMouseMove(e: MouseEvent) {
      const d = dragDataRef.current;
      if (d) setPreviewIdx(snapIdxFromClientY(e.clientY, d));
    }
    function onMouseUp(e: MouseEvent) {
      const d = dragDataRef.current;
      if (d && onMoveSlot) {
        const { newStart, newEnd } = buildNewTimes(snapIdxFromClientY(e.clientY, d), d.durationMin, dateStr);
        onMoveSlot(d.slotId, newStart, newEnd);
      }
      dragDataRef.current = null; longPressedRef.current = false; setDraggingSlotId(null);
    }
    function onTouchMove(e: TouchEvent) {
      e.preventDefault();
      const d = dragDataRef.current;
      if (d) setPreviewIdx(snapIdxFromClientY(e.touches[0].clientY, d));
    }
    function onTouchEnd(e: TouchEvent) {
      const d = dragDataRef.current;
      if (d && onMoveSlot) {
        const { newStart, newEnd } = buildNewTimes(snapIdxFromClientY(e.changedTouches[0].clientY, d), d.durationMin, dateStr);
        onMoveSlot(d.slotId, newStart, newEnd);
      }
      dragDataRef.current = null; longPressedRef.current = false; setDraggingSlotId(null);
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
  }, [draggingSlotId]);

  // 컨테이너 non-passive touchstart
  useEffect(() => {
    const el = columnRef.current;
    if (!el) return;
    function handleTouchStart(e: TouchEvent) {
      const slotEl = (e.target as Element).closest('[data-actual-slot]');
      if (!slotEl) return;
      const slotId = slotEl.getAttribute('data-actual-slot')!;
      const slot = slots.find((s) => s.id === slotId);
      if (!slot) return;
      const log = slot.actual_logs[0];
      if (log?.actual_start && !log?.actual_end) return; // 진행중 슬롯은 드래그 제외

      const touch = e.touches[0];
      const { displayStart } = getDisplayTimes(slot);
      startPosRef.current = { x: touch.clientX, y: touch.clientY };
      longPressedRef.current = false;
      clearTimer();

      timerRef.current = setTimeout(() => {
        const rect = el!.getBoundingClientRect();
        const top = slotIndex(displayStart, startHour) * slotHeight;
        const durationMin = Math.max(30, differenceInMinutes(parseISO(slot.end_at), parseISO(slot.start_at)));
        longPressedRef.current = true;
        dragDataRef.current = { slotId: slot.id, durationMin, offsetY: touch.clientY - rect.top - top, columnRect: rect };
        setPreviewIdx(Math.round(top / slotHeight));
        setDraggingSlotId(slot.id);
      }, LONG_PRESS_MS);
    }
    el?.addEventListener('touchstart', handleTouchStart, { passive: false });
    return () => el?.removeEventListener('touchstart', handleTouchStart);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots, slotHeight, startHour]);

  function openPopup(e: React.MouseEvent, slotId: string, type: 'progress' | 'edit') {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = Math.min(rect.right + 6, window.innerWidth - 180);
    const y = rect.top + rect.height / 2;
    setPopup({ slotId, type, x, y });
  }

  function handlePause(slotId: string) {
    setPauseMap((p) => ({ ...p, [slotId]: new Date().toISOString() }));
    setPopup(null);
  }
  function handleResume(slotId: string) {
    setPauseMap((p) => { const n = { ...p }; delete n[slotId]; return n; });
    setPopup(null);
  }
  function handleComplete(slotId: string, status: SlotStatus) {
    setPauseMap((p) => { const n = { ...p }; delete n[slotId]; return n; });
    onComplete(slotId, status, new Date().toISOString());
    setPopup(null);
  }

  function openEditTime(e: React.MouseEvent, slot: TimeSlotWithLogs) {
    e.stopPropagation();
    const log = slot.actual_logs[0];
    if (!log) return;
    setEditTime({
      slotId: slot.id, logId: log.id,
      startVal: log.actual_start ? format(parseISO(log.actual_start), 'HH:mm') : '',
      endVal: log.actual_end ? format(parseISO(log.actual_end), 'HH:mm') : '',
      date: slot.start_at.slice(0, 10),
    });
    setPopup(null);
  }
  function handleSaveTime() {
    if (!editTime || !onUpdateLog) return;
    const { slotId, logId, startVal, endVal, date } = editTime;
    if (!startVal || !endVal) return;
    onUpdateLog(slotId, logId, new Date(`${date}T${startVal}:00`).toISOString(), new Date(`${date}T${endVal}:00`).toISOString());
    setEditTime(null);
  }

  // 마우스 드래그 핸들러 (드래그 가능한 슬롯용)
  function makeMouseHandlers(slot: TimeSlotWithLogs, top: number) {
    return {
      onMouseDown: (e: React.MouseEvent) => {
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
          dragDataRef.current = { slotId: slot.id, durationMin, offsetY: e.clientY - rect.top - top, columnRect: rect };
          setPreviewIdx(Math.round(top / slotHeight));
          setDraggingSlotId(slot.id);
        }, LONG_PRESS_MS);
      },
      onMouseMove: (e: React.MouseEvent) => {
        if (longPressedRef.current || !startPosRef.current) return;
        if (Math.abs(e.clientX - startPosRef.current.x) > CANCEL_MOVE_PX || Math.abs(e.clientY - startPosRef.current.y) > CANCEL_MOVE_PX) clearTimer();
      },
      onMouseUp: (e: React.MouseEvent) => {
        clearTimer();
        // 드래그가 아니었으면 팝업 열기
        if (!longPressedRef.current) {
          openPopup(e, slot.id, 'edit');
        }
      },
      onMouseLeave: clearTimer,
    };
  }

  const dragSlot = draggingSlotId ? slots.find((s) => s.id === draggingSlotId) : null;
  const popupSlot = popup ? slots.find((s) => s.id === popup.slotId) : null;

  return (
    <div ref={columnRef} className="relative w-full" style={{ height: totalSlots * slotHeight }}>
      {slots.map((slot) => {
        const { displayStart, displayEnd } = getDisplayTimes(slot);
        const top = slotIndex(displayStart, startHour) * slotHeight;
        const height = slotSpan(displayStart, displayEnd) * slotHeight;
        const isPaused = !!pauseMap[slot.id];
        const isDragging = draggingSlotId === slot.id;
        const log = slot.actual_logs[0] ?? null;
        const hasStarted = !!log?.actual_start;
        const hasEnded = !!log?.actual_end;
        const canDrag = !hasStarted || hasEnded;

        return (
          <SlotContent
            key={slot.id}
            slot={slot}
            top={top}
            height={height}
            isPaused={isPaused}
            isDragging={isDragging}
            isAnyDragging={!!draggingSlotId}
            onOpenPopup={(e, type) => openPopup(e, slot.id, type)}
            onStartSlot={() => onStart(slot.id)}
            onPause={() => handlePause(slot.id)}
            onResume={() => handleResume(slot.id)}
            onComplete={(status) => handleComplete(slot.id, status)}
            {...(canDrag ? makeMouseHandlers(slot, top) : {
              onMouseDown: () => {},
              onMouseMove: () => {},
              onMouseUp: () => {},
              onMouseLeave: () => {},
            })}
          />
        );
      })}

      {/* 드래그 미리보기 */}
      {draggingSlotId && dragSlot && (() => {
        const h = slotSpan(dragSlot.start_at, dragSlot.end_at) * slotHeight;
        return (
          <div
            className="absolute left-0.5 right-0.5 rounded-sm border-2 border-dashed border-green-500 bg-green-100/70 dark:bg-green-900/50 z-[5] pointer-events-none"
            style={{ top: previewIdx * slotHeight + 1, height: h - 2 }}
          >
            <div className="text-[10px] font-semibold text-green-700 dark:text-green-300 px-1 pt-0.5 truncate">{dragSlot.title}</div>
          </div>
        );
      })()}

      {/* 팝업 */}
      {popup && popupSlot && typeof window !== 'undefined' && createPortal(
        <div
          data-popup="true"
          style={{ position: 'fixed', top: popup.y, left: popup.x, zIndex: 9999, transform: 'translateY(-50%)' }}
          className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md shadow-lg p-1 flex flex-col gap-1 min-w-[120px]"
        >
          {popup.type === 'progress' ? (
            <>
              {pauseMap[popupSlot.id] ? (
                <button onClick={() => handleResume(popupSlot.id)} className="flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-blue-200 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200 hover:opacity-80">
                  <RotateCcw className="w-3 h-3 shrink-0" />재개
                </button>
              ) : (
                <button onClick={() => handlePause(popupSlot.id)} className="flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-yellow-200 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-200 hover:opacity-80">
                  <Pause className="w-3 h-3 shrink-0" />일시정지
                </button>
              )}
              <div className="border-t border-gray-200 dark:border-gray-600 my-0.5" />
              <button onClick={() => handleComplete(popupSlot.id, 'done')} className="flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-green-200 text-green-800 dark:bg-green-900/50 dark:text-green-200 hover:opacity-80">
                <CheckCircle className="w-3 h-3 shrink-0" />완료
              </button>
              <button onClick={() => handleComplete(popupSlot.id, 'partial')} className="flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-orange-200 text-orange-800 dark:bg-orange-900/50 dark:text-orange-200 hover:opacity-80">
                <AlertCircle className="w-3 h-3 shrink-0" />부분
              </button>
              <button onClick={() => handleComplete(popupSlot.id, 'skipped')} className="flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300 hover:opacity-80">
                <SkipForward className="w-3 h-3 shrink-0" />건너뜀
              </button>
            </>
          ) : (
            <>
              <button onClick={() => { onChangeStatus(popupSlot.id, 'done'); setPopup(null); }} className="flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-green-200 text-green-800 dark:bg-green-900/50 dark:text-green-200 hover:opacity-80">
                <CheckCircle className="w-3 h-3 shrink-0" />완료
              </button>
              <button onClick={() => { onChangeStatus(popupSlot.id, 'partial'); setPopup(null); }} className="flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-orange-200 text-orange-800 dark:bg-orange-900/50 dark:text-orange-200 hover:opacity-80">
                <AlertCircle className="w-3 h-3 shrink-0" />부분
              </button>
              <button onClick={() => { onChangeStatus(popupSlot.id, 'skipped'); setPopup(null); }} className="flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300 hover:opacity-80">
                <SkipForward className="w-3 h-3 shrink-0" />건너뜀
              </button>
              {onUpdateLog && popupSlot.actual_logs[0] && (
                <>
                  <div className="border-t border-gray-200 dark:border-gray-600 my-0.5" />
                  <button onClick={(e) => openEditTime(e, popupSlot)} className="flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 hover:opacity-80">
                    <Clock className="w-3 h-3 shrink-0" />시간 수정
                  </button>
                </>
              )}
            </>
          )}
        </div>,
        document.body
      )}

      {/* 시간 수정 패널 */}
      {editTime && typeof window !== 'undefined' && createPortal(
        <div
          data-edit-time="true"
          style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 10000 }}
          className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl shadow-2xl p-4 w-64"
        >
          <div className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">실제 시간 수정</div>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">시작 시간</label>
              <input type="time" value={editTime.startVal}
                onChange={(e) => setEditTime((p) => p ? { ...p, startVal: e.target.value } : null)}
                className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">종료 시간</label>
              <input type="time" value={editTime.endVal}
                onChange={(e) => setEditTime((p) => p ? { ...p, endVal: e.target.value } : null)}
                className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setEditTime(null)} className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">취소</button>
            <button onClick={handleSaveTime} className="px-4 py-1.5 text-sm font-medium bg-purple-600 hover:bg-purple-700 text-white rounded-lg">저장</button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
