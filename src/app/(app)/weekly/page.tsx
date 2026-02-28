'use client';

import { useState } from 'react';
import { useWeeklyReport } from '@/hooks/useWeeklyReport';
import { usePeriodStats } from '@/hooks/usePeriodStats';
import { format, subDays } from 'date-fns';
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
  { label: '7일', from: format(subDays(new Date(), 6), 'yyyy-MM-dd') },
  { label: '14일', from: format(subDays(new Date(), 13), 'yyyy-MM-dd') },
  { label: '30일', from: format(subDays(new Date(), 29), 'yyyy-MM-dd') },
];

export default function WeeklyPage() {
  const { data: report, isLoading } = useWeeklyReport();

  // 기간 달성률 설정
  const [periodFrom, setPeriodFrom] = useState(presets[0].from);
  const [periodTo, setPeriodTo] = useState(today);
  const { data: period, isFetching: periodFetching } = usePeriodStats(periodFrom, periodTo);

  if (isLoading) {
    return <div className="flex items-center justify-center h-64 text-gray-400">로딩 중...</div>;
  }

  if (!report || report.length === 0) {
    return (
      <div className="p-4 max-w-2xl mx-auto space-y-6">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">주간 리포트</h1>
        <div className="flex flex-col items-center justify-center h-48 text-gray-400 dark:text-gray-500 gap-2">
          <div className="text-4xl">📊</div>
          <div className="text-sm">이번 주 데이터가 없습니다.</div>
          <div className="text-xs">오늘 탭에서 일정을 등록하면 통계가 표시됩니다.</div>
        </div>
      </div>
    );
  }

  const totalFocus = report.reduce((a, d) => a + d.focusMinutes, 0);
  const best = report.reduce((a, b) => (b.completionRate > a.completionRate ? b : a), report[0]);
  const radarData = report.map((d) => ({
    day: d.dayOfWeek,
    완료율: Math.round(d.completionRate),
  }));

  async function handleDownloadPDF() {
    const from = report![0].date;
    window.open(`/api/report/pdf?from=${from}&to=${today}`, '_blank');
  }

  return (
    <div className="p-4 space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">주간 리포트</h1>
        <button
          onClick={handleDownloadPDF}
          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          PDF 내보내기
        </button>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-800">
          <div className="text-sm text-gray-500 dark:text-gray-400">이번 주 집중 시간</div>
          <div className="text-2xl font-bold text-blue-600">{formatFocusTime(totalFocus)}</div>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-800">
          <div className="text-sm text-gray-500 dark:text-gray-400">베스트 데이</div>
          <div className="text-2xl font-bold text-green-600">{best.dayOfWeek}요일</div>
          <div className="text-xs text-gray-400">{Math.round(best.completionRate)}% 완료</div>
        </div>
      </div>

      {/* 달성률 막대 차트 */}
      <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-800">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">7일 달성률</h2>
        <ResponsiveContainer width="100%" height={200}>
          <ComposedChart data={report} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="dayOfWeek" tick={{ fontSize: 12 }} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
            <Tooltip formatter={(v: number | string | undefined) => typeof v === 'number' ? `${Math.round(v)}%` : v} />
            <Legend />
            <Bar dataKey="completionRate" name="완료율" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            <Line type="monotone" dataKey="timePunctuality" name="준수율" stroke="#f97316" strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* 요일별 패턴 레이더 */}
      <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-800">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">요일별 완료율 패턴</h2>
        <ResponsiveContainer width="100%" height={220}>
          <RadarChart data={radarData}>
            <PolarGrid />
            <PolarAngleAxis dataKey="day" tick={{ fontSize: 12 }} />
            <Radar name="완료율" dataKey="완료율" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* ── 기간 달성률 ── */}
      <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-800 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">기간 달성률</h2>

        {/* 프리셋 버튼 */}
        <div className="flex gap-2">
          {presets.map((p) => (
            <button
              key={p.label}
              onClick={() => { setPeriodFrom(p.from); setPeriodTo(today); }}
              className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                periodFrom === p.from && periodTo === today
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              최근 {p.label}
            </button>
          ))}
        </div>

        {/* 직접 날짜 입력 */}
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={periodFrom}
            max={periodTo}
            onChange={(e) => setPeriodFrom(e.target.value)}
            className="flex-1 px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <span className="text-gray-400 text-sm">~</span>
          <input
            type="date"
            value={periodTo}
            min={periodFrom}
            max={today}
            onChange={(e) => setPeriodTo(e.target.value)}
            className="flex-1 px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* 기간 통계 결과 */}
        {periodFetching ? (
          <div className="text-center text-sm text-gray-400 py-4">계산 중...</div>
        ) : period ? (
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3 text-center">
              <div className="text-xs text-blue-600 dark:text-blue-400 mb-1">평균 달성률</div>
              <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                {Math.round(period.avgCompletionRate)}%
              </div>
              <div className="text-[10px] text-blue-500 dark:text-blue-400">
                {period.doneSlots}/{period.totalSlots}개 완료
              </div>
            </div>
            <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-3 text-center">
              <div className="text-xs text-green-600 dark:text-green-400 mb-1">일평균 집중</div>
              <div className="text-2xl font-bold text-green-700 dark:text-green-300">
                {formatFocusTime(period.avgFocusMinutes)}
              </div>
              <div className="text-[10px] text-green-500 dark:text-green-400">
                {period.days}일 기준
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
