let app = undefined;

document.addEventListener('DOMContentLoaded', () => {

    const load = (contentFile) => {
        contentFile ||= 'template';
        Promise.all([
            fetch('preseed.json').then(res => res.json()),
            fetch(`models/${contentFile}.json`).then(res => res.json())
        ]).then(([structure, content]) => {
            structure = sanitizeJSON(structure);
            content = sanitizeJSON(content)
            Application.create(structure, content);
        }).catch(error => console.error('Error setting up canvas:', error));
    };

    load(new URLSearchParams(window.location.search).get('model'));
});


// implicit interface { update(); render(); } to sync DOM to state and back
class Application {

    constructor(meta, canvas, analysis) {
        Object.assign(this, { meta, canvas, analysis });
        this.renderables = [meta, canvas, analysis];
    }

    static create(structure, content) {
        const meta = new PreCanvas(content.meta);
        const canvas = new Canvas(structure, content);
        const analysis = new PostCanvas(canvas, structure, content);
        app = new Application(meta, canvas, analysis);
        app.render();
        document.addEventListener('scoreChanged', () => {
            analysis.computeScore();
        });
    }

    update() {
        this.renderables.forEach(renderable => renderable.update());
    }

    render() {
        this.renderables.forEach(renderable => renderable.render());
    }

    serialize() {
        localStorage.setItem('canvas', JSON.stringify(this));
    }

    static deserialize() {
        const json = localStorage.getItem('canvas');
        if (!json) return;
        content = JSON.parse(sanitizeJSON(json));
        fetch('preseed.json')
            .then(response => response.json())
            .then(structure => {
                init(structure, content);
            }).catch(error => console.error('Error loading canvas:', error));
    }

    toJSON() { return { meta: this.meta, canvas: this.canvas, analysis: this.analysis }; }
}

class Canvas {

    constructor(structure, content) {
        this.structure = structure;
        this.content = content;
        // INFO: assuming content is always stored in seq., then no need for indexes
        this.cells = structure.canvas.map((structData, index) => new Cell(index, structData, content.canvas[index]));
    }

    update() {
        this.cells.forEach(cell => cell.updateState());
    }

    render() {
        const el = document.getElementById('canvas');
        el.innerHTML = '';
        this.cells.forEach(cell => el.appendChild(cell.render()));
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
        this.hasScore = structure.score;
        this.score = content.score;
        this.cards = content.content.map(cardData => new Card(cardData));
    }

    createCard(cardContainerDiv) {
        const name = 'New ' + trimPluralS(this.title);
        const card = new Card(name);
        this.cards.push(card);
        cardContainerDiv.appendChild(card.render());
    }

    removeCard(domIndex) {
        const cellElem = document.querySelector(`.cell[data-index='${this.index}'] > .cell-card-container`);
        const stateIndex = Array.from(cellElem.children).findIndex(cardDiv => cardDiv.getAttribute('data-index') === String(domIndex));
        if (stateIndex !== -1) {
            this.cards.splice(stateIndex, 1);
            document.querySelector(`.card[data-index='${domIndex}']`).remove();
        }
    }

    update() {
        const cards = document.querySelectorAll(`.cell[data-index=${this.index}] > .cell-card-container > .card`);
        // assert cards.length == this.cards.lenth
        cards.forEach((card, index) => this.cards[index].text = sanitize(card.textContent));
        if (this.hasScore) app.canvas.cells[this.index].score = document.querySelector(`.cell[data-index=${this.index}] .scoring-dropdown`).value;
    }

    render() {
        const cellDiv = createElement('div', { class: "cell", id: this.id, 'data-index': this.index });
        const cellTitle = createElement('div', { class: "cell-title-container" });
        const titleH3 = createElement('h3', { class: "cell-title" }, this.title);
        cellTitle.appendChild(titleH3);
        cellDiv.appendChild(cellTitle);

        if (this.hasScore === "yes") this.addScoringDropdown(cellTitle);
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
        select.addEventListener('change', event => document.dispatchEvent(new CustomEvent('scoreChanged')));
        parent.appendChild(select);
    }

    makeBgClickable(cardContainerDiv) {
        cardContainerDiv.addEventListener('dblclick', e => e.target === cardContainerDiv ? this.createCard(cardContainerDiv) : undefined);
        addLongPressListener(cardContainerDiv, () => this.createCard(cardContainerDiv));
        cardContainerDiv.style.minHeight = '50px';
        cardContainerDiv.style.cursor = 'pointer';
    }

