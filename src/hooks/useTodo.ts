'use client';

import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { format, subDays, parseISO } from 'date-fns';
import { db, auth, getAuthUser } from '@/lib/firebase/client';

export interface TodoItem {
  id: string;
  text: string;
  checked: boolean;
  pinned?: boolean; // true이면 다음 날 할 일 목록에 체크 해제 상태로 자동 이월
}

interface TodoDoc {
  items: TodoItem[];
  date: string;
}

// ─── localStorage 캐시 헬퍼 ───────────────────────────────────────────────────
function lsKey(date: string) {
  return `timeflow-todo-${date}`;
}

function readTodoStorage(date: string): TodoItem[] | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const raw = localStorage.getItem(lsKey(date));
    return raw ? (JSON.parse(raw) as TodoItem[]) : undefined;
  } catch {
    return undefined;
  }
}

function writeTodoStorage(date: string, items: TodoItem[]): void {
  try {
    localStorage.setItem(lsKey(date), JSON.stringify(items));
  } catch {
    // 저장 공간 부족 등 무시
  }
}

// ─── Firebase 읽기/쓰기 ────────────────────────────────────────────────────────

function resolveUser() {
  if (auth.currentUser) return Promise.resolve(auth.currentUser);
  return getAuthUser();
}

async function fetchTodo(date: string): Promise<TodoItem[]> {
  const user = await resolveUser();
  if (!user) return [];
  const ref = doc(db, 'users', user.uid, 'todos', date);
  const snap = await getDoc(ref);
  if (!snap.exists()) return [];
  const items = (snap.data() as TodoDoc).items ?? [];
  writeTodoStorage(date, items);
  return items;
}

async function saveTodo(date: string, items: TodoItem[]): Promise<void> {
  const user = await resolveUser();
  if (!user) throw new Error('Not authenticated');
  const ref = doc(db, 'users', user.uid, 'todos', date);
  await setDoc(ref, { items, date });
}

// ─── 고정 항목 자동 이월 ──────────────────────────────────────────────────────
// 오늘 문서가 없을 때만 실행. 어제 pinned 항목을 체크 해제 상태로 오늘에 복사.
async function applyPinnedCarryOver(uid: string, date: string): Promise<void> {
  const todayRef = doc(db, 'users', uid, 'todos', date);
  const todaySnap = await getDoc(todayRef);
  if (todaySnap.exists()) return; // 이미 오늘 데이터가 있으면 건너뜀

  const yesterday = format(subDays(parseISO(date), 1), 'yyyy-MM-dd');
  const ySnap = await getDoc(doc(db, 'users', uid, 'todos', yesterday));
  if (!ySnap.exists()) return;

  const pinnedItems = ((ySnap.data() as TodoDoc).items ?? [])
    .filter((i) => i.pinned)
    .map((i) => ({ ...i, checked: false })); // 새 날엔 체크 해제 상태로

  if (pinnedItems.length > 0) {
    await setDoc(todayRef, { items: pinnedItems, date });
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useTodo(date: string) {
  const queryClient = useQueryClient();

  // Firestore 실시간 구독 — 모든 기기에서 즉시 동기화
  useEffect(() => {
    let unsub: (() => void) | undefined;
    let mounted = true;

    resolveUser().then(async (user) => {
      if (!user || !mounted) return;

      // 실시간 구독 먼저 시작 (쓰기 후 snapshot이 즉시 반영됨)
      const ref = doc(db, 'users', user.uid, 'todos', date);
      unsub = onSnapshot(ref, (snap) => {
        if (!mounted) return;
        const items = snap.exists() ? (snap.data() as TodoDoc).items ?? [] : [];
        writeTodoStorage(date, items);
        queryClient.setQueryData(['todo', date], items);
      });

      // 오늘에 한해서만 고정 항목 이월 처리 (백그라운드, 실패 무시)
      const today = format(new Date(), 'yyyy-MM-dd');
      if (date === today) {
        applyPinnedCarryOver(user.uid, date).catch(() => {});
      }
    });

    return () => {
      mounted = false;
      unsub?.();
    };
  }, [date, queryClient]);

  const query = useQuery({
    queryKey: ['todo', date],
    queryFn: () => fetchTodo(date),
    staleTime: 30 * 1000,
    // localStorage에 캐시가 있으면 즉시 표시 (네트워크 대기 없음)
    initialData: () => readTodoStorage(date),
    // initialDataUpdatedAt: 0 → 항상 stale → Firebase에서 백그라운드로 최신 데이터 동기화
    initialDataUpdatedAt: 0,
  });

  const mutation = useMutation({
    mutationFn: (items: TodoItem[]) => saveTodo(date, items),
    onMutate: (items) => {
      // localStorage 즉시 저장 + React Query 캐시 동기 업데이트 → UI 즉시 반영
      writeTodoStorage(date, items);
      const prev = queryClient.getQueryData<TodoItem[]>(['todo', date]);
      queryClient.setQueryData(['todo', date], items);
      return { prev };
    },
    onError: (_err, _items, ctx) => {
      if (ctx?.prev !== undefined) {
        queryClient.setQueryData(['todo', date], ctx.prev);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['todoHistory'] });
      queryClient.invalidateQueries({ queryKey: ['todoStats'] });
    },
  });

  return {
    items: query.data ?? [],
    isLoading: query.isLoading,
    save: mutation.mutate,
  };
}
