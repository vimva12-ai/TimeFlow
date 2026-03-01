import { useRef, useCallback } from 'react';

interface LongPressOptions {
  threshold?: number; // ms, default 500
  onLongPress: (e: React.MouseEvent | React.TouchEvent) => void;
  onClick?: (e: React.MouseEvent) => void;
}

export function useLongPress({ threshold = 500, onLongPress, onClick }: LongPressOptions) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPressRef = useRef(false);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);

  const start = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      isLongPressRef.current = false;
      const pos = 'touches' in e
        ? { x: e.touches[0].clientX, y: e.touches[0].clientY }
        : { x: (e as React.MouseEvent).clientX, y: (e as React.MouseEvent).clientY };
      startPosRef.current = pos;

      timerRef.current = setTimeout(() => {
        isLongPressRef.current = true;
        onLongPress(e);
      }, threshold);
    },
    [threshold, onLongPress]
  );

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // 오른쪽 클릭 무시
      if (e.button !== 0) return;
      start(e);
    },
    [start]
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      cancel();
      if (!isLongPressRef.current && onClick) {
        onClick(e);
      }
    },
    [cancel, onClick]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!startPosRef.current) return;
      const dx = Math.abs(e.clientX - startPosRef.current.x);
      const dy = Math.abs(e.clientY - startPosRef.current.y);
      if (dx > 8 || dy > 8) cancel();
    },
    [cancel]
  );

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      start(e);
    },
    [start]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!startPosRef.current) return;
      const touch = e.touches[0];
      const dx = Math.abs(touch.clientX - startPosRef.current.x);
      const dy = Math.abs(touch.clientY - startPosRef.current.y);
      if (dx > 8 || dy > 8) cancel();
    },
    [cancel]
  );

  const handleTouchEnd = useCallback(() => {
    cancel();
  }, [cancel]);

  return {
    onMouseDown: handleMouseDown,
    onMouseUp: handleMouseUp,
    onMouseMove: handleMouseMove,
    onMouseLeave: cancel,
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
  };
}
