/**
 * Plain-data canvas store. Source of truth for phase-2 React components;
 * coexists with the phase-1 Application class until the components land.
 *
 * API is `useSyncExternalStore`-compatible: `subscribe` + `getState` work as
 * the React hook's store arguments. Imperative callers use the action
 * functions directly. No reducer framework, no dependency.
 *
 * Mutations always assign a new top-level state object; nested objects are
 * shallow-copied only along the path that changed. Referential equality holds
 * for untouched branches — same rules React's reconciler and memo selectors
 * expect.
 */

import type { Analysis, Card, CardType, Cell, CanvasState, Meta } from '../types/canvas';
import type { CanvasConfig } from '../types/config';
import { sanitizeJSON } from '../util/sanitize';

const lsKey = 'preseedcanvas';

export interface AppState {
  meta: Meta;
  cells: Cell[];
  analysis: Analysis | undefined;
  config: CanvasConfig | undefined;
}

const emptyMeta: Meta = { title: '', canvas: '', version: '', date: '' };

let state: AppState = {
  meta: emptyMeta,
  cells: [],
  analysis: undefined,
  config: undefined,
};

type Listener = () => void;
const listeners = new Set<Listener>();

// ---- core store API -------------------------------------------------------

export function getState(): AppState {
  return state;
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return (): void => {
    listeners.delete(listener);
  };
}

function setState(updater: (s: AppState) => AppState): void {
  state = updater(state);
  listeners.forEach((l) => l());
}

// ---- init & adapters ------------------------------------------------------

/**
 * Rebuild cells from the config structure and fill each with the
 * corresponding positional entry in `content.canvas`. Matches the
 * pre-phase-2 Application.create → Canvas ctor path exactly.
 */
export function init(config: CanvasConfig, content: CanvasState): void {
  setState(() => ({
    config,
    meta: { ...content.meta, canvas: config.meta.canvas },
    cells: cellsFromContent(config, content),
    analysis: content.analysis,
  }));
}

function cellsFromContent(config: CanvasConfig, content: CanvasState): Cell[] {
  return config.canvas.map((structData, i) => {
    const provided = content.canvas[i];
    return {
      id: structData.id,
      cards: provided?.cards ?? [],
      score: structData.score === 'yes' ? (provided?.score ?? 0) : undefined,
    };
  });
}

export function toCanvasState(s: AppState): CanvasState {
  return { meta: s.meta, canvas: s.cells, analysis: s.analysis };
}

// ---- card actions ---------------------------------------------------------

export function addCard(cellId: number, content = '', type?: CardType): void {
  setState((s) => ({
    ...s,
    cells: s.cells.map((cell) =>
      cell.id === cellId
        ? { ...cell, cards: [...(cell.cards ?? []), { content, type }] }
        : cell,
    ),
  }));
}

export function updateCard(
  cellId: number,
  cardIndex: number,
  content: string,
  type?: CardType,
): void {
  setState((s) => ({
    ...s,
    cells: s.cells.map((cell) => {
      if (cell.id !== cellId) return cell;
      const cards = (cell.cards ?? []).slice();
      if (cardIndex < 0 || cardIndex >= cards.length) return cell;
      cards[cardIndex] = { content, type };
      return { ...cell, cards };
    }),
  }));
}

export function removeCard(cellId: number, cardIndex: number): void {
  setState((s) => ({
    ...s,
    cells: s.cells.map((cell) => {
      if (cell.id !== cellId) return cell;
      const cards = (cell.cards ?? []).filter((_c, i) => i !== cardIndex);
      return { ...cell, cards };
    }),
  }));
}

/**
 * Remove the card at (fromCellId, fromIndex), insert at (toCellId, toIndex)
 * where `toIndex` is the final position in the destination's cards array
 * after removal.
 *
 * Cleaner than the legacy drag-drop quirk of "toIndex = drop target's
 * post-insertBefore position and subtract one"; phase-2 drag hooks translate
 * gesture coordinates into this flat index.
 */
