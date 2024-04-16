/* copyright 2024 Unlost GmbH. All rights reserved. */
class Canvas {

    constructor(structure, content) {
        lg(structure.canvas.map(cell => cell.title));
        lg(content.canvas.map(cell => cell.cards?.length));
        // INFO: assuming content is always stored in seq., then no need for cell ids
        this.cells = structure.canvas.map((structData, index) => new Cell(index, structData,
            content.canvas[index] ?? []));
    }

    update() { this.cells.forEach(cell => cell.update()); }

    updateDragDrop() {
        if (Cell.dragSource === Cell.dragDest) {
            if (Card.dragDestIndex === Card.dragSourceIndex) return;
            if (Card.dragDest === Card.dragSource + 1) return;
            const cell = this.cells[Cell.dragSource];
            const [card] = cell.cards.splice(Card.dragSource, 1);
            cell.cards.splice(Card.dragDest - 1, 0, card);
        } else {
            const cell = this.cells[Cell.dragSource];
            const [card] = cell.cards.splice(Card.dragSource, 1);
            const cell2 = this.cells[Cell.dragDest];
            const index = Card.dragDest ? Card.dragDest - 1 : cell2.cards.length;
            cell2.cards.splice(index, 0, card);
        }
        Cell.dragSource = undefined;
        Cell.dragDest = undefined;
        Card.dragSource = undefined;
        Card.dragDest = undefined;
        Card.dragSourceIndex = undefined;
        Card.dragDestIndex = undefined;
        app.check();
        lg(app.canvas.cells.map(cell => cell.cards?.length));
    }

    render() {
        const el = createElement('div', { id: 'canvas' });
        document.getElementById('content').appendChild(el);
        const style = conf.layout.canvasclass || '.lean-canvas';
        el.classList.add(style);
        el.innerHTML = '';
        this.cells.forEach(cell => el.appendChild(cell.render()));
    }

    rerender() { this.cells.forEach(cell => cell.rerender()); }

    clear() {
        this.cells.forEach(cell => cell.clear());
        Card.count = 0;
        if (app.analysis?.scores) app.analysis.computeScore();
    }

    toJSON() { return this.cells; }
}

class Cell {

    static dragSource = undefined;
    static dragDest = undefined;

    constructor(index, structure, content) {
        this.index = index;
        this.id = structure.id;
        this.title = structure.title;
        this.helptitle = structure.subtitle;
        this.helptext = structure.description;
        this.hasScore = structure.score === "yes";
        this.score = this.hasScore ? content.score ?? 0 : undefined;
        this.cards = content.cards?.map(card => new Card(card.content, card.type)) ?? [];
    }

    // dom elements; TODO: cardsElem and scoreElem fixed after render()
    cardsElem = () => document.querySelector(`.cell[data-index='${this.index}'] > .cell-card-container`);
    cardElems = () => document.querySelectorAll(`.cell[data-index='${this.index}'] > .cell-card-container .card`);
    scoreElem = () => document.querySelector(`.cell[data-index='${this.index}'] select.scoring-dropdown`);

    // position in cell is 0-based
    getCardIndex(cellPos) {
        const cells = this.cardElems();
        return cellPos < cells.length ? cells[cellPos].getAttribute('data-index') : -1;
    }

    createCard(cardContainerDiv) {
        const name = 'New ' + trimPluralS(this.title);
        const card = new Card(name);
        this.cards.push(card);
        cardContainerDiv.appendChild(card.render());
        lg(app.canvas.cells.map(cell => cell.cards?.length));
    }

    removeCard(domIndex) {
        const stateIndex = Array.from(this.cardsElem().children).findIndex(cardDiv =>
            cardDiv.getAttribute('data-index') === String(domIndex));
        if (stateIndex !== -1) {
            this.cards.splice(stateIndex, 1);
            document.querySelector(`.card[data-index='${domIndex}']`).remove();
        }
    }

    clear() {
        this.cardElems().forEach(card => this.removeCard(card.getAttribute('data-index')));
        if (this.hasScore) {
            this.scoreElem().value = 0;
            this.score = 0;
        }
    }

    update() {
        this.cardElems().forEach((card, index) => this.cards[index].content = sanitize(card.textContent));
        if (this.hasScore) app.canvas.cells[this.index].score = this.scoreElem().value;
        lg(app.canvas.cells.map(cell => cell.cards?.length));
    }

