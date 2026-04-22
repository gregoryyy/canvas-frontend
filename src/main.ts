/* copyright 2025 Unlost GmbH. All rights reserved. */

import { Application, Controls, Settings } from './app';
import { app, setApp, setConf, setCtl } from './context';
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
      const cfg = config as CanvasConfig;
      const list = configList as { name: string; file: string }[];
      const newConf = Settings.create(cfg);
      newConf.canvasTypes = list.map((type) => [type.name, type.file]);
      setConf(newConf);
      setApp(Application.create(cfg, modelData as CanvasState));
      setCtl(Controls.create());
      console.log('Canvas started');
    })
    .catch((error) => {
      console.error('Error during the canvas setup:', error);
    });
});

// auto-save on page unload when a canvas title is set
window.addEventListener('beforeunload', () => {
  if (app?.meta?.title) {
    try {
      app.saveToLs(app.meta.title, true);
    } catch {
      /* silent */
    }
  }
});

// Ctrl+S / Cmd+S: save to localStorage
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    if (app) app.saveToLs();
  }
});
