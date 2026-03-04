'use client';

import { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { Plus, X, RotateCcw, CheckSquare, ChevronDown, ChevronUp, GripVertical } from 'lucide-react';
import { useTodo, type TodoItem } from '@/hooks/useTodo';
import { useQueryClient } from '@tanstack/react-query';
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
  const queryClient = useQueryClient();
  const [date, setDate] = useState(todayStr);
  const { items: remoteItems, isLoading, save } = useTodo(date);
  const [inputText, setInputText] = useState('');

  // 로컬 상태로 즉시 UI 업데이트 (React Query 비동기 캐시 타이밍 문제 방지)
  const [localItems, setLocalItems] = useState<TodoItem[] | null>(null);
  const initializedRef = useRef(false);

  // 확장/축소 상태
  const [isExpanded, setIsExpanded] = useState(false);

  // 인라인 편집 상태
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);

  // 드래그 상태
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const dragSourceId = useRef<string | null>(null);

  // 자정에 날짜 갱신 → 새 날짜로 todos 로드 + 통계 캐시 무효화
  useEffect(() => {
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const ms = midnight.getTime() - now.getTime();
    const timer = setTimeout(() => {
      setDate(todayStr());
      queryClient.invalidateQueries({ queryKey: ['todoHistory'] });
      queryClient.invalidateQueries({ queryKey: ['todoStats'] });
    }, ms);
    return () => clearTimeout(timer);
  }, [date, queryClient]);

  // 날짜가 바뀌면 로컬 상태 초기화
  useEffect(() => {
    initializedRef.current = false;
    setLocalItems(null);
  }, [date]);

  // Firebase 데이터가 바뀌면 로컬 상태에 반영
  useEffect(() => {
    if (initializedRef.current) return;
    if (!isLoading || remoteItems.length > 0) {
      setLocalItems(remoteItems);
      initializedRef.current = true;
    }
  }, [isLoading, remoteItems]);

  // 편집 모드 진입 시 input 포커스
  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  const items = localItems ?? [];
  const isReady = localItems !== null;

  function addItem() {
    const text = inputText.trim();
    if (!text || items.length >= MAX_ITEMS) return;
    const newItems = [...items, { id: generateId(), text, checked: false }];
    setLocalItems(newItems);
    save(newItems);
    setInputText('');
  }

  function toggleItem(id: string) {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    const newChecked = !item.checked;
    const withoutItem = items.filter((i) => i.id !== id);
    const updatedItem: TodoItem = { ...item, checked: newChecked };

    let newItems: TodoItem[];
    if (newChecked) {
      // 완료 체크 → 맨 뒤로 이동
      newItems = [...withoutItem, updatedItem];
    } else {
      // 체크 해제 → 미완료 항목들 맨 뒤(완료 항목들 앞)로 복귀
      const firstCheckedIdx = withoutItem.findIndex((i) => i.checked);
      if (firstCheckedIdx === -1) {
        newItems = [...withoutItem, updatedItem];
      } else {
        newItems = [
          ...withoutItem.slice(0, firstCheckedIdx),
          updatedItem,
          ...withoutItem.slice(firstCheckedIdx),
        ];
      }
    }
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

  // ─── 인라인 편집 ──────────────────────────────────────────────────────────────

  function startEditing(item: TodoItem) {
    setEditingId(item.id);
    setEditingText(item.text);
  }

  function saveEdit() {
    if (!editingId) return;
    const trimmed = editingText.trim();
    if (trimmed) {
      const newItems = items.map((item) =>
        item.id === editingId ? { ...item, text: trimmed } : item
      );
      setLocalItems(newItems);
      save(newItems);
    }
    setEditingId(null);
    setEditingText('');
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingText('');
  }

  // ─── 드래그 앤 드롭 ───────────────────────────────────────────────────────────

  function handleDragStart(e: React.DragEvent, id: string) {
    // 드래그 핸들에서만 드래그 시작 허용
    const target = e.target as Element;
    if (!target.closest('[data-drag-handle]')) {
      e.preventDefault();
      return;
    }
    dragSourceId.current = id;
    setDraggingId(id);
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleDragOver(e: React.DragEvent, id: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragSourceId.current !== id) {
      setDragOverId(id);
    }
  }

  function handleDrop(e: React.DragEvent, targetId: string) {
    e.preventDefault();
    const sourceId = dragSourceId.current;
    if (!sourceId || sourceId === targetId) {
      setDraggingId(null);
      setDragOverId(null);
      dragSourceId.current = null;
      return;
    }
    const fromIdx = items.findIndex((i) => i.id === sourceId);
    const toIdx = items.findIndex((i) => i.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;

    const newItems = [...items];
    const [moved] = newItems.splice(fromIdx, 1);
    newItems.splice(toIdx, 0, moved);
    setLocalItems(newItems);
    save(newItems);
    setDraggingId(null);
    setDragOverId(null);
    dragSourceId.current = null;
  }

  function handleDragEnd() {
    setDraggingId(null);
    setDragOverId(null);
    dragSourceId.current = null;
  }

  const checkedCount = items.filter((i) => i.checked).length;
  const totalCount = items.length;
  const progressPct = totalCount > 0 ? (checkedCount / totalCount) * 100 : 0;

  return (
    <div className="flex flex-col gap-1.5">
      {/* 헤더 — 제목 + 달성률 인라인 표시 */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <CheckSquare className="w-3.5 h-3.5 text-purple-500 flex-shrink-0" />
          <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap">
            {t.todayTodo}
          </span>
          {/* 달성률: 오늘 할 일 ● 3/5 60% */}
          {isReady && totalCount > 0 && (
            <>
              <span className="text-[9px] text-gray-300 dark:text-gray-600 select-none flex-shrink-0">
                ●
              </span>
              <span className="text-[10px] text-gray-400 dark:text-gray-500 tabular-nums whitespace-nowrap flex-shrink-0">
                {checkedCount}/{totalCount}
              </span>
              <span className="text-[10px] font-semibold text-purple-500 dark:text-purple-400 tabular-nums whitespace-nowrap flex-shrink-0">
                {Math.round(progressPct)}%
              </span>
            </>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={resetAll}
            className="p-0.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 dark:text-gray-500 transition-colors"
            title="오늘 목록 초기화"
            aria-label="초기화"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
          <button
            onClick={() => setIsExpanded((v) => !v)}
            className="p-0.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 dark:text-gray-500 transition-colors"
            title={isExpanded ? t.todoCollapse : t.todoExpand}
            aria-label={isExpanded ? t.todoCollapse : t.todoExpand}
          >
            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
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
      <div
        className={`flex flex-col gap-0.5 overflow-y-auto scrollbar-hide transition-all duration-300 ${
          isExpanded ? 'max-h-80' : 'max-h-44'
        }`}
      >
        {!isReady ? (
          <div className="text-[11px] text-gray-400 dark:text-gray-500 text-center py-2">
            {t.loading}
          </div>
        ) : totalCount === 0 ? (
          <div className="text-[11px] text-gray-400 dark:text-gray-500 text-center py-2">
            {t.todoEmpty}
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              draggable
              onDragStart={(e) => handleDragStart(e, item.id)}
              onDragOver={(e) => handleDragOver(e, item.id)}
              onDrop={(e) => handleDrop(e, item.id)}
              onDragEnd={handleDragEnd}
              className={`flex items-start gap-1 group px-1 py-0.5 rounded transition-all duration-200 ${
                draggingId === item.id
                  ? 'opacity-40 scale-[0.98]'
                  : dragOverId === item.id
                    ? 'bg-purple-50 dark:bg-purple-900/20'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
              }`}
            >
              {/* 드래그 핸들 */}
              <span
                data-drag-handle=""
                className="mt-0.5 text-gray-300 dark:text-gray-600 cursor-grab active:cursor-grabbing flex-shrink-0 select-none opacity-0 group-hover:opacity-100 transition-opacity"
                aria-hidden="true"
              >
                <GripVertical className="w-3 h-3" />
              </span>

              <input
                type="checkbox"
                checked={item.checked}
                onChange={() => toggleItem(item.id)}
                className="mt-0.5 w-3.5 h-3.5 rounded accent-purple-500 cursor-pointer flex-shrink-0"
              />

              {/* 인라인 편집 */}
              {editingId === item.id ? (
                <input
                  ref={editInputRef}
                  type="text"
                  value={editingText}
                  onChange={(e) => setEditingText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveEdit();
                    if (e.key === 'Escape') cancelEdit();
                  }}
                  onBlur={saveEdit}
                  className="flex-1 text-[11px] bg-transparent border-b border-purple-400 outline-none py-0.5 text-gray-700 dark:text-gray-300 min-w-0"
                />
              ) : (
                <span
                  onClick={() => !draggingId && startEditing(item)}
                  className={`flex-1 text-[11px] leading-tight break-words min-w-0 cursor-text select-none ${
                    item.checked
                      ? 'line-through text-gray-400 dark:text-gray-600'
                      : 'text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {item.text}
                </span>
              )}

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

      {/* 입력 */}
      {isReady &&
        (totalCount < MAX_ITEMS ? (
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
        ))}
    </div>
  );
}
