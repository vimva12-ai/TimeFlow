'use client';

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

export type Locale = 'ko' | 'en' | 'ja';

const translations = {
  ko: {
    // 공통
    save: '저장',
    cancel: '취소',
    delete: '삭제',
    close: '닫기',
    confirm: '확인',
    // 네비게이션
    today: '오늘',
    weekly: '주간',
    settings: '설정',
    weeklyReport: '주간 리포트',
    // 타임테이블
    plan: 'PLAN',
    actual: 'ACTUAL',
    add: '추가',
    start: '시작',
    pause: '정지',
    resume: '재개',
    done: '완료',
    partial: '부분',
    skipped: '건너뜀',
    onTime: '정시',
    delayed: (m: number) => `${m}분 지연`,
    early: (m: number) => `${Math.abs(m)}분 일찍`,
    // 설정
    screenSettings: '화면 설정',
    slotSize: '슬롯 크기',
    narrow: '좁게',
    normal: '보통',
    wide: '넓게',
    mostItems: '최대한 많이',
    defaultSize: '기본 크기',
    spacious: '여유 있는 보기',
    timeRange: '시간 범위',
    startTime: '시작 시간',
    endTime: '종료 시간',
    current: '현재',
    hoursShown: (h: number) => `${h}시간 표시`,
    midnight: '자정',
    notificationSettings: '알림 설정',
    // 슬롯 편집
    editSlot: '슬롯 편집',
    title: '제목',
    status: '상태',
    planned: '계획',
    doneLabel: '완료',
    partialLabel: '부분 완료',
    skippedLabel: '건너뜀',
    confirmDelete: '정말 삭제할까요?',
    yes: '예',
    no: '아니오',
    // 통계
    todayRate: '오늘 달성률',
    focusTime: '집중 시간',
    weeklyAvg: '주간 평균',
    sevenDays: '7일',
    punctuality: (p: number) => `준수 ${p}%`,
    // 이월
    carryOver: '미완료 항목 내일로 이월',
    carryOverDone: (n: number) => `${n}개 항목을 내일로 이월했습니다.`,
    // 시간 수정
    editActualTime: '실제 시간 수정',
    actualStart: '시작 시간',
    actualEnd: '종료 시간',
    editTime: '시간 수정',
    // 뱃지
    focusBadge: '집중왕',
    punctualBadge: '정시왕',
    completionBadge: '달성왕',
    badgeList: '뱃지 목록',
    timePunctualityLabel: '시간 준수',
    completionRateLabel: '완료율',
    // AddSlotModal
    addPlanTitle: 'PLAN 일정 추가',
    addActualTitle: 'ACTUAL 기록 추가',
    taskLabel: '할 일',
    activityLabel: '활동명',
    taskPlaceholder: '할 일을 입력하세요',
    activityPlaceholder: '무엇을 했나요?',
    durationLabel: '지속 시간',
    addSchedule: '일정 추가',
    addRecord: '기록 추가',
    // 주간 리포트
    loading: '로딩 중...',
    noWeeklyData: '이번 주 데이터가 없습니다.',
    registerForStats: '오늘 탭에서 일정을 등록하면 통계가 표시됩니다.',
    exportPDF: 'PDF 내보내기',
    thisWeekFocus: '이번 주 집중 시간',
    bestDay: '베스트 데이',
    sevenDayRate: '7일 달성률',
    dayPattern: '요일별 완료율 패턴',
    periodRate: '기간 달성률',
    recent: '최근',
    calculating: '계산 중...',
    avgRate: '평균 달성률',
    dailyAvgFocus: '일평균 집중',
    daysBasis: (d: number) => `${d}일 기준`,
    punctualityRateLabel: '준수율',
    customRange: '직접 설정',
    completed: '완료',
    dayOfWeekSuffix: '요일',
  },
  en: {
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    close: 'Close',
    confirm: 'Confirm',
    today: 'Today',
    weekly: 'Weekly',
    settings: 'Settings',
    weeklyReport: 'Weekly Report',
    plan: 'PLAN',
    actual: 'ACTUAL',
    add: 'Add',
    start: 'Start',
    pause: 'Pause',
    resume: 'Resume',
    done: 'Done',
    partial: 'Partial',
    skipped: 'Skipped',
    onTime: 'On time',
    delayed: (m: number) => `${m}m late`,
    early: (m: number) => `${Math.abs(m)}m early`,
    screenSettings: 'Display Settings',
    slotSize: 'Slot Size',
    narrow: 'Narrow',
    normal: 'Normal',
    wide: 'Wide',
    mostItems: 'Show more',
    defaultSize: 'Default',
    spacious: 'Spacious',
    timeRange: 'Time Range',
    startTime: 'Start',
    endTime: 'End',
    current: 'Current',
    hoursShown: (h: number) => `${h}h shown`,
    midnight: 'Midnight',
    notificationSettings: 'Notifications',
    editSlot: 'Edit Slot',
    title: 'Title',
    status: 'Status',
    planned: 'Planned',
    doneLabel: 'Done',
    partialLabel: 'Partial',
    skippedLabel: 'Skipped',
    confirmDelete: 'Really delete?',
    yes: 'Yes',
    no: 'No',
    todayRate: "Today's Rate",
    focusTime: 'Focus Time',
    weeklyAvg: 'Weekly Avg',
    sevenDays: '7 days',
    punctuality: (p: number) => `${p}% on-time`,
    carryOver: 'Carry over incomplete items to tomorrow',
    carryOverDone: (n: number) => `${n} items carried over.`,
    editActualTime: 'Edit Actual Time',
    actualStart: 'Start Time',
    actualEnd: 'End Time',
    editTime: 'Edit Time',
    focusBadge: 'Focus Master',
    punctualBadge: 'On-Time',
    completionBadge: 'Achiever',
    badgeList: 'Badge List',
    timePunctualityLabel: 'Punctuality',
    completionRateLabel: 'Completion',
    addPlanTitle: 'Add PLAN',
    addActualTitle: 'Add ACTUAL',
    taskLabel: 'Task',
    activityLabel: 'Activity',
    taskPlaceholder: 'Enter task name',
    activityPlaceholder: 'What did you do?',
    durationLabel: 'Duration',
    addSchedule: 'Add Schedule',
    addRecord: 'Add Record',
    loading: 'Loading...',
    noWeeklyData: 'No data this week.',
    registerForStats: 'Add schedules in Today tab to see stats.',
    exportPDF: 'Export PDF',
    thisWeekFocus: 'This Week Focus',
    bestDay: 'Best Day',
    sevenDayRate: '7-Day Rate',
    dayPattern: 'Daily Completion Pattern',
    periodRate: 'Period Rate',
    recent: 'Last',
    calculating: 'Calculating...',
    avgRate: 'Avg Rate',
    dailyAvgFocus: 'Daily Avg Focus',
    daysBasis: (d: number) => `over ${d} days`,
    punctualityRateLabel: 'On-time Rate',
    customRange: 'Custom',
    completed: 'Done',
    dayOfWeekSuffix: '',
  },
  ja: {
    save: '保存',
    cancel: 'キャンセル',
    delete: '削除',
    close: '閉じる',
    confirm: '確認',
    today: '今日',
    weekly: '週間',
    settings: '設定',
    weeklyReport: '週間レポート',
    plan: 'PLAN',
    actual: 'ACTUAL',
    add: '追加',
    start: '開始',
    pause: '一時停止',
    resume: '再開',
    done: '完了',
    partial: '部分',
    skipped: 'スキップ',
    onTime: '定時',
    delayed: (m: number) => `${m}分遅延`,
    early: (m: number) => `${Math.abs(m)}分早い`,
    screenSettings: '画面設定',
    slotSize: 'スロットサイズ',
    narrow: '狭く',
    normal: '普通',
    wide: '広く',
    mostItems: '最大表示',
    defaultSize: 'デフォルト',
    spacious: 'ゆとりある表示',
    timeRange: '時間範囲',
    startTime: '開始時間',
    endTime: '終了時間',
    current: '現在',
    hoursShown: (h: number) => `${h}時間表示`,
    midnight: '深夜0時',
    notificationSettings: '通知設定',
    editSlot: 'スロット編集',
    title: 'タイトル',
    status: 'ステータス',
    planned: '予定',
    doneLabel: '完了',
    partialLabel: '部分完了',
    skippedLabel: 'スキップ',
    confirmDelete: '本当に削除しますか？',
    yes: 'はい',
    no: 'いいえ',
    todayRate: '今日の達成率',
    focusTime: '集中時間',
    weeklyAvg: '週間平均',
    sevenDays: '7日',
    punctuality: (p: number) => `定時率 ${p}%`,
    carryOver: '未完了を明日に繰り越し',
    carryOverDone: (n: number) => `${n}件を明日に繰り越しました。`,
    editActualTime: '実績時間を編集',
    actualStart: '開始時間',
    actualEnd: '終了時間',
    editTime: '時間編集',
    focusBadge: '集中王',
    punctualBadge: '定時王',
    completionBadge: '達成王',
    badgeList: 'バッジ一覧',
    timePunctualityLabel: '時間遵守',
    completionRateLabel: '完了率',
    addPlanTitle: 'PLAN 予定を追加',
    addActualTitle: 'ACTUAL 記録を追加',
    taskLabel: 'タスク',
    activityLabel: '活動名',
    taskPlaceholder: 'タスク名を入力',
    activityPlaceholder: '何をしましたか？',
    durationLabel: '所要時間',
    addSchedule: '予定を追加',
    addRecord: '記録を追加',
    loading: '読み込み中...',
    noWeeklyData: '今週のデータがありません。',
    registerForStats: '今日タブで予定を登録すると統計が表示されます。',
    exportPDF: 'PDF エクスポート',
    thisWeekFocus: '今週の集中時間',
    bestDay: 'ベスト デイ',
    sevenDayRate: '7日間達成率',
    dayPattern: '曜日別完了率パターン',
    periodRate: '期間達成率',
    recent: '直近',
    calculating: '計算中...',
    avgRate: '平均達成率',
    dailyAvgFocus: '日平均集中',
    daysBasis: (d: number) => `${d}日間基準`,
    punctualityRateLabel: '時間遵守率',
    customRange: 'カスタム',
    completed: '完了',
    dayOfWeekSuffix: '曜日',
  },
} as const;

