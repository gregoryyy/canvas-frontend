import { beforeEach, describe, expect, it } from 'vitest';
import * as store from '../src/state/store';
import type { CanvasState } from '../src/types/canvas';
import type { CanvasConfig } from '../src/types/config';
import { installLocalStorageStub, loadFixture } from './helpers';

const preseedConfig = loadFixture<CanvasConfig>('public/conf/preseed.json');
const leanConfig = loadFixture<CanvasConfig>('public/conf/leancanvas.json');
const testModel = loadFixture<CanvasState>('public/models/test.json');

function cellById(id: number): store.Cell {
  return store.getState().cells.find((c) => c.id === id)!;
}

describe('store', () => {
  beforeEach(() => {
    installLocalStorageStub();
    store.init(preseedConfig, testModel);
  });

  it('init populates meta, cells, analysis, and config', () => {
    const s = store.getState();
    expect(s.meta.title).toBe('Example Startup');
    expect(s.meta.canvas).toBe(preseedConfig.meta.canvas);
    expect(s.cells).toHaveLength(preseedConfig.canvas.length);
    expect(s.cells[0]!.cards).toEqual([
      { content: 'Problem 1' },
      { content: 'Problem 2' },
    ]);
    expect(s.config).toBe(preseedConfig);
  });

  it('init zeros scores for scored cells when content omits them', () => {
    const blank = { ...testModel, canvas: [] } as CanvasState;
    store.init(preseedConfig, blank);
    const scoredCell = store
      .getState()
      .cells.find((_c, i) => preseedConfig.canvas[i]?.score === 'yes')!;
    expect(scoredCell.score).toBe(0);
  });

  it('addCard appends to the target cell', () => {
    store.addCard(1, 'New item', 'query');
    const cards = cellById(1).cards!;
    expect(cards[cards.length - 1]).toEqual({ content: 'New item', type: 'query' });
  });

  it('updateCard replaces content and type at the given index', () => {
    store.updateCard(1, 0, 'Changed', 'emphasis');
    expect(cellById(1).cards![0]).toEqual({ content: 'Changed', type: 'emphasis' });
  });

  it('updateCard is a no-op for an out-of-range index', () => {
    const before = cellById(1).cards!.slice();
    store.updateCard(1, 99, 'nope');
    expect(cellById(1).cards).toEqual(before);
  });

  it('removeCard splices out the card at the given index', () => {
    const before = cellById(1).cards!.length;
    store.removeCard(1, 0);
    expect(cellById(1).cards!.length).toBe(before - 1);
  });

  it('moveCard within a cell reorders (post-removal semantics)', () => {
    // reset cell 1 to [A, B, C] for a clean, position-driven assertion
    store.updateCard(1, 0, 'A');
    store.updateCard(1, 1, 'B');
    store.addCard(1, 'C');
    // move A (index 0) → position 1 in the post-removal array
    store.moveCard(1, 0, 1, 1);
    expect(cellById(1).cards!.map((c) => c.content)).toEqual(['B', 'A', 'C']);
  });

  it('moveCard across cells moves the card between cells', () => {
    const sourcePre = cellById(1).cards!.length;
    const destPre = cellById(2).cards!.length;
    store.moveCard(1, 0, 2, 0);
    expect(cellById(1).cards!.length).toBe(sourcePre - 1);
    expect(cellById(2).cards!.length).toBe(destPre + 1);
    expect(cellById(2).cards![0]).toEqual({ content: 'Problem 1' });
  });

  it('moveCard with an out-of-range source index is a no-op', () => {
    const before = store.getState().cells.map((c) => c.cards!.length);
    store.moveCard(1, 99, 2, 0);
    const after = store.getState().cells.map((c) => c.cards!.length);
    expect(after).toEqual(before);
  });

  it('setScore updates the cell score', () => {
    store.setScore(1, 3);
    expect(cellById(1).score).toBe(3);
  });

  it('setMeta patches the meta partial without clobbering other fields', () => {
    store.setMeta({ title: 'New Title' });
    const m = store.getState().meta;
    expect(m.title).toBe('New Title');
    expect(m.canvas).toBe(preseedConfig.meta.canvas);
    expect(m.date).toBe(testModel.meta.date);
  });

  it('setAnalysis replaces analysis content', () => {
    store.setAnalysis('Done');
    expect(store.getState().analysis).toEqual({ content: 'Done' });
  });

  it('clearAll empties cards and zeros scored cells', () => {
    store.clearAll();
    const cells = store.getState().cells;
    expect(cells.every((c) => (c.cards ?? []).length === 0)).toBe(true);
    const scoredIndex = preseedConfig.canvas.findIndex((c) => c.score === 'yes');
    if (scoredIndex >= 0) expect(cells[scoredIndex]!.score).toBe(0);
  });

  it('changeType rebuilds cells from the new config while preserving cards by position', () => {
    const firstCellCardsPre = cellById(1).cards!.slice();
    store.changeType(leanConfig);
    const s = store.getState();
    expect(s.cells).toHaveLength(leanConfig.canvas.length);
    expect(s.cells[0]!.cards).toEqual(firstCellCardsPre);
    expect(s.meta.canvas).toBe(leanConfig.meta.canvas);
    expect(s.config).toBe(leanConfig);
  });

  it('saveToLs + loadFromLs round-trips through localStorage', () => {
    store.addCard(1, 'Added card');
    store.saveToLs();
    store.clearAll();
    expect(cellById(1).cards).toEqual([]);
    store.loadFromLs('Example Startup');
    const cards = cellById(1).cards!;
    expect(cards[cards.length - 1]).toEqual({ content: 'Added card' });
  });

  it('saveToLs is a no-op when the canvas has no title', () => {
    store.setMeta({ title: '' });
    store.saveToLs();
    expect(localStorage.getItem('preseedcanvas')).toBeNull();
  });

  it('loadFromLs returns undefined for a missing title', () => {
    expect(store.loadFromLs('Nope')).toBeUndefined();
  });

  it('subscribe fires on every state change and unsubscribe stops it', () => {
    let calls = 0;
    const unsub = store.subscribe(() => {
      calls++;
    });
    store.addCard(1, 'x');
    store.addCard(1, 'y');
    unsub();
    store.addCard(1, 'z');
    expect(calls).toBe(2);
  });

  it('preserves referential equality for untouched cell branches', () => {
    const cellsBefore = store.getState().cells;
    const cell2Before = cellsBefore[1]!;
    store.addCard(cellsBefore[0]!.id, 'only cell 0 mutates');
    const cellsAfter = store.getState().cells;
    expect(cellsAfter).not.toBe(cellsBefore);
    expect(cellsAfter[1]).toBe(cell2Before);
  });
});
