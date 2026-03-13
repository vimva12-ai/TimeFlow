'use client';

import { useState, useRef, useCallback } from 'react';
import { FileText, Pencil, X, Plus, ChevronDown, ChevronUp } from 'lucide-react';
import { format } from 'date-fns';
import { useMemoNote } from '@/hooks/useMemoNote';
import { useI18n } from '@/lib/i18n';

export default function SidebarMemo() {
  const { t } = useI18n();
  const { memos, create, update, remove } = useMemoNote();

  const [text, setText] = useState('');
  // 수정 중인 메모 ID (null이면 신규 작성 모드)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /** 저장 버튼: 수정 모드면 update, 아니면 create */
  const handleSave = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      if (editingId) {
        await update.mutateAsync({ id: editingId, text: trimmed });
        setEditingId(null);
      } else {
        await create.mutateAsync(trimmed);
        // 저장 후 목록 자동 펼침
        setListOpen(true);
      }
      setText('');
    } finally {
      setSaving(false);
    }
  }, [text, editingId, create, update]);

  /** 목록 아이템 편집 버튼: 해당 메모 텍스트를 입력창에 로드 */
  function handleEdit(memo: { id: string; text: string }) {
    setEditingId(memo.id);
    setText(memo.text);
    textareaRef.current?.focus();
  }

  /** 수정 모드 취소: 입력창 초기화 */
  function handleCancelEdit() {
    setEditingId(null);
    setText('');
  }

  /** 메모 삭제: 수정 중인 메모가 삭제되면 입력창도 초기화 */
  async function handleDelete(id: string) {
    if (!confirm(t.memoConfirmDelete)) return;
    await remove.mutateAsync(id);
    if (editingId === id) {
      setEditingId(null);
      setText('');
    }
  }

  const canSave = text.trim().length > 0 && !saving;
  const isEditing = editingId !== null;

  return (
    <div className="flex flex-col gap-1.5">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
          <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            {t.memoTitle}
          </span>
        </div>
        {/* 수정 모드일 때: 새 메모 작성으로 전환 버튼 */}
        {isEditing && (
          <button
            onClick={handleCancelEdit}
            className="flex items-center gap-0.5 text-[9px] text-amber-500 hover:text-amber-700 dark:hover:text-amber-300 transition-colors"
          >
            <Plus className="w-2.5 h-2.5" />
            {t.memoNew}
          </button>
        )}
      </div>

      {/* 메모 입력 텍스트 영역 */}
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t.memoPlaceholder}
        rows={3}
        className="w-full px-2 py-1.5 text-[11px] rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent text-gray-700 dark:text-gray-300 placeholder:text-gray-300 dark:placeholder:text-gray-600 focus:outline-none focus:border-amber-400 dark:focus:border-amber-600 resize-none transition-colors leading-relaxed scrollbar-hide"
      />

      {/* 저장/수정 버튼 */}
      <button
        onClick={handleSave}
        disabled={!canSave}
        className="w-full py-1 text-[11px] rounded-md bg-amber-500 hover:bg-amber-600 disabled:bg-gray-200 dark:disabled:bg-gray-700 text-white disabled:text-gray-400 dark:disabled:text-gray-500 transition-colors font-medium"
      >
        {saving ? '...' : isEditing ? t.memoUpdate : t.save}
      </button>

      {/* 저장된 메모 목록 */}
      {memos.length > 0 && (
        <div className="mt-0.5">
          {/* 목록 펼침/접기 토글 */}
          <button
            onClick={() => setListOpen((v) => !v)}
            className="w-full flex items-center justify-between px-1 py-0.5 text-[10px] text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <span>{t.memoList} ({memos.length})</span>
            {listOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>

          {listOpen && (
            <div className="flex flex-col gap-1 mt-1 max-h-48 overflow-y-auto scrollbar-hide">
              {memos.map((memo) => (
                <div
                  key={memo.id}
                  className={`flex items-start gap-1 px-1.5 py-1.5 rounded-md border text-[10px] transition-colors ${
                    editingId === memo.id
                      ? 'border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/20'
                      : 'border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/40'
                  }`}
                >
                  {/* 메모 내용 + 날짜 */}
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-600 dark:text-gray-300 line-clamp-2 leading-relaxed break-words">
                      {memo.text}
                    </p>
                    <p className="text-gray-300 dark:text-gray-600 mt-0.5">
                      {format(new Date(memo.updated_at), 'MM/dd HH:mm')}
                    </p>
                  </div>
                  {/* 편집 / 삭제 버튼 */}
                  <div className="flex flex-col gap-0.5 shrink-0">
                    <button
                      onClick={() => handleEdit(memo)}
                      className="p-0.5 text-gray-300 hover:text-amber-500 dark:text-gray-600 dark:hover:text-amber-400 transition-colors"
                      title={t.memoEditBtn}
                    >
                      <Pencil className="w-2.5 h-2.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(memo.id)}
                      className="p-0.5 text-gray-300 hover:text-red-500 dark:text-gray-600 dark:hover:text-red-400 transition-colors"
                      title={t.delete}
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
