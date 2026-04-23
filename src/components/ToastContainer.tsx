import { useEffect, useState } from 'react';
import { Toast } from './Toast';

interface ToastEntry {
  id: number;
  message: string;
  isError?: boolean;
}

let nextId = 0;
let pushToast: ((message: string, isError?: boolean) => void) | null = null;

/**
 * Programmatic toast trigger. No-op when no `<ToastContainer />` is mounted;
 * enqueues a new toast on the currently-mounted container otherwise. Mirrors
 * the legacy `showToast(message, isError?)` entry point so imperative call
 * sites port over without a signature change.
 */
export function showToast(message: string, isError = false): void {
  pushToast?.(message, isError);
}

/**
 * Mounts a fan-out host for `showToast` calls. Render once at the top of the
 * React tree (e.g. in App). Each toast auto-dismisses after its duration and
 * removes itself from the container queue on transition end.
 */
export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);

  useEffect(() => {
    pushToast = (message, isError) => {
      setToasts((prev) => [...prev, { id: ++nextId, message, isError }]);
    };
    return () => {
      pushToast = null;
    };
  }, []);

  const dismiss = (id: number): void => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <>
      {toasts.map((t) => (
        <Toast
          key={t.id}
          message={t.message}
          isError={t.isError}
          onDismiss={() => dismiss(t.id)}
        />
      ))}
    </>
  );
}
