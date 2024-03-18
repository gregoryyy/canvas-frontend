let app = undefined;
let ctl = undefined;
const canvasLsKey = 'canvas';
const canvasStructure = 'preseed.json';

document.addEventListener('DOMContentLoaded', () => {

    const load = (contentFile) => {
        contentFile ||= 'template';
        Promise.all([
            fetch(canvasStructure).then(res => res.json()),
            fetch(`models/${contentFile}.json`).then(res => res.json())
        ]).then(([structure, content]) => {
            structure = sanitizeJSON(structure);
            content = sanitizeJSON(content);
            app = Application.create(structure, content);
            ctl = Controls.create();
        }).catch(error => console.error('Error setting up canvas:', error));
    };
    console.log('canvas started');
    load(new URLSearchParams(window.location.search).get('model'));
});

// implicit interface { update(); render(); rerender(); clear(); } 
// to sync DOM to state, initial rendering, sync state to DOM and clear content
class Application {

    constructor(meta, canvas, analysis) {
        Object.assign(this, { meta, canvas, analysis });
        this.renderables = [meta, canvas, analysis];
    }

    static create(structure, content) {
        const meta = new PreCanvas(content.meta);
        const canvas = new Canvas(structure, content);
        const analysis = new PostCanvas(canvas, structure, content);
        const newApp = new Application(meta, canvas, analysis);
        newApp.render(canvasStructure);
        document.addEventListener('scoreChanged', () => {
            analysis.computeScore();
        });
        newApp.check();
        return newApp;
    }

    repopulate(content) {
        this.clear();
        this.content = content;
        this.meta.title = content.meta.title;
        this.meta.description = content.meta.description;
        content.canvas.forEach((cell, index) => {
            const ccell = this.canvas.cells[index];
            ccell.cards = content.canvas[index].cards.map(card => new Card(card.content, card.type));
            if (ccell.hasScore) ccell.score = cell.score;
        });
        this.analysis.content = content.analysis.content;
    }

    update() { this.renderables.forEach(renderable => renderable.update()); }

    render() { this.renderables.forEach(renderable => renderable.render()); }

    rerender() { this.renderables.forEach(renderable => renderable.rerender()); }

    clear() { this.renderables.forEach(renderable => renderable.clear()); }

    saveToLs() {
        this.check();
        localStorage.setItem(canvasLsKey, JSON.stringify(this));
    }

    loadFromLs() {
        const json = localStorage.getItem(canvasLsKey);
        if (!json || json.length == 0) return;
        const content = JSON.parse(sanitizeJSON(json));
        this.repopulate(content);
        this.rerender();
        this.check();
    }

    static clearLocalStorage() { localStorage.removeItem(canvasLsKey); }

    toJSON() { return { meta: this.meta, canvas: this.canvas, analysis: this.analysis }; }

    // simple consistency test on cells
    check() { this.canvas.cells.forEach(cell => cell.check()); }
}

class Controls {

    static create() {
        const newCtl = new Controls();
        newCtl.render();
        return newCtl;
    }

    render() {
        const ctlElem = document.getElementById('controls');
        const buttons = [
            ['lsload', 'Load LS', app.loadFromLs.bind(app)],
            ['lssave', 'Save LS', app.saveToLs.bind(app)],
            ['lsclear', 'Clear LS', Application.clearLocalStorage],
            ['cvclear', 'Clear Canvas', app.clear.bind(app)]];
        buttons.forEach(button => {
            const btn = createElement('div', { id: button[0], class: 'control' }, button[1])
            ctlElem.appendChild(btn);
            btn.addEventListener('click', button[2]);
            btn.addEventListener('click', () => {
                btn.classList.add('clicked');
                setTimeout(() => btn.classList.remove('clicked'), 500);
            });
        });
    }
}

class Canvas {

    constructor(structure, content) {
        this.structure = structure;
        this.content = content;
        // INFO: assuming content is always stored in seq., then no need for cell ids
        this.cells = structure.canvas.map((structData, index) => new Cell(index, structData, content.canvas[index]));
    }

    update() { this.cells.forEach(cell => cell.updateState()); }

    render() {
        const el = document.getElementById('canvas');
        el.innerHTML = '';
        this.cells.forEach(cell => el.appendChild(cell.render()));
    }

    rerender() { this.cells.forEach(cell => cell.rerender()); }

    clear() {
        this.cells.forEach(cell => cell.clear());
        Card.count = 0;
        app.analysis.computeScore();
    }

    toJSON() { return this.cells; }
}

class Cell {

