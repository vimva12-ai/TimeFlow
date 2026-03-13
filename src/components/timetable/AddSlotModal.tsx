'use client';

import { useState, useEffect, useRef } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, Star } from 'lucide-react';
import { addMinutes, format, differenceInMinutes } from 'date-fns';
import { useI18n } from '@/lib/i18n';
import { useSlotTitleHistory } from '@/hooks/useSlotTitleHistory';

interface AddSlotModalProps {
  type: 'plan' | 'actual';
  open: boolean;
  onClose: () => void;
  date: string;
  onCreatePlan: (start: string, end: string, title: string) => void;
  onCreateActual: (start: string, end: string, title: string) => void;
  initialHour?: number;
  initialMin?: number;
  // PLAN 즐겨찾기 저장 콜백 (PLAN 타입에서만 표시)
  onSaveFavorite?: (title: string, durationMinutes: number) => void;
}

function toIso(date: string, hour: number, minute: number): string {
  return new Date(`${date}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`).toISOString();
}

function hm(val: string): { h: number; m: number } {
  const [h, m] = val.split(':').map(Number);
  return { h: h ?? 0, m: m ?? 0 };
}

export default function AddSlotModal({
  type, open, onClose, date, onCreatePlan, onCreateActual,
  initialHour, initialMin, onSaveFavorite,
}: AddSlotModalProps) {
  const { t } = useI18n();
  const { addTitle, getSuggestions, removeTitle } = useSlotTitleHistory();

  const now = new Date();
  const [title, setTitle] = useState('');
  const [startHourVal, setStartHourVal] = useState(now.getHours());
  const [startMin, setStartMin] = useState(now.getMinutes() < 30 ? 0 : 30);
  const [endHourVal, setEndHourVal] = useState(now.getHours());
  const [endMin, setEndMin] = useState(now.getMinutes() < 30 ? 30 : 0);
  const [duration, setDuration] = useState(60);
  const [directInput, setDirectInput] = useState(false);
  const [directStart, setDirectStart] = useState('');
  const [directEnd, setDirectEnd] = useState('');

  // 자동완성 드롭다운 상태
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [activeIdx, setActiveIdx] = useState(-1);
  const titleWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      const h = initialHour ?? new Date().getHours();
      const m = initialMin ?? (new Date().getMinutes() < 30 ? 0 : 30);
      setTitle('');
      setShowSuggestions(false);
      setSuggestions([]);
      setActiveIdx(-1);
      setDirectInput(false);
      setStartHourVal(h);
      setStartMin(m);
      const eH = m === 30 ? (h + 1) % 24 : h;
      const eM = m === 30 ? 0 : 30;
      setEndHourVal(eH);
      setEndMin(eM);
      setDuration(60);
      setDirectStart(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
      setDirectEnd(`${String(eH).padStart(2, '0')}:${String(eM).padStart(2, '0')}`);
    }
  }, [open, initialHour, initialMin]);

  function toggleDirect() {
    if (!directInput) {
      // 직접 입력으로 전환: 현재 선택 값을 time input에 반영
      const s = `${String(startHourVal).padStart(2, '0')}:${String(startMin).padStart(2, '0')}`;
      setDirectStart(s);
      if (type === 'plan') {
        const endDate = addMinutes(new Date(`${date}T${s}:00`), duration);
        setDirectEnd(format(endDate, 'HH:mm'));
      } else {
        setDirectEnd(`${String(endHourVal).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`);
      }
    } else {
      // 빠른 선택으로 전환: time input 값을 selects에 반영 (30분 단위로 반올림)
      if (directStart) {
        const { h, m } = hm(directStart);
        setStartHourVal(h);
        setStartMin(m < 15 ? 0 : m < 45 ? 30 : 0);
        if (m >= 45) setStartHourVal((h + 1) % 24);
      }
      if (directEnd && type === 'actual') {
        const { h, m } = hm(directEnd);
        setEndHourVal(h);
        setEndMin(m < 15 ? 0 : m < 45 ? 30 : 0);
        if (m >= 45) setEndHourVal((h + 1) % 24);
      }
    }
    setDirectInput((v) => !v);
  }

  /** 제목 input 변경 시 자동완성 목록 갱신 */
  function handleTitleChange(val: string) {
    setTitle(val);
    setActiveIdx(-1);
    const results = getSuggestions(val);
    setSuggestions(results);
    setShowSuggestions(results.length > 0);
  }

  /** 자동완성 항목 선택 */
  function selectSuggestion(value: string) {
    setTitle(value);
    setShowSuggestions(false);
    setActiveIdx(-1);
  }

  /** 키보드 탐색 (↑↓ Enter Escape) */
  function handleTitleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      if (showSuggestions && activeIdx >= 0) {
        e.preventDefault();
        selectSuggestion(suggestions[activeIdx]);
        return;
      }
      setShowSuggestions(false);
      handleSubmit();
      return;
    }
    if (!showSuggestions) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, -1));
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      setActiveIdx(-1);
    }
  }

  function handleSubmit() {
    if (!title.trim()) return;
    let start: string, end: string;
    if (directInput) {
      if (!directStart || !directEnd) return;
      const s = hm(directStart);
      const e = hm(directEnd);
      start = toIso(date, s.h, s.m);
      end = toIso(date, e.h, e.m);
      if (end <= start) return;
    } else if (type === 'plan') {
      start = toIso(date, startHourVal, startMin);
      end = addMinutes(new Date(start), duration).toISOString();
    } else {
      start = toIso(date, startHourVal, startMin);
      end = toIso(date, endHourVal, endMin);
      if (end <= start) return;
    }
    // 제출 시 제목 히스토리에 저장
    addTitle(title.trim());
    if (type === 'plan') onCreatePlan(start, end, title.trim());
    else onCreateActual(start, end, title.trim());
    onClose();
  }

  const isPlan = type === 'plan';

  // 요약 표시용 분 계산
  const totalMin = (() => {
    if (directInput) {
      if (!directStart || !directEnd) return 0;
      const s = hm(directStart);
      const e = hm(directEnd);
      const diff = differenceInMinutes(
        new Date(`${date}T${directEnd}:00`),
        new Date(`${date}T${directStart}:00`),
      );
      void s; void e;
      return diff > 0 ? diff : 0;
    }
    if (isPlan) return duration;
    const s = startHourVal * 60 + startMin;
    const e = endHourVal * 60 + endMin;
    return e > s ? e - s : 0;
  })();

  const summaryEnd = (() => {
    if (directInput) return directEnd;
    if (isPlan)
      return format(addMinutes(new Date(`${date}T${String(startHourVal).padStart(2,'0')}:${String(startMin).padStart(2,'0')}:00`), duration), 'HH:mm');
    return `${String(endHourVal).padStart(2,'0')}:${String(endMin).padStart(2,'0')}`;
  })();

  const summaryStart = directInput
    ? directStart
    : `${String(startHourVal).padStart(2,'0')}:${String(startMin).padStart(2,'0')}`;

  const selectCls = 'flex-1 px-2 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none';
  const timeCls = 'flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" />
        <Dialog.Content
          className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-5 focus:outline-none"
          aria-describedby={undefined}
        >
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-base font-semibold text-gray-900 dark:text-gray-100">
              {isPlan ? t.addPlanTitle : t.addActualTitle}
            </Dialog.Title>
            <div className="flex items-center gap-2">
              {/* 직접 입력 토글 */}
              <button
                onClick={toggleDirect}
                className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors ${
                  directInput
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                직접 입력
              </button>
              <Dialog.Close asChild>
                <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                  <X className="w-5 h-5" />
                </button>
              </Dialog.Close>
            </div>
          </div>

          <div className="space-y-3">
            {/* 제목 + 자동완성 드롭다운 */}
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                {isPlan ? t.taskLabel : t.activityLabel}
              </label>
              <div ref={titleWrapRef} className="relative">
                <input
                  autoFocus
                  value={title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  onFocus={() => {
                    const results = getSuggestions(title);
                    setSuggestions(results);
                    setShowSuggestions(results.length > 0);
                  }}
                  onBlur={(e) => {
                    // 드롭다운 항목 클릭 시 blur가 먼저 발생하므로 delay
                    if (!titleWrapRef.current?.contains(e.relatedTarget as Node)) {
                      setShowSuggestions(false);
                    }
                  }}
                  onKeyDown={handleTitleKeyDown}
                  placeholder={isPlan ? t.taskPlaceholder : t.activityPlaceholder}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {/* 자동완성 드롭다운 */}
                {showSuggestions && (
                  <ul className="absolute z-10 left-0 right-0 top-full mt-1 max-h-48 overflow-y-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
                    {suggestions.slice(0, 8).map((s, i) => (
                      <li
                        key={s}
                        className={`flex items-center group ${
                          i === activeIdx
                            ? 'bg-blue-50 dark:bg-blue-900/40'
                            : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                      >
                        <span
                          onMouseDown={(e) => {
                            // blur 전에 선택되도록 mousedown에서 처리
                            e.preventDefault();
                            selectSuggestion(s);
                          }}
                          className={`flex-1 px-3 py-2 text-sm cursor-pointer truncate ${
                            i === activeIdx
                              ? 'text-blue-700 dark:text-blue-300'
                              : 'text-gray-800 dark:text-gray-200'
                          }`}
                        >
                          {s}
                        </span>
                        {/* 히스토리에서 항목 삭제 */}
                        <button
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            removeTitle(s);
                            const updated = getSuggestions(title);
                            setSuggestions(updated);
                            if (updated.length === 0) setShowSuggestions(false);
                          }}
                          className="px-2 py-2 text-gray-300 dark:text-gray-600 hover:text-red-500 can-hover:opacity-0 can-hover:group-hover:opacity-100 transition-opacity flex-shrink-0"
                          aria-label="목록에서 제거"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {directInput ? (
              /* ── 직접 입력 모드 ── */
              <>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{t.startTime}</label>
                  <input
                    type="time"
                    value={directStart}
                    onChange={(e) => setDirectStart(e.target.value)}
                    className={timeCls}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{t.endTime}</label>
                  <input
                    type="time"
                    value={directEnd}
                    onChange={(e) => setDirectEnd(e.target.value)}
                    className={timeCls}
                  />
                </div>
              </>
            ) : (
              /* ── 기본 선택 모드 ── */
              <>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{t.startTime}</label>
                  <div className="flex gap-2">
                    <select
                      value={startHourVal}
                      onChange={(e) => setStartHourVal(Number(e.target.value))}
                      className={selectCls}
                    >
                      {Array.from({ length: 24 }, (_, i) => (
                        <option key={i} value={i}>{String(i).padStart(2, '0')}시</option>
                      ))}
                    </select>
                    <select
                      value={startMin}
                      onChange={(e) => setStartMin(Number(e.target.value))}
                      className={selectCls}
                    >
                      <option value={0}>00분</option>
                      <option value={30}>30분</option>
                    </select>
                  </div>
                </div>

                {isPlan ? (
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{t.durationLabel}</label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {[30, 60, 90, 120, 150, 180].map((m) => (
                        <button
                          key={m}
                          onClick={() => setDuration(m)}
                          className={`py-1.5 text-xs rounded-lg border transition-colors ${
                            duration === m
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                          }`}
                        >
                          {m < 60 ? `${m}분` : `${m / 60}시간`}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{t.endTime}</label>
                    <div className="flex gap-2">
                      <select
                        value={endHourVal}
                        onChange={(e) => setEndHourVal(Number(e.target.value))}
                        className={selectCls}
                      >
                        {Array.from({ length: 24 }, (_, i) => (
                          <option key={i} value={i}>{String(i).padStart(2, '0')}시</option>
                        ))}
                      </select>
                      <select
                        value={endMin}
                        onChange={(e) => setEndMin(Number(e.target.value))}
                        className={selectCls}
                      >
                        <option value={0}>00분</option>
                        <option value={30}>30분</option>
                      </select>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* 요약 */}
            {totalMin > 0 && (
              <p className="text-[11px] text-gray-400 dark:text-gray-500">
                {summaryStart} ~ {summaryEnd} ({totalMin}분)
              </p>
            )}

            <div className="flex gap-2">
              {/* PLAN 타입일 때만 즐겨찾기 저장 버튼 표시 */}
              {isPlan && onSaveFavorite && (
                <button
                  onClick={() => {
                    if (!title.trim() || totalMin <= 0) return;
                    onSaveFavorite(title.trim(), totalMin);
                  }}
                  disabled={!title.trim() || totalMin <= 0}
                  title={t.favoriteAdd}
                  className="px-3 py-2.5 border border-yellow-300 dark:border-yellow-700 text-yellow-500 dark:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 disabled:opacity-40 rounded-lg transition-colors flex-shrink-0"
                >
                  <Star className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={handleSubmit}
                disabled={!title.trim() || totalMin <= 0}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                {isPlan ? t.addSchedule : t.addRecord}
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
