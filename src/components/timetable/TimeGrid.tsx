'use client';

import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { Plus, Star } from 'lucide-react';
import { useTimetableStore } from '@/store/timetableStore';

export const SLOT_MINUTES = 30;

function minutesFromMidnight(isoString: string): number {
  const d = new Date(isoString);
  return d.getHours() * 60 + d.getMinutes();
}

/** Y 좌표 → 시/분 변환 (드래그 드롭에서 사용) */
function getTimeFromY(
  relY: number,
  startHour: number,
  slotHeight: number,
  totalSlots: number,
): { h: number; m: number } | null {
  const maxMins = totalSlots * SLOT_MINUTES;
  const offsetMins = Math.round(relY / (slotHeight / SLOT_MINUTES));
  if (offsetMins < 0 || offsetMins >= maxMins) return null;
  const absoluteMins = startHour * 60 + offsetMins;
  return { h: Math.floor(absoluteMins / 60) % 24, m: absoluteMins % 60 };
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
  const maxMins = totalSlots * SLOT_MINUTES;
  const offsetMins = Math.round(relY / (slotHeight / SLOT_MINUTES));
  if (offsetMins < 0 || offsetMins >= maxMins) return null;

  const absoluteMins = startHour * 60 + offsetMins;
  return { h: Math.floor(absoluteMins / 60) % 24, m: absoluteMins % 60 };
}

interface TimeGridProps {
  planColumn: React.ReactNode;
  actualColumn: React.ReactNode;
  // 즐겨찾기 패널 (데스크톱 전용)
  favoritesPanel?: React.ReactNode;
  favoritesOpen?: boolean;
  onToggleFavorites?: () => void;
  onAddPlan?: () => void;
  onAddActual?: () => void;
  onPlanCellClick?: (h: number, m: number) => void;
  onActualCellClick?: (h: number, m: number) => void;
  // 드래그 드롭: 할 일 → PLAN, 즐겨찾기 → PLAN
  onTodoDrop?: (h: number, m: number, title: string) => void;
  onFavoriteDrop?: (h: number, m: number, title: string, durationMin: number) => void;
}

