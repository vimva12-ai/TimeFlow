'use client';

import { useState } from 'react';
import NotificationToggle from '@/components/settings/NotificationToggle';
import { useTimetableStore } from '@/store/timetableStore';

const SLOT_HEIGHT_OPTIONS = [
  { label: '좁게', value: 24, desc: '최대한 많이' },
  { label: '보통', value: 36, desc: '기본 크기' },
  { label: '넓게', value: 48, desc: '여유 있는 보기' },
];

export default function SettingsPage() {
  const { startHour, endHour, slotHeight, setStartHour, setEndHour, setSlotHeight } = useTimetableStore();

  const [draft, setDraft] = useState({ startHour, endHour, slotHeight });
  const isDirty =
    draft.startHour !== startHour ||
    draft.endHour !== endHour ||
    draft.slotHeight !== slotHeight;

  function handleSave() {
    setStartHour(draft.startHour);
    setEndHour(draft.endHour);
    setSlotHeight(draft.slotHeight);
  }

  function handleReset() {
    setDraft({ startHour, endHour, slotHeight });
  }

  return (
    <div className="p-4 space-y-6 max-w-lg mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">설정</h1>
        <div className="flex items-center gap-2">
          {isDirty && (
            <button
              onClick={handleReset}
              className="px-3 py-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
            >
              취소
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={!isDirty}
            className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              isDirty
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed'
            }`}
          >
            저장
          </button>
        </div>
      </div>

      {/* ── 화면 설정 ── */}
      <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-800 space-y-5">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">화면 설정</h2>

        {/* 슬롯 높이 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            슬롯 크기
          </label>
          <div className="grid grid-cols-3 gap-2">
            {SLOT_HEIGHT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setDraft((d) => ({ ...d, slotHeight: opt.value }))}
                className={`p-2.5 rounded-lg border text-center transition-colors ${
                  draft.slotHeight === opt.value
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                    : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                <div className="text-sm font-medium">{opt.label}</div>
                <div className="text-[10px] opacity-70 mt-0.5">{opt.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* 시간 범위 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            시간 범위
          </label>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">시작 시간</div>
              <select
                value={draft.startHour}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (v < draft.endHour - 1) setDraft((d) => ({ ...d, startHour: v }));
                }}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={i}>{String(i).padStart(2, '0')}:00</option>
                ))}
              </select>
            </div>

            <span className="text-gray-400 dark:text-gray-500 mt-5">~</span>

            <div className="flex-1">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">종료 시간</div>
              <select
                value={draft.endHour}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (v > draft.startHour + 1) setDraft((d) => ({ ...d, endHour: v }));
                }}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {Array.from({ length: 24 }, (_, i) => i + 1).map((h) => (
                  <option key={h} value={h}>{String(h % 24).padStart(2, '0')}:00{h === 24 ? ' (자정)' : ''}</option>
                ))}
              </select>
            </div>
          </div>
          <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1.5">
            현재: {String(draft.startHour).padStart(2, '0')}:00 ~ {String(draft.endHour % 24).padStart(2, '0')}:00
            ({draft.endHour - draft.startHour}시간 표시)
          </p>
        </div>
      </div>

      {/* ── 알림 설정 ── */}
      <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-800">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">알림 설정</h2>
        <NotificationToggle />
      </div>
    </div>
  );
}
