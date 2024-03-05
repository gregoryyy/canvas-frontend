document.addEventListener('DOMContentLoaded', () => {
    const init = (contentFile) => {
        Promise.all([
            fetch('preseed.json').then(res => res.json()),
            fetch(`models/${contentFile || 'template'}.json`).then(res => res.json())
        ]).then(([structure, content]) => render(structure, content))
            .catch(error => console.error('Error setting up canvas:', error));
    };

    init(new URLSearchParams(window.location.search).get('model'));
});

// initial rendering
function render(structure, content) {

    const precanvas = new PreCanvas(content.meta);
    const canvas = new Canvas(structure, content);
    const postcanvas = new PostCanvas(canvas, structure, content);

    precanvas.render();
    canvas.render();
    postcanvas.render();
    postcanvas.computeScore();

    document.addEventListener('scoreChanged', () => {
        postcanvas.computeScore();
    });
}

class Canvas {

    constructor(structure, content) {
        this.structure = structure;
        this.content = content;
        // INFO: assuming content is always stored in seq., then no need for indexes
        this.cells = structure.canvas.map((structData, index) => new Cell(index, structData, content.canvas[index]));
    }

    render() {
        const el = document.getElementById('canvas');
        el.innerHTML = '';
        this.cells.forEach(cell => el.appendChild(cell.render()));
    }

    findCellById(id) {
        // consider map id => cell
        return this.cells.find(cell => cell.id === id);
    }
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
        this.cards = content.content.map((cardData, index) => new Card(index, cardData));
    }

    addCard(card) {
        this.cards.push(card);
    }

    createCard(cardContainerDiv) {
        const name = newCardName(this.title);
        const newCard = new Card(name);
        this.addCard(newCard);
        cardContainerDiv.appendChild(newCard.render());
    }

    render() {
        const cellDiv = createElement('div', { class: "cell", id: this.id, 'data-index': this.index });
        const cellTitle = createElement('div', { class: "cell-title-container" });
        const titleH3 = createElement('h3', { class: "cell-title" }, this.title);
        cellTitle.appendChild(titleH3);

        if (this.hasScore === "yes") this.addScoringDropdown(cellTitle);
        cellDiv.appendChild(cellTitle);
        this.addHelpOverlay(titleH3);

        const cardContainerDiv = createElement('div', { class: 'cell-card-container' });
        cellDiv.appendChild(cardContainerDiv);

        this.cards.forEach(card => cardContainerDiv.appendChild(card.render()));

        this.makeBgClickable(cardContainerDiv);
        return cellDiv;
    }

    addHelpOverlay(parentElement) {
        const helpDiv = createElement('div', { class: 'hover-help' });
        if (this.helptitle) helpDiv.appendChild(createElement('h4', {}, this.helptitle));
        if (this.helptext) helpDiv.appendChild(createElement('p', {}, this.helptext));
        parentElement.appendChild(helpDiv);

        const hoverHelp = elem => helpDiv.style.display = helpDiv.style.display === 'block' ? 'none' : 'block';
        parentElement.addEventListener('dblclick', hoverHelp);
        addLongPressListener(parentElement, hoverHelp);
    }

    addScoringDropdown(parentElement) {
        const select = createElement('select', { id: "score" + this.id, class: 'scoring-dropdown' });
        Array.from({ length: 6 }, (_, i) => select.appendChild(createElement('option', { value: i }, i === 0 ? "-" : i)));
        select.value = this.score;
        select.addEventListener('change', event => document.dispatchEvent(new CustomEvent('scoreChanged')));
        parentElement.appendChild(select);
    }

    makeBgClickable(cardContainerDiv) {

        // Existing render code...
        cardContainerDiv.addEventListener('dblclick', e => e.target === cardContainerDiv ? this.createCard(cardContainerDiv) : undefined);
        addLongPressListener(cardContainerDiv, () => this.createCard(cardContainerDiv));
        cardContainerDiv.style.minHeight = '50px';
        cardContainerDiv.style.cursor = 'pointer';
    }
}

class Card {

    constructor(index, text, id = -1) {
        this.index = index;
        this.text = text;
        this.id = id;
    }

    render() {
        const card = createElement('div', { class: 'card', 'data-index': this.index }, this.text);
        makeEditable(card, true);
        return card;
    }
}

class PreCanvas {

    constructor(data) {
        this.title = data.title;
        this.content = data.description;
    }

    render() {
        const metaDiv = document.getElementById('precanvas');
        const title = createElement('h2', {}, this.title);
        makeEditable(title);
        const description = createElement('p', {}, this.content);
        makeEditable(description);
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

        this.content.forEach(paragraphText => {
            const paragraph = createElement('p', {}, paragraphText);
            anaDiv.appendChild(paragraph);
            makeEditable(paragraph);
        });
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

/**
 * Toggle standard editing mode on element
 * 
 * @param {elem} elem dom element doubleclicked
 * @param {boolean} removeEmpty true if element should be removed if empty
 */
function makeEditable(elem, removeEmpty = false) {
    const editClass = 'editing';
    elem.addEventListener('dblclick', () => elem.classList.contains(editClass) ? finishEdit(elem, removeEmpty) : startEdit(elem));
    addLongPressListener(elem, () => elem.classList.contains(editClass) ? finishEdit(elem, removeEmpty) : startEdit(elem));
    
    // max one field editable at a time
    elem.addEventListener('blur', () => finishEdit(this, removeEmpty));

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

    function startEdit(elem) {
        elem.contentEditable = true;
        elem.classList.add(editClass);
        elem.focus();
        setCaretAtEnd(elem);
    }

    function finishEdit(elem, removeEmpty = false) {
        elem.contentEditable = false;
        elem.classList.remove(editClass);
        if (removeEmpty && elem.textContent.trim().length == 0) elem.remove();
    }

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

/**
 * create card with name in singular
 * 
 * @param {string} name 
 */
function newCardName(name) {
    var s = "New " + name;
    if (s.endsWith('ss')) return s;
    // chop off plural s
    if (s.endsWith('s')) return s.substring(0, s.length - 1);
    return s;
}


