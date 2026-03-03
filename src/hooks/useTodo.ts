'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, auth, getAuthUser } from '@/lib/firebase/client';

export interface TodoItem {
  id: string;
  text: string;
  checked: boolean;
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

/**
 * auth.currentUser가 이미 로드돼 있으면 즉시 반환 (동기, 빠름).
 * 초기 페이지 로드처럼 아직 복원 중이면 onAuthStateChanged 완료까지 대기.
 */
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
  // Firebase에서 불러온 최신 데이터를 localStorage에도 반영
  writeTodoStorage(date, items);
  return items;
}

async function saveTodo(date: string, items: TodoItem[]): Promise<void> {
  const user = await resolveUser();
  // null 반환(조용한 실패) 대신 throw → onSuccess 미호출 → 캐시 오염 방지
  if (!user) throw new Error('Not authenticated');
  const ref = doc(db, 'users', user.uid, 'todos', date);
  await setDoc(ref, { items, date });
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useTodo(date: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['todo', date],
    queryFn: () => fetchTodo(date),
    staleTime: 30 * 1000,
    // localStorage에 캐시가 있으면 즉시 표시 (네트워크 대기 없음)
    initialData: () => readTodoStorage(date),
    // initialDataUpdatedAt: 0 → 항상 stale 처리 → Firebase에서 백그라운드로 최신 데이터 동기화
    initialDataUpdatedAt: 0,
  });

  const mutation = useMutation({
    mutationFn: (items: TodoItem[]) => saveTodo(date, items),
    onMutate: (items) => {
      // 1) localStorage에 즉시 저장 → 새로고침 후에도 데이터 유지
      writeTodoStorage(date, items);
      // 2) React Query 캐시를 동기적으로 업데이트 → UI 즉시 반영 (loading 없음)
      const prev = queryClient.getQueryData<TodoItem[]>(['todo', date]);
      queryClient.setQueryData(['todo', date], items);
      return { prev };
    },
    onError: (_err, _items, ctx) => {
      // Firebase 쓰기 실패 시 캐시 롤백 (localStorage는 그대로 — UI 일관성 유지)
      if (ctx?.prev !== undefined) {
        queryClient.setQueryData(['todo', date], ctx.prev);
      }
    },
    onSettled: () => {
      // 주간 히스토리만 갱신 (todo 캐시는 onMutate에서 이미 최신 상태)
      queryClient.invalidateQueries({ queryKey: ['todoHistory'] });
    },
  });

  return {
    items: query.data ?? [],
    isLoading: query.isLoading,
    save: mutation.mutate,
  };
}
