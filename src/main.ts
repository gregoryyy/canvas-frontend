/* copyright 2025 Unlost GmbH. All rights reserved. */

import { Canvas } from './canvas/Canvas';
import { Card } from './canvas/Card';
import { Cell } from './canvas/Cell';
import { PostCanvas } from './canvas/PostCanvas';
import { PreCanvas } from './canvas/PreCanvas';
import { app, conf, ctl, setApp, setConf, setCtl } from './context';
import type { CanvasState } from './types/canvas';
import type { CanvasConfig, CanvasTypesList, Settings as SettingsShape } from './types/config';
import { createElement } from './util/dom';
import { downloadLs as downloadLsHelper, loadJson, uploadLs as uploadLsHelper } from './util/io';
import { lg } from './util/log';
import { confirmStep, overlayMenu, showToast } from './util/overlay';
import { sanitizeJSON } from './util/sanitize';
import { convertDivToSvg } from './util/svg';

const defaultLsKey = 'preseedcanvas';
const defaultModel = 'template';
const configsFile = 'configs.json';
const defaultConfigName = 'preseed';
const appSignature = 'Unlost Canvas App v1.3.5';

interface Renderable {
  update(): void;
  render(): void;
  rerender(): void;
  clear(): void;
}

type ButtonDef = [id: string, label: string, handler: (event: Event) => void];

// ---- bootstrap -------------------------------------------------------------

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

// ---- Settings --------------------------------------------------------------

class Settings {
  canvasd: SettingsShape['canvasd'];
  localstorage: SettingsShape['localstorage'];
  layout: SettingsShape['layout'];
  canvasTypes?: CanvasTypesList;

  constructor(settings: SettingsShape) {
    this.canvasd = settings.canvasd;
    this.localstorage = settings.localstorage;
    this.layout = settings.layout;
  }

  static create(structure: { settings: SettingsShape }): Settings {
    return conf || new Settings(structure.settings);
  }
}

// ---- Application -----------------------------------------------------------
//
// renderable lifecycle: update() syncs DOM → state, render() builds the
// initial DOM, rerender() syncs state → DOM, clear() resets to an empty canvas.

class Application {
  meta: PreCanvas;
  canvas: Canvas;
  analysis: PostCanvas;
  renderables: Renderable[];
  structure?: CanvasConfig;

  constructor(meta: PreCanvas, canvas: Canvas, analysis: PostCanvas) {
    this.meta = meta;
    this.canvas = canvas;
    this.analysis = analysis;
    this.renderables = [meta, canvas, analysis].filter(Boolean);
  }

  static create(structure: CanvasConfig, content: CanvasState): Application {
    // meta always stored even if not displayed
    Card.count = 0;
    const meta = new PreCanvas(content.meta, conf.layout.precanvas === 'yes');
    const canvas = new Canvas(structure, content);
    const analysis = new PostCanvas(
      canvas,
      structure,
      content,
      conf.layout.postcanvas === 'yes',
    );
    const newApp = new Application(meta, canvas, analysis);
    // enforce canvas-type identifier from config
    newApp.meta.canvas = structure.meta.canvas;
    newApp.render();
    if (newApp.analysis.display && analysis.total) {
      document.addEventListener('scoreChanged', () => analysis.computeScore());
    }
    newApp.check();
    return newApp;
  }

  restructure(structure: CanvasConfig): void {
    const elem = document.getElementById('content')!;
    lg(structure.canvas.map((cell) => cell.title));
    lg(this.canvas.cells.map((cell) => cell.cards?.length));
    elem.innerHTML = '';
    this.structure = structure;
    this.meta.canvas = structure.meta.canvas;

    this.meta.display = conf.layout.precanvas === 'yes';
    if (!this.meta.display) this.meta.description = undefined;
    else this.meta.description ??= 'Description...';

    this.analysis.display = conf.layout.postcanvas === 'yes';
    if (!this.analysis.display) this.analysis.content = undefined;
    else this.analysis.content ??= 'Analysis...';

    this.analysis.total = structure.scoring[0]?.total;
    this.analysis.scores = structure.scoring[0]?.scores;
    this.canvas.cells = structure.canvas.map(
      (structData, index) => new Cell(index, structData, this.canvas.cells[index] ?? []),
    );
    this.render();
    lg(this.canvas.cells.map((cell) => cell.cards?.length));
  }

  update(): void {
    this.renderables.forEach((renderable) => renderable.update());
  }

  render(): void {
    this.renderables.forEach((renderable) => renderable.render());
    this.renderSignature();
  }

  renderSignature(): void {
    const content = document.getElementById('content')!;
    const sig = createElement('div', { class: 'signature' });
    content.appendChild(sig);

    sig.appendChild(
      createElement(
        'div',
        { class: 'canvastype' },
        conf.canvasTypes!.find(
          ([_name, file]: [string, string]) => file === this.meta.canvas,
        )![0],
      ),
    );
    sig.appendChild(createElement('div', { class: 'canvassource' }, appSignature));
  }

  rerender(): void {
    this.renderables.forEach((renderable) => renderable.rerender());
  }

  clear(): void {
    this.renderables.forEach((renderable) => renderable.clear());
  }

  saveToLs(_title: string = this.meta.title, silent = false): void {
    this.check();
    const canvases = JSON.parse(localStorage.getItem(defaultLsKey) ?? 'null') || {};
    canvases[this.meta.title] = this.toJSON();
    localStorage.setItem(defaultLsKey, JSON.stringify(canvases));
    if (!silent) showToast('Saved');
  }

