'use client';

import { useState, useEffect, useCallback, useRef, memo } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { format, parseISO, differenceInMinutes, addMinutes } from 'date-fns';
import { CheckCircle, SkipForward, AlertCircle, Play, Pause, RotateCcw, Clock } from 'lucide-react';
import { type TimeSlotWithLogs, type SlotStatus } from '@/types/database';
import { SLOT_MINUTES, slotIndex, slotSpan } from './TimeGrid';
import { useTimetableStore } from '@/store/timetableStore';
import { useLongPress } from '@/hooks/useLongPress';

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

/** 슬롯의 실제 표시 위치 계산 */
function getDisplayTimes(slot: TimeSlotWithLogs): { displayStart: string; displayEnd: string } {
  const log = slot.actual_logs[0] ?? null;
  if (!log?.actual_start) {
    return { displayStart: slot.start_at, displayEnd: slot.end_at };
  }
  if (log.actual_end) {
    return { displayStart: log.actual_start, displayEnd: log.actual_end };
  }
  // 진행 중: actual_start에서 계획된 duration만큼
  const plannedDurationMin = differenceInMinutes(parseISO(slot.end_at), parseISO(slot.start_at));
  const displayEnd = addMinutes(parseISO(log.actual_start), plannedDurationMin).toISOString();
  return { displayStart: log.actual_start, displayEnd };
}

const ACTION_THRESHOLD = 60;

type PopupState = {
  slotId: string;
  type: 'progress' | 'edit';
  x: number;
  y: number;
} | null;

type EditTimeState = {
  slotId: string;
  logId: string;
  startVal: string;
  endVal: string;
  date: string;
} | null;

type PauseMap = Record<string, string>;

interface DragState {
  slotId: string;
  slotHeightPx: number;
  slotDurationMin: number;
  offsetY: number;
  currentY: number;
  columnRect: DOMRect;
}

// ── 슬롯 아이템 컴포넌트 ────────────────────────────────────────
interface SlotItemProps {
  slot: TimeSlotWithLogs;
  top: number;
  height: number;
  isPaused: boolean;
  isDragging: boolean;
  isAnyDragging: boolean;
  onLongPressStart: (e: React.MouseEvent | React.TouchEvent) => void;
  onOpenPopup: (e: React.MouseEvent, type: 'progress' | 'edit') => void;
  onStartSlot: () => void;
  onPause: () => void;
  onResume: () => void;
  onComplete: (status: SlotStatus) => void;
}

