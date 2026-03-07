'use client';

import Image from 'next/image';
import { useI18n, type Locale } from '@/lib/i18n';

// 각 섹션의 데이터 구조
interface ManualSection {
  id: string;
  title: string;
  desc: string;
  image?: { src: string; alt: string };
  images?: { src: string; alt: string }[];  // 섹션 6처럼 이미지가 2장인 경우
  steps: string[];
  tip?: string;
}

// 전체 페이지 콘텐츠 (언어별)
interface ManualContent {
  pageTitle: string;
  pageDesc: string;
  sections: ManualSection[];
}

// 언어별 콘텐츠 정의
const MANUAL_CONTENT: Record<Locale, ManualContent> = {
  ko: {
    pageTitle: '사용자 매뉴얼',
    pageDesc: 'TimeFlow를 처음 사용하시는 분들을 위한 단계별 가이드입니다.',
    sections: [
      {
        id: 'intro',
        title: '서비스 소개',
        desc: 'TimeFlow는 하루 일정을 PLAN(계획)과 ACTUAL(실제)로 나눠 관리하는 타임블로킹 앱입니다.',
        image: { src: '/manual-images/02_main.png', alt: '메인 화면' },
        steps: [
          '왼쪽 열(PLAN)에 오늘 할 일을 미리 계획합니다.',
          '오른쪽 열(ACTUAL)에 실제로 한 일을 기록합니다.',
          '뽀모도로 타이머와 To Do List로 집중력을 높입니다.',
          '주간 리포트에서 달성률과 집중 시간을 확인합니다.',
        ],
        tip: '하루를 마칠 때 PLAN vs ACTUAL을 비교해 보면 시간 사용 패턴을 파악할 수 있어요.',
      },
      {
        id: 'login',
        title: '시작하기 (로그인)',
        desc: 'Google 계정으로 간편하게 로그인하여 TimeFlow를 시작하세요.',
        image: { src: '/manual-images/01_login.png', alt: '로그인 화면' },
        steps: [
          '앱에 접속하면 로그인 화면이 표시됩니다.',
          '"Google로 계속하기" 버튼을 클릭합니다.',
          'Google 계정을 선택하면 자동으로 로그인됩니다.',
          '로그인 후 오늘 날짜의 타임테이블이 바로 표시됩니다.',
        ],
        tip: '로그인하면 모든 기기에서 같은 데이터를 사용할 수 있어요.',
      },
      {
        id: 'plan',
        title: 'PLAN 사용법 (일정 추가/수정/삭제)',
        desc: '하루를 시작하기 전, PLAN 열에 오늘 할 일을 시간 단위로 계획해 보세요.',
        image: { src: '/manual-images/02_main.png', alt: 'PLAN 타임테이블' },
        steps: [
          'PLAN 열의 원하는 시간대를 클릭하면 일정 추가 모달이 열립니다.',
          '할 일 제목을 입력하고 지속 시간을 설정합니다.',
          '"일정 추가" 버튼을 클릭하면 타임테이블에 슬롯이 생성됩니다.',
          '슬롯을 클릭하면 제목 수정, 상태 변경, 삭제가 가능합니다.',
          '슬롯 하단 끝을 드래그하면 시간을 늘리거나 줄일 수 있습니다.',
          '슬롯을 드래그하여 다른 시간대로 이동할 수 있습니다.',
        ],
        tip: 'PLAN은 하루의 의도를 설정하는 곳입니다. 완벽하지 않아도 괜찮아요!',
      },
      {
        id: 'actual',
        title: 'ACTUAL 사용법 (실제 기록)',
        desc: '실제로 한 일을 ACTUAL 열에 기록해 달성률과 패턴을 파악하세요.',
        image: { src: '/manual-images/02_main.png', alt: 'ACTUAL 타임테이블' },
        steps: [
          'ACTUAL 열의 원하는 시간대를 클릭하면 기록 추가 모달이 열립니다.',
          '활동명을 입력하고 지속 시간을 설정합니다.',
          '"기록 추가" 버튼으로 실제 기록을 저장합니다.',
          'PLAN 슬롯을 클릭하면 상태를 완료/부분완료/건너뜀으로 변경할 수 있습니다.',
          '슬롯 편집 모달에서 실제 시작·종료 시간을 수정할 수 있습니다.',
        ],
        tip: 'PLAN 없이도 ACTUAL을 자유롭게 기록할 수 있어요.',
      },
      {
        id: 'pomodoro',
        title: '뽀모도로 타이머 사용법',
        desc: '25분 집중 + 5분 휴식 사이클로 생산성을 높여보세요.',
        image: { src: '/manual-images/04_Pomodoro1.png', alt: '뽀모도로 타이머' },
        steps: [
          '화면 하단 또는 우측 패널의 뽀모도로 탭을 선택합니다.',
          '"시작" 버튼을 눌러 25분 집중 타이머를 시작합니다.',
          '타이머가 끝나면 알림이 울리고 자동으로 휴식 모드로 전환됩니다.',
          '4번의 집중 사이클 후에는 15분의 긴 휴식이 주어집니다.',
          '"정지" 버튼으로 일시 정지하고 "재개"로 이어서 진행할 수 있습니다.',
        ],
        tip: '뽀모도로 중 집중 시간은 자동으로 ACTUAL에 기록될 수 있어요.',
      },
      {
        id: 'todo',
        title: 'To Do List 사용법',
        desc: '오늘 처리해야 할 할 일 목록을 관리하세요.',
        images: [
          { src: '/manual-images/05_todo_list.png', alt: 'To Do 목록' },
          { src: '/manual-images/03_todo_add.png', alt: 'To Do 추가' },
        ],
        steps: [
          '화면 하단의 "오늘 할 일" 패널을 클릭하여 펼칩니다.',
          '"할 일 추가..." 입력창에 내용을 입력하고 Enter를 누릅니다.',
          '항목 옆 체크박스를 클릭하면 완료 처리됩니다.',
          '항목을 길게 누르거나 우클릭하면 고정/삭제 옵션이 표시됩니다.',
          '"고정" 옵션을 선택하면 다음 날에도 해당 항목이 유지됩니다.',
          '"초기화" 버튼으로 오늘 할 일 목록을 전체 초기화할 수 있습니다.',
        ],
        tip: '고정된 할 일은 내일 자동으로 이월됩니다. 반복 작업에 유용해요!',
      },
      {
        id: 'weekly',
        title: '주간 리포트 보는 법',
        desc: '지난 7일간의 집중 시간과 달성률을 한눈에 확인하세요.',
        image: { src: '/manual-images/06_weekly_report.png', alt: '주간 리포트' },
        steps: [
          '사이드바 또는 하단 메뉴에서 "주간 리포트"를 클릭합니다.',
          '이번 주 총 집중 시간과 베스트 데이를 확인합니다.',
          '요일별 완료율 패턴 그래프로 생산성 트렌드를 파악합니다.',
          '기간 설정을 변경하여 7일·4주·직접 설정 범위로 조회할 수 있습니다.',
          '"PDF 내보내기" 버튼으로 리포트를 저장할 수 있습니다.',
        ],
        tip: '매주 리포트를 검토하면 시간 관리 습관을 개선하는 데 도움이 됩니다.',
      },
      {
        id: 'settings',
        title: '설정 방법',
        desc: '앱 언어, 테마, 시간 범위, 슬롯 크기 등 환경을 내 입맛에 맞게 설정하세요.',
        image: { src: '/manual-images/07_Setting.png', alt: '설정 화면' },
        steps: [
          '사이드바 또는 하단 메뉴에서 "설정"을 클릭합니다.',
          '언어 설정에서 한국어 / English / 日本語를 선택합니다.',
          '다크 모드 토글로 화면 테마를 전환합니다.',
          '슬롯 크기(좁게/보통/넓게)로 타임테이블 밀도를 조정합니다.',
          '시간 범위(시작·종료 시간)를 설정하여 표시 구간을 조정합니다.',
          '알림 설정에서 슬롯 시작 5분 전 알림을 켜거나 끌 수 있습니다.',
        ],
        tip: '설정은 기기에 저장되므로 앱을 다시 열어도 유지됩니다.',
      },
    ],
  },

  en: {
    pageTitle: 'User Manual',
    pageDesc: 'A step-by-step guide for getting started with TimeFlow.',
    sections: [
      {
        id: 'intro',
        title: 'About TimeFlow',
        desc: 'TimeFlow is a time-blocking app that helps you manage your day by separating PLAN (what you intend to do) from ACTUAL (what you actually did).',
        image: { src: '/manual-images/02_main.png', alt: 'Main screen' },
        steps: [
          'Use the left column (PLAN) to schedule what you intend to do today.',
          'Use the right column (ACTUAL) to record what you actually did.',
          'Use the Pomodoro timer and To Do List to stay focused.',
          'Check the Weekly Report to review your completion rate and focus time.',
        ],
        tip: 'Comparing PLAN vs ACTUAL at the end of the day helps you understand your time-use patterns.',
      },
      {
        id: 'login',
        title: 'Getting Started (Login)',
        desc: 'Sign in with your Google account to get started with TimeFlow.',
        image: { src: '/manual-images/01_login.png', alt: 'Login screen' },
        steps: [
          'Open the app and you\'ll see the login screen.',
          'Click the "Continue with Google" button.',
          'Select your Google account to sign in automatically.',
          'After login, today\'s timetable is displayed immediately.',
        ],
        tip: 'Once logged in, your data syncs across all your devices.',
      },
      {
        id: 'plan',
        title: 'Using PLAN (Add / Edit / Delete)',
        desc: 'Before your day begins, plan your schedule in the PLAN column by time block.',
        image: { src: '/manual-images/02_main.png', alt: 'PLAN timetable' },
        steps: [
          'Click on any time slot in the PLAN column to open the Add Schedule modal.',
          'Enter the task name and set the duration.',
          'Click "Add Schedule" to create the slot on the timetable.',
          'Click a slot to edit its title, change its status, or delete it.',
          'Drag the bottom edge of a slot to resize its duration.',
          'Drag a slot to move it to a different time.',
        ],
        tip: 'PLAN is for setting your intentions — it doesn\'t have to be perfect!',
      },
      {
        id: 'actual',
        title: 'Using ACTUAL (Record What You Did)',
        desc: 'Log what you actually did in the ACTUAL column to track completion rates and patterns.',
        image: { src: '/manual-images/02_main.png', alt: 'ACTUAL timetable' },
        steps: [
          'Click on any time slot in the ACTUAL column to open the Add Record modal.',
          'Enter the activity name and set the duration.',
          'Click "Add Record" to save the entry.',
          'Click a PLAN slot to mark it as Done, Partial, or Skipped.',
          'In the slot edit modal, you can adjust the actual start and end times.',
        ],
        tip: 'You can log ACTUAL records even without a PLAN — just record freely.',
      },
      {
        id: 'pomodoro',
        title: 'Pomodoro Timer',
        desc: 'Boost your productivity with 25-minute focus sessions and 5-minute breaks.',
        image: { src: '/manual-images/04_Pomodoro1.png', alt: 'Pomodoro timer' },
        steps: [
          'Select the Pomodoro tab in the bottom or side panel.',
          'Press "Start" to begin a 25-minute focus session.',
          'When the timer ends, you\'ll be notified and it switches to break mode automatically.',
          'After 4 focus sessions, a 15-minute long break is given.',
          'Use "Pause" and "Resume" to control the timer.',
        ],
        tip: 'Focus time from Pomodoro sessions can be automatically logged in ACTUAL.',
      },
      {
        id: 'todo',
        title: 'To Do List',
        desc: 'Manage your task list for the day.',
        images: [
          { src: '/manual-images/05_todo_list.png', alt: 'To Do list' },
          { src: '/manual-images/03_todo_add.png', alt: 'Add To Do' },
        ],
        steps: [
          'Click the "Today\'s Tasks" panel at the bottom to expand it.',
          'Type in the "Add task..." input and press Enter.',
          'Click the checkbox next to an item to mark it as complete.',
          'Long-press or right-click an item to see Pin / Delete options.',
          'Choose "Pin" to keep the item on your list the next day.',
          'Use the "Reset" button to clear all of today\'s tasks.',
        ],
        tip: 'Pinned tasks carry over to tomorrow automatically — great for recurring items!',
      },
      {
        id: 'weekly',
        title: 'Weekly Report',
        desc: 'Review your focus time and completion rate for the past 7 days at a glance.',
        image: { src: '/manual-images/06_weekly_report.png', alt: 'Weekly report' },
        steps: [
          'Click "Weekly Report" in the sidebar or bottom menu.',
          'View your total focus time and Best Day for this week.',
          'Read the daily completion pattern chart to spot productivity trends.',
          'Change the period (7 days, 4 weeks, or custom) to adjust the date range.',
          'Click "Export PDF" to save the report.',
        ],
        tip: 'Reviewing the weekly report regularly helps you build better time-management habits.',
      },
      {
        id: 'settings',
        title: 'Settings',
        desc: 'Customize the app language, theme, time range, and slot size to your preference.',
        image: { src: '/manual-images/07_Setting.png', alt: 'Settings screen' },
        steps: [
          'Click "Settings" in the sidebar or bottom menu.',
          'Choose your language: 한국어 / English / 日本語.',
          'Toggle dark mode to switch the app theme.',
          'Adjust slot size (Narrow / Normal / Wide) to control timetable density.',
          'Set the time range (start and end times) to customize the visible hours.',
          'Turn slot start notifications on or off under Notifications.',
        ],
        tip: 'Settings are saved locally, so they persist even after you close the app.',
      },
    ],
  },

  ja: {
    pageTitle: 'ユーザーマニュアル',
    pageDesc: 'TimeFlowをはじめて使う方のためのステップバイステップガイドです。',
    sections: [
      {
        id: 'intro',
        title: 'サービスの紹介',
        desc: 'TimeFlowはPLAN（計画）とACTUAL（実績）で1日を管理するタイムブロッキングアプリです。',
        image: { src: '/manual-images/02_main.png', alt: 'メイン画面' },
        steps: [
          '左列（PLAN）に今日やりたいことを計画します。',
          '右列（ACTUAL）に実際に行ったことを記録します。',
          'ポモドーロタイマーとToDoリストで集中力を高めます。',
          '週間レポートで達成率と集中時間を確認します。',
        ],
        tip: '1日の終わりにPLAN vs ACTUALを比較すると、時間の使い方のパターンが分かります。',
      },
      {
        id: 'login',
        title: 'はじめに（ログイン）',
        desc: 'Googleアカウントで簡単にログインしてTimeFlowを始めましょう。',
        image: { src: '/manual-images/01_login.png', alt: 'ログイン画面' },
        steps: [
          'アプリにアクセスするとログイン画面が表示されます。',
          '「Googleで続ける」ボタンをクリックします。',
          'Googleアカウントを選択すると自動的にログインされます。',
          'ログイン後、今日のタイムテーブルがすぐに表示されます。',
        ],
        tip: 'ログインするとすべてのデバイスで同じデータを利用できます。',
      },
      {
        id: 'plan',
        title: 'PLANの使い方（予定の追加・編集・削除）',
        desc: '1日を始める前に、PLAN列に今日のスケジュールを時間ブロック単位で計画しましょう。',
        image: { src: '/manual-images/02_main.png', alt: 'PLANタイムテーブル' },
        steps: [
          'PLAN列の任意の時間帯をクリックすると予定追加モーダルが開きます。',
          'タスク名を入力して所要時間を設定します。',
          '「予定を追加」ボタンをクリックするとタイムテーブルにスロットが作成されます。',
          'スロットをクリックするとタイトル編集・ステータス変更・削除が可能です。',
          'スロット下端をドラッグして時間を伸縮できます。',
          'スロットをドラッグして別の時間帯に移動できます。',
        ],
        tip: 'PLANは1日の意図を設定する場所です。完璧でなくても大丈夫！',
      },
      {
        id: 'actual',
        title: 'ACTUALの使い方（実績の記録）',
        desc: '実際に行ったことをACTUAL列に記録して達成率とパターンを把握しましょう。',
        image: { src: '/manual-images/02_main.png', alt: 'ACTUALタイムテーブル' },
        steps: [
          'ACTUAL列の任意の時間帯をクリックすると記録追加モーダルが開きます。',
          '活動名を入力して所要時間を設定します。',
          '「記録を追加」ボタンで実績を保存します。',
          'PLANスロットをクリックしてステータスを完了・部分完了・スキップに変更できます。',
          'スロット編集モーダルで実際の開始・終了時間を修正できます。',
        ],
        tip: 'PLANがなくてもACTUALは自由に記録できます。',
      },
      {
        id: 'pomodoro',
        title: 'ポモドーロタイマーの使い方',
        desc: '25分集中＋5分休憩のサイクルで生産性を上げましょう。',
        image: { src: '/manual-images/04_Pomodoro1.png', alt: 'ポモドーロタイマー' },
        steps: [
          '画面下部またはサイドパネルのポモドーロタブを選択します。',
          '「開始」ボタンを押して25分の集中タイマーを開始します。',
          'タイマーが終了すると通知が鳴り、自動的に休憩モードに切り替わります。',
          '4回の集中サイクル後に15分の長い休憩が与えられます。',
          '「一時停止」と「再開」でタイマーをコントロールできます。',
        ],
        tip: 'ポモドーロの集中時間はACTUALに自動記録されることがあります。',
      },
      {
        id: 'todo',
        title: 'ToDoリストの使い方',
        desc: '今日のタスクリストを管理しましょう。',
        images: [
          { src: '/manual-images/05_todo_list.png', alt: 'ToDoリスト' },
          { src: '/manual-images/03_todo_add.png', alt: 'ToDo追加' },
        ],
        steps: [
          '画面下部の「今日のタスク」パネルをクリックして展開します。',
          '「タスクを追加...」入力欄に内容を入力してEnterを押します。',
          '項目のチェックボックスをクリックすると完了になります。',
          '項目を長押しまたは右クリックするとピン留め・削除オプションが表示されます。',
          '「固定」を選択すると翌日も項目が引き継がれます。',
          '「リセット」ボタンで今日のタスクをすべてクリアできます。',
        ],
        tip: '固定されたタスクは翌日に自動的に引き継がれます。繰り返しタスクに便利です！',
      },
      {
        id: 'weekly',
        title: '週間レポートの見方',
        desc: '過去7日間の集中時間と達成率を一目で確認しましょう。',
        image: { src: '/manual-images/06_weekly_report.png', alt: '週間レポート' },
        steps: [
          'サイドバーまたは下部メニューの「週間レポート」をクリックします。',
          '今週の総集中時間とベストデイを確認します。',
          '曜日別完了率パターングラフで生産性のトレンドを把握します。',
          '期間設定（7日・4週・カスタム）を変更して表示範囲を調整できます。',
          '「PDFエクスポート」ボタンでレポートを保存できます。',
        ],
        tip: '毎週レポートを見直すと時間管理の習慣改善に役立ちます。',
      },
      {
        id: 'settings',
        title: '設定方法',
        desc: '言語・テーマ・時間範囲・スロットサイズなどを好みに合わせてカスタマイズしましょう。',
        image: { src: '/manual-images/07_Setting.png', alt: '設定画面' },
        steps: [
          'サイドバーまたは下部メニューの「設定」をクリックします。',
          '言語設定で한국어 / English / 日本語を選択します。',
          'ダークモードトグルで画面テーマを切り替えます。',
          'スロットサイズ（狭く・普通・広く）でタイムテーブルの密度を調整します。',
          '時間範囲（開始・終了時間）を設定して表示区間を調整します。',
          '通知設定でスロット開始5分前通知をオン/オフできます。',
        ],
        tip: '設定はデバイスに保存されるため、アプリを再起動しても維持されます。',
      },
    ],
  },
};

