/**
 * Save triggers for the phase-2 store. Same semantics as the pre-phase-2
 * main.ts listeners:
 *   - beforeunload → silent save (no toast)
 *   - Ctrl+S / Cmd+S → save with "Saved" toast
 * No debounce, no on-change save.
 *
 * Not wired up by default. Call enablePersistence() once after the store has
 * been initialized and React has taken over from the Application class.
 * The phase-1 listeners in src/main.ts stay in place until phase 2 M6 swaps
 * them out — enabling both at once would double-save, so don't.
 */

import { showToast } from '../util/overlay';
import { getState, saveToLs } from './store';

let attached = false;
let beforeunloadHandler: (() => void) | null = null;
let keydownHandler: ((e: KeyboardEvent) => void) | null = null;

export function enablePersistence(): void {
  if (attached) return;

  beforeunloadHandler = (): void => {
    const title = getState().meta.title;
    if (!title) return;
    try {
      saveToLs(title);
    } catch {
      /* silent */
    }
  };

  keydownHandler = (e: KeyboardEvent): void => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      const title = getState().meta.title;
      if (!title) return;
      saveToLs(title);
      showToast('Saved');
    }
  };

  window.addEventListener('beforeunload', beforeunloadHandler);
  document.addEventListener('keydown', keydownHandler);
  attached = true;
}

export function disablePersistence(): void {
  if (!attached) return;
  if (beforeunloadHandler)
    window.removeEventListener('beforeunload', beforeunloadHandler);
  if (keydownHandler) document.removeEventListener('keydown', keydownHandler);
  beforeunloadHandler = null;
  keydownHandler = null;
  attached = false;
}

export function isPersistenceEnabled(): boolean {
  return attached;
}
