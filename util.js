/* copyright 2025 Unlost GmbH. All rights reserved. */

// Re-export shim during phase 1 M4 port. Legacy main.js and canvas.js still
// import from './util.js'; this file fans the names out to the split TS
// modules under src/util/. Delete once M6 switches main.js to TS + direct
// imports.

export { createElement, toggleElements } from './src/util/dom.ts';
export { makeEditable } from './src/util/editable.ts';
export { addLongPressListener } from './src/util/longpress.ts';
export { makeDraggable, makeDroppable } from './src/util/dragdrop.ts';
export { overlayMenu, confirmStep, showToast } from './src/util/overlay.ts';
export {
  sanitize,
  sanitizeJSON,
  convertBR,
  convertNL,
  decodeHtml,
  encodeHtml,
  trimPluralS,
} from './src/util/sanitize.ts';
export { loadJson, downloadLs, uploadLs } from './src/util/io.ts';
export { convertDivToSvg } from './src/util/svg.ts';
export { lg } from './src/util/log.ts';
