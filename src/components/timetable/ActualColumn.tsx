'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { format, parseISO, differenceInMinutes } from 'date-fns';
import { CheckCircle, SkipForward, AlertCircle, Play } from 'lucide-react';
import { type TimeSlotWithLogs, type SlotStatus } from '@/types/database';
import { SLOT_MINUTES, slotIndex, slotSpan } from './TimeGrid';
import { useTimetableStore } from '@/store/timetableStore';

interface ActualColumnProps {
  slots: TimeSlotWithLogs[];
  onStart: (slotId: string) => void;
  onComplete: (slotId: string, status: SlotStatus, end: string) => void;
  onChangeStatus: (slotId: string, status: SlotStatus) => void;
}

function punctualityLabel(plannedStart: string, actualStart: string): string {
  const diffMin = differenceInMinutes(parseISO(actualStart), parseISO(plannedStart));
  if (Math.abs(diffMin) <= 15) return '정시';
  if (diffMin > 0) return `${diffMin}분 지연`;
  return `${Math.abs(diffMin)}분 일찍`;
}

// 버튼이 슬롯 안에 들어갈 수 없는 높이 기준 (px)
const ACTION_THRESHOLD = 60;

type PopupState = {
  slotId: string;
  type: 'progress' | 'edit';
  x: number;
  y: number;
} | null;

