import { act } from '@testing-library/react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CanvasArea, ControlsArea } from '../src/components/App';
import { init, setCanvasTypes } from '../src/state/store';
import type { CanvasState } from '../src/types/canvas';
import type { CanvasConfig } from '../src/types/config';
import { loadJson } from '../src/util/io';
import { installFetchMock, installLocalStorageStub } from './helpers';

describe('main.tsx bootstrap simulation', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('populates #content and #controls with rendered children', async () => {
    installLocalStorageStub();
    installFetchMock();
    document.body.innerHTML =
      '<div id="content"></div><span id="controls"></span>';

    // Simulate the bootstrap in main.tsx
    const modelData = (await loadJson('models/template.json')) as CanvasState;
    const config = (await loadJson(`conf/${modelData.meta.canvas}.json`)) as CanvasConfig;
    const configList = (await loadJson('conf/configs.json')) as { name: string; file: string }[];

    act(() => {
      setCanvasTypes(configList.map((t) => [t.name, t.file]));
      init(config, modelData);
      createRoot(document.getElementById('content')!).render(<CanvasArea />);
      createRoot(document.getElementById('controls')!).render(<ControlsArea />);
    });

    // Wait a tick for React 19's render to flush
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    const content = document.getElementById('content')!;
    const controls = document.getElementById('controls')!;

    expect(content.querySelector('#precanvas')).toBeTruthy();
    expect(content.querySelector('#canvas')).toBeTruthy();
    expect(content.querySelectorAll('.cell').length).toBeGreaterThan(0);
    expect(content.querySelector('.signature')).toBeTruthy();
    expect(controls.querySelectorAll('.control').length).toBeGreaterThan(0);
  });
});
