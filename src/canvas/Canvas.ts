import { app, conf } from '../context';
import type { CanvasState } from '../types/canvas';
import type { CanvasConfig } from '../types/config';
import { createElement } from '../util/dom';
import { lg } from '../util/log';
import { Card } from './Card';
import { Cell } from './Cell';
import { dragState, resetDragState } from './dragState';

export class Canvas {
  cells: Cell[];

  constructor(structure: CanvasConfig, content: CanvasState) {
    lg(structure.canvas.map((cell) => cell.title));
    lg(content.canvas.map((cell) => cell.cards?.length));
    // assuming content is stored in sequence, so no need for cell ids
    this.cells = structure.canvas.map(
      (structData, index) => new Cell(index, structData, content.canvas[index] ?? []),
    );
  }

  update(): void {
    this.cells.forEach((cell) => cell.update());
  }

  updateDragDrop(): void {
    if (dragState.sourceCell === dragState.destCell) {
      if (dragState.destCardIndex === dragState.sourceCardIndex) return;
      if (dragState.destCard === dragState.sourceCard! + 1) return;
      const cell = this.cells[Number(dragState.sourceCell)]!;
      const [card] = cell.cards.splice(dragState.sourceCard!, 1);
      cell.cards.splice(dragState.destCard! - 1, 0, card!);
    } else {
      const cell = this.cells[Number(dragState.sourceCell)]!;
      const [card] = cell.cards.splice(dragState.sourceCard!, 1);
      const cell2 = this.cells[Number(dragState.destCell)]!;
      const index = dragState.destCard ? dragState.destCard - 1 : cell2.cards.length;
      cell2.cards.splice(index, 0, card!);
    }
    resetDragState();
    app.check();
    lg(app.canvas.cells.map((cell: { cards?: unknown[] }) => cell.cards?.length));
  }

  render(): void {
    const el = createElement('div', { id: 'canvas' });
    document.getElementById('content')!.appendChild(el);
    const style = conf.layout.canvasclass || '.lean-canvas';
    el.classList.add(style);
    el.innerHTML = '';
    this.cells.forEach((cell) => el.appendChild(cell.render()));
  }

  rerender(): void {
    this.cells.forEach((cell) => cell.rerender());
  }

  clear(): void {
    this.cells.forEach((cell) => cell.clear());
    Card.count = 0;
    if (app.analysis?.scores) app.analysis.computeScore();
  }

  toJSON(): Cell[] {
    return this.cells;
  }
}
