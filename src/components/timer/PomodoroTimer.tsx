'use client';

import { useEffect, useRef, useReducer } from 'react';
import { Play, Pause, RotateCcw, X } from 'lucide-react';

type Phase = 'idle' | 'focus' | 'break' | 'long-break';

interface TimerState {
  phase: Phase;
  secondsLeft: number;
  sessions: number;
  visible: boolean;
}

type Action =
  | { type: 'START' }
  | { type: 'PAUSE' }
  | { type: 'RESET' }
  | { type: 'TICK' }
  | { type: 'NEXT' }
  | { type: 'HIDE' };

const DURATIONS: Record<Exclude<Phase, 'idle'>, number> = {
  focus: 25 * 60,
  break: 5 * 60,
  'long-break': 15 * 60,
};

function nextPhase(state: TimerState): Partial<TimerState> {
  if (state.phase === 'focus') {
    const sessions = state.sessions + 1;
    const phase: Phase = sessions % 4 === 0 ? 'long-break' : 'break';
    return { phase, secondsLeft: DURATIONS[phase], sessions };
  }
  return { phase: 'focus', secondsLeft: DURATIONS.focus };
}

function reducer(state: TimerState, action: Action): TimerState {
  switch (action.type) {
    case 'START':
      return { ...state, phase: state.phase === 'idle' ? 'focus' : state.phase, secondsLeft: state.phase === 'idle' ? DURATIONS.focus : state.secondsLeft };
    case 'PAUSE':
      return { ...state, phase: 'idle' };
    case 'RESET':
      return { ...state, phase: 'idle', secondsLeft: DURATIONS.focus };
    case 'TICK':
      if (state.secondsLeft > 0) return { ...state, secondsLeft: state.secondsLeft - 1 };
      return { ...state, ...nextPhase(state) };
    case 'NEXT':
      return { ...state, ...nextPhase(state) };
    case 'HIDE':
      return { ...state, visible: false };
    default:
      return state;
  }
}

const initial: TimerState = {
  phase: 'idle',
  secondsLeft: DURATIONS.focus,
  sessions: 0,
  visible: true,
};

export default function PomodoroTimer() {
  const [state, dispatch] = useReducer(reducer, initial);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const running = state.phase !== 'idle' && state.visible;

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => dispatch({ type: 'TICK' }), 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running]);

  // 타이머 완료 시 알림
  useEffect(() => {
    if (state.secondsLeft === 0 && state.phase !== 'idle' && 'Notification' in window && Notification.permission === 'granted') {
      new Notification('TimeFlow 포모도로', {
        body: state.phase === 'focus' ? '집중 시간이 끝났습니다! 휴식하세요.' : '휴식이 끝났습니다! 집중 시작!',
        icon: '/icons/icon-192.png',
      });
    }
  }, [state.secondsLeft, state.phase]);

  if (!state.visible) return null;

  const mm = String(Math.floor(state.secondsLeft / 60)).padStart(2, '0');
  const ss = String(state.secondsLeft % 60).padStart(2, '0');

  const phaseLabel: Record<Phase, string> = {
    idle: '준비',
    focus: '집중',
    break: '휴식',
    'long-break': '긴 휴식',
  };

  return (
    <div className="fixed bottom-20 md:bottom-6 right-4 z-50 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 p-4 flex items-center gap-3 min-w-[180px]">
      <div className="flex-1">
        <div className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wide">
          {phaseLabel[state.phase]} · {state.sessions}회
        </div>
        <div className="text-2xl font-mono font-bold text-gray-900 dark:text-gray-100">
          {mm}:{ss}
        </div>
      </div>
      <div className="flex items-center gap-1">
        {state.phase === 'idle' ? (
          <button onClick={() => dispatch({ type: 'START' })} className="p-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700">
            <Play className="w-4 h-4" />
          </button>
        ) : (
          <button onClick={() => dispatch({ type: 'PAUSE' })} className="p-1.5 rounded-lg bg-orange-500 text-white hover:bg-orange-600">
            <Pause className="w-4 h-4" />
          </button>
        )}
        <button onClick={() => dispatch({ type: 'RESET' })} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800">
          <RotateCcw className="w-4 h-4" />
        </button>
        <button onClick={() => dispatch({ type: 'HIDE' })} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
