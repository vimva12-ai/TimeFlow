'use client';

import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, Trash2, BookTemplate } from 'lucide-react';
import { useTemplates } from '@/hooks/useTemplates';
import { useTimetableStore } from '@/store/timetableStore';
import { type TimeSlotWithLogs } from '@/types/database';

interface TemplateDrawerProps {
  slots: TimeSlotWithLogs[];
}

export default function TemplateDrawer({ slots }: TemplateDrawerProps) {
  const [open, setOpen] = useState(false);
  const [saveName, setSaveName] = useState('');
  const { selectedDate } = useTimetableStore();
  const { data: templates = [], saveTemplate, applyTemplate, deleteTemplate } = useTemplates();

  function handleSave() {
    if (!saveName.trim()) return;
    saveTemplate.mutate({ name: saveName.trim(), slots });
    setSaveName('');
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 transition-colors"
      >
        <BookTemplate className="w-4 h-4" />
        템플릿
      </button>

      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" />
          <Dialog.Content
            className="fixed z-50 bottom-0 inset-x-0 md:left-auto md:right-4 md:bottom-4 md:w-80 bg-white dark:bg-gray-900 rounded-t-2xl md:rounded-2xl shadow-2xl p-5 max-h-[80vh] overflow-y-auto focus:outline-none"
            aria-describedby={undefined}
          >
            <div className="flex items-center justify-between mb-4">
              <Dialog.Title className="text-base font-semibold text-gray-900 dark:text-gray-100">
                템플릿
              </Dialog.Title>
              <Dialog.Close asChild>
                <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                  <X className="w-5 h-5" />
                </button>
              </Dialog.Close>
            </div>

            {/* 현재 플랜 저장 */}
            <div className="mb-4">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1.5">현재 플랜을 템플릿으로 저장</div>
              <div className="flex gap-2">
                <input
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && handleSave()}
                  placeholder="템플릿 이름"
                  className="flex-1 text-sm px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={handleSave}
                  disabled={!saveName.trim() || saveTemplate.isPending}
                  className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  저장
                </button>
              </div>
            </div>

            {/* 템플릿 목록 */}
            <div className="space-y-2">
              {templates.length === 0 ? (
                <div className="text-sm text-gray-400 text-center py-4">저장된 템플릿이 없습니다.</div>
              ) : (
                templates.map((tpl) => (
                  <div
                    key={tpl.id}
                    className="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{tpl.name}</div>
                      <div className="text-xs text-gray-400">{(tpl.slots_json as []).length}개 슬롯</div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          applyTemplate.mutate({ templateId: tpl.id, date: selectedDate });
                          setOpen(false);
                        }}
                        className="text-xs px-2 py-1 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 hover:opacity-80"
                      >
                        적용
                      </button>
                      <button
                        onClick={() => deleteTemplate.mutate(tpl.id)}
                        className="p-1 text-gray-400 hover:text-red-500"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
