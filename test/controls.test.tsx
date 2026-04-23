import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Controls } from '../src/components/Controls';
import * as store from '../src/state/store';
import type { CanvasState } from '../src/types/canvas';
import type { CanvasConfig } from '../src/types/config';
import { installFetchMock, installLocalStorageStub, loadFixture } from './helpers';

const preseedConfig = loadFixture<CanvasConfig>('public/conf/preseed.json');
const testModel = loadFixture<CanvasState>('public/models/test.json');

function withFilemenu(value: 'yes' | 'no'): CanvasConfig {
  return {
    ...preseedConfig,
    settings: {
      ...preseedConfig.settings,
      localstorage: { ...preseedConfig.settings.localstorage, filemenu: value },
    },
  };
}

function initStore(): void {
  store.init(preseedConfig, testModel);
  store.setCanvasTypes([
    ['Preseed Canvas', 'preseed'],
    ['Business Model Canvas', 'bmcanvas'],
    ['Lean Canvas', 'leancanvas'],
  ]);
}

function setup(configOverride?: CanvasConfig): HTMLElement {
  initStore();
  return render(<Controls config={configOverride ?? preseedConfig} />).container;
}

describe('Controls — direct actions', () => {
  beforeEach(() => {
    installLocalStorageStub();
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('Clear Canvas: two clicks empty every cell', () => {
    const container = setup();
    const btn = container.querySelector('#cvclear') as HTMLElement;
    fireEvent.click(btn);
    fireEvent.click(btn);
    const cells = store.getState().cells;
    expect(cells.every((c) => (c.cards ?? []).length === 0)).toBe(true);
  });

  it('Save to LS: two clicks write the current state under meta.title', () => {
    const container = setup();
    const btn = container.querySelector('#lssave') as HTMLElement;
    fireEvent.click(btn);
    fireEvent.click(btn);
    const raw = localStorage.getItem('preseedcanvas');
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!) as Record<string, unknown>;
    expect(Object.keys(parsed)).toContain(store.getState().meta.title);
  });

  it('Clear LS: two clicks wipe the preseedcanvas key', () => {
    setup();
    localStorage.setItem('preseedcanvas', JSON.stringify({ foo: { x: 1 } }));
    const container = document.body;
    const btn = container.querySelector('#lsclear') as HTMLElement;
    fireEvent.click(btn);
    fireEvent.click(btn);
    expect(localStorage.getItem('preseedcanvas')).toBeNull();
  });

  it('Single click arms but does not fire (ConfirmStep semantics)', () => {
    const container = setup();
    const btn = container.querySelector('#cvclear') as HTMLElement;
    fireEvent.click(btn);
    // Only primed — state still has cards
    const cells = store.getState().cells;
    expect(cells.some((c) => (c.cards ?? []).length > 0)).toBe(true);
    expect(btn.textContent).toBe('Clear Canvas?');
  });
});

describe('Controls — Canvas Type menu', () => {
  beforeEach(() => {
    installLocalStorageStub();
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('opens and lists canvas-type entries from the store', () => {
    const container = setup();
    const btn = container.querySelector('#chtype') as HTMLElement;
    fireEvent.click(btn);
    const menu = document.body.querySelector('.overlay-menu');
    expect(menu).toBeTruthy();
    const labels = Array.from(menu!.querySelectorAll('.overlay-menu-item')).map(
      (n) => n.textContent,
    );
    expect(labels).toContain('Preseed Canvas');
    expect(labels).toContain('Business Model Canvas');
  });

  it('toggles closed on a second click of the trigger', () => {
    const container = setup();
    const btn = container.querySelector('#chtype') as HTMLElement;
    fireEvent.click(btn);
    expect(document.body.querySelector('.overlay-menu')).toBeTruthy();
    fireEvent.click(btn);
    expect(document.body.querySelector('.overlay-menu')).toBeNull();
  });

  it('selecting an item dispatches changeType and closes the menu', async () => {
    installFetchMock();
    const container = setup();
    fireEvent.click(container.querySelector('#chtype')!);
    const item = Array.from(document.body.querySelectorAll<HTMLElement>('.overlay-menu-item')).find(
      (n) => n.textContent === 'Business Model Canvas',
    )!;
    fireEvent.click(item);
    // fetch mock is async — wait a tick
    await new Promise((r) => setTimeout(r, 20));
    expect(document.body.querySelector('.overlay-menu')).toBeNull();
    expect(store.getState().config?.meta.canvas).toBe('bmcanvas');
  });
});

describe('Controls — Load from LS menu', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    installLocalStorageStub();
    localStorage.setItem(
      'preseedcanvas',
      JSON.stringify({
        'Example Startup': testModel,
        'Other Startup': testModel,
      }),
    );
  });

  it('lists every saved canvas name', () => {
    setup();
    fireEvent.click(document.body.querySelector('#lsload')!);
    const labels = Array.from(
      document.body.querySelectorAll<HTMLElement>('.overlay-menu-item'),
    ).map((n) => n.textContent);
    expect(labels.join(' ')).toContain('Example Startup');
    expect(labels.join(' ')).toContain('Other Startup');
  });

  it('per-item Delete removes the entry after confirmation', () => {
    setup();
    fireEvent.click(document.body.querySelector('#lsload')!);
    const deletes = Array.from(
      document.body.querySelectorAll<HTMLElement>('.overlay-menu-item-delete'),
    );
    // two clicks on first Delete = confirm
    fireEvent.click(deletes[0]!);
    fireEvent.click(deletes[0]!);
    const stored = JSON.parse(localStorage.getItem('preseedcanvas')!) as Record<string, unknown>;
    // One of the two entries removed
    expect(Object.keys(stored)).toHaveLength(1);
  });
});

describe('Controls — filemenu toggle', () => {
  beforeEach(() => {
    installLocalStorageStub();
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('omits Export/Import LS + file input when filemenu="no"', () => {
    const container = setup(withFilemenu('no'));
    expect(container.querySelector('#lsdown')).toBeNull();
    expect(container.querySelector('#lsup')).toBeNull();
    expect(container.querySelector('#lsFileInput')).toBeNull();
  });

  it('renders Export/Import LS + hidden file input when filemenu="yes"', () => {
    const container = setup(withFilemenu('yes'));
    expect(container.querySelector('#lsdown')).toBeTruthy();
    expect(container.querySelector('#lsup')).toBeTruthy();
    const fileInput = container.querySelector<HTMLInputElement>('#lsFileInput');
    expect(fileInput).toBeTruthy();
    expect(fileInput!.type).toBe('file');
  });
});
