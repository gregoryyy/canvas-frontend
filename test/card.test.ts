import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Card } from '../src/canvas/Card';
import { app } from '../src/context';
import { bootstrapApp, flush, installFetchMock } from './helpers';

function dispatchMouse(elem: Element, type: string): void {
  elem.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: false }));
}

describe('Card manipulations', () => {
  beforeEach(() => {
    installFetchMock();
    bootstrapApp({ model: 'test', config: 'preseed' });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('edits a card and reflects the change in state', async () => {
    const cellIndex = 4;
    const cardPosition = 1;
    const cell = app.canvas.cells[cellIndex];
    const domIndex = cell.getCardIndex(cardPosition);
    const elem = Card.getElement(domIndex as number)!;

    dispatchMouse(elem, 'click');
    elem.textContent = elem.textContent + ' Test';
    elem.dispatchEvent(new FocusEvent('blur'));
    await flush();

    expect(cell.cards[cardPosition].content).toMatch(/.+ Test$/);
  });

  it('removes a card when its content is cleared and blurred', async () => {
    const cellIndex = 0;
    const cardPosition = 1;
    const cell = app.canvas.cells[cellIndex];

    const statePre = cell.cards.length;
    const domPre = cell.cardElems().length;
    expect(statePre).toBe(domPre);

    const domIndex = cell.getCardIndex(cardPosition);
    const elem = Card.getElement(domIndex as number)!;

    dispatchMouse(elem, 'click');
    elem.textContent = '';
    elem.dispatchEvent(new FocusEvent('blur'));
    await flush();

    expect(cell.cards.length).toBe(cell.cardElems().length);
    expect(cell.cards.length).toBe(statePre - 1);
  });

  it('adds a new card on double-click of the cell area', async () => {
    const cellIndex = 0;
    const cell = app.canvas.cells[cellIndex];
    const statePre = cell.cards.length;

    const container = cell.cardsElem()!;
    dispatchMouse(container, 'dblclick');
    await flush();

    expect(cell.cards.length).toBe(cell.cardElems().length);
    expect(cell.cards.length).toBe(statePre + 1);
  });

  it('applies a card type command (:? → query)', async () => {
    const cellIndex = 4;
    const cardPosition = 1;
    const cell = app.canvas.cells[cellIndex];
    const domIndex = cell.getCardIndex(cardPosition);
    const elem = Card.getElement(domIndex as number)!;

    dispatchMouse(elem, 'click');
    const textPre = elem.textContent!;
    elem.textContent = ':? ' + textPre;
    elem.dispatchEvent(new FocusEvent('blur'));
    await flush();

    expect(elem.classList.contains('query')).toBe(true);
    expect(elem.textContent).toBe(textPre);
    expect(cell.cards[cardPosition].content).toBe(textPre);
    expect(cell.cards[cardPosition].type).toBe('query');
  });
});
