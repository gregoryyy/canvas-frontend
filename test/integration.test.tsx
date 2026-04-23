import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/components/App';
import * as store from '../src/state/store';
import type { CanvasState } from '../src/types/canvas';
import type { CanvasConfig } from '../src/types/config';
import { installLocalStorageStub, loadFixture } from './helpers';

const preseedConfig = loadFixture<CanvasConfig>('public/conf/preseed.json');
const testModel = loadFixture<CanvasState>('public/models/test.json');

function setup(): HTMLElement {
  installLocalStorageStub();
  store.init(preseedConfig, testModel);
  store.setCanvasTypes([
    ['Preseed Canvas', 'preseed'],
    ['Business Model Canvas', 'bmcanvas'],
  ]);
  return render(<App />).container;
}

function firstCellId(): number {
  return preseedConfig.canvas[0]!.id;
}

describe('App integration — card editing', () => {
  afterEach(cleanup);

  it('editing a card and blurring updates the store', () => {
    const container = setup();
    const firstCard = container.querySelector<HTMLElement>(
      `.cell[data-index='${firstCellId()}'] .card`,
    )!;
    expect(firstCard.textContent).toBe('Problem 1');

    act(() => {
      firstCard.innerHTML = 'Problem 1 edited';
      fireEvent.blur(firstCard);
    });

    const cell = store.getState().cells.find((c) => c.id === firstCellId())!;
    expect(cell.cards![0]!.content).toBe('Problem 1 edited');
  });

  it('prefix command :? sets card type via edit', () => {
    const container = setup();
    const firstCard = container.querySelector<HTMLElement>(
      `.cell[data-index='${firstCellId()}'] .card`,
    )!;
    act(() => {
      firstCard.innerHTML = ':? Problem 1';
      fireEvent.blur(firstCard);
    });
    const cell = store.getState().cells.find((c) => c.id === firstCellId())!;
    expect(cell.cards![0]!.type).toBe('query');
    expect(cell.cards![0]!.content).toBe('Problem 1');
  });

  it('clearing a card text on edit removes it from the cell', () => {
    const container = setup();
    const cellBefore = store.getState().cells.find((c) => c.id === firstCellId())!;
    const lengthBefore = cellBefore.cards!.length;
    const firstCard = container.querySelector<HTMLElement>(
      `.cell[data-index='${firstCellId()}'] .card`,
    )!;
    act(() => {
      firstCard.innerHTML = '';
      fireEvent.blur(firstCard);
    });
    const cellAfter = store.getState().cells.find((c) => c.id === firstCellId())!;
    expect(cellAfter.cards!.length).toBe(lengthBefore - 1);
  });

  it('double-click on the empty cell container adds a new card', () => {
    const container = setup();
    const cellBefore = store.getState().cells.find((c) => c.id === firstCellId())!;
    const lengthBefore = cellBefore.cards!.length;
    const cellContainer = container.querySelector<HTMLElement>(
      `.cell[data-index='${firstCellId()}'] .cell-card-container`,
    )!;
    act(() => {
      fireEvent.doubleClick(cellContainer);
    });
    const cellAfter = store.getState().cells.find((c) => c.id === firstCellId())!;
    expect(cellAfter.cards!.length).toBe(lengthBefore + 1);
  });

  it('changing the score dropdown dispatches setScore', () => {
    const container = setup();
    const select = container.querySelector<HTMLSelectElement>(
      `.cell[data-index='${firstCellId()}'] select.scoring-dropdown`,
    )!;
    act(() => {
      fireEvent.change(select, { target: { value: '2' } });
    });
    const cell = store.getState().cells.find((c) => c.id === firstCellId())!;
    expect(String(cell.score)).toBe('2');
  });
});

