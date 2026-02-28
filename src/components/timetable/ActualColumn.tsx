'use client';

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
}

function punctualityLabel(plannedStart: string, actualStart: string): string {
  const diffMin = differenceInMinutes(parseISO(actualStart), parseISO(plannedStart));
  if (Math.abs(diffMin) <= 15) return '정시';
  if (diffMin > 0) return `${diffMin}분 지연`;
  return `${Math.abs(diffMin)}분 일찍`;
}

export default function ActualColumn({ slots, onStart, onComplete }: ActualColumnProps) {
  const { startHour, endHour, slotHeight } = useTimetableStore();
  const totalSlots = ((endHour - startHour) * 60) / SLOT_MINUTES;
  const now = new Date().toISOString();

  return (
    <div className="relative w-full" style={{ height: totalSlots * slotHeight }}>

      {/* 슬롯 블록 */}
      {slots.map((slot) => {
        const top = slotIndex(slot.start_at, startHour) * slotHeight;
        const height = slotSpan(slot.start_at, slot.end_at) * slotHeight;
        const log = slot.actual_logs[0] ?? null;
        const hasStarted = !!log?.actual_start;
        const hasEnded = !!log?.actual_end;

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
            ) : !hasEnded ? (
              <div className="flex flex-col h-full p-0.5 gap-0.5 bg-blue-50/80 dark:bg-blue-900/20">
                <div className="text-[9px] text-blue-600 dark:text-blue-400 font-semibold leading-tight px-0.5">
                  {format(parseISO(log.actual_start!), 'HH:mm')} ▶
                </div>
                <div className="flex gap-0.5 flex-wrap">
                  <button
                    onClick={() => onComplete(slot.id, 'done', now)}
                    className="flex items-center gap-0.5 text-[9px] px-1 py-0.5 rounded bg-green-200 text-green-800 dark:bg-green-900/50 dark:text-green-200 hover:opacity-80"
                  >
                    <CheckCircle className="w-2 h-2" />완료
                  </button>
                  <button
                    onClick={() => onComplete(slot.id, 'partial', now)}
                    className="flex items-center gap-0.5 text-[9px] px-1 py-0.5 rounded bg-orange-200 text-orange-800 dark:bg-orange-900/50 dark:text-orange-200 hover:opacity-80"
                  >
                    <AlertCircle className="w-2 h-2" />부분
                  </button>
                  <button
                    onClick={() => onComplete(slot.id, 'skipped', now)}
                    className="flex items-center gap-0.5 text-[9px] px-1 py-0.5 rounded bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300 hover:opacity-80"
                  >
                    <SkipForward className="w-2 h-2" />건너뜀
                  </button>
                </div>
              </div>
            ) : (
              <div
                className={clsx(
                  'w-full h-full flex flex-col justify-center px-1.5 text-[11px]',
                  slot.status === 'done'    && 'bg-green-100 dark:bg-green-900/30',
                  slot.status === 'partial' && 'bg-orange-100 dark:bg-orange-900/30',
                  slot.status === 'skipped' && 'bg-gray-100 dark:bg-gray-800/40'
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
    </div>
  );
}