export default function TimeGrid({
  planColumn, actualColumn,
  favoritesPanel, favoritesOpen, onToggleFavorites,
  onAddPlan, onAddActual,
  onPlanCellClick, onActualCellClick,
  onTodoDrop, onFavoriteDrop,
}: TimeGridProps) {
  const { startHour, endHour, slotHeight } = useTimetableStore();
  const totalSlots = ((endHour - startHour) * 60) / SLOT_MINUTES;

  const [offset, setOffset] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  // PLAN 컬럼에 드래그 중인지 표시 (시각적 피드백)
  const [planDragOver, setPlanDragOver] = useState(false);

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
          <div className="flex items-center gap-1">
            {/* 즐겨찾기 토글 버튼 (데스크톱 전용) */}
            {onToggleFavorites && (
              <button
                onClick={onToggleFavorites}
                title="즐겨찾기 패널"
                className={`hidden md:flex items-center p-0.5 rounded transition-colors ${
                  favoritesOpen
                    ? 'text-yellow-500 dark:text-yellow-400'
                    : 'text-gray-400 hover:text-yellow-500 dark:text-gray-500 dark:hover:text-yellow-400'
                }`}
              >
                <Star className="w-3 h-3" fill={favoritesOpen ? 'currentColor' : 'none'} />
              </button>
            )}
            {onAddPlan && (
              <button onClick={onAddPlan} className="flex items-center gap-0.5 text-[10px] text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-200">
                <Plus className="w-3 h-3" />추가
              </button>
            )}
          </div>
        </div>
        {/* 즐겨찾기 패널 헤더 (데스크톱 전용, 표시 중일 때) */}
        {favoritesOpen && favoritesPanel && (
          <div className="hidden md:flex w-16 shrink-0 items-center justify-center border-r border-gray-300 dark:border-gray-600 bg-yellow-50 dark:bg-yellow-900/10">
            <Star className="w-3 h-3 text-yellow-500" fill="currentColor" />
          </div>
        )}
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
                i % 2 === 0
                  ? 'border-t border-gray-300 dark:border-gray-600/80'
                  : 'border-t border-gray-200 dark:border-transparent',
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

        {/* PLAN 컬럼 — 클릭/드래그 드롭 처리 */}
        <div
          className={clsx(
            'flex-1 relative border-r border-gray-300 dark:border-gray-600 transition-colors',
            onPlanCellClick ? 'cursor-pointer' : '',
            // 드래그 오버 시 시각적 피드백
            planDragOver ? 'ring-2 ring-inset ring-blue-400 bg-blue-50/40 dark:bg-blue-900/10' : '',
          )}
          onClick={(e) => {
            if (!onPlanCellClick) return;
            const t = getTimeFromClick(e, startHour, slotHeight, totalSlots);
            if (t) onPlanCellClick(t.h, t.m);
          }}
          onDragOver={(e) => {
            const types = Array.from(e.dataTransfer.types);
            if (types.includes('text/x-todo-title') || types.includes('text/x-favorite')) {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'copy';
              setPlanDragOver(true);
            }
          }}
          onDragLeave={(e) => {
            // 자식 요소로 이동할 때는 무시 (currentTarget 벗어날 때만 처리)
            if (!e.currentTarget.contains(e.relatedTarget as Node)) {
              setPlanDragOver(false);
            }
          }}
          onDrop={(e) => {
            setPlanDragOver(false);
            const rect = e.currentTarget.getBoundingClientRect();
            const relY = e.clientY - rect.top;
            const timeResult = getTimeFromY(relY, startHour, slotHeight, totalSlots);
            if (!timeResult) return;

            const todoTitle = e.dataTransfer.getData('text/x-todo-title');
            const favoriteRaw = e.dataTransfer.getData('text/x-favorite');

            if (todoTitle && onTodoDrop) {
              e.preventDefault();
              onTodoDrop(timeResult.h, timeResult.m, todoTitle);
            } else if (favoriteRaw && onFavoriteDrop) {
              e.preventDefault();
              try {
                const fav = JSON.parse(favoriteRaw) as { title: string; durationMinutes: number };
                onFavoriteDrop(timeResult.h, timeResult.m, fav.title, fav.durationMinutes);
              } catch {
                // 파싱 실패 시 무시
              }
            }
          }}
        >
          {/* 배경 격자 — 다크모드에서 가독성 개선: 30분 경계선 매우 연하게 처리 */}
          {Array.from({ length: totalSlots }, (_, i) => (
            <div
              key={i}
              className={clsx(
                'absolute left-0 right-0 pointer-events-none',
                // 라이트 모드: 기존 그대로 / 다크 모드: 시간(짝수) 경계만 표시
                i % 2 === 0
                  ? 'border-t border-gray-200 dark:border-gray-700/70'
                  : 'border-t border-gray-100 dark:border-transparent',
                // 다크 모드에서는 배경 줄무늬 제거 (슬롯이 더 잘 보이게)
                Math.floor(i / 2) % 2 === 1
                  ? 'bg-slate-50 dark:bg-transparent'
                  : 'bg-white dark:bg-transparent',
              )}
              style={{ top: i * slotHeight, height: slotHeight }}
            />
          ))}
          <div className="relative" style={{ height: totalSlots * slotHeight }}>
            {planColumn}
          </div>
        </div>

        {/* 즐겨찾기 패널 컬럼 — 데스크톱 전용, 표시 중일 때만 렌더 */}
        {favoritesOpen && favoritesPanel && (
          <div
            className="hidden md:block w-16 shrink-0 border-r border-gray-300 dark:border-gray-600 bg-yellow-50/50 dark:bg-yellow-900/5 overflow-y-auto"
            style={{ height: totalSlots * slotHeight }}
          >
            {favoritesPanel}
          </div>
        )}

        {/* ACTUAL 컬럼 — 컬럼 전체에 onClick */}
        <div
          className={clsx(
            'flex-1 relative',
            onActualCellClick ? 'cursor-pointer' : '',
          )}
          onClick={(e) => {
            if (!onActualCellClick) return;
            const t = getTimeFromClick(e, startHour, slotHeight, totalSlots);
            if (t) onActualCellClick(t.h, t.m);
          }}
        >
          {/* 배경 격자 — 다크모드 가독성 개선 적용 */}
          {Array.from({ length: totalSlots }, (_, i) => (
            <div
              key={i}
              className={clsx(
                'absolute left-0 right-0 pointer-events-none',
                i % 2 === 0
                  ? 'border-t border-gray-200 dark:border-gray-700/70'
                  : 'border-t border-gray-100 dark:border-transparent',
                Math.floor(i / 2) % 2 === 1
                  ? 'bg-slate-50 dark:bg-transparent'
                  : 'bg-white dark:bg-transparent',
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
