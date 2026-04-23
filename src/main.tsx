/* copyright 2025 Unlost GmbH. All rights reserved. */

import { createRoot } from 'react-dom/client';
import { CanvasArea, ControlsArea } from './components/App';
import { enablePersistence } from './state/persistence';
import { init, setCanvasTypes } from './state/store';
import type { CanvasState } from './types/canvas';
import type { CanvasConfig } from './types/config';
import { loadJson } from './util/io';

const defaultModel = 'template';
const configsFile = 'configs.json';
const defaultConfigName = 'preseed';

document.addEventListener('DOMContentLoaded', () => {
  const param = (key: string): string | null =>
    new URLSearchParams(window.location.search).get(key);
  const modelName = param('model') || defaultModel;

  loadJson(`models/${modelName}.json`)
    .then((modelData) => {
      const md = modelData as CanvasState;
      const configName = param('config') || md.meta.canvas || defaultConfigName;
      return Promise.all([
        modelData,
        loadJson(`conf/${configName}.json`),
        loadJson(`conf/${configsFile}`),
      ]);
    })
    .then(([modelData, config, configList]) => {
      const list = configList as { name: string; file: string }[];
      setCanvasTypes(list.map((t) => [t.name, t.file]));
      init(config as CanvasConfig, modelData as CanvasState);

      const contentEl = document.getElementById('content');
      const controlsEl = document.getElementById('controls');
      if (contentEl) createRoot(contentEl).render(<CanvasArea />);
      if (controlsEl) createRoot(controlsEl).render(<ControlsArea />);

      enablePersistence();
      console.log('Canvas started');
    })
    .catch((error) => {
      console.error('Error during the canvas setup:', error);
    });
});
