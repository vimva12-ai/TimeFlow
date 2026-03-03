'use client';

import { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { Plus, X, RotateCcw, CheckSquare } from 'lucide-react';
import { useTodo, type TodoItem } from '@/hooks/useTodo';
import { useI18n } from '@/lib/i18n';

const MAX_ITEMS = 15;

function todayStr() {
  return format(new Date(), 'yyyy-MM-dd');
}

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

export default function SidebarTodo() {
  const { t } = useI18n();
  const [date, setDate] = useState(todayStr);
  const { items: remoteItems, isLoading, save } = useTodo(date);
  const [inputText, setInputText] = useState('');

  // 로컬 상태로 즉시 UI 업데이트 (React Query 비동기 캐시 타이밍 문제 방지)
  // null = 아직 Firebase 데이터 미초기화 (로딩 중)
  const [localItems, setLocalItems] = useState<TodoItem[] | null>(null);
  const initializedRef = useRef(false);

  // 자정에 날짜 갱신 → 새 날짜로 todos 로드
  useEffect(() => {
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const ms = midnight.getTime() - now.getTime();
    const timer = setTimeout(() => setDate(todayStr()), ms);
    return () => clearTimeout(timer);
  }, [date]);

  // 날짜가 바뀌면 로컬 상태 초기화 (새 날짜 데이터를 Firebase에서 다시 로드)
  useEffect(() => {
    initializedRef.current = false;
    setLocalItems(null);
  }, [date]);

  // Firebase 데이터 로드 완료 시 로컬 상태 초기화 (날짜당 최초 1회)
  useEffect(() => {
    if (!isLoading && !initializedRef.current) {
      setLocalItems(remoteItems);
      initializedRef.current = true;
    }
  }, [isLoading, remoteItems]);

  // 표시용 items: 로컬 상태 우선, 로딩 중엔 빈 배열
  const items = localItems ?? [];
  const isReady = !isLoading && localItems !== null;

  function addItem() {
    const text = inputText.trim();
    if (!text || items.length >= MAX_ITEMS) return;
    // 로컬 상태를 먼저 동기적으로 업데이트 → 즉시 반영
    const newItems = [...items, { id: generateId(), text, checked: false }];
    setLocalItems(newItems);
    save(newItems);
    setInputText('');
  }

  function toggleItem(id: string) {
    // 로컬 상태를 먼저 동기적으로 업데이트 → 체크/언체크 즉시 반영
    const newItems = items.map((item): TodoItem =>
      item.id === id ? { ...item, checked: !item.checked } : item
    );
    setLocalItems(newItems);
    save(newItems);
  }

  function deleteItem(id: string) {
    const newItems = items.filter((item) => item.id !== id);
    setLocalItems(newItems);
    save(newItems);
  }

  function resetAll() {
    setLocalItems([]);
    save([]);
  }

  const checkedCount = items.filter((i) => i.checked).length;
  const totalCount = items.length;
  const progressPct = totalCount > 0 ? (checkedCount / totalCount) * 100 : 0;

  return (
    <div className="flex flex-col gap-1.5">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-1.5">
          <CheckSquare className="w-3.5 h-3.5 text-purple-500" />
          <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            {t.todayTodo}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {totalCount > 0 && (
            <span className="text-[10px] text-gray-400 dark:text-gray-500 tabular-nums">
              {checkedCount}/{totalCount}
            </span>
          )}
          <button
            onClick={resetAll}
            className="p-0.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 dark:text-gray-500 transition-colors"
            title="오늘 목록 초기화"
            aria-label="초기화"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* 달성률 바 */}
      {totalCount > 0 && (
        <div className="h-1 bg-gray-100 dark:bg-gray-800 rounded-full mx-1 overflow-hidden">
          <div
            className="h-full bg-purple-500 rounded-full transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      )}

      {/* 할 일 목록 */}
      <div className="flex flex-col gap-0.5 max-h-44 overflow-y-auto scrollbar-hide">
        {!isReady ? (
          <div className="text-[11px] text-gray-400 dark:text-gray-500 text-center py-2">{t.loading}</div>
        ) : totalCount === 0 ? (
          <div className="text-[11px] text-gray-400 dark:text-gray-500 text-center py-2">
            {t.todoEmpty}
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="flex items-start gap-1.5 group px-1 py-0.5 rounded hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
            >
              <input
                type="checkbox"
                checked={item.checked}
                onChange={() => toggleItem(item.id)}
                className="mt-0.5 w-3.5 h-3.5 rounded accent-purple-500 cursor-pointer flex-shrink-0"
              />
              <span
                className={`flex-1 text-[11px] leading-tight break-words min-w-0 ${
                  item.checked
                    ? 'line-through text-gray-400 dark:text-gray-600'
                    : 'text-gray-700 dark:text-gray-300'
                }`}
              >
                {item.text}
              </span>
              <button
                onClick={() => deleteItem(item.id)}
                className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 transition-all flex-shrink-0 mt-0.5"
                aria-label="삭제"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </div>
          ))
        )}
      </div>

      {/* 하단 달성률 */}
      {isReady && totalCount > 0 && (
        <div className="flex items-center justify-between px-1 pt-0.5 border-t border-gray-100 dark:border-gray-800">
          <span className="text-[10px] text-gray-400 dark:text-gray-500">
            {checkedCount}/{totalCount}
          </span>
          <span className="text-sm font-bold tabular-nums text-purple-600 dark:text-purple-400">
            {Math.round(progressPct)}%
          </span>
        </div>
      )}

      {/* 입력 */}
      {isReady && (
        totalCount < MAX_ITEMS ? (
          <div className="flex items-center gap-1 px-1">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addItem()}
              placeholder={t.todoAdd}
              className="flex-1 text-[11px] bg-transparent border-b border-gray-200 dark:border-gray-700 outline-none py-0.5 text-gray-700 dark:text-gray-300 placeholder:text-gray-300 dark:placeholder:text-gray-600 focus:border-purple-400 dark:focus:border-purple-600 transition-colors min-w-0"
            />
            <button
              onClick={addItem}
              disabled={!inputText.trim()}
              className="p-0.5 rounded text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 disabled:opacity-30 transition-colors flex-shrink-0"
              aria-label={t.add}
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="text-[10px] text-center text-gray-400 dark:text-gray-500 px-1">
            {t.todoMaxReached(MAX_ITEMS)}
          </div>
        )
      )}
    </div>
  );
}
