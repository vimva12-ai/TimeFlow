'use client';

import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { format, subDays, parseISO } from 'date-fns';
import { db, auth } from '@/lib/firebase/client';

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

async function fetchTodo(date: string, uid: string): Promise<TodoItem[]> {
  const ref = doc(db, 'users', uid, 'todos', date);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    // Firebase에 문서가 없으면 localStorage 캐시를 그대로 유지
    return readTodoStorage(date) ?? [];
  }
  const items = (snap.data() as TodoDoc).items ?? [];
  writeTodoStorage(date, items);
  return items;
}

async function saveTodo(date: string, items: TodoItem[], uid: string): Promise<void> {
  const ref = doc(db, 'users', uid, 'todos', date);
  await setDoc(ref, { items, date });
}

// ─── 고정 항목 자동 이월 ──────────────────────────────────────────────────────
// 오늘 문서가 없을 때만 실행. 어제 pinned 항목을 체크 해제 상태로 오늘에 복사.
async function applyPinnedCarryOver(uid: string, date: string): Promise<void> {
  const todayRef = doc(db, 'users', uid, 'todos', date);
  const todaySnap = await getDoc(todayRef).catch(() => null);
  if (!todaySnap || todaySnap.exists()) return; // 이미 오늘 데이터가 있으면 건너뜀

  const yesterday = format(subDays(parseISO(date), 1), 'yyyy-MM-dd');
  const ySnap = await getDoc(doc(db, 'users', uid, 'todos', yesterday)).catch(() => null);
  if (!ySnap || !ySnap.exists()) return;

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

  // onAuthStateChanged로 auth 상태가 확정된 뒤 Firestore 구독 시작
  // — getAuthUser() 대신 직접 사용해 첫 이벤트 null 문제 방지
  useEffect(() => {
    let snapshotUnsub: (() => void) | undefined;
    let mounted = true;

    const authUnsub = onAuthStateChanged(auth, async (user) => {
      // 이전 snapshot 구독 정리 (auth 변경 시)
      snapshotUnsub?.();
      snapshotUnsub = undefined;

      if (!user || !mounted) return;

      const ref = doc(db, 'users', user.uid, 'todos', date);

      snapshotUnsub = onSnapshot(
        ref,
        (snap) => {
          if (!mounted) return;
          if (snap.exists()) {
            // 문서가 있을 때만 localStorage 갱신 (없을 때 [] 덮어쓰기 방지)
            const items = (snap.data() as TodoDoc).items ?? [];
            writeTodoStorage(date, items);
            queryClient.setQueryData(['todo', date], items);
          } else {
            // 문서 없음 → localStorage는 그대로, React Query만 빈 배열로
            queryClient.setQueryData(['todo', date], []);
          }
        },
        (error) => {
          // Firestore 권한 에러 등 → localStorage 폴백
          console.error('[useTodo] onSnapshot error:', error.code, error.message);
          const cached = readTodoStorage(date);
          queryClient.setQueryData(['todo', date], cached ?? []);
        },
      );

      // 오늘에 한해서만 고정 항목 이월 처리 (백그라운드, 실패 무시)
      const today = format(new Date(), 'yyyy-MM-dd');
      if (date === today) {
        applyPinnedCarryOver(user.uid, date).catch(() => {});
      }
    });

    return () => {
      mounted = false;
      authUnsub();
      snapshotUnsub?.();
    };
  }, [date, queryClient]);

  const query = useQuery({
    queryKey: ['todo', date],
    queryFn: () => {
      const uid = auth.currentUser?.uid;
      if (!uid) return readTodoStorage(date) ?? [];
      return fetchTodo(date, uid);
    },
    staleTime: 30 * 1000,
    // localStorage에 캐시가 있으면 즉시 표시 (네트워크 대기 없음)
    initialData: () => readTodoStorage(date),
    // initialDataUpdatedAt: 0 → 항상 stale → Firebase에서 백그라운드로 최신 데이터 동기화
    initialDataUpdatedAt: 0,
  });

  const mutation = useMutation({
    mutationFn: (items: TodoItem[]) => {
      const uid = auth.currentUser?.uid;
      if (!uid) {
        console.error('[useTodo] saveTodo: user not authenticated');
        throw new Error('Not authenticated');
      }
      return saveTodo(date, items, uid);
    },
    onMutate: (items) => {
      // localStorage 즉시 저장 + React Query 캐시 동기 업데이트 → UI 즉시 반영
      writeTodoStorage(date, items);
      const prev = queryClient.getQueryData<TodoItem[]>(['todo', date]);
      queryClient.setQueryData(['todo', date], items);
      return { prev };
    },
    onError: (err, _items, ctx) => {
      console.error('[useTodo] save error:', err);
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