    render() {
        const cellDiv = createElement('div', { class: "cell", id: this.id, 'data-index': this.index });
        const cellTitle = createElement('div', { class: "cell-title-container" });
        const titleH3 = createElement('h3', { class: "cell-title" }, this.title);
        cellTitle.appendChild(titleH3);
        cellDiv.appendChild(cellTitle);

        if (this.hasScore) this.addScoringDropdown(cellTitle);
        this.addHelpOverlay(titleH3);

        const cardContainerDiv = createElement('div', { class: 'cell-card-container' });
        cellDiv.appendChild(cardContainerDiv);
        this.cards.forEach(card => cardContainerDiv.appendChild(card.render()));

        this.makeBgClickable(cardContainerDiv);
        makeDroppable(cardContainerDiv, () => {
            Cell.dragDest = this.index;
            app.canvas.updateDragDrop();
        });
        cellDiv.addEventListener('cardDelete', (event) => this.removeCard(event.detail.index));
        return cellDiv;
    }

    addHelpOverlay(parent) {
        const helpDiv = createElement('div', { class: 'hover-help' });
        if (this.helptitle) helpDiv.appendChild(createElement('h4', {}, this.helptitle));
        if (this.helptext) helpDiv.appendChild(createElement('p', {}, this.helptext, 'html'));
        parent.appendChild(helpDiv);

        const hoverHelp = elem => helpDiv.style.display = helpDiv.style.display === 'block' ? 'none' : 'block';
        parent.addEventListener('dblclick', hoverHelp);
        addLongPressListener(parent, hoverHelp);
    }

    addScoringDropdown(parent) {
        const select = createElement('select', { id: "score" + this.id, class: 'scoring-dropdown' });
        Array.from({ length: 6 }, (_, i) => select.appendChild(createElement('option', { value: i }, i === 0 ? "-" : i)));
        select.value = this.score;
        select.addEventListener('change', event => {
            this.score = select.value;
            document.dispatchEvent(new CustomEvent('scoreChanged'));
        });
        parent.appendChild(select);
    }

    makeBgClickable(cardContainerDiv) {
        cardContainerDiv.addEventListener('dblclick', e => e.target === cardContainerDiv ? this.createCard(cardContainerDiv) : undefined);
        addLongPressListener(cardContainerDiv, () => this.createCard(cardContainerDiv));
        cardContainerDiv.style.minHeight = '50px';
        cardContainerDiv.style.cursor = 'pointer';
    }

    rerender() {
        const cardContainerDiv = this.cardsElem();
        cardContainerDiv.innerHTML = '';
        this.cards.forEach(card => cardContainerDiv.appendChild(card.render()));
        if (this.hasScore) this.scoreElem().value = this.score;
    }

    // TODO: handle comment
    toJSON() { return { id: this.id, cards: this.cards, score: this.score }; }

    check() {
        const domCards = this.cardElems();
        const stateCards = this.cards;
        if (domCards.length !== stateCards.length)
            throw new Error(`Cell ${this.index}: dom.len ${domCards.length} != state.len ${stateCards.length}`);
        Array.from(domCards).forEach((elem, index) => {
            if (elem.textContent.trim() !== this.cards[index].content.trim())
                throw new Error(`Cell ${this.index}: dom.card ${elem.getAttribute('data-index')}: ${elem.textContent.trim()} ` +
                    `!= state.card ${index}: ${stateCards[index].content.trim()}`);
        });
        if (this.hasScore) {
            const score = this.scoreElem().value;
            if (score !== String(this.score))
                throw new Error(`Cell ${this.index}: dom.score: ${score} != state.score: ${this.score}`);
        }
    }
}

class Card {

    static count = 0;
    static dragSourceIndex = undefined;
    static dragDestIndex = undefined;
    static dragSource = undefined;
    static dragDest = undefined;

    // type is optional
    constructor(text, type = undefined) {
        this.index = Card.count++;
        this.type = type;
        this.setTypeAndContent(sanitize(text));
    }

    getElement = () => document.querySelector(`.card[data-index='${this.index}']`);
    static getElement = (index) => document.querySelector(`.card[data-index='${index}']`);
    static getCellCardPos = (index) => { const elem = Card.getElement(index); return [elem.cellIndex(), elem.cardCellPos()]; }
    //static getCellCardIndex = (cell, pos) => { app.canvas.cells[cell].getCardIndex(pos); }

    getParentCell = () => this.getElement().parentElement.parentElement;

    // parent cell and position within parent cell
    cellIndex = () => this.getParentCell().getAttribute('data-index');
    cardCellPos = () => { const card = this.getElement(); return Array.from(card.parentNode.children).indexOf(card); };

    update() {
        const cardElem = this.getElement();
        if (!cardElem) return;
        this.setTypeAndContent(sanitize(convertBR(cardElem.innerHTML)));
        this.rerender();
        if (!this.content.trim()) cardElem.dispatchEvent(new CustomEvent('cardDelete', { bubbles: true, detail: { index: this.index } }));
        lg(app.canvas.cells.map(cell => cell.cards?.length));
    }

