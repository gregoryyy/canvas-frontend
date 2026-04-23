import { type RefObject, useEffect, useRef } from 'react';

const MOVE_THRESHOLD_PX = 10;

/**
 * Fire `callback` after the user holds the referenced element for `duration`
 * ms without moving more than 10 px. Listens for both mouse and touch,
 * mirrors the legacy `generateLongPressEvents` util 1:1. Callback is
 * captured fresh on every render via a ref so the hook's listener setup
 * does not re-attach on prop change.
 */
export function useLongPress(
  ref: RefObject<HTMLElement | null>,
  callback: () => void,
  duration = 500,
): void {
  const callbackRef = useRef(callback);
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    let timerId: ReturnType<typeof setTimeout> | null = null;
    let startX = 0;
    let startY = 0;

    const start = (event: Event): void => {
      const te = event as TouchEvent;
      const me = event as MouseEvent;
      startX = event.type === 'touchstart' ? te.touches[0]!.pageX : me.pageX;
      startY = event.type === 'touchstart' ? te.touches[0]!.pageY : me.pageY;
      if ((event.type === 'mousedown' && me.button !== 0) || event.target !== element) return;
      timerId = setTimeout(() => callbackRef.current(), duration);
    };

    const cancel = (): void => {
      if (timerId !== null) {
        clearTimeout(timerId);
        timerId = null;
      }
    };

    const move = (event: Event): void => {
      const te = event as TouchEvent;
      const me = event as MouseEvent;
      const newX = event.type === 'touchmove' ? te.touches[0]!.pageX : me.pageX;
      const newY = event.type === 'touchmove' ? te.touches[0]!.pageY : me.pageY;
      if (
        Math.abs(newX - startX) > MOVE_THRESHOLD_PX ||
        Math.abs(newY - startY) > MOVE_THRESHOLD_PX
      ) {
        cancel();
      }
    };

    element.addEventListener('mousedown', start);
    element.addEventListener('touchstart', start, { passive: true });
    element.addEventListener('mouseup', cancel);
    element.addEventListener('mouseleave', cancel);
    element.addEventListener('touchend', cancel);
    element.addEventListener('touchcancel', cancel);
    element.addEventListener('mousemove', move);
    element.addEventListener('touchmove', move, { passive: true });

    return () => {
      cancel();
      element.removeEventListener('mousedown', start);
      element.removeEventListener('touchstart', start);
      element.removeEventListener('mouseup', cancel);
      element.removeEventListener('mouseleave', cancel);
      element.removeEventListener('touchend', cancel);
      element.removeEventListener('touchcancel', cancel);
      element.removeEventListener('mousemove', move);
      element.removeEventListener('touchmove', move);
    };
  }, [ref, duration]);
}
