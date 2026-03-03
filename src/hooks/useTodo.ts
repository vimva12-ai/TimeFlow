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
    onSettled: () => {
      // SidebarTodo가 로컬 상태로 UI를 관리하므로 ['todo', date] invalidate가
      // 경쟁조건 없이 안전함. 리마운트 시 최신 Firebase 데이터를 보장하기 위해
      // 양쪽 모두 갱신.
      queryClient.invalidateQueries({ queryKey: ['todo', date] });
      queryClient.invalidateQueries({ queryKey: ['todoHistory'] });
    },
  });

  return {
    items: query.data ?? [],
    isLoading: query.isLoading,
    save: mutation.mutate,
  };
}
