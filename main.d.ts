// Type shim for ./main.js (still plain JS in phase 1 M5). Declares the
// live-binding module exports so TypeScript modules under src/canvas/ can
// reference `app` / `conf` / `ctl` without enabling `allowJs`. Vite resolves
// the real values from main.js at runtime.
//
// Remove in M6 when main.js ports to main.ts — see PLAN.md §Phase-1 M6.

/* eslint-disable @typescript-eslint/no-explicit-any --
   Explicit any matches main.js's untyped JS exports; tightening happens in M6. */

export const app: any;
export const conf: any;
export const ctl: any;
