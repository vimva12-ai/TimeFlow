'use client';

import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { Plus } from 'lucide-react';
import { useTimetableStore } from '@/store/timetableStore';

export const SLOT_MINUTES = 30;

function minutesFromMidnight(isoString: string): number {
  const d = new Date(isoString);
  return d.getHours() * 60 + d.getMinutes();
}

export function slotIndex(isoString: string, startHour: number): number {
  const mins = minutesFromMidnight(isoString);
  return (mins - startHour * 60) / SLOT_MINUTES;
}

export function slotSpan(startIso: string, endIso: string): number {
  return Math.max(1, (minutesFromMidnight(endIso) - minutesFromMidnight(startIso)) / SLOT_MINUTES);
}

/** 컬럼 클릭 위치 → 시/분 변환. 기존 슬롯 클릭이면 null 반환 */
function getTimeFromClick(
  e: React.MouseEvent<HTMLDivElement>,
  startHour: number,
  slotHeight: number,
  totalSlots: number,
): { h: number; m: number } | null {
  // 기존 슬롯 위를 클릭한 경우 무시
  if ((e.target as Element).closest('[data-slot]')) return null;

  const rect = e.currentTarget.getBoundingClientRect();
  const relY = e.clientY - rect.top;           // getBoundingClientRect 는 스크롤 반영
  const idx = Math.floor(relY / slotHeight);
  if (idx < 0 || idx >= totalSlots) return null;

  const totalMins = startHour * 60 + idx * SLOT_MINUTES;
  return { h: Math.floor(totalMins / 60) % 24, m: totalMins % 60 };
}

interface TimeGridProps {
  planColumn: React.ReactNode;
  actualColumn: React.ReactNode;
  onAddPlan?: () => void;
  onAddActual?: () => void;
  onPlanCellClick?: (h: number, m: number) => void;
  onActualCellClick?: (h: number, m: number) => void;
}

