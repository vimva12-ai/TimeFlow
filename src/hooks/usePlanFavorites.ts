'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  query,
  orderBy,
} from 'firebase/firestore';
import { db, getAuthUser } from '@/lib/firebase/client';
import type { PlanFavorite } from '@/types/database';

export type { PlanFavorite };

export function usePlanFavorites() {
  const queryClient = useQueryClient();

  const { data: favorites = [] } = useQuery({
    queryKey: ['planFavorites'],
    queryFn: async (): Promise<PlanFavorite[]> => {
      const user = await getAuthUser();
      if (!user) return [];
      const q = query(
        collection(db, 'users', user.uid, 'plan_favorites'),
        orderBy('sort_order', 'asc'),
      );
      const snap = await getDocs(q);
      return snap.docs.map((d) => ({ id: d.id, ...d.data() })) as PlanFavorite[];
    },
    staleTime: 30_000,
  });

  const addFavorite = useMutation({
    mutationFn: async ({
      title,
      durationMinutes,
    }: {
      title: string;
      durationMinutes: number;
    }) => {
      const user = await getAuthUser();
      if (!user) throw new Error('Not authenticated');
      await addDoc(collection(db, 'users', user.uid, 'plan_favorites'), {
        uid: user.uid,
        title,
        durationMinutes,
        sort_order: favorites.length,
        created_at: serverTimestamp(),
      });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['planFavorites'] }),
  });

  const removeFavorite = useMutation({
    mutationFn: async (id: string) => {
      const user = await getAuthUser();
      if (!user) throw new Error('Not authenticated');
      await deleteDoc(doc(db, 'users', user.uid, 'plan_favorites', id));
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['planFavorites'] }),
  });

  return { favorites, addFavorite, removeFavorite };
}
