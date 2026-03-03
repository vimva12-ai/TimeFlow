'use client';

import { useEffect, useRef, useReducer, useState } from 'react';
import { createPortal } from 'react-dom';
import { Play, Pause, RotateCcw, SkipForward, Maximize2, X } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

type Phase = 'focus' | 'break' | 'longBreak';

const DURATIONS: Record<Phase, number> = {
  focus: 25 * 60,
  break: 5 * 60,
  longBreak: 15 * 60,
};

const PHASE_COLORS: Record<Phase, string> = {
  focus: '#3b82f6',
  break: '#22c55e',
  longBreak: '#a855f7',
};

interface State {
  phase: Phase;
  remaining: number;
  running: boolean;
  session: number;
}

type Action =
  | { type: 'TICK' }
  | { type: 'TOGGLE' }
  | { type: 'RESET' }
  | { type: 'SKIP' }
  | { type: 'ADVANCE_PHASE' };

function nextPhaseFor(phase: Phase, session: number): { phase: Phase; session: number } {
  if (phase === 'focus') {
    const next = session + 1;
    return { phase: next % 4 === 0 ? 'longBreak' : 'break', session: next };
  }
  return { phase: 'focus', session };
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'TICK':
      if (!state.running || state.remaining <= 0) return state;
      return { ...state, remaining: state.remaining - 1 };
    case 'TOGGLE':
      return { ...state, running: !state.running };
    case 'RESET':
      return { ...state, remaining: DURATIONS[state.phase], running: false };
    case 'SKIP':
    case 'ADVANCE_PHASE': {
      const { phase, session } = nextPhaseFor(state.phase, state.session);
      return { phase, remaining: DURATIONS[phase], running: false, session };
    }
    default:
      return state;
  }
}

function playBeep(frequency = 880) {
  try {
    const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = frequency;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.8);
  } catch {
    // 오디오 미지원 환경 무시
  }
}

// 컴팩트 사이드바용
const R = 30;
const C = 2 * Math.PI * R;
const SZ = 76;
const CXY = 38;

// 전체화면용
const R_FS = 120;
const C_FS = 2 * Math.PI * R_FS;
const SZ_FS = 280;
const CXY_FS = 140;

