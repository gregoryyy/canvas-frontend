import { app } from '../../main';
import type { CanvasState } from '../types/canvas';
import type { CanvasConfig } from '../types/config';
import { evaluateFormula } from '../scoring/formula';
import { createElement } from '../util/dom';
import { makeEditable } from '../util/editable';
import { convertBR, convertNL, sanitize } from '../util/sanitize';
import { Canvas } from './Canvas';

export class PostCanvas {
  title: string;
  content: string | undefined;
  canvas: Canvas;
  total: string | undefined;
  scores: Record<string, string> | undefined;
  scoreSpan: HTMLElement | null;
  display: boolean;

  constructor(
    canvas: Canvas,
    structure: CanvasConfig,
    content: CanvasState,
    display = false,
  ) {
    this.title = 'Analysis';
    this.content = content.analysis?.content;
    this.canvas = canvas;
    this.total = structure.scoring[0]?.total;
    this.scores = structure.scoring[0]?.scores;
    this.scoreSpan = document.querySelector<HTMLElement>('span.score-total');
    this.display = display;
  }

  update(): void {
    const metaDiv = document.getElementById('postcanvas')!;
    app.analysis.title = sanitize(metaDiv.querySelector('h3')!.textContent ?? '');
    app.analysis.description = sanitize(convertBR(metaDiv.querySelector('p')!.innerHTML));
  }

  render(): void {
    if (!this.display) return;
    const anaDiv = createElement('div', { id: 'postcanvas' });
    document.getElementById('content')!.appendChild(anaDiv);
    const cellTitle = createElement('div', { class: 'cell-title-container' });
    const titleH3 = createElement('h3', { class: 'cell-title' }, this.title);
    cellTitle.appendChild(titleH3);
    anaDiv.appendChild(cellTitle);

    if (this.total) {
      this.scoreSpan = this.addScorer(cellTitle);
      this.computeScore();
    }

    const paragraph = createElement('p', {}, this.content);
    makeEditable(paragraph, () => {
      app.analysis.content = sanitize(convertBR(paragraph.innerHTML));
    });
    anaDiv.appendChild(paragraph);
  }

  rerender(): void {
    if (this.display)
      document.querySelector(`#postcanvas p`)!.innerHTML = convertNL(this.content ?? '');
    if (this.total) this.computeScore();
  }

  addScorer(parentElement: HTMLElement): HTMLElement {
    parentElement.appendChild(createElement('h3', { class: 'score-total-label' }, 'Score'));
    const score = createElement('span', { class: 'score-total' }, (0).toFixed(1));
    parentElement.appendChild(score);
    return score;
  }

  computeScore(): number {
    if (!this.scores || !this.total) return 0;

    // sub-scores from config
    const context: Record<string, number> = {};
    for (const [name, formula] of Object.entries(this.scores)) {
      context[name] = evaluateFormula(formula, context);
    }

    const total = evaluateFormula(this.total, context);
    this.scoreSpan!.textContent = total.toFixed(1);

    return total;
  }

  clear(): void {
    this.content = 'Analysis';
    this.rerender();
  }

  toJSON(): { content: string | undefined } {
    return { content: this.content };
  }
}
