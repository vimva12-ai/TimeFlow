'use client';

import Link from 'next/link';
import { CalendarDays, BarChart2, Settings } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

export default function NavLinks() {
  const { t } = useI18n();
  return (
    <nav className="flex flex-col gap-0.5">
      <Link href="/today" className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
        <CalendarDays className="w-4 h-4 shrink-0" />{t.today}
      </Link>
      <Link href="/weekly" className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
        <BarChart2 className="w-4 h-4 shrink-0" />{t.weeklyReport}
      </Link>
      <Link href="/settings" className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
        <Settings className="w-4 h-4 shrink-0" />{t.settings}
      </Link>
    </nav>
  );
}

export function BottomNav() {
  const { t } = useI18n();
  return (
    <div className="flex items-center justify-around h-14">
      <Link href="/today" className="flex flex-col items-center gap-0.5 text-xs text-gray-600 dark:text-gray-400 hover:text-blue-600">
        <CalendarDays className="w-5 h-5" />{t.today}
      </Link>
      <Link href="/weekly" className="flex flex-col items-center gap-0.5 text-xs text-gray-600 dark:text-gray-400 hover:text-blue-600">
        <BarChart2 className="w-5 h-5" />{t.weekly}
      </Link>
      <Link href="/settings" className="flex flex-col items-center gap-0.5 text-xs text-gray-600 dark:text-gray-400 hover:text-blue-600">
        <Settings className="w-5 h-5" />{t.settings}
      </Link>
    </div>
  );
}
