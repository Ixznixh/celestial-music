import React, { useRef, useCallback } from 'react';

interface UseLongPressOptions {
  threshold?: number; // ms to trigger long press (default 420ms)
  moveTolerance?: number; // px movement before cancelling (default 10px)
  onStart?: () => void;
  onFinish?: () => void;
  onCancel?: () => void;
}

export function useLongPress<T = any>(
  onLongPress: (item: T, e: React.TouchEvent | React.MouseEvent | React.PointerEvent) => void,
  onClick?: (item: T, e: React.MouseEvent) => void,
  options: UseLongPressOptions = {}
) {
  const {
    threshold = 420,
    moveTolerance = 12,
    onStart,
    onFinish,
    onCancel,
  } = options;

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPressRef = useRef<boolean>(false);
  const startPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const itemRef = useRef<T | null>(null);

  const triggerHaptic = () => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(15);
      } catch {}
    }
  };

  const start = useCallback(
    (item: T, e: React.PointerEvent | React.TouchEvent | React.MouseEvent) => {
      // Prevent double trigger on secondary buttons
      if ('button' in e && e.button !== 0 && e.button !== undefined) return;

      itemRef.current = item;
      isLongPressRef.current = false;
      const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.PointerEvent).clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.PointerEvent).clientY;
      startPosRef.current = { x: clientX, y: clientY };

      onStart?.();

      if (timerRef.current) clearTimeout(timerRef.current);

      timerRef.current = setTimeout(() => {
        isLongPressRef.current = true;
        triggerHaptic();
        onLongPress(item, e);
        onFinish?.();
      }, threshold);
    },
    [onLongPress, onStart, onFinish, threshold]
  );

  const move = useCallback(
    (e: React.PointerEvent | React.TouchEvent | React.MouseEvent) => {
      if (!timerRef.current) return;
      const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.PointerEvent).clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.PointerEvent).clientY;

      const deltaX = Math.abs(clientX - startPosRef.current.x);
      const deltaY = Math.abs(clientY - startPosRef.current.y);

      // If user moved finger more than tolerance, they are scrolling -> cancel timer
      if (deltaX > moveTolerance || deltaY > moveTolerance) {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
        onCancel?.();
      }
    },
    [moveTolerance, onCancel]
  );

  const clear = useCallback(
    (shouldTriggerClick = false, e?: React.MouseEvent) => {
      const wasLongPress = isLongPressRef.current;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }

      if (shouldTriggerClick && !wasLongPress && onClick && itemRef.current && e) {
        onClick(itemRef.current, e);
      }

      // Reset after a small delay to avoid phantom clicks
      setTimeout(() => {
        isLongPressRef.current = false;
      }, 50);
    },
    [onClick]
  );

  const getHandlers = useCallback(
    (item: T) => ({
      onPointerDown: (e: React.PointerEvent) => start(item, e),
      onPointerMove: (e: React.PointerEvent) => move(e),
      onPointerUp: (e: React.PointerEvent) => clear(false),
      onPointerCancel: () => clear(false),
      onClick: (e: React.MouseEvent) => {
        if (isLongPressRef.current) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        if (onClick) {
          onClick(item, e);
        }
      },
      onContextMenu: (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        triggerHaptic();
        onLongPress(item, e);
      },
    }),
    [start, move, clear, onClick, onLongPress]
  );

  return { getHandlers };
}
