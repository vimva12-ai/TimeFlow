'use client';

import { useState } from 'react';
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  isSameMonth, isToday, startOfWeek, endOfWeek,
  addMonths, subMonths,
} from 'date-fns';
import clsx from 'clsx';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTimetableStore } from '@/store/timetableStore';

const DOW = ['일', '월', '화', '수', '목', '금', '토'];

export default function DatePicker() {
  const { selectedDate, setSelectedDate } = useTimetableStore();
  const [viewDate, setViewDate] = useState(new Date());

  const monthStart = startOfMonth(viewDate);
  const monthEnd = endOfMonth(viewDate);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const calDays = eachDayOfInterval({ start: calStart, end: calEnd });

  return (
    <div className="select-none">
      {/* 월 네비게이션 */}
      <div className="flex items-center justify-between mb-1.5">
        <button
          onClick={() => setViewDate(subMonths(viewDate, 1))}
          className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => setViewDate(new Date())}
          className="text-xs font-semibold text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        >
          {format(viewDate, 'yyyy년 M월')}
        </button>
        <button
          onClick={() => setViewDate(addMonths(viewDate, 1))}
          className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 요일 헤더 */}
      <div className="grid grid-cols-7 mb-0.5">
        {DOW.map((d, i) => (
          <div
            key={d}
            className={clsx(
              'text-center text-[10px] font-medium py-0.5',
              i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-400 dark:text-gray-500'
            )}
          >
            {d}
          </div>
        ))}
      </div>

      {/* 날짜 그리드 */}
      <div className="grid grid-cols-7">
        {calDays.map((day) => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const isSelected = dateStr === selectedDate;
          const isCurrentMonth = isSameMonth(day, viewDate);
          const isTodayDate = isToday(day);
          const isSun = day.getDay() === 0;
          const isSat = day.getDay() === 6;

          return (
            <button
              key={dateStr}
              onClick={() => setSelectedDate(dateStr)}
              className={clsx(
                'flex items-center justify-center text-[11px] rounded-full w-6 h-6 mx-auto my-0.5 transition-colors',
                isSelected
                  ? 'bg-blue-600 text-white font-bold'
                  : isTodayDate
                  ? 'ring-1 ring-blue-500 text-blue-600 dark:text-blue-400 font-semibold'
                  : isCurrentMonth
                  ? isSun
                    ? 'text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'
                    : isSat
                    ? 'text-blue-500 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                  : 'text-gray-300 dark:text-gray-600'
              )}
            >
              {format(day, 'd')}
            </button>
          );
        })}
      </div>
    </div>
  );
}
