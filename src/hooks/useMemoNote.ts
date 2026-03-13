'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, getAuthUser } from '@/lib/firebase/client';

export function useMemoNote() {
  const queryClient = useQueryClient();

  const { data: text = '' } = useQuery({
    queryKey: ['memoNote'],
    queryFn: async (): Promise<string> => {
      const user = await getAuthUser();
      if (!user) return '';
      const docRef = doc(db, 'users', user.uid, 'memos', 'main');
      const snap = await getDoc(docRef);
      return snap.exists() ? (snap.data().text as string) : '';
    },
    staleTime: 60_000,
  });

  const save = useMutation({
    mutationFn: async (newText: string) => {
      const user = await getAuthUser();
      if (!user) return;
      const docRef = doc(db, 'users', user.uid, 'memos', 'main');
      await setDoc(docRef, { text: newText, updatedAt: serverTimestamp() }, { merge: true });
    },
    onMutate: async (newText) => {
      // 낙관적 업데이트: 즉시 캐시에 반영
      await queryClient.cancelQueries({ queryKey: ['memoNote'] });
      queryClient.setQueryData(['memoNote'], newText);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['memoNote'] }),
  });

  return { text, save };
}
