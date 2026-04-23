import { type MouseEvent, useEffect, useRef, useState } from 'react';

interface ConfirmStepProps {
  label: string;
  onConfirm: () => void;
  timeout?: number;
  id?: string;
  className?: string;
  /**
   * When true, stop click events from bubbling past this button — useful when
   * it sits inside another clickable element (e.g. the Delete button inside
   * an OverlayMenu item).
   */
  stopPropagation?: boolean;
}

/**
 * Click-twice-to-confirm button. First click shows "{label}?" in red and
 * arms for `timeout` ms; second click within the window fires `onConfirm`
 * and resets. Matches the legacy `confirmStep` util behavior 1:1.
 */
export function ConfirmStep({
  label,
  onConfirm,
  timeout = 3000,
  id,
  className,
  stopPropagation = false,
}: ConfirmStepProps) {
  const [confirming, setConfirming] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const handleClick = (e: MouseEvent): void => {
    if (stopPropagation) e.stopPropagation();
    if (confirming) {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
      setConfirming(false);
      onConfirm();
    } else {
      setConfirming(true);
      timerRef.current = setTimeout(() => setConfirming(false), timeout);
    }
  };

  const style = confirming ? { color: 'red' } : undefined;
  return (
    <div id={id} className={className} style={style} onClick={handleClick}>
      {confirming ? `${label}?` : label}
    </div>
  );
}
