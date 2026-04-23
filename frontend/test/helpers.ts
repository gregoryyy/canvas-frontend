import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { vi } from 'vitest';

export function loadFixture<T = unknown>(relativePath: string): T {
  return JSON.parse(readFileSync(resolve(relativePath), 'utf8')) as T;
}

/**
 * Install a fetch mock that serves files from `public/`. The app calls
 * `fetch('conf/foo.json')` and `fetch('models/bar.json')`; jsdom resolves
 * those relative to `document.URL`, so the mock keys off the path tail.
 */
export function installFetchMock(): void {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = input instanceof Request ? input.url : String(input);
    const pathMatch = url.match(/(conf|models)\/[^?]+/);
    if (!pathMatch) throw new Error(`fetch mock: unexpected url ${url}`);
    const body = readFileSync(resolve('public', pathMatch[0]), 'utf8');
    return new Response(body, { headers: { 'Content-Type': 'application/json' } });
  });
}

/**
 * Vitest + Node 22's experimental localStorage leaves `globalThis.localStorage`
 * as a plain object without the Storage API methods. Install a Map-backed
 * stub so `getItem` / `setItem` / `removeItem` / `clear` work as the app
 * expects.
 */
export function installLocalStorageStub(): void {
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, String(v));
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
      clear: () => {
        store.clear();
      },
      key: (i: number) => Array.from(store.keys())[i] ?? null,
      get length() {
        return store.size;
      },
    },
    writable: true,
    configurable: true,
  });
}
