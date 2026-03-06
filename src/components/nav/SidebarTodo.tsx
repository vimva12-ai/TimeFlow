'use client';

import { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import {
  Plus,
  X,
  RotateCcw,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  GripVertical,
  Pin,
} from 'lucide-react';
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
  const { items, isLoading, save } = useTodo(date);
  const [inputText, setInputText] = useState('');

  // useTodo가 onSnapshot으로 실시간 동기화를 처리하므로 localItems 레이어 불필요
  const isReady = !isLoading;

  // 확장/축소 상태
  const [isExpanded, setIsExpanded] = useState(false);

  // 인라인 편집 상태
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);
  // Enter 저장 후 onBlur 중복 저장 방지용 플래그
  const editSavedRef = useRef(false);

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

  // 편집 모드 진입 시 input 포커스 + 전체 선택
  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  function addItem() {
    const text = inputText.trim();
    if (!text || items.length >= MAX_ITEMS) return;
    save([...items, { id: generateId(), text, checked: false }]);
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
    save(newItems);
  }

  function togglePin(id: string) {
    save(items.map((item) => (item.id === id ? { ...item, pinned: !item.pinned } : item)));
  }

  function deleteItem(id: string) {
    save(items.filter((item) => item.id !== id));
  }

  function resetAll() {
    save([]);
  }

  // ─── 인라인 편집 ──────────────────────────────────────────────────────────────

  function startEditing(item: TodoItem) {
    editSavedRef.current = false;
    setEditingId(item.id);
    setEditingText(item.text);
  }

  function saveEdit() {
    // 이미 저장했거나 편집 중이 아니면 무시 (Enter 후 onBlur 중복 방지)
    if (editSavedRef.current || !editingId) return;
    editSavedRef.current = true;
    const id = editingId;
    const trimmed = editingText.trim();
    setEditingId(null);
    setEditingText('');
    if (trimmed) {
      save(items.map((item) => (item.id === id ? { ...item, text: trimmed } : item)));
    }
  }

  function cancelEdit() {
    // ESC 취소 시 onBlur 저장을 막기 위해 플래그 설정
    editSavedRef.current = true;
    setEditingId(null);
    setEditingText('');
  }

  // ─── 드래그 앤 드롭 ───────────────────────────────────────────────────────────
  // 핵심: draggable 속성은 그립 핸들 span에만 배치.
  // 부모 div에 draggable을 붙이면 자식 클릭 이벤트(체크박스, 텍스트 편집)가 브라우저에 의해 간섭됨.

  function handleDragStart(e: React.DragEvent<HTMLSpanElement>, id: string) {
    // 드래그 고스트 이미지를 전체 행으로 설정 (그립 아이콘만 표시되는 것 방지)
    const row = (e.currentTarget as HTMLElement).closest('[data-drag-row]') as HTMLElement | null;
    if (row) {
      e.dataTransfer.setDragImage(row, 20, 10);
    }
    e.dataTransfer.effectAllowed = 'move';
    dragSourceId.current = id;
    setDraggingId(id);
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
              data-drag-row=""
              onDragOver={(e) => handleDragOver(e, item.id)}
              onDrop={(e) => handleDrop(e, item.id)}
              className={`flex items-start gap-1 group px-1 py-0.5 rounded transition-all duration-200 ${
                draggingId === item.id
                  ? 'opacity-40'
                  : dragOverId === item.id
                    ? 'bg-purple-50 dark:bg-purple-900/20'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
              }`}
            >
              {/* 드래그 핸들 — draggable은 여기에만! 부모 div에 붙이면 자식 click 이벤트 간섭 발생 */}
              <span
                draggable
                onDragStart={(e) => handleDragStart(e, item.id)}
                onDragEnd={handleDragEnd}
                className="mt-0.5 text-gray-300 dark:text-gray-600 cursor-grab active:cursor-grabbing flex-shrink-0 select-none can-hover:opacity-0 can-hover:group-hover:opacity-100 transition-opacity"
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

              {/* 인라인 편집: 텍스트 클릭 → input 전환, Enter/blur 저장, ESC 취소 */}
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
                  onClick={() => startEditing(item)}
                  className={`flex-1 text-[11px] leading-tight break-words min-w-0 cursor-text select-none ${
                    item.checked
                      ? 'line-through text-gray-400 dark:text-gray-600'
                      : 'text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {item.text}
                </span>
              )}

              {/* 고정 버튼 — 고정된 항목은 항상 표시, 미고정은 hover 시에만 표시 */}
              <button
                onClick={() => togglePin(item.id)}
                className={`p-0.5 rounded transition-all flex-shrink-0 mt-0.5 ${
                  item.pinned
                    ? 'text-blue-500 dark:text-blue-400'
                    : 'can-hover:opacity-0 can-hover:group-hover:opacity-100 text-gray-400 hover:text-blue-500 dark:hover:text-blue-400'
                }`}
                aria-label={item.pinned ? t.todoUnpinItem : t.todoPinItem}
                title={item.pinned ? t.todoUnpinItem : t.todoPinItem}
              >
                <Pin className="w-2.5 h-2.5" />
              </button>

              <button
                onClick={() => deleteItem(item.id)}
                className="can-hover:opacity-0 can-hover:group-hover:opacity-100 p-0.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 transition-all flex-shrink-0 mt-0.5"
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