    render() {
        const card = createElement('div', { class: 'card', 'data-index': this.index }, convertNL(this.content), 'html');
        if (this.type) card.classList.add(this.type);
        makeEditable(card, this.update.bind(this));
        makeDraggable(card, 500, (e) => {
            Cell.dragSource = this.cellIndex();
            Card.dragSource = this.cardCellPos();
            Card.dragSourceIndex = this.index;
        }, (e) => {
            Cell.dragDest = this.cellIndex();
            Card.dragDest = this.cardCellPos();
            Card.dragDestIndex = this.index;
            app.canvas.updateDragDrop();
        });
        return card;
    }

    rerender() {
        const cardElem = this.getElement();
        lg('elem before: ' + cardElem.innerHTML);
        cardElem.innerHTML = convertNL(this.content);
        lg(this.content + ' -> ' + cardElem.innerHTML);
        cardElem.className = 'card';
        if (this.type) cardElem.classList.add(this.type);
    }

    setTypeAndContent(text) {
        const cardtypes = { ':?': 'query', ':!': 'comment', ':=': 'analysis', ':-': undefined };
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

    toJSON() { return { content: this.content, type: this.type }; }
}

class PreCanvas {

    constructor(data, display = false) {
        this.title = data.title;
        this.description = data.description;
        this.canvas = data.canvas;
        this.display = display;
    }

    update() {
        const metaDiv = document.getElementById('precanvas');
        app.meta.title = sanitize(metaDiv.querySelector('h2').textContent);
        app.meta.description = sanitize(convertBR(metaDiv.querySelector('p').innerHTML));
    }

    render() {
        const metaDiv = createElement('div', { id: 'precanvas' });
        document.getElementById('content').appendChild(metaDiv);
        const title = createElement('h2', {}, this.title);
        makeEditable(title, () => app.meta.title = sanitize(title.textContent), this.updateState);
        metaDiv.appendChild(title);
        if (this.display) {
            const description = createElement('p', {}, this.description);
            makeEditable(description, () => app.meta.description = sanitize(convertBR(description.innerHTML)), this.updateState);
            metaDiv.appendChild(description);
        }
    }

    rerender() {
        document.querySelector(`#precanvas h2`).textContent = this.title;
        if (this.display) document.querySelector(`#precanvas p`).innerHTML = convertNL(this.description);
    }

    clear() {
        this.title = 'Company name';
        this.description = 'Description';
        this.rerender();
    }

    toJSON() { return { title: this.title, description: this.description, canvas: this.canvas }; }
}

class PostCanvas {

    constructor(canvas, structure, content, display = false) {
        this.title = 'Analysis';
        this.content = content.analysis.content;
        this.canvas = canvas;
        this.total = structure.scoring[0]?.total;
        this.scores = structure.scoring[0]?.scores;
        this.scoreSpan = document.querySelector('span.score-total');
        this.display = display;
    }

    update() {
        const metaDiv = document.getElementById('postcanvas');
        app.analysis.title = sanitize(metaDiv.querySelector('h3').textContent);
        app.analysis.description = sanitize(convertBR(metaDiv.querySelector('p').innerHTML));
    }

    render() {
        if (!this.display) return;
        const anaDiv = createElement('div', { id: 'postcanvas' });
        document.getElementById('content').appendChild(anaDiv);
        const cellTitle = createElement('div', { class: 'cell-title-container' });
        const titleH3 = createElement('h3', { class: 'cell-title' }, this.title);
        cellTitle.appendChild(titleH3);
        anaDiv.appendChild(cellTitle);

        if (this.total) {
            this.scoreSpan = this.addScorer(cellTitle);
            this.computeScore();
        }

        const paragraph = createElement('p', {}, this.content);
        makeEditable(paragraph, () => app.analysis.content = sanitize(convertBR(paragraph.innerHTML)));
        anaDiv.appendChild(paragraph);
    }

    rerender() {
        if (this.display) document.querySelector(`#postcanvas p`).innerHTML = convertNL(this.content);
        this.computeScore();
    }

    addScorer(parentElement) {
        parentElement.appendChild(createElement('h3', { class: 'score-total-label' }, 'Score'));
        const score = createElement('span', { class: 'score-total' }, 0..toFixed(1));
        parentElement.appendChild(score);
        return score;
    }

    computeScore() {
        const score = index => parseFloat(document.getElementById(`score${index}`)?.value) || 0;

        // TODO: load dynamically from preseed.json: scoring.total and /scoring.scores.*
        let Product = score(1) * 1 / 3 + score(2) * 1 / 3 + score(7) * 1 / 3;
        let Market = score(4) * 1 / 3 + score(9) * 1 / 3 + score(5) * 1 / 3;
        let Progress = score(3) * 1 / 2 + score(6) * 1 / 2;
        let Team = score(8) * 1;
        let total = Product * 3 / 10 + Market * 1 / 5 + Progress * 1 / 5 + Team * 3 / 10;
        this.scoreSpan.textContent = total.toFixed(1);

        return total;
    }

    clear() {
        this.content = 'Analysis';
        this.rerender();
    }

    toJSON() { return { content: this.content }; }
}
