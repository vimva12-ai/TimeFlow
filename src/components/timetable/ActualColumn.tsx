'use client';

import { useState, useEffect, useRef } from 'react';
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
  onUpdateSlotTime?: (slotId: string, newStart: string, newEnd: string) => void;
}

function punctualityLabel(plannedStart: string, actualStart: string): string {
  const diffMin = differenceInMinutes(parseISO(actualStart), parseISO(plannedStart));
  if (Math.abs(diffMin) <= 15) return '정시';
  if (diffMin > 0) return `${diffMin}분 지연`;
  return `${Math.abs(diffMin)}분 일찍`;
}

function getDisplayTimes(slot: TimeSlotWithLogs): { displayStart: string; displayEnd: string } {
  const log = slot.actual_logs[0] ?? null;
  if (!log?.actual_start) {
    // Not started: use ACTUAL-only override position if set (independent from PLAN)
    if (slot.actual_disp_start) {
      return { displayStart: slot.actual_disp_start, displayEnd: slot.actual_disp_end ?? slot.end_at };
    }
    return { displayStart: slot.start_at, displayEnd: slot.end_at };
  }
  if (log.actual_end) return { displayStart: log.actual_start, displayEnd: log.actual_end };
  const plannedDurationMin = differenceInMinutes(parseISO(slot.end_at), parseISO(slot.start_at));
  return { displayStart: log.actual_start, displayEnd: addMinutes(parseISO(log.actual_start), plannedDurationMin).toISOString() };
}

const ACTION_THRESHOLD = 60;
const LONG_PRESS_MS = 300;
const CANCEL_MOVE_PX = 10;
const HANDLE_PX = 8;
const MIN_DURATION_MIN = 5;

type PopupState = { slotId: string; type: 'progress' | 'edit'; x: number; y: number } | null;
type EditTimeState = { slotId: string; logId?: string; startVal: string; endVal: string; date: string; mode: 'slot' | 'log' } | null;
type PauseMap = Record<string, string>;

