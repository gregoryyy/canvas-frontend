import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { vi } from 'vitest';
import { Application, Settings } from '../src/app';
import { setApp, setConf } from '../src/context';

export function loadFixture<T = unknown>(relativePath: string): T {
  return JSON.parse(readFileSync(resolve(relativePath), 'utf8')) as T;
}

// Install a fetch mock that serves files from public/.
// The app calls `fetch('conf/foo.json')` and `fetch('models/bar.json')`; jsdom
// resolves those relative to document.URL, so we key the mock off the path.
export function installFetchMock(): void {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = input instanceof Request ? input.url : String(input);
    const pathMatch = url.match(/(conf|models)\/[^?]+/);
    if (!pathMatch) throw new Error(`fetch mock: unexpected url ${url}`);
    const body = readFileSync(resolve('public', pathMatch[0]), 'utf8');
    return new Response(body, { headers: { 'Content-Type': 'application/json' } });
  });
}

export interface BootstrapOptions {
  config?: string; // filename in public/conf, sans .json
  model?: string; // filename in public/models, sans .json
}

// Vitest + Node 22's experimental localStorage leaves `globalThis.localStorage`
// as a plain object without the Storage API methods. Install a Map-backed stub
// so `getItem` / `setItem` / `removeItem` / `clear` work as the app expects.
function installLocalStorageStub(): void {
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

// Reset DOM + localStorage, build a fresh Application bound to the given
// config and model. Mirrors the DOMContentLoaded bootstrap in src/main.ts,
// minus the network fetch.
export function bootstrapApp(options: BootstrapOptions = {}): void {
  const configName = options.config ?? 'preseed';
  const modelName = options.model ?? 'test';

  document.body.innerHTML = '<div id="content"></div><div id="controls"></div>';
  installLocalStorageStub();

  const config = loadFixture<{ settings: never }>(`public/conf/${configName}.json`);
  const model = loadFixture(`public/models/${modelName}.json`);

  const newConf = new Settings((config as { settings: never }).settings as never);
  newConf.canvasTypes = [
    ['Preseed Canvas', 'preseed'],
    ['Business Model Canvas', 'bmcanvas'],
    ['Lean Canvas', 'leancanvas'],
  ];
  setConf(newConf);
  setApp(Application.create(config as never, model as never));
}

// Wait long enough for fetch + microtasks to drain, used after loadFromLs and
// changeType which kick off async work but don't return a Promise.
export function flush(ms = 20): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
