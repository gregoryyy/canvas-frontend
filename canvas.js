/* copyright 2025 Unlost GmbH. All rights reserved. */

// Re-export shim during phase 1 M5 port. Legacy main.js still imports the
// canvas classes from './canvas.js'; this file forwards to the split TS
// modules under src/canvas/. Delete once M6 ports main.js to TS and switches
// to direct imports.

export { Canvas } from './src/canvas/Canvas.ts';
export { Cell } from './src/canvas/Cell.ts';
export { Card } from './src/canvas/Card.ts';
export { PreCanvas } from './src/canvas/PreCanvas.ts';
export { PostCanvas } from './src/canvas/PostCanvas.ts';
