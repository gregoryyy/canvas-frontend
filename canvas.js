document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const modelParam = params.get('model');
    init(modelParam || 'template');


    // load files and set up canvas
    function init(contentFile) {
        Promise.all([
            fetch('preseed.json').then(response => response.json()),
            fetch(`models/${contentFile}.json`).then(response => response.json())
        ]).then(([structure, content]) => {
            render(structure, content);
        }).catch(error => {
            console.error('Error setting up canvas:', error);
        });
    }

    // initial rendering
    function render(structure, content) {

        const precanvas = new PreCanvas(content.meta);
        precanvas.render();
        const canvas = new Canvas(structure, content);
        canvas.render();
        const postcanvas = new PostCanvas(canvas, structure, content);
        postcanvas.render();
        postcanvas.computeScore();

        document.addEventListener('scoreChanged', () => {
            postcanvas.computeScore();
        });
    }
});

class Canvas {

    constructor(structure, content) {
        this.structure = structure;
        this.content = content;
        this.cells = structure.canvas.map((structData, index) => {
            // INFO: assuming content is always stored in seq., then no need for indexes
            return new Cell(index, structData, content.canvas[index]);
        });
    }

    render() {
        const element = document.getElementById('canvas');
        element.innerHTML = '';
        this.cells.forEach(cell => element.appendChild(cell.render()));
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
        this.cards = content.content.map((cardData, index) => {
            return new Card(index, cardData);
        });
    }

    addCard(card) {
        this.cards.push(card);
    }

    /**
     * creates a new card
     */
    createCard(cardContainerDiv) {
        const name = newCardName(this.title);
        const newCard = new Card(name);
        this.addCard(newCard);
        cardContainerDiv.appendChild(newCard.render());
        // Optional: focus the new card for immediate editing
    }

    render() {
        // TODO: replace id with data attr
        const cellDiv = createElement('div', { class: "cell", id: this.id, 'data-index': this.index });
        const cellTitle = createElement('div', { class: "cell-title-container" });
        const titleH3 = createElement('h3', { class: "cell-title" }, this.title);
        cellTitle.appendChild(titleH3);

        if (this.hasScore === "yes") {
            this.addScoringDropdown(cellTitle);
        }
        cellDiv.appendChild(cellTitle);
        this.addHelpOverlay(titleH3);

        const cardContainerDiv = createElement('div', { class: 'cell-card-container' });
        cellDiv.appendChild(cardContainerDiv);

        this.cards.forEach(card => {
            cardContainerDiv.appendChild(card.render());
        });

        this.dom = cellDiv;
        this.makeBgClickable(cardContainerDiv);
        return cellDiv;
    }

    addHelpOverlay(parentElement) {
        const helpDiv = createElement('div', { class: 'hover-help' });
        if (this.helptitle) {
            const helptitle = createElement('h4', {}, this.helptitle);
            helpDiv.appendChild(helptitle);
        }
        if (this.helptext) {
            const helptext = createElement('p', {}, this.helptext);
            helpDiv.appendChild(helptext);
        }
        parentElement.appendChild(helpDiv);

        const hoverHelp = (elem) => {
            helpDiv.style.display = helpDiv.style.display === 'block' ? 'none' : 'block';
        }
        parentElement.addEventListener('dblclick', function () {
            hoverHelp();
        });

        addLongPressListener(parentElement, hoverHelp);
    }

    addScoringDropdown(parentElement) {
        const select = document.createElement('select');
        select.id = "score" + this.id;
        select.className = 'scoring-dropdown';
        for (let i = 0; i <= 5; i++) {
            const option = createElement('option', { value: i }, i === 0 ? "-" : i);
            select.appendChild(option);
        }
        select.value = this.score;
        select.addEventListener('change', (event) => {
            this.hasScore = event.target.value;
            document.dispatchEvent(new CustomEvent('scoreChanged'));
        });
        parentElement.appendChild(select);
    }

    makeBgClickable(cardContainerDiv) {

        // Existing render code...
        cardContainerDiv.addEventListener('dblclick', (e) => {
            if (e.target === cardContainerDiv) { // Ensures the container itself was clicked
                this.createCard(cardContainerDiv);
            }
        });

        addLongPressListener(cardContainerDiv, () => {
            this.createCard(cardContainerDiv);
        });

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

        this.dom = card;
        makeEditable(card, 'card-editing', true);
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
        makeEditable(title, 'editing');
        const description = createElement('p', {}, this.content);
        makeEditable(description, 'editing');
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
            makeEditable(anaDiv, 'editing', false, paragraph);
        });
    }

    // TODO: this is hardcoded and should be read from the file
    addScorer(parentElement) {
        const scoreLabel = createElement('h3', { class: 'score-total-label' }, 'Score');
        parentElement.appendChild(scoreLabel);
        // FIXME
        var num = 0.0;
        const score = createElement('span', { class: 'score-total' }, num.toFixed(1));
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

/**
 * create an element
 * 
 * @param {string} tagName 
 * @param {object} attributes 
 * @param {string} text 
 * @returns 
 */
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
 * @param {string} editClass the class label while editing
 * @param {boolean} removeEmpty true if element should be removed if empty
 * @param {string} editElem dom element made editable
 */
function makeEditable(elem, editClass, removeEmpty = false, editElem = null) {
    elem.addEventListener('dblclick', function () {
        el = editElem != null ? editElem : this;
        el.classList.contains(editClass) ? finishEdit(el, removeEmpty) : startEdit(el);
    });

    addLongPressListener(elem, function () {
        el = editElem != null ? editElem : elem;
        el.classList.contains(editClass) ? finishEdit(el, removeEmpty) : startEdit(el);
    });

    // max one field editable at a time
    elem.addEventListener('blur', function () {
        el = editElem != null ? editElem : this;
        finishEdit(el, removeEmpty);
    });

    // allow multiline entries
    el = editElem != null ? editElem : elem;
    el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            if (e.shiftKey) {
                // finalize editing by removing focus
                finishEdit(el);
            } else {
                e.preventDefault();
                insertBr();
            }
        }
        if (e.key === 'Escape') {
            finishEdit(el);
        }
    });

    function startEdit(elem) {
        elem.contentEditable = true;
        elem.classList.add(editClass);
        elem.focus();
        setCaretAtEnd(elem);
    }

    /**
     * Finish editing
     * 
     * @param {} elem element being editable
     * @param {} removeEmpty remove if empty string
     */
    function finishEdit(elem, removeEmpty = false) {
        elem.contentEditable = false;
        elem.classList.remove(editClass);
        if (removeEmpty && elem.textContent.trim().length == 0) {
            elem.remove();
        }
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
        if (Math.abs(newX - startX) > 10 || Math.abs(newY - startY) > 10) {
            cancel();
        }
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
    range.collapse(false); // false to collapse the range to its end
    selection.removeAllRanges();
    selection.addRange(range);
    element.focus(); // Finally, focus the element to ensure cursor visibility
}

/**
 * create card with name in singular
 * 
 * @param {string} name 
 */
function newCardName(name) {
    var s = "New " + name;
    if (s.endsWith('ss'))
        return s;
    // chop off the plural s
    if (s.endsWith('s'))
        return s.substring(0, s.length - 1);
    return s;
}


