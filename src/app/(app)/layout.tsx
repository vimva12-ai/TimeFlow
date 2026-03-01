import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { CalendarDays, BarChart2, Settings } from 'lucide-react';
import { adminAuth } from '@/lib/firebase/admin';
import DatePicker from '@/components/nav/DatePicker';
import ThemeToggle from '@/components/ThemeToggle';
import LanguageSelector from '@/components/LanguageSelector';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const session = cookieStore.get('__session')?.value;
  if (!session) redirect('/login');

  try {
    await adminAuth.verifySessionCookie(session, true);
  } catch {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
      <div aria-live="polite" aria-atomic="true" className="sr-only" id="status-announcer" />

      {/* 상단 헤더 — 높이 축소 */}
      <header className="sticky top-0 z-30 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-6xl mx-auto px-4 h-10 flex items-center justify-between">
          <Link href="/today" className="text-base font-bold text-blue-600">
            TimeFlow
          </Link>
          <div className="flex items-center gap-2">
            <div id="achievement-badges-portal" />
            <LanguageSelector />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="flex flex-1 max-w-6xl w-full mx-auto overflow-hidden">
        {/* 사이드바 — 캘린더 + 바로 아래 네비게이션 */}
        <aside className="hidden md:flex flex-col w-52 shrink-0 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3 gap-3 overflow-y-auto">
          <DatePicker />

          <div className="border-t border-gray-100 dark:border-gray-800 pt-2">
            <nav className="flex flex-col gap-0.5">
              <Link
                href="/today"
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                <CalendarDays className="w-4 h-4 shrink-0" />
                오늘
              </Link>
              <Link
                href="/weekly"
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                <BarChart2 className="w-4 h-4 shrink-0" />
                주간 리포트
              </Link>
              <Link
                href="/settings"
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                <Settings className="w-4 h-4 shrink-0" />
                설정
              </Link>
            </nav>
          </div>
        </aside>

        {/* 메인 콘텐츠 */}
        <main className="flex-1 min-w-0 pb-14 md:pb-0 overflow-hidden" id="main-content" tabIndex={-1}>
          {children}
        </main>
      </div>

      {/* 하단 네비게이션 (모바일) */}
      <nav
        aria-label="앱 네비게이션"
        className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800"
      >
        <div className="flex items-center justify-around h-14">
          <Link href="/today" className="flex flex-col items-center gap-0.5 text-xs text-gray-600 dark:text-gray-400 hover:text-blue-600">
            <CalendarDays className="w-5 h-5" aria-hidden="true" />
            오늘
          </Link>
          <Link href="/weekly" className="flex flex-col items-center gap-0.5 text-xs text-gray-600 dark:text-gray-400 hover:text-blue-600">
            <BarChart2 className="w-5 h-5" aria-hidden="true" />
            주간
          </Link>
          <Link href="/settings" className="flex flex-col items-center gap-0.5 text-xs text-gray-600 dark:text-gray-400 hover:text-blue-600">
            <Settings className="w-5 h-5" aria-hidden="true" />
            설정
          </Link>
        </div>
      </nav>
    </div>
  );
}
