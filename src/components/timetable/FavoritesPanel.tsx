'use client';

import { X } from 'lucide-react';
import { usePlanFavorites, type PlanFavorite } from '@/hooks/usePlanFavorites';
import { useI18n } from '@/lib/i18n';

export default function FavoritesPanel() {
  const { t } = useI18n();
  const { favorites, removeFavorite } = usePlanFavorites();

  /** 즐겨찾기 드래그 시작: PLAN 컬럼에 드롭할 수 있도록 데이터 설정 */
  function handleDragStart(e: React.DragEvent<HTMLDivElement>, fav: PlanFavorite) {
    e.dataTransfer.setData(
      'text/x-favorite',
      JSON.stringify({ title: fav.title, durationMinutes: fav.durationMinutes }),
    );
    e.dataTransfer.effectAllowed = 'copy';
  }

  if (favorites.length === 0) {
    return (
      <div className="flex flex-col items-center justify-start pt-3 px-0.5 gap-1">
        <span className="text-[8px] text-gray-400 dark:text-gray-500 text-center leading-tight">
          {t.favoriteEmpty}
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5 px-0.5 pt-0.5">
      {favorites.map((fav) => (
        <div
          key={fav.id}
          draggable
          onDragStart={(e) => handleDragStart(e, fav)}
          className="group relative flex flex-col gap-0.5 p-1 rounded bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 cursor-grab active:cursor-grabbing touch-none hover:border-yellow-400 dark:hover:border-yellow-600 transition-colors"
          title={`${fav.title} (${fav.durationMinutes < 60 ? `${fav.durationMinutes}분` : `${fav.durationMinutes / 60}h`}) — ${t.favoriteDragHint}`}
        >
          {/* 제목 (2줄까지 표시) */}
          <span className="text-[8px] font-medium text-yellow-800 dark:text-yellow-300 leading-tight break-all line-clamp-2">
            {fav.title}
          </span>
          {/* 시간 */}
          <span className="text-[7px] text-yellow-600/80 dark:text-yellow-400/70">
            {fav.durationMinutes < 60
              ? `${fav.durationMinutes}분`
              : `${fav.durationMinutes / 60}h`}
          </span>
          {/* 삭제 버튼 — hover 시 표시 */}
          <button
            onMouseDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
            }}
            onClick={(e) => {
              e.stopPropagation();
              removeFavorite.mutate(fav.id);
            }}
            className="absolute top-0.5 right-0.5 p-0.5 rounded text-yellow-400/60 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors can-hover:opacity-0 can-hover:group-hover:opacity-100"
            aria-label="즐겨찾기 삭제"
          >
            <X className="w-2 h-2" />
          </button>
        </div>
      ))}
    </div>
  );
}