    // TODO: handle id and comment
    toJSON() { return { content: this.cards, score: this.score }; }
}

class Card {

    static count = 0;

    constructor(text) {
        this.text = text;
        this.index = Card.count++;
    }

    update() {
        // global indexing
        const cardElem = document.querySelector(`.card[data-index='${this.index}']`);
        if (cardElem) this.text = sanitize(cardElem.textContent);
        if (!this.text.trim()) {
            cardElem.dispatchEvent(new CustomEvent('cardDelete', { bubbles: true, detail: { index: this.index } }));
        }
    }

    render() {
        const card = createElement('div', { class: 'card', 'data-index': this.index }, this.text);
        // bind this to Card state not DOM element 
        makeEditable(card, this.update.bind(this), true);
        return card;
    }

    toJSON() { return this.text; }
}

class PreCanvas {

    constructor(data) {
        this.title = data.title;
        this.content = data.description;
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
        const description = createElement('p', {}, this.content);
        makeEditable(description, () => app.meta.description = sanitize(description.textContent));
        metaDiv.appendChild(title);
        metaDiv.appendChild(description);
    }
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
}

/* static functions */

function createElement(tagName, attributes = {}, text = '') {
    const element = document.createElement(tagName);
    Object.keys(attributes).forEach(key => element.setAttribute(key, attributes[key]));
    if (text) element.textContent = text;
    return element;
};

function makeEditable(elem, callback, removeEmpty = false) {
    elem.setAttribute('contenteditable', 'true');
    //const editClass = 'editing';

    if (callback) elem.addEventListener('blur', callback);

    // allow multiline entries
    elem.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            if (e.shiftKey) {
                // finalize editing by removing focus
                finishEdit(elem);
            } else {
                e.preventDefault();
                insertBr();
            }
        }
        if (e.key === 'Escape') {
            finishEdit(elem);
        }
    });

    // TODO: changing as textContent, this may not be necessary
    function insertBr() {
        // insert new line br at cursor
        console.log('BR');
        const br = document.createElement('br');
        const range = window.getSelection().getRangeAt(0);
        range.insertNode(br);
        range.setStartAfter(br);
        range.setEndAfter(br);
        // clear selection, set new range
        window.getSelection().removeAllRanges();
        window.getSelection().addRange(range);
        br.parentElement.focus();
    }
}

/**
 * Add a long press listener for pointer and touch devices.
 * The method separates this from touch-move events. 
 * 
 * @param {Element} element 
 * @param {Function}} callback 
 * @param {number} duration 
 */
function addLongPressListener(element, callback, duration = 500) {
    let timerId = null;
    let startX = 0;
    let startY = 0;

    const start = (event) => {
        // For touch events, use the first touch point
        startX = event.type === 'touchstart' ? event.touches[0].pageX : event.pageX;
        startY = event.type === 'touchstart' ? event.touches[0].pageY : event.pageY;

        if ((event.type === 'mousedown' && event.button !== 0) || event.target !== element) return;
        timerId = setTimeout(() => callback(element), duration);
    };

    const cancel = () => {
        clearTimeout(timerId);
    };

    const move = (event) => {
        // Determine the new position
        let newX = event.type === 'touchmove' ? event.touches[0].pageX : event.pageX;
        let newY = event.type === 'touchmove' ? event.touches[0].pageY : event.pageY;

        // Calculate the distance moved
        if (Math.abs(newX - startX) > 10 || Math.abs(newY - startY) > 10) cancel();
    };

    // Attach listeners
    element.addEventListener('mousedown', start);
    element.addEventListener('touchstart', start, { passive: true });
    element.addEventListener('mouseup', cancel);
    element.addEventListener('mouseleave', cancel);
    element.addEventListener('touchend', cancel);
    element.addEventListener('touchcancel', cancel);
    element.addEventListener('mousemove', move);
    element.addEventListener('touchmove', move, { passive: true });
}

/**
 * Place the caret at the end of the element text.
 * 
 * @param {Element} element 
 */
function setCaretAtEnd(element) {
    const range = document.createRange();
    const selection = window.getSelection();
    range.selectNodeContents(element);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
    element.focus();
}

function sanitize(text) {
    // TODO: sanitize using DOMPurify etc.
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;', '`': '&#x60;', '=': '&#x3D;' };
    return text.replace(/[&<>"'`=]/g, m => map[m]);
}

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


