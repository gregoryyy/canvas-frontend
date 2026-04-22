import { app } from '../../main';
import type { Cell as CellData, Meta } from '../types/canvas';
import { createElement } from '../util/dom';
import { makeEditable } from '../util/editable';
import { convertBR, convertNL, sanitize } from '../util/sanitize';

// Source data for PreCanvas: the `meta` object from a loaded model. `canvas`
// here is the canvas-type identifier string (e.g. "preseed"), not an array.
interface PreCanvasData extends Meta {
  canvas: string;
}

// When PreCanvas is constructed from a Canvas instance's state (legacy path in
// pre-migration code), data may also carry `canvas` as a Cell[]. Retained for
// compatibility with the shape produced by Application.toJSON.
type PreCanvasCtorData = (PreCanvasData & { canvas?: unknown })
  | (Meta & { canvas?: unknown | CellData[] });

export class PreCanvas {
  title: string;
  description: string | undefined;
  canvas: unknown;
  display: boolean;

  constructor(data: PreCanvasCtorData, display = false) {
    this.title = data.title;
    this.description = data.description;
    this.canvas = (data as { canvas?: unknown }).canvas;
    this.display = display;
  }

  update(): void {
    const metaDiv = document.getElementById('precanvas')!;
    app.meta.title = sanitize(metaDiv.querySelector('h2')!.textContent ?? '');
    app.meta.description = sanitize(convertBR(metaDiv.querySelector('p')!.innerHTML));
  }

  render(): void {
    const metaDiv = createElement('div', { id: 'precanvas' });
    document.getElementById('content')!.appendChild(metaDiv);
    const title = createElement('h2', {}, this.title);
    makeEditable(title, () => {
      app.meta.title = sanitize(title.textContent ?? '');
    });
    metaDiv.appendChild(title);
    if (this.display) {
      const description = createElement('p', {}, this.description);
      makeEditable(description, () => {
        app.meta.description = sanitize(convertBR(description.innerHTML));
      });
      metaDiv.appendChild(description);
    }
  }

  rerender(): void {
    document.querySelector(`#precanvas h2`)!.textContent = this.title;
    if (this.display)
      document.querySelector(`#precanvas p`)!.innerHTML = convertNL(this.description ?? '');
  }

  clear(): void {
    this.title = 'Company name';
    this.description = 'Description';
    this.rerender();
  }

  toJSON(): { title: string; description: string | undefined; canvas: unknown } {
    return { title: this.title, description: this.description, canvas: this.canvas };
  }
}
