'use client';

import { useState, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, Trash2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useTimetableStore } from '@/store/timetableStore';
import { type TimeSlotWithLogs, type SlotStatus } from '@/types/database';
import { useSlotMutations } from '@/hooks/useSlotMutations';
import { useI18n } from '@/lib/i18n';

interface SlotEditModalProps {
  slots: TimeSlotWithLogs[];
  date: string;
}

export default function SlotEditModal({ slots, date }: SlotEditModalProps) {
  const { editingSlotId, setEditingSlotId } = useTimetableStore();
  const { updateSlotStatus, updateSlotTitle, deleteSlot, updateSlotTime } = useSlotMutations(date);
  const { t } = useI18n();

  const slot = slots.find((s) => s.id === editingSlotId) ?? null;
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState<SlotStatus>('planned');
  const [startVal, setStartVal] = useState('');
  const [endVal, setEndVal] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const STATUS_OPTIONS: { value: SlotStatus; label: string }[] = [
    { value: 'planned', label: t.planned },
    { value: 'done',    label: t.doneLabel },
    { value: 'partial', label: t.partialLabel },
    { value: 'skipped', label: t.skippedLabel },
  ];

  useEffect(() => {
    if (slot) {
      setTitle(slot.title);
      setStatus(slot.status);
      setStartVal(format(parseISO(slot.start_at), 'HH:mm'));
      setEndVal(format(parseISO(slot.end_at), 'HH:mm'));
      setConfirmDelete(false);
    }
  }, [slot]);

  function handleSave() {
    if (!slot) return;
    if (title !== slot.title) updateSlotTitle.mutate({ slotId: slot.id, title });
    if (status !== slot.status) updateSlotStatus.mutate({ slotId: slot.id, status });
    const origStart = format(parseISO(slot.start_at), 'HH:mm');
    const origEnd = format(parseISO(slot.end_at), 'HH:mm');
    if ((startVal && endVal) && (startVal !== origStart || endVal !== origEnd)) {
      const d = slot.start_at.slice(0, 10);
      updateSlotTime.mutate({
        slotId: slot.id,
        start_at: new Date(`${d}T${startVal}:00`).toISOString(),
        end_at: new Date(`${d}T${endVal}:00`).toISOString(),
      });
    }
    setEditingSlotId(null);
  }

  function handleDelete() {
    if (!slot) return;
    deleteSlot.mutate(slot.id);
    setEditingSlotId(null);
  }

  return (
    <Dialog.Root open={!!editingSlotId} onOpenChange={(open) => !open && setEditingSlotId(null)}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" />
        <Dialog.Content
          className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-6 focus:outline-none"
          aria-describedby={undefined}
        >
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {t.editSlot}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <X className="w-5 h-5" />
              </button>
            </Dialog.Close>
          </div>

          {slot && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.timeRange}</label>
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={startVal}
                    onChange={(e) => setStartVal(e.target.value)}
                    className="flex-1 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-gray-400 shrink-0">–</span>
                  <input
                    type="time"
                    value={endVal}
                    onChange={(e) => setEndVal(e.target.value)}
                    className="flex-1 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.title}</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.status}</label>
                <div className="flex gap-2 flex-wrap">
                  {STATUS_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setStatus(opt.value)}
                      className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                        status === opt.value
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                {!confirmDelete ? (
                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="flex items-center gap-1 text-sm text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                    {t.delete}
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-red-600">{t.confirmDelete}</span>
                    <button onClick={handleDelete} className="text-sm text-red-600 font-semibold hover:text-red-800">{t.yes}</button>
                    <button onClick={() => setConfirmDelete(false)} className="text-sm text-gray-500">{t.no}</button>
                  </div>
                )}
                <button
                  onClick={handleSave}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {t.save}
                </button>
              </div>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