const SlotItem = memo(function SlotItem({
  slot, top, height, isPaused, isDragging, isAnyDragging,
  onLongPressStart, onOpenPopup, onStartSlot, onPause, onResume, onComplete,
}: SlotItemProps) {
  const log = slot.actual_logs[0] ?? null;
  const hasStarted = !!log?.actual_start;
  const hasEnded = !!log?.actual_end;
  const showInline = hasStarted && !hasEnded && height >= ACTION_THRESHOLD;
  const showCompact = hasStarted && !hasEnded && height < ACTION_THRESHOLD;
  const canDrag = !hasStarted || hasEnded; // 시작 전 또는 완료된 슬롯만 드래그 가능

  const longPressHandlers = useLongPress({
    threshold: 500,
    onLongPress: canDrag ? onLongPressStart : () => {},
    onClick: () => {}, // 클릭은 각 버튼에서 처리
  });

  const dragProps = canDrag ? {
    ...longPressHandlers,
    style: { top: top + 1, height: height - 2, cursor: isDragging ? 'grabbing' : 'grab', touchAction: 'none' as const },
  } : {
    style: { top: top + 1, height: height - 2 },
  };

  return (
    <div
      data-slot="true"
      {...(canDrag ? longPressHandlers : {})}
      className={clsx(
        'absolute left-0.5 right-0.5 rounded-sm border border-gray-300 dark:border-gray-600 overflow-hidden z-[2] select-none',
        isDragging ? 'opacity-30' : '',
        isAnyDragging && !isDragging ? 'pointer-events-none' : '',
      )}
      style={dragProps.style}
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
        <div className={clsx(
          'flex flex-col h-full p-0.5 gap-0.5',
          isPaused ? 'bg-yellow-50/80 dark:bg-yellow-900/20' : 'bg-blue-50/80 dark:bg-blue-900/20'
        )}>
          <div className={clsx(
            'text-[9px] font-semibold leading-tight px-0.5 flex items-center gap-0.5',
            isPaused ? 'text-yellow-600 dark:text-yellow-400' : 'text-blue-600 dark:text-blue-400'
          )}>
            {isPaused ? <Pause className="w-2 h-2" /> : <Play className="w-2 h-2" />}
            {format(parseISO(log!.actual_start!), 'HH:mm')}
            {isPaused ? ' 일시정지' : ' ▶'}
          </div>
          <div className="flex gap-0.5 flex-wrap">
            {isPaused ? (
              <button
                onClick={onResume}
                className="flex items-center gap-0.5 text-[9px] px-1 py-0.5 rounded bg-blue-200 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200 hover:opacity-80"
              >
                <RotateCcw className="w-2 h-2" />재개
              </button>
            ) : (
              <button
                onClick={onPause}
                className="flex items-center gap-0.5 text-[9px] px-1 py-0.5 rounded bg-yellow-200 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-200 hover:opacity-80"
              >
                <Pause className="w-2 h-2" />정지
              </button>
            )}
            <button
              onClick={() => onComplete('done')}
              className="flex items-center gap-0.5 text-[9px] px-1 py-0.5 rounded bg-green-200 text-green-800 dark:bg-green-900/50 dark:text-green-200 hover:opacity-80"
            >
              <CheckCircle className="w-2 h-2" />완료
            </button>
            <button
              onClick={() => onComplete('partial')}
              className="flex items-center gap-0.5 text-[9px] px-1 py-0.5 rounded bg-orange-200 text-orange-800 dark:bg-orange-900/50 dark:text-orange-200 hover:opacity-80"
            >
              <AlertCircle className="w-2 h-2" />부분
            </button>
            <button
              onClick={() => onComplete('skipped')}
              className="flex items-center gap-0.5 text-[9px] px-1 py-0.5 rounded bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300 hover:opacity-80"
            >
              <SkipForward className="w-2 h-2" />건너뜀
            </button>
          </div>
        </div>
      ) : showCompact ? (
        <button
          onClick={(e) => onOpenPopup(e, 'progress')}
          className={clsx(
            'w-full h-full flex items-center px-1 gap-0.5 transition-colors',
            isPaused
              ? 'bg-yellow-50/80 dark:bg-yellow-900/20 hover:bg-yellow-100/80'
              : 'bg-blue-50/80 dark:bg-blue-900/20 hover:bg-blue-100/80 dark:hover:bg-blue-800/30'
          )}
        >
          {isPaused
            ? <Pause className="w-2.5 h-2.5 shrink-0 text-yellow-500" />
            : <Play className="w-2.5 h-2.5 shrink-0 text-blue-500" />
          }
          <span className={clsx(
            'text-[9px] font-semibold truncate',
            isPaused ? 'text-yellow-600 dark:text-yellow-400' : 'text-blue-600 dark:text-blue-400'
          )}>
            {format(parseISO(log!.actual_start!), 'HH:mm')}
          </span>
        </button>
      ) : (
        <div
          onClick={(e) => onOpenPopup(e, 'edit')}
          className={clsx(
            'w-full h-full flex flex-col justify-center px-1.5 text-[11px] cursor-pointer hover:opacity-75 transition-opacity',
            slot.status === 'done'    && 'bg-green-100 dark:bg-green-900/30',
            slot.status === 'partial' && 'bg-orange-100 dark:bg-orange-900/30',
            slot.status === 'skipped' && 'bg-gray-100 dark:bg-gray-800/40',
          )}
        >
          <div className="font-medium text-gray-800 dark:text-gray-200 leading-tight">
            {log?.actual_start && format(parseISO(log.actual_start), 'HH:mm')}
            {log?.actual_end && `–${format(parseISO(log.actual_end), 'HH:mm')}`}
            {height >= 36 && log?.actual_start && log?.actual_end && (
              <span className="ml-1 text-[9px] opacity-60">
                ({differenceInMinutes(parseISO(log.actual_end), parseISO(log.actual_start))}분)
              </span>
            )}
          </div>
          {height >= 48 && log?.actual_start && (
            <div className="text-[9px] opacity-60 leading-tight">
              {punctualityLabel(slot.start_at, log.actual_start)}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

// ── 메인 컴포넌트 ──────────────────────────────────────────────
export default function ActualColumn({
  slots, onStart, onComplete, onChangeStatus, onUpdateLog, onMoveSlot,
}: ActualColumnProps) {
  const { startHour, endHour, slotHeight } = useTimetableStore();
  const totalSlots = ((endHour - startHour) * 60) / SLOT_MINUTES;
  const columnRef = useRef<HTMLDivElement>(null);

  const [popup, setPopup] = useState<PopupState>(null);
  const [editTime, setEditTime] = useState<EditTimeState>(null);
  const [pauseMap, setPauseMap] = useState<PauseMap>({});
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const [, forceUpdate] = useState(0);

  useEffect(() => { dragRef.current = drag; }, [drag]);

  // 진행중 슬롯 elapsed 갱신
  useEffect(() => {
    const id = setInterval(() => forceUpdate((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  // 팝업/편집 바깥 클릭 시 닫기
  useEffect(() => {
    if (!popup && !editTime) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as Element;
      if (!t.closest('[data-popup]') && !t.closest('[data-edit-time]')) {
        setPopup(null);
        setEditTime(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [popup, editTime]);

  // 드래그 스냅
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
    // 날짜는 슬롯의 start_at에서 추출
    const slot = slots.find((s) => s.id === d.slotId);
    const dateStr = (slot?.start_at ?? '').slice(0, 10);
    const newStart = new Date(`${dateStr}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`);
    const newEnd = addMinutes(newStart, d.slotDurationMin);
    onMoveSlot(d.slotId, newStart.toISOString(), newEnd.toISOString());
    setDrag(null);
  }, [snapIndex, startHour, slots, onMoveSlot]);

  useEffect(() => {
    if (!drag) return;
    const onMouseMove = (e: MouseEvent) => setDrag((p) => p ? { ...p, currentY: e.clientY } : null);
    const onMouseUp = (e: MouseEvent) => commitDrop(e.clientY);
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      setDrag((p) => p ? { ...p, currentY: e.touches[0].clientY } : null);
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

  function openPopup(e: React.MouseEvent, slotId: string, type: 'progress' | 'edit') {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = Math.min(rect.right + 6, window.innerWidth - 180);
    const y = rect.top + rect.height / 2;
    setPopup({ slotId, type, x, y });
  }

  function handlePause(slotId: string) {
    setPauseMap((prev) => ({ ...prev, [slotId]: new Date().toISOString() }));
    setPopup(null);
  }

  function handleResume(slotId: string) {
    setPauseMap((prev) => { const n = { ...prev }; delete n[slotId]; return n; });
    setPopup(null);
  }

  function handleComplete(slotId: string, status: SlotStatus) {
    setPauseMap((prev) => { const n = { ...prev }; delete n[slotId]; return n; });
    onComplete(slotId, status, new Date().toISOString());
    setPopup(null);
  }

  function openEditTime(e: React.MouseEvent, slot: TimeSlotWithLogs) {
    e.stopPropagation();
    const log = slot.actual_logs[0];
    if (!log) return;
    const dateStr = slot.start_at.slice(0, 10);
    setEditTime({
      slotId: slot.id,
      logId: log.id,
      startVal: log.actual_start ? format(parseISO(log.actual_start), 'HH:mm') : '',
      endVal: log.actual_end ? format(parseISO(log.actual_end), 'HH:mm') : '',
      date: dateStr,
    });
    setPopup(null);
  }

  function handleSaveTime() {
    if (!editTime || !onUpdateLog) return;
    const { slotId, logId, startVal, endVal, date } = editTime;
    if (!startVal || !endVal) return;
    const actualStart = new Date(`${date}T${startVal}:00`).toISOString();
    const actualEnd = new Date(`${date}T${endVal}:00`).toISOString();
    onUpdateLog(slotId, logId, actualStart, actualEnd);
    setEditTime(null);
  }

  // 드래그 미리보기
  let dragPreviewTop = 0;
  let dragSlot: TimeSlotWithLogs | null = null;
  if (drag) {
    dragSlot = slots.find((s) => s.id === drag.slotId) ?? null;
    const idx = snapIndex(drag.currentY, drag.offsetY, drag.columnRect);
    dragPreviewTop = idx * slotHeight;
  }

  const popupSlot = popup ? slots.find((s) => s.id === popup.slotId) : null;

  return (
    <div ref={columnRef} className="relative w-full" style={{ height: totalSlots * slotHeight }}>
      {slots.map((slot) => {
        const { displayStart, displayEnd } = getDisplayTimes(slot);
        const top = slotIndex(displayStart, startHour) * slotHeight;
        const height = slotSpan(displayStart, displayEnd) * slotHeight;
        const isPaused = !!pauseMap[slot.id];
        const isDragging = drag?.slotId === slot.id;
        const log = slot.actual_logs[0] ?? null;
        const hasStarted = !!log?.actual_start;
        const hasEnded = !!log?.actual_end;
        const canDrag = !hasStarted || hasEnded;

        function handleLongPressStart(e: React.MouseEvent | React.TouchEvent) {
          if (!onMoveSlot) return;
          e.stopPropagation();
          const rect = columnRef.current?.getBoundingClientRect();
          if (!rect) return;
          const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
          const durationMin = (new Date(slot.end_at).getTime() - new Date(slot.start_at).getTime()) / 60000;
          setDrag({
            slotId: slot.id,
            slotHeightPx: height,
            slotDurationMin: durationMin,
            offsetY: clientY - rect.top - top,
            currentY: clientY,
            columnRect: rect,
          });
        }

        return (
          <SlotItem
            key={slot.id}
            slot={slot}
            top={top}
            height={height}
            isPaused={isPaused}
            isDragging={isDragging}
            isAnyDragging={!!drag}
            onLongPressStart={handleLongPressStart}
            onOpenPopup={(e, type) => openPopup(e, slot.id, type)}
            onStartSlot={() => onStart(slot.id)}
            onPause={() => handlePause(slot.id)}
            onResume={() => handleResume(slot.id)}
            onComplete={(status) => handleComplete(slot.id, status)}
          />
        );
      })}

      {/* 드래그 미리보기 */}
      {drag && dragSlot && (
        <div
          className="absolute left-0.5 right-0.5 rounded-sm border-2 border-dashed border-green-500 bg-green-200/50 dark:bg-green-900/40 z-[5] pointer-events-none"
          style={{ top: dragPreviewTop + 1, height: drag.slotHeightPx - 2 }}
        >
          <div className="text-[10px] font-semibold text-green-700 dark:text-green-300 px-1 pt-0.5 truncate">
            {dragSlot.title}
          </div>
        </div>
      )}

      {/* 오른쪽 팝업 */}
      {popup && popupSlot && typeof window !== 'undefined' && createPortal(
        <div
          data-popup="true"
          style={{ position: 'fixed', top: popup.y, left: popup.x, zIndex: 9999, transform: 'translateY(-50%)' }}
          className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md shadow-lg p-1 flex flex-col gap-1 min-w-[120px]"
        >
          {popup.type === 'progress' ? (
            <>
              {pauseMap[popupSlot.id] ? (
                <button
                  onClick={() => handleResume(popupSlot.id)}
                  className="flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-blue-200 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200 hover:opacity-80"
                >
                  <RotateCcw className="w-3 h-3 shrink-0" />재개
                </button>
              ) : (
                <button
                  onClick={() => handlePause(popupSlot.id)}
                  className="flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-yellow-200 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-200 hover:opacity-80"
                >
                  <Pause className="w-3 h-3 shrink-0" />일시정지
                </button>
              )}
              <div className="border-t border-gray-200 dark:border-gray-600 my-0.5" />
              <button
                onClick={() => handleComplete(popupSlot.id, 'done')}
                className="flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-green-200 text-green-800 dark:bg-green-900/50 dark:text-green-200 hover:opacity-80"
              >
                <CheckCircle className="w-3 h-3 shrink-0" />완료
              </button>
              <button
                onClick={() => handleComplete(popupSlot.id, 'partial')}
                className="flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-orange-200 text-orange-800 dark:bg-orange-900/50 dark:text-orange-200 hover:opacity-80"
              >
                <AlertCircle className="w-3 h-3 shrink-0" />부분
              </button>
              <button
                onClick={() => handleComplete(popupSlot.id, 'skipped')}
                className="flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300 hover:opacity-80"
              >
                <SkipForward className="w-3 h-3 shrink-0" />건너뜀
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => { onChangeStatus(popupSlot.id, 'done'); setPopup(null); }}
                className="flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-green-200 text-green-800 dark:bg-green-900/50 dark:text-green-200 hover:opacity-80"
              >
                <CheckCircle className="w-3 h-3 shrink-0" />완료
              </button>
              <button
                onClick={() => { onChangeStatus(popupSlot.id, 'partial'); setPopup(null); }}
                className="flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-orange-200 text-orange-800 dark:bg-orange-900/50 dark:text-orange-200 hover:opacity-80"
              >
                <AlertCircle className="w-3 h-3 shrink-0" />부분
              </button>
              <button
                onClick={() => { onChangeStatus(popupSlot.id, 'skipped'); setPopup(null); }}
                className="flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300 hover:opacity-80"
              >
                <SkipForward className="w-3 h-3 shrink-0" />건너뜀
              </button>
              {onUpdateLog && popupSlot.actual_logs[0] && (
                <>
                  <div className="border-t border-gray-200 dark:border-gray-600 my-0.5" />
                  <button
                    onClick={(e) => openEditTime(e, popupSlot)}
                    className="flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 hover:opacity-80"
                  >
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
              <input
                type="time"
                value={editTime.startVal}
                onChange={(e) => setEditTime((p) => p ? { ...p, startVal: e.target.value } : null)}
                className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">종료 시간</label>
              <input
                type="time"
                value={editTime.endVal}
                onChange={(e) => setEditTime((p) => p ? { ...p, endVal: e.target.value } : null)}
                className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button
              onClick={() => setEditTime(null)}
              className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              취소
            </button>
            <button
              onClick={handleSaveTime}
              className="px-4 py-1.5 text-sm font-medium bg-purple-600 hover:bg-purple-700 text-white rounded-lg"
            >
              저장
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
