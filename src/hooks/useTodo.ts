'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, getAuthUser } from '@/lib/firebase/client';

export interface TodoItem {
  id: string;
  text: string;
  checked: boolean;
}

interface TodoDoc {
  items: TodoItem[];
  date: string;
}

async function fetchTodo(date: string): Promise<TodoItem[]> {
  const user = await getAuthUser();
  if (!user) return [];
  const ref = doc(db, 'users', user.uid, 'todos', date);
  const snap = await getDoc(ref);
  if (!snap.exists()) return [];
  return (snap.data() as TodoDoc).items ?? [];
}

async function saveTodo(date: string, items: TodoItem[]): Promise<void> {
  const user = await getAuthUser();
  if (!user) return;
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
      // 재패치 없이 캐시를 동기적으로 업데이트 — isLoading 상태 변화 없음
      // (invalidateQueries → refetch → isLoading=true → 로딩 화면 노출 방지)
      queryClient.setQueryData(['todo', date], items);
    },
    onSettled: () => {
      // 주간 리포트 히스토리만 갱신 (todo 목록은 setQueryData로 이미 최신 상태)
      queryClient.invalidateQueries({ queryKey: ['todoHistory'] });
    },
  });

  return {
    items: query.data ?? [],
    isLoading: query.isLoading,
    save: mutation.mutate,
  };
}
