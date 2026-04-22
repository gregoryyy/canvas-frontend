import { app } from '../context';
import type { CardType } from '../types/canvas';
import type { CellStructure } from '../types/config';
import { createElement } from '../util/dom';
import { makeDroppable } from '../util/dragdrop';
import { lg } from '../util/log';
import { addLongPressListener } from '../util/longpress';
import { decodeHtml, sanitize, trimPluralS } from '../util/sanitize';
import { Card } from './Card';
import { dragState } from './DragState';

// Score is typed as string | number because the legacy runtime assigns both:
// the initial load assigns a number (from JSON), and the dropdown `change`
// handler assigns the raw <select>.value string. Serialization and DOM reads
// accept both. Narrowed in phase 2.
type Score = string | number | undefined;

// Shape the Cell constructor accepts as `content`. Satisfied by a plain Cell
// JSON object (initial load), a Cell instance (restructure), or [] (no
// content yet).
interface CellContent {
  cards?: Array<{ content: string; type?: CardType }>;
  score?: Score;
}

export class Cell {
  index: number;
  id: number;
  title: string;
  helptitle: string | undefined;
  helptext: string | undefined;
  hasScore: boolean;
  score: Score;
  cards: Card[];

  constructor(
    index: number,
    structure: CellStructure,
    content: CellContent | readonly never[],
  ) {
    this.index = index;
    this.id = structure.id;
    this.title = structure.title;
    this.helptitle = structure.subtitle;
    this.helptext = structure.description;
    this.hasScore = structure.score === 'yes';
    // cast merges the [] branch; readonly-empty has no cards/score to access
    const c = content as CellContent;
    this.score = this.hasScore ? (c.score ?? 0) : undefined;
    this.cards = c.cards?.map((card) => new Card(card.content, card.type)) ?? [];
  }

  cardsElem = (): HTMLElement | null =>
    document.querySelector<HTMLElement>(
      `.cell[data-index='${this.index}'] > .cell-card-container`,
    );

  cardElems = (): NodeListOf<HTMLElement> =>
    document.querySelectorAll<HTMLElement>(
      `.cell[data-index='${this.index}'] > .cell-card-container .card`,
    );

  scoreElem = (): HTMLSelectElement | null =>
    document.querySelector<HTMLSelectElement>(
      `.cell[data-index='${this.index}'] select.scoring-dropdown`,
    );

  getCardIndex(cellPos: number): string | number {
    const cells = this.cardElems();
    return cellPos < cells.length ? cells[cellPos]!.getAttribute('data-index')! : -1;
  }

  createCard(cardContainerDiv: HTMLElement): void {
    const name = 'New ' + trimPluralS(this.title);
    const card = new Card(name);
    this.cards.push(card);
    cardContainerDiv.appendChild(card.render());
    lg(app.canvas.cells.map((cell: { cards?: unknown[] }) => cell.cards?.length));
  }

  removeCard(domIndex: number | string): void {
    const container = this.cardsElem()!;
    const stateIndex = Array.from(container.children).findIndex(
      (cardDiv) => cardDiv.getAttribute('data-index') === String(domIndex),
    );
    if (stateIndex !== -1) {
      this.cards.splice(stateIndex, 1);
      document.querySelector(`.card[data-index='${domIndex}']`)!.remove();
    }
  }

  clear(): void {
    this.cardElems().forEach((card) => this.removeCard(card.getAttribute('data-index')!));
    if (this.hasScore) {
      this.scoreElem()!.value = '0';
      this.score = 0;
    }
  }

  update(): void {
    this.cardElems().forEach((card, index) => {
      this.cards[index]!.content = sanitize(card.textContent ?? '');
    });
    if (this.hasScore) app.canvas.cells[this.index].score = this.scoreElem()!.value;
    lg(app.canvas.cells.map((cell: { cards?: unknown[] }) => cell.cards?.length));
  }