interface DragData {
  slotId: string;
  durationMin: number;
  offsetY: number;
  columnRect: DOMRect;
  dateStr: string;
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

export default function ActualColumn({ slots, onStart, onComplete, onChangeStatus, onUpdateLog, onMoveSlot, onUpdateSlotTime }: ActualColumnProps) {
  const { startHour, endHour, slotHeight } = useTimetableStore();
  const totalSlots = ((endHour - startHour) * 60) / SLOT_MINUTES;
  const columnRef = useRef<HTMLDivElement>(null);
  const ppm = slotHeight / SLOT_MINUTES; // pixels per minute

  const [popup, setPopup] = useState<PopupState>(null);
  const [editTime, setEditTime] = useState<EditTimeState>(null);
  const [pauseMap, setPauseMap] = useState<PauseMap>({});
  const [draggingSlotId, setDraggingSlotId] = useState<string | null>(null);
  const [previewIdx, setPreviewIdx] = useState(0);
  const [, forceUpdate] = useState(0);

  // Resize state
  const [resizingSlotId, setResizingSlotId] = useState<string | null>(null);
  const [resizePreview, setResizePreview] = useState<ResizePreview | null>(null);
  const resizeDataRef = useRef<ResizeData | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const longPressedRef = useRef(false);
  const dragDataRef = useRef<DragData | null>(null);

  // 진행중 슬롯 경과시간 갱신
  useEffect(() => {
    const id = setInterval(() => forceUpdate((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  // 팝업/편집 바깥 클릭·터치 닫기 (mousedown + touchstart 모두 처리)
  useEffect(() => {
    if (!popup && !editTime) return;
    const handler = (e: Event) => {
      const t = e.target as Element;
      if (!t.closest('[data-popup]') && !t.closest('[data-edit-time]')) {
        setPopup(null); setEditTime(null);
      }
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler, { passive: true });
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [popup, editTime]);

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

  function buildNewTimes(offsetMin: number, durationMin: number, dateStr: string) {
    const totalMins = startHour * 60 + offsetMin;
    const h = Math.floor(totalMins / 60) % 24;
    const m = totalMins % 60;
    const newStart = new Date(`${dateStr}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`);
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

  function openPopup(el: HTMLElement, slotId: string, type: 'progress' | 'edit') {
    const rect = el.getBoundingClientRect();
    const popupWidth = 150;
    let x = rect.right + 6;
    if (x + popupWidth > window.innerWidth) x = Math.max(4, rect.left - popupWidth - 6);
    const y = rect.top + rect.height / 2;
    setPopup({ slotId, type, x, y });
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
    const { displayStart } = getDisplayTimes(slot);
    const dateStr = displayStart.slice(0, 10);

    timerRef.current = setTimeout(() => {
      const rect = columnRef.current?.getBoundingClientRect();
      if (!rect) return;
      // Use actual log duration for completed slots, display duration for others
      const log = slot.actual_logs[0];
      const { displayStart: ds2, displayEnd: de2 } = getDisplayTimes(slot);
      const durationMin = (log?.actual_start && log?.actual_end)
        ? Math.max(1, differenceInMinutes(parseISO(log.actual_end), parseISO(log.actual_start)))
        : Math.max(1, differenceInMinutes(parseISO(de2), parseISO(ds2)));
      longPressedRef.current = true;
      dragDataRef.current = { slotId: slot.id, durationMin, offsetY: initY - rect.top - top, columnRect: rect, dateStr };
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
      // 드래그 완료 후 내부 버튼(Play 등)의 click 이벤트 차단
      e.preventDefault();
      const d = dragDataRef.current;
      // 손가락이 실제로 충분히 이동했을 때만 드래그 커밋
      // 모바일에서 탭 시 롱프레스 타이머가 발동되더라도 이동 없으면 팝업 열기
      const totalDy = startPosRef.current ? Math.abs(e.clientY - startPosRef.current.y) : CANCEL_MOVE_PX;
      const didDrag = totalDy >= CANCEL_MOVE_PX;
      if (d && onMoveSlot && didDrag) {
        const { newStart, newEnd } = buildNewTimes(snapMin(e.clientY, d), d.durationMin, d.dateStr);
        onMoveSlot(d.slotId, newStart, newEnd);
      } else if (!didDrag) {
        // 이동 없는 롱프레스 → 탭으로 간주하여 팝업 열기
        const log = slot.actual_logs[0] ?? null;
        if (log?.actual_end) {
          openPopup(e.currentTarget as HTMLElement, slot.id, 'edit');
        }
      }
      dragDataRef.current = null;
      longPressedRef.current = false;
      setDraggingSlotId(null);
    } else {
      // Short press: only open popup for completed slots.
      // Not-started slots let the inner Play button's onClick handle starting.
      const log = slot.actual_logs[0] ?? null;
      const hasEnded = !!log?.actual_end;
      if (hasEnded) {
        openPopup(e.currentTarget as HTMLElement, slot.id, 'edit');
      }
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

    const { displayStart, displayEnd } = getDisplayTimes(slot);
    const top = slotIndex(displayStart, startHour) * slotHeight;
    const height = slotSpan(displayStart, displayEnd) * slotHeight;
    const startOffsetMin = Math.round(top / ppm);
    const endOffsetMin = Math.round((top + height) / ppm);
    const fixedOffsetMin = edge === 'top' ? endOffsetMin : startOffsetMin;

    resizeDataRef.current = { slotId: slot.id, edge, fixedOffsetMin, date: displayStart.slice(0, 10) };
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

  function openLogTimeEdit(e: React.MouseEvent, slot: TimeSlotWithLogs) {
    e.stopPropagation();
    const log = slot.actual_logs[0];
    if (!log) return;
    setEditTime({
      slotId: slot.id, logId: log.id,
      startVal: log.actual_start ? format(parseISO(log.actual_start), 'HH:mm') : '',
      endVal: log.actual_end ? format(parseISO(log.actual_end), 'HH:mm') : '',
      date: slot.start_at.slice(0, 10),
      mode: 'log',
    });
    setPopup(null);
  }

  function openSlotTimeEdit(e: React.MouseEvent | React.PointerEvent, slot: TimeSlotWithLogs) {
    e.stopPropagation();
    setEditTime({
      slotId: slot.id,
      startVal: format(parseISO(slot.start_at), 'HH:mm'),
      endVal: format(parseISO(slot.end_at), 'HH:mm'),
      date: slot.start_at.slice(0, 10),
      mode: 'slot',
    });
    setPopup(null);
  }

  function handleSaveTime() {
    if (!editTime) return;
    const { slotId, startVal, endVal, date } = editTime;
    if (!startVal || !endVal) return;
    const newStart = new Date(`${date}T${startVal}:00`).toISOString();
    const newEnd = new Date(`${date}T${endVal}:00`).toISOString();
    if (editTime.mode === 'log' && editTime.logId && onUpdateLog) {
      onUpdateLog(slotId, editTime.logId, newStart, newEnd);
    } else if (editTime.mode === 'slot' && onUpdateSlotTime) {
      onUpdateSlotTime(slotId, newStart, newEnd);
    }
    setEditTime(null);
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
        const isResizing = resizingSlotId === slot.id;
        const log = slot.actual_logs[0] ?? null;
        const hasStarted = !!log?.actual_start;
        const hasEnded = !!log?.actual_end;
        // Not-started slots: drag updates actual_disp_start/end (ACTUAL-only position, PLAN unaffected).
        // Completed slots: drag updates actual_log times.
        // In-progress slots cannot be dragged or resized.
        const canDrag = !hasStarted || hasEnded;
        const showInline = hasStarted && !hasEnded && height >= ACTION_THRESHOLD;
        const showCompact = hasStarted && !hasEnded && height < ACTION_THRESHOLD;
        const busy = (draggingSlotId !== null && !isDragging) || (resizingSlotId !== null && !isResizing);

        return (
          <div
            key={slot.id}
            data-slot="true"
            data-actual-slot={slot.id}
            className={clsx(
              'absolute left-0.5 right-0.5 rounded-sm border border-gray-300 dark:border-gray-600 overflow-hidden z-[2] select-none',
              (isDragging || isResizing) ? 'opacity-30' : '',
              busy ? 'pointer-events-none' : '',
              canDrag ? 'cursor-grab active:cursor-grabbing' : '',
            )}
            style={{ top: top + 1, height: height - 2, touchAction: canDrag ? 'none' : undefined }}
            onPointerDown={canDrag ? (e) => handlePointerDown(e, slot, top) : undefined}
            onPointerMove={canDrag ? handlePointerMove : undefined}
            onPointerUp={canDrag ? (e) => handlePointerUp(e, slot) : undefined}
            onPointerCancel={canDrag ? handlePointerCancel : undefined}
          >
            {/* 상단 리사이즈 핸들 (not-started / completed 전용) */}
            {canDrag && (
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
                <div className="w-5 h-px bg-gray-400 opacity-25 hover:opacity-60 mt-[3px] transition-opacity" />
              </div>
            )}

            {!hasStarted ? (
              <div className="relative w-full h-full">
                <button
                  onClick={() => onStart(slot.id)}
                  className="w-full h-full flex items-center justify-center gap-1 text-[11px] text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                >
                  <Play className="w-3 h-3 shrink-0" />
                  {height >= 32 ? '시작' : ''}
                </button>
                {height >= 28 && (
                  <button
                    onClick={(e) => openSlotTimeEdit(e, slot)}
                    onPointerDown={(e) => e.stopPropagation()}
                    className="absolute top-0.5 right-0.5 p-0.5 rounded text-gray-300 hover:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <Clock className="w-3 h-3" />
                  </button>
                )}
              </div>
            ) : showInline ? (
              <div className={clsx('flex flex-col h-full p-0.5 gap-0.5', isPaused ? 'bg-yellow-50/80 dark:bg-yellow-900/20' : 'bg-blue-50/80 dark:bg-blue-900/20')}>
                <div className={clsx('text-[9px] font-semibold leading-tight px-0.5 flex items-center gap-0.5 pointer-events-none', isPaused ? 'text-yellow-600 dark:text-yellow-400' : 'text-blue-600 dark:text-blue-400')}>
                  {isPaused ? <Pause className="w-2 h-2" /> : <Play className="w-2 h-2" />}
                  {format(parseISO(log!.actual_start!), 'HH:mm')}{isPaused ? ' 일시정지' : ' ▶'}
                </div>
                <div className="flex gap-0.5 flex-wrap">
                  {isPaused ? (
                    <button onClick={() => handleResume(slot.id)} className="flex items-center gap-0.5 text-[9px] px-1 py-0.5 rounded bg-blue-200 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200 hover:opacity-80">
                      <RotateCcw className="w-2 h-2" />재개
                    </button>
                  ) : (
                    <button onClick={() => handlePause(slot.id)} className="flex items-center gap-0.5 text-[9px] px-1 py-0.5 rounded bg-yellow-200 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-200 hover:opacity-80">
                      <Pause className="w-2 h-2" />정지
                    </button>
                  )}
                  <button onClick={() => handleComplete(slot.id, 'done')} className="flex items-center gap-0.5 text-[9px] px-1 py-0.5 rounded bg-green-200 text-green-800 dark:bg-green-900/50 dark:text-green-200 hover:opacity-80">
                    <CheckCircle className="w-2 h-2" />완료
                  </button>
                  <button onClick={() => handleComplete(slot.id, 'partial')} className="flex items-center gap-0.5 text-[9px] px-1 py-0.5 rounded bg-orange-200 text-orange-800 dark:bg-orange-900/50 dark:text-orange-200 hover:opacity-80">
                    <AlertCircle className="w-2 h-2" />부분
                  </button>
                  <button onClick={() => handleComplete(slot.id, 'skipped')} className="flex items-center gap-0.5 text-[9px] px-1 py-0.5 rounded bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300 hover:opacity-80">
                    <SkipForward className="w-2 h-2" />건너뜀
                  </button>
                  <button onClick={(e) => openSlotTimeEdit(e, slot)} className="flex items-center gap-0.5 text-[9px] px-1 py-0.5 rounded bg-gray-100 text-gray-500 dark:bg-gray-700/50 dark:text-gray-400 hover:opacity-80">
                    <Clock className="w-2 h-2" />시간
                  </button>
                </div>
              </div>
            ) : showCompact ? (
              <button
                onClick={(e) => openPopup(e.currentTarget as HTMLElement, slot.id, 'progress')}
                className={clsx('w-full h-full flex items-center px-1 gap-0.5 transition-colors', isPaused ? 'bg-yellow-50/80 dark:bg-yellow-900/20 hover:bg-yellow-100/80' : 'bg-blue-50/80 dark:bg-blue-900/20 hover:bg-blue-100/80 dark:hover:bg-blue-800/30')}
              >
                {isPaused ? <Pause className="w-2.5 h-2.5 shrink-0 text-yellow-500" /> : <Play className="w-2.5 h-2.5 shrink-0 text-blue-500" />}
                <span className={clsx('text-[9px] font-semibold truncate', isPaused ? 'text-yellow-600 dark:text-yellow-400' : 'text-blue-600 dark:text-blue-400')}>
                  {format(parseISO(log!.actual_start!), 'HH:mm')}
                </span>
              </button>
            ) : (
              /* Completed slot — pointer handlers on outer div open popup via handlePointerUp */
              <div
                className={clsx('w-full h-full flex flex-col justify-center px-1.5 text-[11px]',
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

            {/* 하단 리사이즈 핸들 (not-started / completed 전용) */}
            {canDrag && (
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
                <div className="w-5 h-px bg-gray-400 opacity-25 hover:opacity-60 mb-[3px] transition-opacity" />
              </div>
            )}
          </div>
        );
      })}

      {/* 드래그 미리보기 */}
      {draggingSlotId && dragSlot && (() => {
        const { displayStart: ds, displayEnd: de } = getDisplayTimes(dragSlot);
        const h = slotSpan(ds, de) * slotHeight;
        return (
          <div
            className="absolute left-0.5 right-0.5 rounded-sm border-2 border-dashed border-green-500 bg-green-100/70 dark:bg-green-900/50 z-[5] pointer-events-none"
            style={{ top: previewIdx * ppm + 1, height: h - 2 }}
          >
            <div className="text-[10px] font-semibold text-green-700 dark:text-green-300 px-1 pt-0.5 truncate">{dragSlot.title}</div>
          </div>
        );
      })()}

      {/* 리사이즈 미리보기 */}
      {resizingSlotId && resizePreview && (
        <div
          className="absolute left-0.5 right-0.5 rounded-sm border-2 border-dashed border-amber-500 bg-amber-100/70 dark:bg-amber-900/50 z-[5] pointer-events-none"
          style={{ top: resizePreview.top, height: resizePreview.height }}
        />
      )}

      {/* 팝업 */}
      {popup && popupSlot && typeof window !== 'undefined' && createPortal(
        <div
          data-popup="true"
          style={{ position: 'fixed', top: popup.y, left: popup.x, zIndex: 9999, transform: 'translateY(-50%)' }}
          className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md shadow-lg p-1 flex flex-col gap-1 min-w-[120px]"
          onClick={(e) => e.stopPropagation()}
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
              <div className="border-t border-gray-200 dark:border-gray-600 my-0.5" />
              <button onClick={(e) => openSlotTimeEdit(e, popupSlot)} className="flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 hover:opacity-80">
                <Clock className="w-3 h-3 shrink-0" />시간 수정
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
                  <button onClick={(e) => openLogTimeEdit(e, popupSlot)} className="flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 hover:opacity-80">
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
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">
            {editTime?.mode === 'log' ? '실제 시간 수정' : '시간 범위 수정'}
          </div>
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
