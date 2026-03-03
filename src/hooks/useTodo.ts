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
  return (snap.data() as TodoDoc).items ?? [];
}

async function saveTodo(date: string, items: TodoItem[]): Promise<void> {
  const user = await resolveUser();
  // null 반환(조용한 실패) 대신 throw → onSuccess 미호출 → 캐시 오염 방지
  if (!user) throw new Error('Not authenticated');
  const ref = doc(db, 'users', user.uid, 'todos', date);
  await setDoc(ref, { items, date });
}

export function useTodo(date: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['todo', date],
    queryFn: () => fetchTodo(date),
    staleTime: 30 * 1000,
  });

  const mutation = useMutation({
    mutationFn: (items: TodoItem[]) => saveTodo(date, items),
    onSuccess: (_, items) => {
      // Firebase 쓰기 성공 후 캐시를 동기 업데이트 (refetch 없음 → 로딩 없음)
      // 리마운트 시 이 캐시가 사용되어 staleTime 내에서 즉시 표시됨
      queryClient.setQueryData(['todo', date], items);
    },
    onSettled: () => {
      // 주간 히스토리만 갱신 (todo 캐시는 onSuccess에서 이미 최신 상태)
      queryClient.invalidateQueries({ queryKey: ['todoHistory'] });
    },
  });

  return {
    items: query.data ?? [],
    isLoading: query.isLoading,
    save: mutation.mutate,
  };
}
