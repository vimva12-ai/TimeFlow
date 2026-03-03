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
    onMutate: async (items) => {
      await queryClient.cancelQueries({ queryKey: ['todo', date] });
      const prev = queryClient.getQueryData<TodoItem[]>(['todo', date]);
      queryClient.setQueryData(['todo', date], items);
      return { prev };
    },
    onError: (_err, _items, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['todo', date], ctx.prev);
    },
    onSettled: () => {
      // ['todo', date]는 invalidate하지 않음 — onMutate 옵티미스틱 업데이트가
      // 이미 정확한 상태를 갖고 있으므로 서버 리패치 시 경쟁조건(체크 해제 불가,
      // 두 번째 항목 추가 불가) 발생. 주간 리포트용 히스토리만 갱신.
      queryClient.invalidateQueries({ queryKey: ['todoHistory'] });
    },
  });

  return {
    items: query.data ?? [],
    isLoading: query.isLoading,
    save: mutation.mutate,
  };
}
