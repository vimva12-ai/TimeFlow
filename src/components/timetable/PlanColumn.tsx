'use client';

import clsx from 'clsx';
import { format, parseISO } from 'date-fns';
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
}

export default function PlanColumn({ slots, planId, date }: PlanColumnProps) {
  const { setEditingSlotId, startHour, endHour, slotHeight } = useTimetableStore();
  const totalSlots = ((endHour - startHour) * 60) / SLOT_MINUTES;

  return (
    <div className="relative w-full" style={{ height: totalSlots * slotHeight }}>
      {/* 슬롯 블록 */}
      {slots.map((slot) => {
        const top = slotIndex(slot.start_at, startHour) * slotHeight;
        const height = slotSpan(slot.start_at, slot.end_at) * slotHeight;
        return (
          <button
            key={slot.id}
            data-slot="true"
            className={clsx(
              'absolute left-0.5 right-0.5 rounded-sm border-l-4 px-1.5 text-left text-[11px] overflow-hidden hover:opacity-80 transition-opacity z-[2]',
              statusColor(slot.status)
            )}
            style={{ top: top + 1, height: height - 2 }}
            onClick={() => setEditingSlotId(slot.id)}
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
      })}
    </div>
  );
}
