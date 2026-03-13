'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  collection,
  query,
  orderBy,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from 'firebase/firestore';
import { db, getAuthUser } from '@/lib/firebase/client';
import type { MemoItem } from '@/types/database';

const QUERY_KEY = ['memoItems'] as const;

/** Firestore Timestamp → ISO 문자열 변환 (serverTimestamp 직후 null 안전 처리) */
function toIso(ts: { toDate?: () => Date } | null | undefined): string {
  return ts?.toDate?.()?.toISOString() ?? new Date().toISOString();
}

export function useMemoNote() {
  const queryClient = useQueryClient();

  // 메모 목록 조회 (최신순)
  const { data: memos = [] } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async (): Promise<MemoItem[]> => {
      const user = await getAuthUser();
      if (!user) return [];
      const q = query(
        collection(db, 'users', user.uid, 'memo_items'),
        orderBy('created_at', 'desc'),
      );
      const snap = await getDocs(q);
      return snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          text: data.text as string,
          created_at: toIso(data.created_at),
          updated_at: toIso(data.updated_at),
        };
      });
    },
    staleTime: 60_000,
  });

  // 새 메모 생성
  const create = useMutation({
    mutationFn: async (text: string) => {
      const user = await getAuthUser();
      if (!user) return;
      await addDoc(collection(db, 'users', user.uid, 'memo_items'), {
        text,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  // 메모 수정
  const update = useMutation({
    mutationFn: async ({ id, text }: { id: string; text: string }) => {
      const user = await getAuthUser();
      if (!user) return;
      const ref = doc(db, 'users', user.uid, 'memo_items', id);
      await updateDoc(ref, { text, updated_at: serverTimestamp() });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  // 메모 삭제 (낙관적 업데이트)
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const user = await getAuthUser();
      if (!user) return;
      const ref = doc(db, 'users', user.uid, 'memo_items', id);
      await deleteDoc(ref);
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY });
      const prev = queryClient.getQueryData<MemoItem[]>(QUERY_KEY);
      queryClient.setQueryData<MemoItem[]>(QUERY_KEY, (old) => old?.filter((m) => m.id !== id) ?? []);
      return { prev };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(QUERY_KEY, ctx.prev);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  return { memos, create, update, remove };
}
