import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../src/context';
import { bootstrapApp, flush, installFetchMock } from './helpers';

describe('Application loading and saving', () => {
  beforeEach(() => {
    installFetchMock();
    bootstrapApp({ model: 'test', config: 'preseed' });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads the state correctly for model=test', () => {
    expect(app).toBeDefined();
    expect(app.meta.title).toBe('Example Startup');
    const sample = app.canvas.cells[4];
    expect(sample.cards[1].content).toBe('GTM Strategy 2');
    expect(sample.cardElems().length).toBe(2);
  });

  it('saves to local storage and loads correctly', async () => {
    app.saveToLs();
    app.clear();
    const beforeReload = app.canvas.cells[4];
    expect(beforeReload.cards.length).toBe(0);
    expect(beforeReload.cardElems().length).toBe(0);

    // Title passed explicitly: clear() resets meta.title to 'Company name',
    // so loadFromLs() with no arg wouldn't find the saved record.
    app.loadFromLs('Example Startup');
    await flush();

    // loadFromLs calls Application.create internally, which re-populates
    // context.app. The live-bound `app` import reflects the new instance.
    expect(app.meta.title).toBe('Example Startup');
    const sample = app.canvas.cells[4];
    expect(sample.cards[1].content).toBe('GTM Strategy 2');
    expect(sample.cardElems().length).toBe(2);
  });
});