    constructor(index, structure, content) {
        this.index = index;
        this.id = structure.id;
        this.title = structure.title;
        this.helptitle = structure.subtitle;
        this.helptext = structure.description;
        this.hasScore = structure.score === "yes";
        this.score = content.score;
        this.cards = content.cards.map(card => new Card(card.content, card.type));
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
        this.cardElems().forEach((card, index) => this.cards[index].text = sanitize(card.textContent));
        if (this.hasScore) app.canvas.cells[this.index].score = this.scoreElem().value;
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
        cellDiv.addEventListener('cardDelete', (event) => this.removeCard(event.detail.index));
        return cellDiv;
    }

    addHelpOverlay(parent) {
        const helpDiv = createElement('div', { class: 'hover-help' });
        if (this.helptitle) helpDiv.appendChild(createElement('h4', {}, this.helptitle));
        if (this.helptext) helpDiv.appendChild(createElement('p', {}, this.helptext));
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
            if (elem.textContent.trim() !== this.cards[index].text.trim())
                throw new Error(`Cell ${this.index}: dom.card ${elem.getAttribute('data-index')}: ${elem.textContent.trim()} ` +
                    `!= state.card ${index}: ${stateCards[index].text.trim()}`);
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

    // type is optional
    constructor(text, type = undefined) {
        this.index = Card.count++;
        this.type = type;
        this.setTypeAndText(sanitize(text));
    }

    getElement = () => document.querySelector(`.card[data-index='${this.index}']`);
    
    static getElement = (index) => document.querySelector(`.card[data-index='${index}']`);

    update() {
        // global indexing
        console.log('card update' + this.index);
        const cardElem = this.getElement();
        if (!cardElem) return;
        this.setTypeAndText(sanitize(cardElem.textContent));
        this.rerender();
        if (!this.text.trim()) cardElem.dispatchEvent(new CustomEvent('cardDelete', { bubbles: true, detail: { index: this.index } }));
    }

    render() {
        const card = createElement('div', { class: 'card', 'data-index': this.index }, this.text);
        if (this.type) card.classList.add(this.type);
        makeEditable(card, this.update.bind(this));
        return card;
    }

    rerender() {
        const cardElem = this.getElement();
        cardElem.textContent = this.text;
        cardElem.className = 'card';
        if (this.type) cardElem.classList.add(this.type);
    }

    setTypeAndText(text) {
        const cardtypes = { ':?': 'query', ':!': 'comment', ':=': 'analysis', ':-': undefined };
        const trimmed = text.trim();
        for (const [cmd, type] of Object.entries(cardtypes)) {
            if (trimmed.startsWith(cmd)) {
                this.text = trimmed.substring(2).trim();
                this.type = type;
                return;
            }
        }
        this.text = trimmed;
    }

    toJSON() { return { content: this.text, type: this.type }; }
}

class PreCanvas {

    constructor(data) {
        this.title = data.title;
        this.description = data.description;
    }

    update() {
        const metaDiv = document.getElementById('precanvas');
        app.meta.title = sanitize(metaDiv.querySelector('h2').textContent);
        app.meta.description = sanitize(metaDiv.querySelector('p').textContent);
    }

    render() {
        const metaDiv = document.getElementById('precanvas');
        const title = createElement('h2', {}, this.title);
        makeEditable(title, () => app.meta.title = sanitize(title.textContent), this.updateState);
        const description = createElement('p', {}, this.description);
        makeEditable(description, () => app.meta.description = sanitize(description.textContent), this.updateState);
        metaDiv.appendChild(title);
        metaDiv.appendChild(description);
    }

    rerender() {
        document.querySelector(`#precanvas h2`).textContent = this.title;
        document.querySelector(`#precanvas p`).textContent = this.description;
    }

    clear() {
        document.getElementById('precanvas').innerHTML = '';
        this.title = 'Company name';
        this.description = 'Description';
        this.render();
    }

    toJSON() { return { title: this.title, description: this.description }; }
}

class PostCanvas {

    constructor(canvas, structure, content) {
        this.title = 'Analysis';
        this.content = content.analysis.content;
        this.canvas = canvas;
        this.total = structure.scoring[0].total;
        this.scores = structure.scoring[0].scores;
        this.scoreSpan = document.querySelector('span.score-total');
    }

    update() {
        const metaDiv = document.getElementById('postcanvas');
        app.analysis.title = sanitize(metaDiv.querySelector('h3').textContent);
        app.analysis.description = sanitize(metaDiv.querySelector('p').textContent);
    }

