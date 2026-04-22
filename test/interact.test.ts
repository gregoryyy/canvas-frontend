import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bootstrapApp, flush, installFetchMock } from './helpers';

function dispatchMouse(elem: Element, type: string): void {
  elem.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: false }));
}

describe('UI interactions', () => {
  beforeEach(() => {
    installFetchMock();
    bootstrapApp({ model: 'test', config: 'preseed' });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('toggles the help overlay on double-click of a cell title', async () => {
    const cellIndex = 4;
    const titleElem = document.querySelector(
      `.cell[data-index='${cellIndex}'] .cell-title`,
    )!;
    const helpElem = document.querySelector<HTMLElement>(
      `.cell[data-index='${cellIndex}'] .hover-help`,
    )!;

    // overlay starts hidden (inline style not set → '')
    expect(helpElem.style.display).not.toBe('block');

    dispatchMouse(titleElem, 'dblclick');
    await flush();
    expect(helpElem.style.display).toBe('block');

    dispatchMouse(titleElem, 'dblclick');
    await flush();
    expect(helpElem.style.display).toBe('none');
  });

  it('updates the total score when a cell score changes', async () => {
    const cellIndex = 3; // Product Progress — has score in preseed config
    const totalElem = document.querySelector('span.score-total')!;
    const totalPre = parseFloat(totalElem.textContent ?? '0');

    const scoreElem = document.querySelector<HTMLSelectElement>(
      `.cell[data-index='${cellIndex}'] select`,
    )!;
    scoreElem.value = '0';
    scoreElem.dispatchEvent(new Event('change', { bubbles: true }));
    await flush();

    const totalPost = parseFloat(totalElem.textContent ?? '0');
    expect(totalPost).toBeLessThan(totalPre);
  });
});
