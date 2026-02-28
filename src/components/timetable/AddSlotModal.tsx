'use client';

import { useState, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { addMinutes, format } from 'date-fns';
import { useTimetableStore } from '@/store/timetableStore';

interface AddSlotModalProps {
  type: 'plan' | 'actual';
  open: boolean;
  onClose: () => void;
  date: string;
  slotCount: number;
  onCreatePlan: (start: string, end: string, title: string) => void;
  onCreateActual: (start: string, end: string, title: string) => void;
  initialHour?: number;
  initialMin?: number;
}

function toIso(date: string, hour: number, minute: number): string {
  return new Date(`${date}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`).toISOString();
}

export default function AddSlotModal({
  type, open, onClose, date, slotCount, onCreatePlan, onCreateActual,
  initialHour, initialMin,
}: AddSlotModalProps) {
  const { startHour } = useTimetableStore();

  const now = new Date();
  const [title, setTitle] = useState('');
  const [startHourVal, setStartHourVal] = useState(now.getHours());
  const [startMin, setStartMin] = useState(now.getMinutes() < 30 ? 0 : 30);
  const [endHourVal, setEndHourVal] = useState(now.getHours());
  const [endMin, setEndMin] = useState(now.getMinutes() < 30 ? 30 : 0);
  const [duration, setDuration] = useState(60);

  // 모달 열릴 때 초기화 — 클릭된 시각이 있으면 우선 사용
  useEffect(() => {
    if (open) {
      const h = initialHour ?? new Date().getHours();
      const m = initialMin ?? (new Date().getMinutes() < 30 ? 0 : 30);
      setTitle('');
      setStartHourVal(h);
      setStartMin(m);
      setEndHourVal(m === 30 ? (h + 1) % 24 : h);
      setEndMin(m === 30 ? 0 : 30);
      setDuration(60);
    }
  }, [open, initialHour, initialMin]);

  function handleSubmit() {
    if (!title.trim()) return;
    if (type === 'plan') {
      const start = toIso(date, startHourVal, startMin);
      const end = addMinutes(new Date(start), duration).toISOString();
      onCreatePlan(start, end, title.trim());
    } else {
      const start = toIso(date, startHourVal, startMin);
      const end = toIso(date, endHourVal, endMin);
      if (end <= start) return;
      onCreateActual(start, end, title.trim());
    }
    onClose();
  }

  const isPlan = type === 'plan';
  const totalMin = isPlan ? duration : (() => {
    const s = startHourVal * 60 + startMin;
    const e = endHourVal * 60 + endMin;
    return e > s ? e - s : 0;
  })();

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" />
        <Dialog.Content
          className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-5 focus:outline-none"
          aria-describedby={undefined}
        >
          {/* 헤더 */}
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-base font-semibold text-gray-900 dark:text-gray-100">
              {isPlan ? 'PLAN 일정 추가' : 'ACTUAL 기록 추가'}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <X className="w-5 h-5" />
              </button>
            </Dialog.Close>
          </div>

          <div className="space-y-3">
            {/* 제목 */}
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                {isPlan ? '할 일' : '활동명'}
              </label>
              <input
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                placeholder={isPlan ? '할 일을 입력하세요' : '무엇을 했나요?'}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* 시작 시간 */}
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                시작 시간
              </label>
              <div className="flex gap-2">
                <select
                  value={startHourVal}
                  onChange={(e) => setStartHourVal(Number(e.target.value))}
                  className="flex-1 px-2 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none"
                >
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={i}>{String(i).padStart(2, '0')}시</option>
                  ))}
                </select>
                <select
                  value={startMin}
                  onChange={(e) => setStartMin(Number(e.target.value))}
                  className="flex-1 px-2 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none"
                >
                  <option value={0}>00분</option>
                  <option value={30}>30분</option>
                </select>
              </div>
            </div>

            {/* 종료 시간 (actual) 또는 지속 시간 (plan) */}
            {isPlan ? (
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  지속 시간
                </label>
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
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  종료 시간
                </label>
                <div className="flex gap-2">
                  <select
                    value={endHourVal}
                    onChange={(e) => setEndHourVal(Number(e.target.value))}
                    className="flex-1 px-2 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none"
                  >
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={i}>{String(i).padStart(2, '0')}시</option>
                    ))}
                  </select>
                  <select
                    value={endMin}
                    onChange={(e) => setEndMin(Number(e.target.value))}
                    className="flex-1 px-2 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none"
                  >
                    <option value={0}>00분</option>
                    <option value={30}>30분</option>
                  </select>
                </div>
              </div>
            )}

            {/* 미리보기 */}
            {totalMin > 0 && (
              <p className="text-[11px] text-gray-400 dark:text-gray-500">
                {String(startHourVal).padStart(2, '0')}:{String(startMin).padStart(2, '0')}
                {' ~ '}
                {isPlan
                  ? format(addMinutes(new Date(`${date}T${String(startHourVal).padStart(2,'0')}:${String(startMin).padStart(2,'0')}:00`), duration), 'HH:mm')
                  : `${String(endHourVal).padStart(2,'0')}:${String(endMin).padStart(2,'0')}`
                }
                {' '}({totalMin}분)
              </p>
            )}

            {/* 제출 */}
            <button
              onClick={handleSubmit}
              disabled={!title.trim() || (type === 'actual' && totalMin <= 0)}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              {isPlan ? '일정 추가' : '기록 추가'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
