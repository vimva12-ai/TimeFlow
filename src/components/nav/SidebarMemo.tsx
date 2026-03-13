'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { FileText } from 'lucide-react';
import { useMemoNote } from '@/hooks/useMemoNote';
import { useI18n } from '@/lib/i18n';

type SaveStatus = 'idle' | 'saving' | 'saved';

export default function SidebarMemo() {
  const { t } = useI18n();
  const { text, save } = useMemoNote();
  const [localText, setLocalText] = useState('');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 서버 데이터 초기화 여부 추적 (최초 1회만 덮어씀)
  const initializedRef = useRef(false);

  // Firebase에서 로드된 텍스트로 초기화 (최초 1회)
  useEffect(() => {
    if (!initializedRef.current && text !== undefined) {
      setLocalText(text);
      initializedRef.current = true;
    }
  }, [text]);

  /** 텍스트 변경 → 800ms 디바운스 후 Firebase 저장 */
  const handleChange = useCallback(
    (val: string) => {
      setLocalText(val);
      setSaveStatus('saving');
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      debounceRef.current = setTimeout(async () => {
        try {
          await save.mutateAsync(val);
          setSaveStatus('saved');
          // 2초 후 상태 초기화
          savedTimerRef.current = setTimeout(() => setSaveStatus('idle'), 2000);
        } catch {
          setSaveStatus('idle');
        }
      }, 800);
    },
    [save],
  );

  // 언마운트 시 타이머 정리
  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    },
    [],
  );

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
        {/* 저장 상태 표시 */}
        {saveStatus === 'saved' && (
          <span className="text-[9px] text-green-500 dark:text-green-400 transition-opacity">
            {t.memoSaved}
          </span>
        )}
        {saveStatus === 'saving' && (
          <span className="text-[9px] text-gray-400 dark:text-gray-500 animate-pulse">...</span>
        )}
      </div>

      {/* 메모 입력 */}
      <textarea
        value={localText}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={t.memoPlaceholder}
        rows={3}
        className="w-full px-2 py-1.5 text-[11px] rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent text-gray-700 dark:text-gray-300 placeholder:text-gray-300 dark:placeholder:text-gray-600 focus:outline-none focus:border-amber-400 dark:focus:border-amber-600 resize-none transition-colors leading-relaxed scrollbar-hide"
      />
    </div>
  );
}
