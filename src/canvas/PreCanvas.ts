import { app } from '../context';
import type { Meta } from '../types/canvas';
import { createElement } from '../util/dom';
import { makeEditable } from '../util/editable';
import { convertBR, convertNL, sanitize } from '../util/sanitize';

export class PreCanvas {
  title: string;
  description: string | undefined;
  canvas: string;
  display: boolean;

  constructor(data: Meta, display = false) {
    this.title = data.title;
    this.description = data.description;
    this.canvas = data.canvas;
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

  toJSON(): { title: string; description: string | undefined; canvas: string } {
    return { title: this.title, description: this.description, canvas: this.canvas };
  }
}
