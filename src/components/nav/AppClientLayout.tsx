'use client';

import { useState, useEffect } from 'react';
import { Menu, X, LogOut, BookOpen } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase/client';
import DatePicker from '@/components/nav/DatePicker';
import ThemeToggle from '@/components/ThemeToggle';
import LanguageSelector from '@/components/LanguageSelector';
import NavLinks, { BottomNav } from '@/components/nav/NavLinks';
import SidebarPomodoro from '@/components/nav/SidebarPomodoro';
import SidebarTodo from '@/components/nav/SidebarTodo';
import SidebarMemo from '@/components/nav/SidebarMemo';
import { useTimetableStore } from '@/store/timetableStore';
import { useSlotMutations } from '@/hooks/useSlotMutations';
import { useTodo, type TodoItem } from '@/hooks/useTodo';
import { useQueryClient } from '@tanstack/react-query';
import { addMinutes, format } from 'date-fns';

export default function AppClientLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const router = useRouter();
  const { selectedDate } = useTimetableStore();
  const { updateSlotStatus, createSlot } = useSlotMutations(selectedDate);
  const { save: saveTodo } = useTodo(selectedDate);
  const queryClient = useQueryClient();

  // 할 일 체크/해제 시 연결된 슬롯 상태 동기화
  // 체크 → 슬롯 'done', 해제 → 슬롯 'planned'으로 되돌림
  function handleTodoToggle(item: TodoItem, newChecked: boolean) {
    if (!item.linkedSlotId) return;
    updateSlotStatus.mutate({
      slotId: item.linkedSlotId,
      status: newChecked ? 'done' : 'planned',
    });
  }

  // 새 할 일 추가 시 PLAN 슬롯 자동 생성
  // 오늘: 현재 시각 기준 다음 30분 경계 / 다른 날짜: 09:00 기본값
  function handleTodoAdd(text: string, todoId: string) {
    const now = new Date();
    const todayStr = format(now, 'yyyy-MM-dd');
    let startStr: string;
    if (selectedDate === todayStr) {
      // 현재 분이 0~29이면 :30, 30~59이면 다음 시간 :00
      const h = now.getMinutes() < 30 ? now.getHours() : now.getHours() + 1;
      const m = now.getMinutes() < 30 ? 30 : 0;
      startStr = `${selectedDate}T${String(h % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
    } else {
      startStr = `${selectedDate}T09:00:00`;
    }
    const start = new Date(startStr).toISOString();
    const end = addMinutes(new Date(start), 30).toISOString();
    createSlot.mutate(
      { title: text, start_at: start, end_at: end, status: 'planned', sort_order: 0, linkedTodoId: todoId },
      {
        onSuccess: (slot) => {
          // 생성된 슬롯 ID를 할 일 항목에 역방향으로 연결
          const current = queryClient.getQueryData<TodoItem[]>(['todo', selectedDate]) ?? [];
          saveTodo(current.map((t) => t.id === todoId ? { ...t, linkedSlotId: slot.id } : t));
        },
      }
    );
  }

  // Firebase 로그아웃 + 세션 쿠키 삭제 후 로그인 페이지로 이동
  async function handleLogout() {
    await fetch('/api/auth/session', { method: 'DELETE' });
    await signOut(auth);
    router.push('/login');
  }

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSidebarOpen(false);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);

  const closeSidebar = () => setSidebarOpen(false);

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
            {/* TF Guide 버튼: /manual 페이지로 이동 */}
            <Link
              href="/manual"
              className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 border border-blue-200 dark:border-blue-800 transition-colors"
              aria-label="사용자 매뉴얼"
              title="사용자 매뉴얼"
            >
              <BookOpen size={13} />
              <span>TF Guide</span>
            </Link>
            {/* 로그아웃 버튼 */}
            <button
              onClick={handleLogout}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
              aria-label="로그아웃"
              title="로그아웃"
            >
              <LogOut size={16} />
            </button>
            <LanguageSelector />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="flex flex-1 max-w-6xl w-full mx-auto overflow-hidden">
        {/* 데스크톱 사이드바 (항상 표시) */}
        <aside className="hidden md:flex flex-col w-52 shrink-0 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3 gap-3 overflow-y-auto">
          <DatePicker />
          <div className="border-t border-gray-100 dark:border-gray-800 pt-2">
            <SidebarPomodoro />
          </div>
          <div className="border-t border-gray-100 dark:border-gray-800 pt-2">
            <SidebarTodo onToggle={handleTodoToggle} onAddItem={handleTodoAdd} />
          </div>
          <div className="border-t border-gray-100 dark:border-gray-800 pt-2">
            <SidebarMemo />
          </div>
          <div className="border-t border-gray-100 dark:border-gray-800 pt-2">
            <NavLinks />
          </div>
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
          <DatePicker />
          <div className="border-t border-gray-100 dark:border-gray-800 pt-2">
            <SidebarPomodoro />
          </div>
          <div className="border-t border-gray-100 dark:border-gray-800 pt-2">
            <SidebarTodo onToggle={handleTodoToggle} onAddItem={handleTodoAdd} />
          </div>
          <div className="border-t border-gray-100 dark:border-gray-800 pt-2">
            <SidebarMemo />
          </div>
          <div className="border-t border-gray-100 dark:border-gray-800 pt-2">
            <NavLinks />
          </div>
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
