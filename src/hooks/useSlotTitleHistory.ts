'use client';

import { useCallback } from 'react';

const STORAGE_KEY = 'timeflow-slot-titles';
const MAX_HISTORY = 30;

/** localStorage에서 슬롯 제목 히스토리를 읽는다 */
function readHistory(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

/** 슬롯 제목 히스토리를 localStorage에 저장한다 */
function writeHistory(titles: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(titles));
  } catch {
    // 저장 실패 시 무시
  }
}

export function useSlotTitleHistory() {
  /** 새 제목을 히스토리 맨 앞에 추가 (중복 제거, 최대 MAX_HISTORY개) */
  const addTitle = useCallback((title: string) => {
    const trimmed = title.trim();
    if (!trimmed) return;
    const prev = readHistory().filter((t) => t !== trimmed);
    writeHistory([trimmed, ...prev].slice(0, MAX_HISTORY));
  }, []);

  /**
   * 입력값으로 히스토리를 필터링해 반환
   * - query가 비어있으면 전체 목록 반환
   * - query가 있으면 포함 여부로 필터링
   */
  const getSuggestions = useCallback((query: string): string[] => {
    const history = readHistory();
    if (!query.trim()) return history;
    const lower = query.toLowerCase();
    return history.filter((t) => t.toLowerCase().includes(lower));
  }, []);

  return { addTitle, getSuggestions };
}
