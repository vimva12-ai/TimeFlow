'use client';

import { useEffect, useRef, useReducer } from 'react';
import { Play, Pause, RotateCcw, SkipForward } from 'lucide-react';
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
  session: number; // 완료된 집중 세션 수
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

const RADIUS = 30;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const CX = 38;
const CY = 38;
const SIZE = 76;

export default function SidebarPomodoro() {
  const { t } = useI18n();
  const [state, dispatch] = useReducer(reducer, {
    phase: 'focus',
    remaining: DURATIONS.focus,
    running: false,
    session: 0,
  });
  const prevRemaining = useRef(state.remaining);

  // 1초 tick
  useEffect(() => {
    if (!state.running) return;
    const id = setInterval(() => dispatch({ type: 'TICK' }), 1000);
    return () => clearInterval(id);
  }, [state.running]);

  // 페이즈 완료 감지
  useEffect(() => {
    if (state.remaining === 0 && prevRemaining.current > 0) {
      playBeep(state.phase === 'focus' ? 880 : 660);
      dispatch({ type: 'ADVANCE_PHASE' });
    }
    prevRemaining.current = state.remaining;
  }, [state.remaining, state.phase]);

  const total = DURATIONS[state.phase];
  const progress = state.remaining / total;
  const dashOffset = CIRCUMFERENCE * (1 - progress);
  const mm = String(Math.floor(state.remaining / 60)).padStart(2, '0');
  const ss = String(state.remaining % 60).padStart(2, '0');
  const color = PHASE_COLORS[state.phase];
  const phaseLabels: Record<Phase, string> = {
    focus: t.pomodoroFocus,
    break: t.pomodoroBreak,
    longBreak: t.pomodoroLongBreak,
  };
  const phaseLabel = phaseLabels[state.phase];
  // 4세션 완료(긴 휴식 중)일 때 4개 모두 채워서 표시
  const rawFilled = state.session % 4;
  const dotsFilled = rawFilled === 0 && state.session > 0 ? 4 : rawFilled;

  return (
    <div className="flex flex-col items-center gap-2 py-1.5">
      {/* 헤더 */}
      <div className="flex items-center justify-between w-full px-1">
        <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          {t.pomodoro}
        </span>
        <span
          className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
          style={{ backgroundColor: `${color}20`, color }}
        >
          {phaseLabel}
        </span>
      </div>

      {/* 원형 타이머 */}
      <div className="relative">
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
          {/* 배경 원 */}
          <circle
            cx={CX} cy={CY} r={RADIUS}
            fill="none"
            stroke="currentColor"
            strokeWidth="5"
            className="text-gray-100 dark:text-gray-800"
          />
          {/* 진행 원 */}
          <circle
            cx={CX} cy={CY} r={RADIUS}
            fill="none"
            stroke={color}
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={dashOffset}
            transform={`rotate(-90 ${CX} ${CY})`}
            style={{ transition: 'stroke-dashoffset 0.5s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[15px] font-bold tabular-nums text-gray-800 dark:text-gray-100 leading-none">
            {mm}:{ss}
          </span>
        </div>
      </div>

      {/* 버튼 */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => dispatch({ type: 'TOGGLE' })}
          className="flex items-center justify-center w-8 h-8 rounded-full text-white transition-opacity hover:opacity-90 active:opacity-75"
          style={{ backgroundColor: color }}
          aria-label={state.running ? '일시정지' : '시작'}
        >
          {state.running ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 translate-x-px" />}
        </button>
        <button
          onClick={() => dispatch({ type: 'RESET' })}
          className="flex items-center justify-center w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          aria-label="초기화"
        >
          <RotateCcw className="w-3 h-3" />
        </button>
        <button
          onClick={() => dispatch({ type: 'SKIP' })}
          className="flex items-center justify-center w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          aria-label="다음 페이즈"
        >
          <SkipForward className="w-3 h-3" />
        </button>
      </div>

      {/* 세션 점 (4개 중 몇 번째 집중 완료) */}
      <div className="flex gap-1.5 items-center">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="w-1.5 h-1.5 rounded-full transition-colors duration-300"
            style={{ backgroundColor: i < dotsFilled ? color : '#e5e7eb' }}
          />
        ))}
      </div>
    </div>
  );
}
