import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from '../src/components/App';
import { Canvas } from '../src/components/Canvas';
import { Card } from '../src/components/Card';
import { Cell } from '../src/components/Cell';
import { Controls } from '../src/components/Controls';
import { PostCanvas } from '../src/components/PostCanvas';
import { PreCanvas } from '../src/components/PreCanvas';
import * as store from '../src/state/store';
import type { CanvasState } from '../src/types/canvas';
import type { CanvasConfig } from '../src/types/config';
import { installLocalStorageStub, loadFixture } from './helpers';

const preseedConfig = loadFixture<CanvasConfig>('public/conf/preseed.json');
const bmConfig = loadFixture<CanvasConfig>('public/conf/bmcanvas.json');
const testModel = loadFixture<CanvasState>('public/models/test.json');

describe('Card', () => {
  afterEach(cleanup);

  it('renders content in a .card div', () => {
    const { container } = render(<Card card={{ content: 'hello world' }} />);
    const div = container.querySelector('div.card')!;
    expect(div.textContent).toBe('hello world');
    expect(div.className).toBe('card');
  });

  it('adds the type class when type is set', () => {
    const { container } = render(<Card card={{ content: 'x', type: 'query' }} />);
    expect(container.querySelector('div.card')!.className).toBe('card query');
  });

  it('converts \\n in content to <br>', () => {
    const { container } = render(<Card card={{ content: 'line1\nline2' }} />);
    expect(container.querySelector('div.card')!.innerHTML).toBe('line1<br>line2');
  });
});

describe('Cell', () => {
  afterEach(cleanup);

  const structure = preseedConfig.canvas[0]!;
  const cellData = { id: 1, cards: [{ content: 'c1' }, { content: 'c2' }], score: 3 };

  it('renders title, cards, and id attributes', () => {
    const { container } = render(<Cell cell={cellData} structure={structure} />);
    expect(container.querySelector('.cell-title')!.textContent).toBe(structure.title);
    expect(container.querySelectorAll('.cell-card-container > .card')).toHaveLength(2);
    const cell = container.querySelector('.cell') as HTMLElement;
    expect(cell.id).toBe(String(structure.id));
    expect(cell.dataset.index).toBe(String(cellData.id));
  });

  it('renders the scoring dropdown when the structure has score="yes"', () => {
    const { container } = render(<Cell cell={cellData} structure={structure} />);
    const select = container.querySelector<HTMLSelectElement>('select.scoring-dropdown')!;
    expect(select).toBeTruthy();
    expect(select.value).toBe('3');
    expect(select.id).toBe(`score${structure.id}`);
    expect(select.querySelectorAll('option')).toHaveLength(6);
  });

  it('omits the dropdown when the structure has score="no"', () => {
    const noScoreStructure = { ...structure, score: 'no' as const };
    const { container } = render(<Cell cell={cellData} structure={noScoreStructure} />);
    expect(container.querySelector('select.scoring-dropdown')).toBeNull();
  });

  it('renders the help overlay with subtitle + description', () => {
    const { container } = render(<Cell cell={cellData} structure={structure} />);
    const help = container.querySelector('.hover-help')!;
    expect(help.querySelector('h4')!.textContent).toBe(structure.subtitle);
    expect(help.querySelector('p')!.innerHTML).toBe(structure.description);
  });

  it('toggles the help overlay on dblclick of the title (M4 wiring)', () => {
    const { container } = render(<Cell cell={cellData} structure={structure} />);
    const title = container.querySelector<HTMLElement>('.cell-title')!;
    const help = container.querySelector<HTMLDivElement>('.hover-help')!;
    expect(help.style.display).toBe('none');
    fireEvent.doubleClick(title);
    expect(help.style.display).toBe('block');
    fireEvent.doubleClick(title);
    expect(help.style.display).toBe('none');
  });
});

describe('Canvas', () => {
  afterEach(cleanup);

  it('renders one Cell per config entry with the layout canvasclass', () => {
    const cells = preseedConfig.canvas.map((c) => ({ id: c.id }));
    const { container } = render(<Canvas cells={cells} config={preseedConfig} />);
    const root = container.querySelector('#canvas') as HTMLElement;
    expect(root.className).toBe(preseedConfig.settings.layout.canvasclass);
    expect(container.querySelectorAll('.cell')).toHaveLength(preseedConfig.canvas.length);
  });
});