export default function TimeGrid({
  planColumn, actualColumn,
  onAddPlan, onAddActual,
  onPlanCellClick, onActualCellClick,
}: TimeGridProps) {
  const { startHour, endHour, slotHeight } = useTimetableStore();
  const totalSlots = ((endHour - startHour) * 60) / SLOT_MINUTES;

  const [offset, setOffset] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const calc = () => {
      const mins = new Date().getHours() * 60 + new Date().getMinutes();
      return ((mins - startHour * 60) / SLOT_MINUTES) * slotHeight;
    };
    setOffset(calc());
    const id = setInterval(() => setOffset(calc()), 60_000);
    return () => clearInterval(id);
  }, [startHour, slotHeight]);

  useEffect(() => {
    if (containerRef.current && offset > 0) {
      containerRef.current.scrollTop = Math.max(0, offset - 120);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hourLabels = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto" style={{ height: 'calc(100vh - 96px)' }}>
      {/* 헤더 행 */}
      <div className="sticky top-0 z-20 flex border-b-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900">
        <div className="w-12 shrink-0 border-r border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800" />
        <div className="flex-1 flex items-center justify-between px-2 py-1 border-r border-gray-300 dark:border-gray-600 bg-blue-50 dark:bg-blue-950/30">
          <span className="text-xs font-bold text-blue-700 dark:text-blue-300 tracking-wide">PLAN</span>
          {onAddPlan && (
            <button onClick={onAddPlan} className="flex items-center gap-0.5 text-[10px] text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-200">
              <Plus className="w-3 h-3" />추가
            </button>
          )}
        </div>
        <div className="flex-1 flex items-center justify-between px-2 py-1 bg-green-50 dark:bg-green-950/30">
          <span className="text-xs font-bold text-green-700 dark:text-green-300 tracking-wide">ACTUAL</span>
          {onAddActual && (
            <button onClick={onAddActual} className="flex items-center gap-0.5 text-[10px] text-green-500 hover:text-green-700 dark:text-green-400 dark:hover:text-green-200">
              <Plus className="w-3 h-3" />추가
            </button>
          )}
        </div>
      </div>

      {/* 그리드 본문 */}
      <div className="relative flex" style={{ height: totalSlots * slotHeight }}>
        {/* 시간 레이블 열 */}
        <div className="w-12 shrink-0 relative select-none border-r border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/60">
          {Array.from({ length: totalSlots }, (_, i) => (
            <div
              key={i}
              className={clsx(
                'absolute left-0 right-0 pointer-events-none',
                i % 2 === 0 ? 'border-t border-gray-300 dark:border-gray-600' : 'border-t border-gray-200 dark:border-gray-700'
              )}
              style={{ top: i * slotHeight, height: slotHeight }}
            />
          ))}
          {hourLabels.map((h) => (
            <div
              key={h}
              className="absolute w-full flex items-start justify-end pr-1 pt-0.5 text-[10px] font-medium text-gray-500 dark:text-gray-400 pointer-events-none"
              style={{ top: (h - startHour) * 2 * slotHeight, height: slotHeight }}
            >
              {String(h).padStart(2, '0')}
            </div>
          ))}
        </div>

        {/* PLAN 컬럼 — 컬럼 전체에 onClick */}
        <div
          className={clsx(
            'flex-1 relative border-r border-gray-300 dark:border-gray-600',
            onPlanCellClick ? 'cursor-pointer' : ''
          )}
          onClick={(e) => {
            if (!onPlanCellClick) return;
            const t = getTimeFromClick(e, startHour, slotHeight, totalSlots);
            if (t) onPlanCellClick(t.h, t.m);
          }}
        >
          {/* 엑셀 배경 (pointer-events-none) */}
          {Array.from({ length: totalSlots }, (_, i) => (
            <div
              key={i}
              className={clsx(
                'absolute left-0 right-0 pointer-events-none',
                i % 2 === 0 ? 'border-t border-gray-200 dark:border-gray-700' : 'border-t border-gray-100 dark:border-gray-800',
                Math.floor(i / 2) % 2 === 1 ? 'bg-slate-50 dark:bg-slate-800/20' : 'bg-white dark:bg-transparent'
              )}
              style={{ top: i * slotHeight, height: slotHeight }}
            />
          ))}
          <div className="relative" style={{ height: totalSlots * slotHeight }}>
            {planColumn}
          </div>
        </div>

        {/* ACTUAL 컬럼 — 컬럼 전체에 onClick */}
        <div
          className={clsx(
            'flex-1 relative',
            onActualCellClick ? 'cursor-pointer' : ''
          )}
          onClick={(e) => {
            if (!onActualCellClick) return;
            const t = getTimeFromClick(e, startHour, slotHeight, totalSlots);
            if (t) onActualCellClick(t.h, t.m);
          }}
        >
          {/* 엑셀 배경 (pointer-events-none) */}
          {Array.from({ length: totalSlots }, (_, i) => (
            <div
              key={i}
              className={clsx(
                'absolute left-0 right-0 pointer-events-none',
                i % 2 === 0 ? 'border-t border-gray-200 dark:border-gray-700' : 'border-t border-gray-100 dark:border-gray-800',
                Math.floor(i / 2) % 2 === 1 ? 'bg-slate-50 dark:bg-slate-800/20' : 'bg-white dark:bg-transparent'
              )}
              style={{ top: i * slotHeight, height: slotHeight }}
            />
          ))}
          <div className="relative" style={{ height: totalSlots * slotHeight }}>
            {actualColumn}
          </div>
        </div>

        {/* 현재 시각 빨간 선 */}
        {offset >= 0 && offset <= totalSlots * slotHeight && (
          <div
            className="absolute left-0 right-0 flex items-center pointer-events-none z-10"
            style={{ top: offset }}
          >
            <div className="w-2 h-2 rounded-full bg-red-500 ml-10 shrink-0" />
            <div className="flex-1 border-t-2 border-red-500" />
          </div>
        )}
      </div>
    </div>
  );
}
