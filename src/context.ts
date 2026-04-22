// App-wide runtime context. Populated by src/main.ts at bootstrap so modules
// under src/canvas/ can read `app` / `conf` / `ctl` without importing main
// (which would reintroduce the circular dependency the M6 port eliminated).
//
// The bindings are `export let` so importers get live-binding semantics: any
// read sees the most recent value written by `setContext`. Phase 2 will
// replace this with a React context or a zustand store.

/* eslint-disable @typescript-eslint/no-explicit-any --
   Types intentionally loose; Application/Settings/Controls live in main.ts
   and typing them here would reintroduce the import cycle. */

export let app: any = undefined;
export let conf: any = undefined;
export let ctl: any = undefined;

export function setApp(value: any): void {
  app = value;
}
export function setConf(value: any): void {
  conf = value;
}
export function setCtl(value: any): void {
  ctl = value;
}
