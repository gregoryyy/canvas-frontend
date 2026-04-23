import { type TransitionEvent, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface ToastProps {
  message: string;
  isError?: boolean;
  duration?: number;
  onDismiss: () => void;
}

/**
 * Brief toast notification, portal-rendered into `document.body`. Mounts with
 * no `.toast-visible` class, flips to visible on the next frame so the CSS
 * transition fires, then hides after `duration` ms. On transition end after
 * hide, calls `onDismiss` so the parent can unmount — same lifecycle as the
 * legacy `showToast` helper.
 */
export function Toast({ message, isError, duration = 2500, onDismiss }: ToastProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    const timer = setTimeout(() => setVisible(false), duration);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [duration]);

  const handleTransitionEnd = (e: TransitionEvent<HTMLDivElement>): void => {
    // only dismiss after the hide transition finishes
    if (!visible && e.target === e.currentTarget) onDismiss();
  };

  const classes = ['toast'];
  if (isError) classes.push('toast-error');
  if (visible) classes.push('toast-visible');

  return createPortal(
    <div className={classes.join(' ')} onTransitionEnd={handleTransitionEnd}>
      {message}
    </div>,
    document.body,
  );
}