export default function ActualColumn({ slots, onStart, onComplete, onChangeStatus }: ActualColumnProps) {
  const { startHour, endHour, slotHeight } = useTimetableStore();
  const totalSlots = ((endHour - startHour) * 60) / SLOT_MINUTES;
  const [popup, setPopup] = useState<PopupState>(null);

  // 팝업 바깥 클릭 시 닫기
  useEffect(() => {
    if (!popup) return;
    const handler = (e: MouseEvent) => {
      if (!(e.target as Element).closest('[data-popup]')) {
        setPopup(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [popup]);

  function openPopup(e: React.MouseEvent, slotId: string, type: 'progress' | 'edit') {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    // 오른쪽으로 팝업 위치 계산 (뷰포트 기준 fixed)
    const x = Math.min(rect.right + 6, window.innerWidth - 160);
    const y = rect.top + rect.height / 2;
    setPopup({ slotId, type, x, y });
  }

  const popupSlot = popup ? slots.find((s) => s.id === popup.slotId) : null;

  return (
    <div className="relative w-full" style={{ height: totalSlots * slotHeight }}>
      {slots.map((slot) => {
        const top = slotIndex(slot.start_at, startHour) * slotHeight;
        const height = slotSpan(slot.start_at, slot.end_at) * slotHeight;
        const log = slot.actual_logs[0] ?? null;
        const hasStarted = !!log?.actual_start;
        const hasEnded = !!log?.actual_end;
        const showInline = hasStarted && !hasEnded && height >= ACTION_THRESHOLD;
        const showCompact = hasStarted && !hasEnded && height < ACTION_THRESHOLD;

        return (
          <div
            key={slot.id}
            data-slot="true"
            className="absolute left-0.5 right-0.5 rounded-sm border border-gray-300 dark:border-gray-600 overflow-hidden z-[2]"
            style={{ top: top + 1, height: height - 2 }}
          >
            {!hasStarted ? (
              <button
                onClick={() => onStart(slot.id)}
                className="w-full h-full flex items-center justify-center gap-1 text-[11px] text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
              >
                <Play className="w-3 h-3 shrink-0" />
                {height >= 32 ? '시작' : ''}
              </button>
            ) : showInline ? (
              /* 충분히 큰 슬롯: 인라인으로 버튼 표시 */
              <div className="flex flex-col h-full p-0.5 gap-0.5 bg-blue-50/80 dark:bg-blue-900/20">
                <div className="text-[9px] text-blue-600 dark:text-blue-400 font-semibold leading-tight px-0.5">
                  {format(parseISO(log.actual_start!), 'HH:mm')} ▶
                </div>
                <div className="flex gap-0.5 flex-wrap">
                  <button
                    onClick={() => onComplete(slot.id, 'done', new Date().toISOString())}
                    className="flex items-center gap-0.5 text-[9px] px-1 py-0.5 rounded bg-green-200 text-green-800 dark:bg-green-900/50 dark:text-green-200 hover:opacity-80"
                  >
                    <CheckCircle className="w-2 h-2" />완료
                  </button>
                  <button
                    onClick={() => onComplete(slot.id, 'partial', new Date().toISOString())}
                    className="flex items-center gap-0.5 text-[9px] px-1 py-0.5 rounded bg-orange-200 text-orange-800 dark:bg-orange-900/50 dark:text-orange-200 hover:opacity-80"
                  >
                    <AlertCircle className="w-2 h-2" />부분
                  </button>
                  <button
                    onClick={() => onComplete(slot.id, 'skipped', new Date().toISOString())}
                    className="flex items-center gap-0.5 text-[9px] px-1 py-0.5 rounded bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300 hover:opacity-80"
                  >
                    <SkipForward className="w-2 h-2" />건너뜀
                  </button>
                </div>
              </div>
            ) : showCompact ? (
              /* 좁은 슬롯: 탭하면 오른쪽 팝업 */
              <button
                onClick={(e) => openPopup(e, slot.id, 'progress')}
                className="w-full h-full flex items-center px-1 gap-0.5 bg-blue-50/80 dark:bg-blue-900/20 hover:bg-blue-100/80 dark:hover:bg-blue-800/30 transition-colors"
              >
                <Play className="w-2.5 h-2.5 shrink-0 text-blue-500" />
                <span className="text-[9px] text-blue-600 dark:text-blue-400 font-semibold truncate">
                  {format(parseISO(log.actual_start!), 'HH:mm')}
                </span>
              </button>
            ) : (
              /* 완료 상태: 클릭 시 상태 변경 팝업 */
              <div
                onClick={(e) => openPopup(e, slot.id, 'edit')}
                className={clsx(
                  'w-full h-full flex flex-col justify-center px-1.5 text-[11px] cursor-pointer hover:opacity-75 transition-opacity',
                  slot.status === 'done'    && 'bg-green-100 dark:bg-green-900/30',
                  slot.status === 'partial' && 'bg-orange-100 dark:bg-orange-900/30',
                  slot.status === 'skipped' && 'bg-gray-100 dark:bg-gray-800/40',
                )}
              >
                <div className="font-medium text-gray-800 dark:text-gray-200 leading-tight">
                  {format(parseISO(log.actual_start!), 'HH:mm')}–{format(parseISO(log.actual_end!), 'HH:mm')}
                  {height >= 36 && (
                    <span className="ml-1 text-[9px] opacity-60">
                      ({differenceInMinutes(parseISO(log.actual_end!), parseISO(log.actual_start!))}분)
                    </span>
                  )}
                </div>
                {height >= 48 && (
                  <div className="text-[9px] opacity-60 leading-tight">
                    {punctualityLabel(slot.start_at, log.actual_start!)}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* 오른쪽 팝업 (fixed → overflow 클리핑 우회) */}
      {popup && popupSlot && typeof window !== 'undefined' && createPortal(
        <div
          data-popup="true"
          style={{ position: 'fixed', top: popup.y, left: popup.x, zIndex: 9999, transform: 'translateY(-50%)' }}
          className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md shadow-lg p-1 flex gap-0.5"
        >
          {popup.type === 'progress' ? (
            <>
              <button
                onClick={() => { onComplete(popupSlot.id, 'done', new Date().toISOString()); setPopup(null); }}
                className="flex items-center gap-0.5 text-[10px] px-1.5 py-1 rounded bg-green-200 text-green-800 dark:bg-green-900/50 dark:text-green-200 hover:opacity-80 whitespace-nowrap"
              >
                <CheckCircle className="w-3 h-3 shrink-0" />완료
              </button>
              <button
                onClick={() => { onComplete(popupSlot.id, 'partial', new Date().toISOString()); setPopup(null); }}
                className="flex items-center gap-0.5 text-[10px] px-1.5 py-1 rounded bg-orange-200 text-orange-800 dark:bg-orange-900/50 dark:text-orange-200 hover:opacity-80 whitespace-nowrap"
              >
                <AlertCircle className="w-3 h-3 shrink-0" />부분
              </button>
              <button
                onClick={() => { onComplete(popupSlot.id, 'skipped', new Date().toISOString()); setPopup(null); }}
                className="flex items-center gap-0.5 text-[10px] px-1.5 py-1 rounded bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300 hover:opacity-80 whitespace-nowrap"
              >
                <SkipForward className="w-3 h-3 shrink-0" />건너뜀
              </button>
            </>
          ) : (
            /* 완료된 슬롯 상태 재수정 */
            <>
              <button
                onClick={() => { onChangeStatus(popupSlot.id, 'done'); setPopup(null); }}
                className="flex items-center gap-0.5 text-[10px] px-1.5 py-1 rounded bg-green-200 text-green-800 dark:bg-green-900/50 dark:text-green-200 hover:opacity-80 whitespace-nowrap"
              >
                <CheckCircle className="w-3 h-3 shrink-0" />완료
              </button>
              <button
                onClick={() => { onChangeStatus(popupSlot.id, 'partial'); setPopup(null); }}
                className="flex items-center gap-0.5 text-[10px] px-1.5 py-1 rounded bg-orange-200 text-orange-800 dark:bg-orange-900/50 dark:text-orange-200 hover:opacity-80 whitespace-nowrap"
              >
                <AlertCircle className="w-3 h-3 shrink-0" />부분
              </button>
              <button
                onClick={() => { onChangeStatus(popupSlot.id, 'skipped'); setPopup(null); }}
                className="flex items-center gap-0.5 text-[10px] px-1.5 py-1 rounded bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300 hover:opacity-80 whitespace-nowrap"
              >
                <SkipForward className="w-3 h-3 shrink-0" />건너뜀
              </button>
            </>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}
