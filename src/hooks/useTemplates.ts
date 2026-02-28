'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  doc, collection, getDoc, getDocs, addDoc, deleteDoc, setDoc,
  query, orderBy, serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase/client';
import { type Template, type TimeSlotWithLogs, type TemplateSlotJson } from '@/types/database';
import { addMinutes, parseISO } from 'date-fns';

async function fetchTemplates(): Promise<Template[]> {
  const uid = auth.currentUser?.uid;
  if (!uid) return [];
  const snap = await getDocs(
    query(collection(db, 'users', uid, 'templates'), orderBy('created_at', 'desc'))
  );
  return snap.docs.map((d) => ({ ...d.data(), id: d.id } as Template));
}

export function useTemplates() {
  const qc = useQueryClient();

  const tplQuery = useQuery({ queryKey: ['templates'], queryFn: fetchTemplates });

  const saveTemplate = useMutation({
    mutationFn: async ({ name, slots }: { name: string; slots: TimeSlotWithLogs[] }) => {
      const uid = auth.currentUser?.uid;
      if (!uid) throw new Error('Not authenticated');

      const existing = await fetchTemplates();
      if (existing.length >= 10) throw new Error('템플릿은 최대 10개까지 저장할 수 있습니다.');

      const slotsJson: TemplateSlotJson[] = slots.map((s, i) => {
        const start = parseISO(s.start_at);
        const end = parseISO(s.end_at);
        const offsetMinutes = start.getHours() * 60 + start.getMinutes();
        const durationMinutes = Math.round((end.getTime() - start.getTime()) / 60000);
        return { title: s.title, offsetMinutes, durationMinutes, sort_order: i };
      });

      const docRef = await addDoc(collection(db, 'users', uid, 'templates'), {
        uid,
        name,
        slots_json: slotsJson,
        created_at: serverTimestamp(),
      });
      return { id: docRef.id, uid, name, slots_json: slotsJson };
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['templates'] }),
  });

  const applyTemplate = useMutation({
    mutationFn: async ({ templateId, date }: { templateId: string; date: string }) => {
      const uid = auth.currentUser?.uid;
      if (!uid) throw new Error('Not authenticated');

      const tplSnap = await getDoc(doc(db, 'users', uid, 'templates', templateId));
      if (!tplSnap.exists()) throw new Error('Template not found');
      const tpl = tplSnap.data();

      const planId = `${uid}_${date}`;
      const planRef = doc(db, 'users', uid, 'daily_plans', planId);
      await setDoc(planRef, { uid, date, created_at: serverTimestamp() }, { merge: true });

      const dayStart = new Date(`${date}T00:00:00`);
      const slotsRef = collection(planRef, 'time_slots');
      await Promise.all(
        (tpl.slots_json as TemplateSlotJson[]).map((s) =>
          addDoc(slotsRef, {
            uid,
            planId,
            title: s.title,
            start_at: addMinutes(dayStart, s.offsetMinutes).toISOString(),
            end_at: addMinutes(dayStart, s.offsetMinutes + s.durationMinutes).toISOString(),
            status: 'planned',
            sort_order: s.sort_order,
            created_at: serverTimestamp(),
          })
        )
      );
    },
    onSettled: (_d, _e, vars) => qc.invalidateQueries({ queryKey: ['dailyPlan', vars.date] }),
  });

  const deleteTemplate = useMutation({
    mutationFn: async (templateId: string) => {
      const uid = auth.currentUser?.uid;
      if (!uid) throw new Error('Not authenticated');
      await deleteDoc(doc(db, 'users', uid, 'templates', templateId));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['templates'] }),
  });

  return { ...tplQuery, saveTemplate, applyTemplate, deleteTemplate };
}