// 번역 타입을 함수 signature까지 포함한 구조적 타입으로 정의
export interface Translations {
  save: string;
  cancel: string;
  delete: string;
  close: string;
  confirm: string;
  today: string;
  weekly: string;
  settings: string;
  weeklyReport: string;
  plan: string;
  actual: string;
  add: string;
  start: string;
  pause: string;
  resume: string;
  done: string;
  partial: string;
  skipped: string;
  onTime: string;
  delayed: (m: number) => string;
  early: (m: number) => string;
  screenSettings: string;
  slotSize: string;
  narrow: string;
  normal: string;
  wide: string;
  mostItems: string;
  defaultSize: string;
  spacious: string;
  timeRange: string;
  startTime: string;
  endTime: string;
  current: string;
  hoursShown: (h: number) => string;
  midnight: string;
  notificationSettings: string;
  editSlot: string;
  title: string;
  status: string;
  planned: string;
  doneLabel: string;
  partialLabel: string;
  skippedLabel: string;
  confirmDelete: string;
  yes: string;
  no: string;
  todayRate: string;
  focusTime: string;
  weeklyAvg: string;
  sevenDays: string;
  punctuality: (p: number) => string;
  carryOver: string;
  carryOverDone: (n: number) => string;
  editActualTime: string;
  actualStart: string;
  actualEnd: string;
  editTime: string;
  focusBadge: string;
  punctualBadge: string;
  completionBadge: string;
  badgeList: string;
  timePunctualityLabel: string;
  completionRateLabel: string;
  addPlanTitle: string;
  addActualTitle: string;
  taskLabel: string;
  activityLabel: string;
  taskPlaceholder: string;
  activityPlaceholder: string;
  durationLabel: string;
  addSchedule: string;
  addRecord: string;
  loading: string;
  noWeeklyData: string;
  registerForStats: string;
  exportPDF: string;
  thisWeekFocus: string;
  bestDay: string;
  sevenDayRate: string;
  dayPattern: string;
  periodRate: string;
  recent: string;
  calculating: string;
  avgRate: string;
  dailyAvgFocus: string;
  daysBasis: (d: number) => string;
  punctualityRateLabel: string;
  customRange: string;
  completed: string;
  dayOfWeekSuffix: string;
}

interface I18nContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: Translations;
}

const I18nContext = createContext<I18nContextValue>({
  locale: 'ko',
  setLocale: () => {},
  t: translations.ko as Translations,
});

const STORAGE_KEY = 'timeflow-locale';

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('ko');

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as Locale | null;
    if (saved && translations[saved]) setLocaleState(saved);
  }, []);

  function setLocale(l: Locale) {
    setLocaleState(l);
    localStorage.setItem(STORAGE_KEY, l);
  }

  return (
    <I18nContext.Provider value={{ locale, setLocale, t: translations[locale] as Translations }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
