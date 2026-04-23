import { useSyncExternalStore } from 'react';
import { type AppState, getState, subscribe } from './store';

/**
 * Subscribe a React component to a slice of the store. The selector runs on
 * every render; memoization is the caller's responsibility for derived data.
 * Referential equality holds for untouched branches (see store.ts) so simple
 * selectors avoid unnecessary re-renders without extra work.
 */
export function useStore<T>(selector: (s: AppState) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => selector(getState()),
    () => selector(getState()),
  );
}