export default function SidebarPomodoro() {
  const { t } = useI18n();
  const [fullscreen, setFullscreen] = useState(false);
  const [state, dispatch] = useReducer(reducer, {
    phase: 'focus',
    remaining: DURATIONS.focus,
    running: false,
    session: 0,
  });
  const prevRemaining = useRef(state.remaining);

  useEffect(() => {
    if (!state.running) return;
    const id = setInterval(() => dispatch({ type: 'TICK' }), 1000);
    return () => clearInterval(id);
  }, [state.running]);

  useEffect(() => {
    if (state.remaining === 0 && prevRemaining.current > 0) {
      playBeep(state.phase === 'focus' ? 880 : 660);
      dispatch({ type: 'ADVANCE_PHASE' });
    }
    prevRemaining.current = state.remaining;
  }, [state.remaining, state.phase]);

  // ESC 키로 전체화면 닫기
  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setFullscreen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fullscreen]);

  const total = DURATIONS[state.phase];
  const progress = state.remaining / total;
  const mm = String(Math.floor(state.remaining / 60)).padStart(2, '0');
  const ss = String(state.remaining % 60).padStart(2, '0');
  const color = PHASE_COLORS[state.phase];
  const phaseLabels: Record<Phase, string> = {
    focus: t.pomodoroFocus,
    break: t.pomodoroBreak,
    longBreak: t.pomodoroLongBreak,
  };
  const phaseLabel = phaseLabels[state.phase];
  const rawFilled = state.session % 4;
  const dotsFilled = rawFilled === 0 && state.session > 0 ? 4 : rawFilled;

  const controlButtons = (large: boolean) => (
    <div className={`flex items-center ${large ? 'gap-4' : 'gap-1.5'}`}>
      <button
        onClick={() => dispatch({ type: 'TOGGLE' })}
        className={`flex items-center justify-center rounded-full text-white transition-opacity hover:opacity-90 active:opacity-75 ${large ? 'w-16 h-16' : 'w-8 h-8'}`}
        style={{ backgroundColor: color }}
        aria-label={state.running ? '일시정지' : '시작'}
      >
        {state.running
          ? <Pause className={large ? 'w-7 h-7' : 'w-3.5 h-3.5'} />
          : <Play className={`${large ? 'w-7 h-7' : 'w-3.5 h-3.5'} translate-x-px`} />}
      </button>
      <button
        onClick={() => dispatch({ type: 'RESET' })}
        className={`flex items-center justify-center rounded-full transition-colors bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 ${large ? 'w-12 h-12' : 'w-7 h-7'}`}
        aria-label="초기화"
      >
        <RotateCcw className={large ? 'w-5 h-5' : 'w-3 h-3'} />
      </button>
      <button
        onClick={() => dispatch({ type: 'SKIP' })}
        className={`flex items-center justify-center rounded-full transition-colors bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 ${large ? 'w-12 h-12' : 'w-7 h-7'}`}
        aria-label="다음 페이즈"
      >
        <SkipForward className={large ? 'w-5 h-5' : 'w-3 h-3'} />
      </button>
    </div>
  );

  const sessionDots = (large: boolean) => (
    <div className={`flex items-center ${large ? 'gap-3' : 'gap-1.5'}`}>
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className={`rounded-full transition-colors duration-300 ${large ? 'w-3 h-3' : 'w-1.5 h-1.5'}`}
          style={{ backgroundColor: i < dotsFilled ? color : '#e5e7eb' }}
        />
      ))}
    </div>
  );

  return (
    <>
      {/* ── 컴팩트 사이드바 뷰 ── */}
      <div className="flex flex-col items-center gap-2 py-1.5">
        <div className="flex items-center justify-between w-full px-1">
          <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            {t.pomodoro}
          </span>
          <div className="flex items-center gap-1">
            <span
              className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
              style={{ backgroundColor: `${color}20`, color }}
            >
              {phaseLabel}
            </span>
            <button
              onClick={() => setFullscreen(true)}
              className="p-0.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 dark:text-gray-500 transition-colors"
              aria-label="전체화면"
            >
              <Maximize2 className="w-3 h-3" />
            </button>
          </div>
        </div>

        <div className="relative">
          <svg width={SZ} height={SZ} viewBox={`0 0 ${SZ} ${SZ}`}>
            <circle cx={CXY} cy={CXY} r={R} fill="none" stroke="currentColor" strokeWidth="5" className="text-gray-100 dark:text-gray-800" />
            <circle
              cx={CXY} cy={CXY} r={R} fill="none" stroke={color}
              strokeWidth="5" strokeLinecap="round"
              strokeDasharray={C} strokeDashoffset={C * (1 - progress)}
              transform={`rotate(-90 ${CXY} ${CXY})`}
              style={{ transition: 'stroke-dashoffset 0.5s ease' }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[15px] font-bold tabular-nums text-gray-800 dark:text-gray-100 leading-none">
              {mm}:{ss}
            </span>
          </div>
        </div>

        {controlButtons(false)}
        {sessionDots(false)}
      </div>

      {/* ── 전체화면 오버레이 ── */}
      {fullscreen && typeof window !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setFullscreen(false)}
        >
          <div
            className="relative bg-white dark:bg-gray-900 rounded-3xl p-10 shadow-2xl flex flex-col items-center gap-6 min-w-[320px]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 닫기 버튼 */}
            <button
              onClick={() => setFullscreen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              aria-label="닫기"
            >
              <X className="w-4 h-4" />
            </button>

            {/* 페이즈 배지 */}
            <span
              className="text-sm px-3 py-1 rounded-full font-semibold"
              style={{ backgroundColor: `${color}20`, color }}
            >
              {phaseLabel}
            </span>

            {/* 큰 원형 타이머 */}
            <div className="relative">
              <svg width={SZ_FS} height={SZ_FS} viewBox={`0 0 ${SZ_FS} ${SZ_FS}`}>
                <circle cx={CXY_FS} cy={CXY_FS} r={R_FS} fill="none" stroke="currentColor" strokeWidth="10" className="text-gray-100 dark:text-gray-800" />
                <circle
                  cx={CXY_FS} cy={CXY_FS} r={R_FS} fill="none" stroke={color}
                  strokeWidth="10" strokeLinecap="round"
                  strokeDasharray={C_FS} strokeDashoffset={C_FS * (1 - progress)}
                  transform={`rotate(-90 ${CXY_FS} ${CXY_FS})`}
                  style={{ transition: 'stroke-dashoffset 0.5s ease' }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
                <span className="text-5xl font-bold tabular-nums text-gray-800 dark:text-gray-100 leading-none">
                  {mm}:{ss}
                </span>
                <span className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                  {t.pomodoro}
                </span>
              </div>
            </div>

            {controlButtons(true)}
            {sessionDots(true)}

            <span className="text-xs text-gray-400 dark:text-gray-500">ESC · 배경 클릭으로 닫기</span>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