describe('App integration — drag/drop wiring', () => {
  // Card uses long-press (500 ms) for drag initiation, not native dragstart
  // — see useDraggable in src/hooks/useDragDrop.ts. Tests fake timers to
  // simulate the hold gesture, then dispatch the native drop event.
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  function startDragViaLongPress(source: HTMLElement): void {
    fireEvent.mouseDown(source, { button: 0, clientX: 0, clientY: 0 });
    act(() => {
      vi.advanceTimersByTime(600);
    });
  }

  it('drag-and-drop a card onto another card in the same cell reorders', () => {
    vi.useFakeTimers();
    const container = setup();
    const cards = container.querySelectorAll<HTMLElement>(
      `.cell[data-index='${firstCellId()}'] .card`,
    );
    // Drag "Problem 2" (index 1) onto "Problem 1" (index 0)
    const source = cards[1]!;
    const target = cards[0]!;
    expect(source.textContent).toBe('Problem 2');
    expect(target.textContent).toBe('Problem 1');

    startDragViaLongPress(source);
    act(() => {
      fireEvent.dragEnter(target);
      fireEvent.drop(target);
      fireEvent.dragEnd(source);
    });

    const cellAfter = store.getState().cells.find((c) => c.id === firstCellId())!;
    expect(cellAfter.cards!.map((c) => c.content)).toEqual(['Problem 2', 'Problem 1']);
  });

  it('drag-and-drop a card onto another cell reorders across cells', () => {
    vi.useFakeTimers();
    const container = setup();
    const sourceCellId = preseedConfig.canvas[0]!.id;
    const destCellId = preseedConfig.canvas[1]!.id;
    const source = container.querySelector<HTMLElement>(
      `.cell[data-index='${sourceCellId}'] .card`,
    )!;
    const destContainer = container.querySelector<HTMLElement>(
      `.cell[data-index='${destCellId}'] .cell-card-container`,
    )!;
    const sourceContent = source.textContent;
    const destCountBefore = store.getState().cells.find((c) => c.id === destCellId)!.cards!.length;

    startDragViaLongPress(source);
    act(() => {
      fireEvent.dragEnter(destContainer);
      fireEvent.drop(destContainer);
      fireEvent.dragEnd(source);
    });

    const destCellAfter = store.getState().cells.find((c) => c.id === destCellId)!;
    expect(destCellAfter.cards!.length).toBe(destCountBefore + 1);
    expect(destCellAfter.cards![destCellAfter.cards!.length - 1]!.content).toBe(sourceContent);
  });
});

describe('store transitions — snapshot-style', () => {
  afterEach(() => {
    // reset to a fresh state between snapshot tests
    store.init(preseedConfig, testModel);
  });

  it('addCard produces a cells snapshot with the new card appended', () => {
    store.init(preseedConfig, testModel);
    store.addCard(1, 'new entry');
    const cell = store.getState().cells.find((c) => c.id === 1)!;
    expect(cell.cards!.at(-1)).toEqual({ content: 'new entry' });
    expect(cell.cards!.map((c) => c.content)).toMatchInlineSnapshot(`
      [
        "Problem 1",
        "Problem 2",
        "new entry",
      ]
    `);
  });

  it('removeCard produces a cells snapshot with the card gone', () => {
    store.init(preseedConfig, testModel);
    store.removeCard(1, 0);
    const cell = store.getState().cells.find((c) => c.id === 1)!;
    expect(cell.cards!.map((c) => c.content)).toMatchInlineSnapshot(`
      [
        "Problem 2",
      ]
    `);
  });

  it('moveCard across cells moves content and leaves source short', () => {
    store.init(preseedConfig, testModel);
    store.moveCard(1, 0, 2, 0);
    const cells = store.getState().cells;
    expect(cells.find((c) => c.id === 1)!.cards!.map((c) => c.content))
      .toMatchInlineSnapshot(`
      [
        "Problem 2",
      ]
    `);
    expect(cells.find((c) => c.id === 2)!.cards!.map((c) => c.content))
      .toMatchInlineSnapshot(`
      [
        "Problem 1",
        "Solution 1",
      ]
    `);
  });

  it('clearAll produces a cells snapshot with all cards removed and scores zeroed', () => {
    store.init(preseedConfig, testModel);
    store.clearAll();
    const cells = store.getState().cells;
    expect(cells.every((c) => (c.cards ?? []).length === 0)).toBe(true);
    // Scored cells in preseed reset to 0; non-scored stay undefined
    const scoredCell = cells.find(
      (_c, i) => preseedConfig.canvas[i]?.score === 'yes',
    );
    expect(scoredCell?.score).toBe(0);
  });

  it('changeType rebuilds cells to match the new config while preserving cards by position', () => {
    const lean = loadFixture<CanvasConfig>('public/conf/leancanvas.json');
    store.init(preseedConfig, testModel);
    const cell0Before = store.getState().cells[0]!.cards;
    store.changeType(lean);
    const s = store.getState();
    expect(s.cells).toHaveLength(lean.canvas.length);
    expect(s.cells[0]!.cards).toEqual(cell0Before);
    expect(s.meta.canvas).toBe(lean.meta.canvas);
  });
});