// ─────────────────────────────────────────────
// 이미지 렌더링 컴포넌트
// ─────────────────────────────────────────────
function SectionImage({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800">
      <Image
        src={src}
        alt={alt}
        fill
        className="object-contain"
        sizes="(max-width: 768px) 100vw, 672px"
        quality={85}
      />
    </div>
  );
}

// ─────────────────────────────────────────────
// 섹션 카드 컴포넌트
// ─────────────────────────────────────────────
function SectionCard({ section, index }: { section: ManualSection; index: number }) {
  return (
    <div
      id={section.id}
      className="scroll-mt-20 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 space-y-4"
    >
      {/* 섹션 헤더: 번호 배지 + 제목 */}
      <div className="flex items-center gap-3">
        <span className="flex items-center justify-center w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-bold shrink-0">
          {index + 1}
        </span>
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
          {section.title}
        </h2>
      </div>

      {/* 섹션 설명 */}
      <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
        {section.desc}
      </p>

      {/* 이미지 1장 */}
      {section.image && (
        <SectionImage src={section.image.src} alt={section.image.alt} />
      )}

      {/* 이미지 2장 (섹션 6처럼 grid 배치) */}
      {section.images && section.images.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {section.images.map((img) => (
            <SectionImage key={img.src} src={img.src} alt={img.alt} />
          ))}
        </div>
      )}

      {/* 단계별 설명 */}
      <ol className="list-decimal list-outside pl-5 space-y-1.5 text-sm text-gray-700 dark:text-gray-300">
        {section.steps.map((step, i) => (
          <li key={i} className="leading-relaxed">{step}</li>
        ))}
      </ol>

      {/* 팁 박스 */}
      {section.tip && (
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-blue-800 dark:text-blue-300 text-sm leading-relaxed">
          💡 {section.tip}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// 메인 페이지
// ─────────────────────────────────────────────
export default function ManualPage() {
  const { locale } = useI18n();
  const content = MANUAL_CONTENT[locale];

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6">
      {/* 페이지 헤더 */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          📖 {content.pageTitle}
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {content.pageDesc}
        </p>
      </div>

      {/* 빠른 이동 링크 */}
      <div className="flex flex-wrap gap-2">
        {content.sections.map((section, index) => (
          <a
            key={section.id}
            href={`#${section.id}`}
            className="px-3 py-1.5 text-sm rounded-full border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            {index + 1}. {section.title}
          </a>
        ))}
      </div>

      {/* 섹션 카드 목록 */}
      {content.sections.map((section, index) => (
        <SectionCard key={section.id} section={section} index={index} />
      ))}

      {/* 푸터 */}
      <div className="text-center text-xs text-gray-400 dark:text-gray-600 py-4">
        © 2026 TimeFlow · All rights reserved
      </div>
    </div>
  );
}