  render(): HTMLElement {
    const cellDiv = createElement('div', {
      class: 'cell',
      id: String(this.id),
      'data-index': this.index,
    });
    const cellTitle = createElement('div', { class: 'cell-title-container' });
    const titleH3 = createElement('h3', { class: 'cell-title' }, this.title);
    cellTitle.appendChild(titleH3);
    cellDiv.appendChild(cellTitle);

    if (this.hasScore) this.addScoringDropdown(cellTitle);
    this.addHelpOverlay(titleH3);

    const cardContainerDiv = createElement('div', { class: 'cell-card-container' });
    cellDiv.appendChild(cardContainerDiv);
    this.cards.forEach((card) => cardContainerDiv.appendChild(card.render()));

    this.makeBgClickable(cardContainerDiv);
    makeDroppable(cardContainerDiv, () => {
      dragState.destCell = this.index;
      app.canvas.updateDragDrop();
    });
    cellDiv.addEventListener('cardDelete', (event) => {
      const e = event as CustomEvent<{ index: number }>;
      this.removeCard(e.detail.index);
    });
    return cellDiv;
  }

  addHelpOverlay(parent: HTMLElement): void {
    const helpDiv = createElement('div', { class: 'hover-help' });
    if (this.helptitle) helpDiv.appendChild(createElement('h4', {}, this.helptitle));
    if (this.helptext) helpDiv.appendChild(createElement('p', {}, this.helptext, 'html'));
    parent.appendChild(helpDiv);

    const hoverHelp = (): void => {
      helpDiv.style.display = helpDiv.style.display === 'block' ? 'none' : 'block';
    };
    parent.addEventListener('dblclick', hoverHelp);
    addLongPressListener(parent, hoverHelp);
  }

  addScoringDropdown(parent: HTMLElement): void {
    const select = createElement('select', {
      id: 'score' + this.id,
      class: 'scoring-dropdown',
    }) as HTMLSelectElement;
    Array.from({ length: 6 }, (_, i) =>
      select.appendChild(createElement('option', { value: i }, i === 0 ? '-' : String(i))),
    );
    select.value = String(this.score);
    select.addEventListener('change', () => {
      this.score = select.value;
      document.dispatchEvent(new CustomEvent('scoreChanged'));
    });
    parent.appendChild(select);
  }

  makeBgClickable(cardContainerDiv: HTMLElement): void {
    cardContainerDiv.addEventListener('dblclick', (e) =>
      e.target === cardContainerDiv ? this.createCard(cardContainerDiv) : undefined,
    );
    addLongPressListener(cardContainerDiv, () => this.createCard(cardContainerDiv));
    cardContainerDiv.style.minHeight = '50px';
    cardContainerDiv.style.cursor = 'pointer';
  }

  rerender(): void {
    const cardContainerDiv = this.cardsElem()!;
    cardContainerDiv.innerHTML = '';
    this.cards.forEach((card) => cardContainerDiv.appendChild(card.render()));
    if (this.hasScore) this.scoreElem()!.value = String(this.score);
  }

  toJSON(): { id: number; cards: Card[]; score: Score } {
    return { id: this.id, cards: this.cards, score: this.score };
  }

  check(): void {
    const domCards = this.cardElems();
    const stateCards = this.cards;

    const stripWs = (text: string): string => text.replace(/\s/g, '');
    const stripWsAndHtml = (text: string): string => decodeHtml(stripWs(text));

    if (domCards.length !== stateCards.length)
      throw new Error(
        `Cell ${this.index}: dom.len ${domCards.length} != state.len ${stateCards.length}`,
      );
    Array.from(domCards).forEach((elem, index) => {
      if (stripWs(elem.textContent ?? '') !== stripWs(stripWsAndHtml(this.cards[index]!.content)))
        throw new Error(
          `Cell ${this.index}: dom.card ${elem.getAttribute('data-index')}: ${(elem.textContent ?? '').trim()} ` +
            `!= state.card ${index}: ${stateCards[index]!.content.trim()}`,
        );
    });
    if (this.hasScore) {
      const score = this.scoreElem()!.value;
      if (score !== String(this.score))
        throw new Error(`Cell ${this.index}: dom.score: ${score} != state.score: ${this.score}`);
    }
  }
}