export function moveCard(
  fromCellId: number,
  fromIndex: number,
  toCellId: number,
  toIndex: number,
): void {
  setState((s) => {
    const fromCell = s.cells.find((c) => c.id === fromCellId);
    if (!fromCell) return s;
    const fromCards = (fromCell.cards ?? []).slice();
    if (fromIndex < 0 || fromIndex >= fromCards.length) return s;
    const [card] = fromCards.splice(fromIndex, 1);
    if (!card) return s;

    if (fromCellId === toCellId) {
      fromCards.splice(toIndex, 0, card);
      return {
        ...s,
        cells: s.cells.map((c) => (c.id === fromCellId ? { ...c, cards: fromCards } : c)),
      };
    }

    const toCell = s.cells.find((c) => c.id === toCellId);
    if (!toCell) return s;
    const toCards = (toCell.cards ?? []).slice();
    toCards.splice(toIndex, 0, card);

    return {
      ...s,
      cells: s.cells.map((c) => {
        if (c.id === fromCellId) return { ...c, cards: fromCards };
        if (c.id === toCellId) return { ...c, cards: toCards };
        return c;
      }),
    };
  });
}

// ---- cell / metadata actions ---------------------------------------------

export function setScore(cellId: number, score: number | string): void {
  setState((s) => ({
    ...s,
    cells: s.cells.map((cell) => (cell.id === cellId ? { ...cell, score } : cell)),
  }));
}

export function setMeta(patch: Partial<Meta>): void {
  setState((s) => ({ ...s, meta: { ...s.meta, ...patch } }));
}

export function setAnalysis(content: string): void {
  setState((s) => ({ ...s, analysis: { content } }));
}

// ---- structural actions ---------------------------------------------------

/**
 * Swap the active config, preserving cards by positional index (matches
 * Application.restructure). Score default: 0 for scored cells, else
 * undefined — per the new config's cell definitions, not the old.
 */
export function changeType(newConfig: CanvasConfig): void {
  setState((s) => ({
    ...s,
    config: newConfig,
    cells: newConfig.canvas.map((structData, i) => ({
      id: structData.id,
      cards: s.cells[i]?.cards ?? [],
      score:
        structData.score === 'yes' ? (s.cells[i]?.score ?? 0) : undefined,
    })),
    meta: { ...s.meta, canvas: newConfig.meta.canvas },
  }));
}

/** Empty every cell's cards, zero scored cells, keep structure. */
export function clearAll(): void {
  setState((s) => ({
    ...s,
    cells: s.cells.map((cell) => ({
      ...cell,
      cards: [],
      score: cell.score !== undefined ? 0 : undefined,
    })),
  }));
}

// ---- persistence actions --------------------------------------------------

export function saveToLs(title?: string): void {
  const t = title ?? state.meta.title;
  if (!t) return;
  const raw = localStorage.getItem(lsKey);
  const all = (raw ? JSON.parse(raw) : {}) as Record<string, CanvasState>;
  all[t] = toCanvasState(state);
  localStorage.setItem(lsKey, JSON.stringify(all));
}

/**
 * Read and sanitize the saved entry, overwrite meta/cells/analysis in the
 * store, and return the loaded state for callers that need to fetch a
 * matching config (when the canvas-type identifier differs).
 */
export function loadFromLs(title: string): CanvasState | undefined {
  const raw = localStorage.getItem(lsKey);
  if (!raw) return undefined;
  const all = JSON.parse(raw) as Record<string, unknown>;
  const entry = all[title];
  if (!entry) return undefined;
  const content = sanitizeJSON(entry) as CanvasState;
  setState((s) => ({
    ...s,
    meta: content.meta,
    cells: content.canvas,
    analysis: content.analysis,
  }));
  return content;
}

/** Re-export types so phase-2 components can import from one place. */
export type { Analysis, Card, CardType, Cell, CanvasState, Meta };
