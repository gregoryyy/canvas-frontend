import { app } from '../context';
import type { CardType } from '../types/canvas';
import { createElement } from '../util/dom';
import { makeDraggable } from '../util/dragdrop';
import { makeEditable } from '../util/editable';
import { lg } from '../util/log';
import { convertBR, convertNL, sanitize } from '../util/sanitize';
import { dragState } from './DragState';

export class Card {
  static count = 0;

  index: number;
  type: CardType | undefined;
  content: string = '';

  constructor(text: string, type: CardType | undefined = undefined) {
    this.index = Card.count++;
    this.type = type;
    this.setTypeAndContent(sanitize(text));
  }

  getElement = (): HTMLElement | null =>
    document.querySelector<HTMLElement>(`.card[data-index='${this.index}']`);

  static getElement = (index: number | string): HTMLElement | null =>
    document.querySelector<HTMLElement>(`.card[data-index='${index}']`);

  static getCellCardPos = (index: number | string): [string | null, number] => {
    const elem = Card.getElement(index) as unknown as {
      cellIndex: () => string | null;
      cardCellPos: () => number;
    };
    return [elem.cellIndex(), elem.cardCellPos()];
  };

  getParentCell = (): HTMLElement => this.getElement()!.parentElement!.parentElement!;

  cellIndex = (): string | null => this.getParentCell().getAttribute('data-index');

  cardCellPos = (): number => {
    const card = this.getElement()!;
    return Array.from(card.parentNode!.children).indexOf(card);
  };

  update(): void {
    const cardElem = this.getElement();
    if (!cardElem) return;
    this.setTypeAndContent(sanitize(convertBR(cardElem.innerHTML)));
    this.rerender();
    if (!this.content.trim())
      cardElem.dispatchEvent(
        new CustomEvent('cardDelete', { bubbles: true, detail: { index: this.index } }),
      );
    lg(app.canvas.cells.map((cell: { cards?: unknown[] }) => cell.cards?.length));
  }

  render(): HTMLElement {
    const card = createElement(
      'div',
      { class: 'card', 'data-index': this.index },
      convertNL(this.content),
      'html',
    );
    if (this.type) card.classList.add(this.type);
    makeEditable(card, this.update.bind(this) as EventListener);
    makeDraggable(
      card,
      500,
      () => {
        dragState.sourceCell = this.cellIndex()!;
        dragState.sourceCard = this.cardCellPos();
        dragState.sourceCardIndex = this.index;
      },
      () => {
        dragState.destCell = this.cellIndex()!;
        dragState.destCard = this.cardCellPos();
        dragState.destCardIndex = this.index;
        app.canvas.updateDragDrop();
      },
    );
    return card;
  }

  rerender(): void {
    const cardElem = this.getElement()!;
    lg('elem before: ' + cardElem.innerHTML);
    cardElem.innerHTML = convertNL(this.content);
    lg(this.content + ' -> ' + cardElem.innerHTML);
    cardElem.className = 'card';
    if (this.type) cardElem.classList.add(this.type);
  }

  setTypeAndContent(text: string): void {
    const cardtypes: Record<string, CardType | undefined> = {
      ':?': 'query',
      ':!': 'comment',
      ':=': 'analysis',
      ':*': 'emphasis',
      ':- ': undefined,
    };
    const trimmed = text.trim();
    for (const [cmd, type] of Object.entries(cardtypes)) {
      if (trimmed.startsWith(cmd)) {
        this.content = convertBR(trimmed.substring(2).trim());
        this.type = type;
        return;
      }
    }
    this.content = convertBR(trimmed);
  }

  toJSON(): { content: string; type: CardType | undefined } {
    return { content: this.content, type: this.type };
  }
}
