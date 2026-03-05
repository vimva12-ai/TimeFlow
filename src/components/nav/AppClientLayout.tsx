'use client';

import { useState, useEffect } from 'react';
import { Menu, X } from 'lucide-react';
import DatePicker from '@/components/nav/DatePicker';
import ThemeToggle from '@/components/ThemeToggle';
import LanguageSelector from '@/components/LanguageSelector';
import NavLinks, { BottomNav } from '@/components/nav/NavLinks';
import SidebarPomodoro from '@/components/nav/SidebarPomodoro';
import SidebarTodo from '@/components/nav/SidebarTodo';

export default function AppClientLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSidebarOpen(false);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);

  const closeSidebar = () => setSidebarOpen(false);

  const SidebarContent = () => (
    <>
      <DatePicker />
      <div className="border-t border-gray-100 dark:border-gray-800 pt-2">
        <SidebarPomodoro />
      </div>
      <div className="border-t border-gray-100 dark:border-gray-800 pt-2">
        <SidebarTodo />
      </div>
      <div className="border-t border-gray-100 dark:border-gray-800 pt-2">
        <NavLinks />
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
      <div aria-live="polite" aria-atomic="true" className="sr-only" id="status-announcer" />

      {/* 상단 헤더 */}
      <header className="sticky top-0 z-30 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-6xl mx-auto px-4 h-10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* 모바일 사이드바 토글 버튼 */}
            <button
              className="md:hidden p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 transition-colors"
              onClick={() => setSidebarOpen((v) => !v)}
              aria-label={sidebarOpen ? '사이드바 닫기' : '사이드바 열기'}
              aria-expanded={sidebarOpen}
            >
              {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <a href="/today" className="text-base font-bold text-blue-600">TimeFlow</a>
          </div>
          <div className="flex items-center gap-2">
            <div id="achievement-badges-portal" />
            <LanguageSelector />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="flex flex-1 max-w-6xl w-full mx-auto overflow-hidden">
        {/* 데스크톱 사이드바 (항상 표시) */}
        <aside className="hidden md:flex flex-col w-52 shrink-0 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3 gap-3 overflow-y-auto">
          <SidebarContent />
        </aside>

        {/* 모바일 사이드바 backdrop */}
        {sidebarOpen && (
          <div
            className="md:hidden fixed inset-0 z-40 bg-black/40"
            onClick={closeSidebar}
            aria-hidden="true"
          />
        )}

        {/* 모바일 사이드바 드로어 */}
        <aside
          className={`md:hidden fixed top-10 left-0 bottom-14 z-50 w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 p-3 gap-3 overflow-y-auto flex flex-col transition-transform duration-200 ease-in-out ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
          aria-hidden={!sidebarOpen}
        >
          <SidebarContent />
        </aside>

        {/* 메인 콘텐츠 */}
        <main
          className="flex-1 min-w-0 pb-14 md:pb-0 overflow-hidden"
          id="main-content"
          tabIndex={-1}
        >
          {children}
        </main>
      </div>

      {/* 하단 네비 (모바일) */}
      <nav
        aria-label="앱 네비게이션"
        className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800"
      >
        <BottomNav />
      </nav>
    </div>
  );
}