    render() {
        const anaDiv = document.getElementById('postcanvas');
        const cellTitle = createElement('div', { class: 'cell-title-container' });
        const titleH3 = createElement('h3', { class: 'cell-title' }, this.title);
        cellTitle.appendChild(titleH3);
        anaDiv.appendChild(cellTitle);

        if (this.total) {
            this.scoreSpan = this.addScorer(cellTitle);
            this.computeScore();
        }

        const paragraph = createElement('p', {}, this.content);
        makeEditable(paragraph, () => app.analysis.content = sanitize(paragraph.textContent));
        anaDiv.appendChild(paragraph);
    }

    rerender() { document.querySelector(`#postcanvas p`).textContent = this.content; }

    addScorer(parentElement) {
        parentElement.appendChild(createElement('h3', { class: 'score-total-label' }, 'Score'));
        const score = createElement('span', { class: 'score-total' }, 0..toFixed(1));
        parentElement.appendChild(score);
        return score;
    }

    computeScore() {
        const score = index => parseFloat(document.getElementById(`score${index}`).value) || 0;

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
        document.getElementById('postcanvas').innerHTML = '';
        this.content = 'Analysis';
        this.render();
    }

    toJSON() { return { content: this.content }; }
}

/* static functions */

function createElement(tagName, attributes = {}, text = '') {
    const element = document.createElement(tagName);
    Object.keys(attributes).forEach(key => element.setAttribute(key, attributes[key]));
    if (text) element.textContent = text;
    return element;
};

function makeEditable(elem, cbFinishEdit) {
    elem.setAttribute('contenteditable', 'true');
    //const editClass = 'editing';

    elem.addEventListener('blur', cbFinishEdit);

    elem.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            if (e.shiftKey) {
                cbFinishEdit();
            } else {
                e.preventDefault();
                insertBr();
            }
        }
        if (e.key === 'Escape') {
            cbFinishEdit();
        }
    });

    function insertBr() {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;

        const range = selection.getRangeAt(0);
        // optional: clear selected content
        range.deleteContents();
        const br = document.createElement('br');
        const zeroWidthSpace = document.createTextNode('\u200B');
        range.insertNode(zeroWidthSpace);
        range.insertNode(br);
        range.setStartAfter(zeroWidthSpace);
        selection.removeAllRanges();
        selection.addRange(range);
    }
}

function addLongPressListener(element, callback, duration = 500) {
    let timerId = null;
    let startX = 0;
    let startY = 0;

    const start = (event) => {
        // first touch point
        startX = event.type === 'touchstart' ? event.touches[0].pageX : event.pageX;
        startY = event.type === 'touchstart' ? event.touches[0].pageY : event.pageY;
        if ((event.type === 'mousedown' && event.button !== 0) || event.target !== element) return;
        timerId = setTimeout(() => callback(element), duration);
    };

    const cancel = () => { clearTimeout(timerId); };

    const move = (event) => {
        let newX = event.type === 'touchmove' ? event.touches[0].pageX : event.pageX;
        let newY = event.type === 'touchmove' ? event.touches[0].pageY : event.pageY;
        if (Math.abs(newX - startX) > 10 || Math.abs(newY - startY) > 10) cancel();
    };

    element.addEventListener('mousedown', start);
    element.addEventListener('touchstart', start, { passive: true });
    element.addEventListener('mouseup', cancel);
    element.addEventListener('mouseleave', cancel);
    element.addEventListener('touchend', cancel);
    element.addEventListener('touchcancel', cancel);
    element.addEventListener('mousemove', move);
    element.addEventListener('touchmove', move, { passive: true });
}

function sanitize(text) { return DOMPurify.sanitize(text); }

function sanitizeJSON(value) {
    if (typeof value === 'string') return sanitize(value);
    else if (Array.isArray(value)) return value.map(sanitizeJSON);
    else if (typeof value === 'object' && value !== null) {
        const sanitizedObject = {};
        for (const key in value) sanitizedObject[key] = sanitizeJSON(value[key]);
        return sanitizedObject;
    } else return value;
}

function trimPluralS(s) {
    if (s.endsWith('ss')) return s;
    if (s.endsWith('s')) return s.substring(0, s.length - 1);
    return s;
}

function lg(message) {
    const stack = new Error().stack;
    const stackLines = stack.split("\n");
    const callerLine = stackLines[2];
    const functionNameMatch = callerLine.match(/at (\S+)/);
    const functionName = functionNameMatch ? functionNameMatch[1] : 'anonymous function';
    //const formattedCallerLine = callerLine.substring(callerLine.indexOf("(") + 1, callerLine.length - 1);
    //console.log(`${message} - ${functionName} - ${formattedCallerLine}`);
    console.log(`${message} - ${functionName}()`);
}