  loadFromLs(title?: string): void {
    const resolved = title || this.meta.title;
    const storedCanvases = localStorage.getItem(defaultLsKey);
    if (!storedCanvases) return;
    const canvases = JSON.parse(storedCanvases);
    if (!canvases[resolved]) return;
    const content = sanitizeJSON(canvases[resolved]) as CanvasState;
    fetch(`conf/${content.meta?.canvas}.json`)
      .then((response) => response.json())
      .then(sanitizeJSON)
      .then((config) => {
        document.getElementById('content')!.innerHTML = '';
        const temp = conf.canvasTypes;
        const cfg = config as CanvasConfig;
        const newConf = new Settings(cfg.settings);
        newConf.canvasTypes = temp;
        setConf(newConf);
        setApp(Application.create(cfg, content));
        // live-bound app now reflects the new instance
        app.check();
      });
  }

  downloadLs(): void {
    downloadLsHelper(defaultLsKey);
  }

  delFromLs(title: string): void {
    const storedCanvases = localStorage.getItem(defaultLsKey);
    if (!storedCanvases) return;
    const canvases = JSON.parse(storedCanvases);
    delete canvases[title];
    localStorage.setItem(defaultLsKey, JSON.stringify(canvases));
  }

  getCanvasNames(): string[] {
    const canvases = JSON.parse(localStorage.getItem(defaultLsKey) ?? 'null') || {};
    return Object.keys(canvases).filter((key) => canvases[key] != null);
  }

  changeType(type: string): void {
    loadJson(`conf/${type}.json`)
      .then((config) => {
        const cfg = config as CanvasConfig;
        const temp = conf.canvasTypes;
        const newConf = new Settings(cfg.settings);
        newConf.canvasTypes = temp;
        setConf(newConf);
        this.restructure(cfg);
        this.check();
      })
      .catch((error) => console.error('Error loading file:', error));
  }

  static clearLocalStorage(): void {
    localStorage.removeItem(defaultLsKey);
  }

  toJSON(): { meta: PreCanvas; canvas: Canvas; analysis: PostCanvas } {
    return { meta: this.meta, canvas: this.canvas, analysis: this.analysis };
  }

  check(): void {
    this.canvas.cells.forEach((cell) => cell.check());
  }
}

// ---- Controls --------------------------------------------------------------

class Controls {
  static create(): Controls {
    if (ctl) return ctl;
    const newCtl = new Controls();
    newCtl.render();
    return newCtl;
  }

  render(): void {
    const ctlElem = document.getElementById('controls')!;
    const convertCanvasToSvg = (): void => convertDivToSvg('content', 'canvas.svg');

    const buttons: ButtonDef[] = [
      ['cvclear', 'Clear Canvas', confirmCanvasClear],
      ['chtype', 'Canvas Type', typeMenu],
      ['cvsvg', 'Export SVG', confirmCanvasSvg],
      ['lsload', 'Load from LS', loadMenu],
      ['lssave', 'Save to LS', confirmCanvasSave],
      ['lsclear', 'Clear LS', confirmLsClear],
    ];

    if (conf.localstorage.filemenu === 'yes') {
      buttons.push(['lsdown', 'Export LS', confirmDownloadLs]);
      buttons.push(['lsup', 'Import LS', uploadLsFile]);
      const lsFileInput = createElement('input', {
        type: 'file',
        id: 'lsFileInput',
        style: 'display: none;',
      });
      lsFileInput.addEventListener('change', (event) => uploadLsHelper(event, defaultLsKey));
      ctlElem.appendChild(lsFileInput);
    }

    buttons.forEach((button) => {
      const btn = createElement('div', { id: button[0], class: 'control' }, button[1]);
      ctlElem.appendChild(btn);
      btn.addEventListener('click', button[2]);
      btn.addEventListener('click', () => {
        btn.classList.add('clicked');
        setTimeout(() => btn.classList.remove('clicked'), 500);
      });
    });

    function typeMenu(event: Event): void {
      overlayMenu(
        event.target as HTMLElement,
        'Select canvas type:',
        conf.canvasTypes!,
        app.changeType.bind(app),
      );
    }

    function loadMenu(event: Event): void {
      overlayMenu(
        event.target as HTMLElement,
        'Load canvas:',
        app.getCanvasNames(),
        app.loadFromLs.bind(app),
        app.delFromLs.bind(app),
      );
    }

    function confirmCanvasSvg(event: Event): void {
      confirmStep(event.target as HTMLElement, () => {
        convertCanvasToSvg();
        showToast('SVG exported');
      });
    }

    function confirmCanvasSave(event: Event): void {
      confirmStep(event.target as HTMLElement, app.saveToLs.bind(app));
    }

    function confirmCanvasClear(event: Event): void {
      confirmStep(event.target as HTMLElement, () => {
        app.clear();
        showToast('Canvas cleared');
      });
    }

    function confirmLsClear(event: Event): void {
      confirmStep(event.target as HTMLElement, () => {
        Application.clearLocalStorage();
        showToast('Local storage cleared');
      });
    }

    function confirmDownloadLs(event: Event): void {
      confirmStep(event.target as HTMLElement, () => {
        app.downloadLs();
        showToast('Exported');
      });
    }

    function uploadLsFile(_event: Event): void {
      document.getElementById('lsFileInput')!.click();
    }
  }
}
