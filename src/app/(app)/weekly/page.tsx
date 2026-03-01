'use client';

import { useState, useRef } from 'react';
import { useWeeklyReport } from '@/hooks/useWeeklyReport';
import { usePeriodStats } from '@/hooks/usePeriodStats';
import { format, subDays } from 'date-fns';
import { useI18n } from '@/lib/i18n';
import {
  ComposedChart, Bar, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer,
} from 'recharts';

function formatFocusTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}시간 ${m}분` : `${m}분`;
}

const today = format(new Date(), 'yyyy-MM-dd');
const presets = [
  { label: '7일', from: format(subDays(new Date(), 6), 'yyyy-MM-dd'), days: 7 },
  { label: '14일', from: format(subDays(new Date(), 13), 'yyyy-MM-dd'), days: 14 },
  { label: '30일', from: format(subDays(new Date(), 29), 'yyyy-MM-dd'), days: 30 },
];

const DAY_LABELS: Record<string, string[]> = {
  ko: ['일', '월', '화', '수', '목', '금', '토'],
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  ja: ['日', '月', '火', '水', '木', '金', '土'],
};

export default function WeeklyPage() {
  const { data: report, isLoading } = useWeeklyReport();
  const { locale, t } = useI18n();

  const [periodFrom, setPeriodFrom] = useState(presets[0].from);
  const [periodTo, setPeriodTo] = useState(today);
  const [customMode, setCustomMode] = useState(false);
  const { data: period, isFetching: periodFetching } = usePeriodStats(periodFrom, periodTo);
  const fromInputRef = useRef<HTMLInputElement>(null);
  const toInputRef = useRef<HTMLInputElement>(null);

  const isPresetActive = (from: string) => !customMode && periodFrom === from && periodTo === today;
  const isCustomActive = customMode || (!presets.some((p) => p.from === periodFrom && periodTo === today));
  const dayLabels = DAY_LABELS[locale] ?? DAY_LABELS.ko;

  if (isLoading) {
    return <div className="flex items-center justify-center h-64 text-gray-400">{t.loading}</div>;
  }

  const hasAnyData = report && report.some((d) => d.totalSlots > 0);

  if (!report || !hasAnyData) {
    return (
      <div className="p-4 max-w-2xl mx-auto space-y-6">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{t.weeklyReport}</h1>
        <div className="flex flex-col items-center justify-center h-48 text-gray-400 dark:text-gray-500 gap-2">
          <div className="text-4xl">📊</div>
          <div className="text-sm">{t.noWeeklyData}</div>
          <div className="text-xs">{t.registerForStats}</div>
        </div>
      </div>
    );
  }

  // Locale-aware day labels
  const localizedReport = report.map((d) => ({
    ...d,
    dayOfWeek: dayLabels[new Date(d.date).getDay()],
  }));

  const totalFocus = localizedReport.reduce((a, d) => a + d.focusMinutes, 0);
  const best = localizedReport.reduce((a, b) => (b.completionRate > a.completionRate ? b : a), localizedReport[0]);
  const radarData = localizedReport.map((d) => ({
    day: d.dayOfWeek,
    완료율: Math.round(d.completionRate),
  }));

  async function handleDownloadPDF() {
    const from = localizedReport[0].date;
    window.open(`/api/report/pdf?from=${from}&to=${today}`, '_blank');
  }

  return (
    <div className="p-4 space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{t.weeklyReport}</h1>
        <button
          onClick={handleDownloadPDF}
          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          {t.exportPDF}
        </button>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-800">
          <div className="text-sm text-gray-500 dark:text-gray-400">{t.thisWeekFocus}</div>
          <div className="text-2xl font-bold text-blue-600">{formatFocusTime(totalFocus)}</div>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-800">
          <div className="text-sm text-gray-500 dark:text-gray-400">{t.bestDay}</div>
          <div className="text-2xl font-bold text-green-600">{best.dayOfWeek}{t.dayOfWeekSuffix}</div>
          <div className="text-xs text-gray-400">{Math.round(best.completionRate)}% {t.completed}</div>
        </div>
      </div>

      {/* 달성률 막대 차트 */}
      <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-800">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">{t.sevenDayRate}</h2>
        <ResponsiveContainer width="100%" height={200}>
          <ComposedChart data={localizedReport} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="dayOfWeek" tick={{ fontSize: 12 }} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
            <Tooltip formatter={(v: number | string | undefined) => typeof v === 'number' ? `${Math.round(v)}%` : v} />
            <Legend />
            <Bar dataKey="completionRate" name={t.completionRateLabel} fill="#3b82f6" radius={[4, 4, 0, 0]} />
            <Line type="monotone" dataKey="timePunctuality" name={t.punctualityRateLabel} stroke="#f97316" strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* 요일별 패턴 레이더 */}
      <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-800">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">{t.dayPattern}</h2>
        <ResponsiveContainer width="100%" height={220}>
          <RadarChart data={radarData}>
            <PolarGrid />
            <PolarAngleAxis dataKey="day" tick={{ fontSize: 12 }} />
            <Radar name={t.completionRateLabel} dataKey="완료율" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* ── 기간 달성률 ── */}
      <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-800 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{t.periodRate}</h2>

        {/* 프리셋 버튼 */}
        <div className="flex gap-2 flex-wrap">
          {presets.map((p) => (
            <button
              key={p.label}
              onClick={() => { setPeriodFrom(p.from); setPeriodTo(today); setCustomMode(false); }}
              className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                isPresetActive(p.from)
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              {t.recent} {p.label}
            </button>
          ))}
          {/* 직접 설정 버튼 */}
          <button
            onClick={() => setCustomMode(true)}
            className={`px-3 py-1 text-xs rounded-full border transition-colors ${
              isCustomActive
                ? 'bg-purple-600 text-white border-purple-600'
                : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
            }`}
          >
            {t.customRange}
          </button>
        </div>

        {/* 직접 날짜 입력 — 직접 설정 모드에서만 표시 */}
        {isCustomActive && (
          <div className="flex items-center gap-2">
            <input
              ref={fromInputRef}
              type="date"
              value={periodFrom}
              max={periodTo}
              onChange={(e) => { setPeriodFrom(e.target.value); setCustomMode(true); }}
              className="flex-1 px-2 py-1.5 text-sm border border-purple-400 dark:border-purple-500 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer"
            />
            <span className="text-gray-400 text-sm">~</span>
            <input
              ref={toInputRef}
              type="date"
              value={periodTo}
              min={periodFrom}
              max={today}
              onChange={(e) => { setPeriodTo(e.target.value); setCustomMode(true); }}
              className="flex-1 px-2 py-1.5 text-sm border border-purple-400 dark:border-purple-500 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer"
            />
          </div>
        )}

        {/* 기간 통계 결과 */}
        {periodFetching ? (
          <div className="text-center text-sm text-gray-400 py-4">{t.calculating}</div>
        ) : period ? (
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3 text-center">
              <div className="text-xs text-blue-600 dark:text-blue-400 mb-1">{t.avgRate}</div>
              <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                {Math.round(period.avgCompletionRate)}%
              </div>
              <div className="text-[10px] text-blue-500 dark:text-blue-400">
                {period.doneSlots}/{period.totalSlots}개 {t.completed}
              </div>
            </div>
            <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-3 text-center">
              <div className="text-xs text-green-600 dark:text-green-400 mb-1">{t.dailyAvgFocus}</div>
              <div className="text-2xl font-bold text-green-700 dark:text-green-300">
                {formatFocusTime(period.avgFocusMinutes)}
              </div>
              <div className="text-[10px] text-green-500 dark:text-green-400">
                {t.daysBasis(period.days)}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
