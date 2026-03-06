'use client';

import { useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
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
// auth.currentUser가 null일 수 있으므로 반드시 resolveUser()로 대기 후 사용

function resolveUser() {
  if (auth.currentUser) return Promise.resolve(auth.currentUser);
  return getAuthUser();
}

async function fetchTodo(date: string): Promise<TodoItem[]> {
  const user = await resolveUser();
  if (!user) return readTodoStorage(date) ?? [];
  const ref = doc(db, 'users', user.uid, 'todos', date);
  const snap = await getDoc(ref);
  if (!snap.exists()) return readTodoStorage(date) ?? [];
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
  // 진행 중인 뮤테이션 수를 추적 — onSnapshot이 optimistic update를 덮어쓰는 race condition 방지
  const pendingMutations = useRef(0);

  // onAuthStateChanged로 auth 확정 후 Firestore 실시간 구독 시작
  // — auth.currentUser 직접 사용 금지 (페이지 로드 직후 null일 수 있음)
  useEffect(() => {
    let snapshotUnsub: (() => void) | undefined;
    let mounted = true;

    const authUnsub = onAuthStateChanged(auth, (user) => {
      // auth 상태가 바뀔 때마다 이전 snapshot 구독 정리
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
            // 뮤테이션 진행 중에는 캐시를 갱신하지 않음
            // — 이전 write 완료 snapshot이 현재 optimistic update를 덮어쓰는 race condition 방지
            if (pendingMutations.current === 0) {
              queryClient.setQueryData(['todo', date], items);
            }
          }
          // 문서가 없을 때는 cache를 건드리지 않음 — optimistic update 보호
        },
        (error) => {
          // Firestore 권한 에러 등 → localStorage 폴백
          console.error('[useTodo] onSnapshot error:', error.code, error.message);
          const cached = readTodoStorage(date);
          if (cached !== undefined) {
            queryClient.setQueryData(['todo', date], cached);
          }
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
      // 뮤테이션 시작 카운트 증가 — onSnapshot의 캐시 덮어쓰기 차단
      pendingMutations.current++;
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
      // 뮤테이션 완료 후 300ms 유예 — setDoc 완료 직후 도착하는 onSnapshot이
      // old data로 캐시를 덮어쓰는 race condition 방지 (모바일 환경에서 특히 중요)
      setTimeout(() => {
        pendingMutations.current = Math.max(0, pendingMutations.current - 1);
      }, 300);
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