describe('PreCanvas', () => {
  afterEach(cleanup);

  const meta = {
    title: 'Hello',
    description: 'line1\nline2',
    canvas: 'preseed',
    version: '1',
    date: '20260101',
  };

  it('always renders the title', () => {
    const { container } = render(<PreCanvas meta={meta} display={false} />);
    expect(container.querySelector('#precanvas h2')!.textContent).toBe('Hello');
  });

  it('renders the description when display=true', () => {
    const { container } = render(<PreCanvas meta={meta} display />);
    expect(container.querySelector('#precanvas p')!.innerHTML).toBe('line1<br>line2');
  });

  it('omits the description when display=false', () => {
    const { container } = render(<PreCanvas meta={meta} display={false} />);
    expect(container.querySelector('#precanvas p')).toBeNull();
  });
});

describe('PostCanvas', () => {
  afterEach(cleanup);

  it('returns null when display=false', () => {
    const { container } = render(
      <PostCanvas analysis={{ content: 'a' }} config={preseedConfig} display={false} />,
    );
    expect(container.querySelector('#postcanvas')).toBeNull();
  });

  it('renders the score span when scoring is configured', () => {
    const { container } = render(
      <PostCanvas analysis={{ content: 'a' }} config={preseedConfig} display />,
    );
    expect(container.querySelector('.score-total')!.textContent).toBe('0.0');
  });

  it('omits the score span for configs without scoring', () => {
    const { container } = render(
      <PostCanvas analysis={{ content: 'a' }} config={bmConfig} display />,
    );
    expect(container.querySelector('.score-total')).toBeNull();
  });
});

describe('Controls', () => {
  afterEach(cleanup);

  const withFilemenu = (value: 'yes' | 'no'): CanvasConfig => ({
    ...preseedConfig,
    settings: {
      ...preseedConfig.settings,
      localstorage: { ...preseedConfig.settings.localstorage, filemenu: value },
    },
  });

  it('renders the default button set when filemenu="no"', () => {
    const { container } = render(<Controls config={withFilemenu('no')} />);
    const ids = Array.from(container.querySelectorAll('.control')).map((b) => b.id);
    expect(ids).toEqual(['cvclear', 'chtype', 'cvsvg', 'lsload', 'lssave', 'lsclear']);
    expect(container.querySelector('#lsFileInput')).toBeNull();
  });

  it('adds Export/Import LS buttons when filemenu="yes"', () => {
    const { container } = render(<Controls config={withFilemenu('yes')} />);
    const ids = Array.from(container.querySelectorAll('.control')).map((b) => b.id);
    expect(ids).toContain('lsdown');
    expect(ids).toContain('lsup');
    expect(container.querySelector('#lsFileInput')).toBeTruthy();
  });
});

describe('App', () => {
  beforeEach(() => {
    installLocalStorageStub();
    store.init(preseedConfig, testModel);
  });
  afterEach(cleanup);

  it('renders PreCanvas, Canvas, PostCanvas, and Controls from store state', () => {
    const { container } = render(<App />);
    expect(container.querySelector('#precanvas h2')!.textContent).toBe('Example Startup');
    expect(container.querySelector('#canvas')!.className).toBe(
      preseedConfig.settings.layout.canvasclass,
    );
    expect(container.querySelectorAll('.cell')).toHaveLength(preseedConfig.canvas.length);
    expect(container.querySelector('#postcanvas')).toBeTruthy();
    expect(container.querySelectorAll('.control').length).toBeGreaterThan(0);
  });

  it('re-renders when the store mutates', () => {
    const { container } = render(<App />);
    const cellId = preseedConfig.canvas[0]!.id;
    const before = container.querySelectorAll(`.cell[data-index='${cellId}'] .card`).length;
    act(() => {
      store.addCard(cellId, 'injected by store');
    });
    const after = container.querySelectorAll(`.cell[data-index='${cellId}'] .card`).length;
    expect(after).toBe(before + 1);
  });
});
