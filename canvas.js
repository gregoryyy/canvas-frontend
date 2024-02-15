/*
 * load data and populate canvas
 */
document.addEventListener('DOMContentLoaded', function () {
    fetch('preseed.json')
        .then(response => response.json())
        .then(data => {
            const precanvas = new PreCanvas(data.meta);
            const canvas = new Canvas(data);
            const postcanvas = new PostCanvas(canvas, data);
            precanvas.render();
            canvas.render();
            postcanvas.render();

            // load actual data
            canvas.load('example.json');
            canvas.initCards();
            // canvas.computeScore();

        });
});

/**
 * The main Canvas that contains all cells
 */
class Canvas {
    constructor(data) {
        this.cells = data.canvas.map(cellData => new Cell(cellData));
    }

    addCell(cell) {
        this.cells.push(cell);
    }

    initCards() {
        // TODO: only as a placeholder; remove
        this.cells.forEach(cell => {
            cell.addCard(new Card("Item 1"));
        });
    }

    render() {
        const canvas = document.querySelector('.canvas');
        this.cells.forEach(cell => {
            canvas.appendChild(cell.render());
        });
        this.dom = canvas;
        return canvas;
    }

    /**
     * update the canvas content with data from the file, which 
     * should be a JSON with a canvas object
     * 
     * @param {string} file 
     */
    load(file) {
        fetch(file)
            .then(response => response.json())
            .then(data => {
                this.replaceContent(data.canvas);
            });
    }

    /**
     * update all content of the cell, incl. all cards and score
     * 
     * @param {*} data 
     */
    replaceContent(data) {
        data.forEach(cellData => {
            // Find the corresponding cell in the canvas by ID
            let cell = this.findCellById(cellData.id);
            if (cell) {
                cell.replaceContent(cellData.content, cellData.score);
            }
        });
    }

    findCellById(id) {
        // consider map id => cell
        return this.cells.find(cell => cell.id === id);
    }
}

/**
 * A cell is a part of a Canvas
 */
class Cell {
    constructor(cellData) {
        this.id = cellData.id;
        this.title = cellData.title;
        this.helptitle = cellData.subtitle;
        this.helptext = cellData.description;
        this.score = cellData.score;
        this.cards = [];
    }

    addCard(card) {
        this.cards.push(card);
    }

    /**
     * Update all content of this card, incl. cards and score.
     * @param {*} content list of text content
     * @param {*} score numeric score
     */
    replaceContent(content, score) {
        this.cards = [];
        // TODO: store as fields
        const cellDiv = document.getElementById(this.id);
        if (cellDiv) {
            const cardDiv = cellDiv.querySelector('.cell-card-container');
            content.forEach(line => {
                const card = new Card(line);
                this.addCard(card);
                cardDiv.appendChild(card.render());
            });
        }

        this.score = score;
        // TODO: auto-synchronize
        const select = document.getElementById("score" + this.id);
        if (select) {
            select.value = score;
        }
    }

    render() {
        const cellDiv = document.createElement('div');
        cellDiv.className = 'cell';
        cellDiv.id = this.id;

        const cellTitle = document.createElement('div');
        cellTitle.classList.add('cell-title-container');

        const titleH3 = document.createElement('h3');
        titleH3.classList.add('cell-title');
        titleH3.textContent = this.title;
        cellTitle.appendChild(titleH3);

        if (this.score === "yes") {
            this.addScoringDropdown(cellTitle);
        }

        cellDiv.appendChild(cellTitle);

        // hover help on title
        this.addHelpOverlay(titleH3);


        // populate with cards
        const cardContainerDiv = document.createElement('div');
        cardContainerDiv.className = 'cell-card-container';
        cellDiv.appendChild(cardContainerDiv);

        this.cards.forEach(card => {
            cardContainerDiv.appendChild(card.render());
        });

        this.dom = cellDiv;
        this.makeBgClickable(cardContainerDiv);
        return cellDiv;
    }

    addHelpOverlay(parentElement) {
        const helpDiv = document.createElement('div');
        helpDiv.classList.add('hover-help');
        if (this.helptitle) {
            const helptitle = document.createElement('h4');
            helptitle.textContent = this.helptitle;
            helpDiv.appendChild(helptitle);
        }
        if (this.helptext) {
            const helptext = document.createElement('p');
            helptext.textContent = this.helptext;
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
            let option = document.createElement('option');
            option.value = i;
            option.text = i === 0 ? "-" : i;
            select.appendChild(option);
        }
        parentElement.appendChild(select);
    }

    makeBgClickable(cardContainerDiv) {

        // Existing render code...
        cardContainerDiv.addEventListener('dblclick', (e) => {
            if (e.target === cardContainerDiv) { // Ensures the container itself was clicked
                const newCard = new Card("New Card Text");
                this.addCard(newCard);
                cardContainerDiv.appendChild(newCard.render());
                // Optional: focus the new card for immediate editing
            }
        });

        addLongPressListener(cardContainerDiv, () => {
            const newCard = new Card("New Card Text");
            this.addCard(newCard);
            cardContainerDiv.appendChild(newCard.render());
        });

        // Ensure the container is always clickable
        cardContainerDiv.style.minHeight = '50px'; // Example minimum height
        cardContainerDiv.style.cursor = 'pointer'; // Change cursor on hover
        // Existing render code continues...
    }
}

/**
 * a card is an object in a cell
 */
class Card {
    constructor(text) {
        this.text = text;
    }

    render() {
        const card = document.createElement('div');
        card.textContent = this.text;
        card.classList.add('card');

        this.dom = card;
        makeEditable(card, 'card-editing', true);
        return card;
    }
}

/**
 * PreCanvas displays meta information about the canvas
 */
class PreCanvas {
    constructor(data) {
        this.title = data.type;
        this.content = data.description;
    }

    render() {
        const metaDiv = document.querySelector('.precanvas');
        const title = document.createElement('h2');
        title.textContent = this.title;
        makeEditable(title, 'editing');
        const description = document.createElement('p');
        description.textContent = this.content;
        makeEditable(description, 'editing');
        metaDiv.appendChild(title);
        metaDiv.appendChild(description);
    }
}

/**
 * PostCanvas contains analysis from a Canvas and additional data
 */
class PostCanvas {
    constructor(canvas, data) {
        this.title = 'Analysis';
        this.content = data.meta.description;
        this.canvas = canvas;
        this.total = data.scoring[0].total;
        this.scores = data.scoring[0].scores;
    }

    render() {

        const anaDiv = document.querySelector('.postcanvas');
        const cellTitle = document.createElement('div');
        cellTitle.classList.add('cell-title-container');
        const titleH3 = document.createElement('h3');
        titleH3.classList.add('cell-title');
        titleH3.textContent = this.title;
        cellTitle.appendChild(titleH3);
        anaDiv.appendChild(cellTitle);

        if (this.total) {
            this.scoreSpan = this.addScorer(cellTitle);
            this.computeScore();
        }

        const description = document.createElement('p');
        description.textContent = this.content;
        anaDiv.appendChild(description);
        makeEditable(anaDiv, 'editing', description);
    }

    // TODO: this is hardcoded and should be read from the file
    addScorer(parentElement) {
        const score = document.createElement('span');
        score.className = 'score-total';
        var num = 0.0;
        score.textContent = num.toFixed(1);
        parentElement.appendChild(score);
        return score;
    }

    computeScore() {
        const score = index => parseFloat(document.getElementById(`score${index}`).value) || 0;

        // Apply the specific formula
        let Product = score(1) * 1 / 3 + score(2) * 1 / 3 + score(7) * 1 / 3;
        let Market = score(4) * 1 / 3 + score(9) * 1 / 3 + score(5) * 1 / 3;
        let Progress = score(3) * 1 / 2 + score(6) * 1 / 2;
        let Team = score(8) * 1;
        let total = Product * 3 / 10 + Market * 1 / 5 + Progress * 1 / 5 + Team * 3 / 10;
        this.scoreSpan.textContent = total;

        // "scores": {
        //     "Product": "score(1) * 1/3 + score(2) * 1/3 + score(7) * 1/3",
        //     "Market": "score(4) * 1/3 + score(9) * 1/3 + score(5) * 1/3",
        //     "Progress": "score(3) * 1/2 + score(6) * 1/2",
        //     "Team": "score(8) * 1"
        // }
        // "total": "Product * 3/10 + Market * 1/5  + Progress * 1/5 + Team * 3/10",
        return total;
    }

}

/* static functions */

/**
 * Toggle standard editing mode on element
 * 
 * @param {elem} elem dom element doubleclicked
 * @param {string} editclass the class label while editing
 * @param {boolean} removeEmpty true if element should be removed if empty
 * @param {string} editelem dom element made editable
 */
function makeEditable(elem, editclass, removeEmpty = false, editelem = null) {
    elem.addEventListener('dblclick', function () {
        el = editelem != null ? editelem : this;
        el.classList.contains(editclass) ? finishEdit(el, removeEmpty) : startEdit(el);
    });

    addLongPressListener(elem, function () {
        el = editelem != null ? editelem : elem;
        el.classList.contains(editclass) ? finishEdit(el, removeEmpty) : startEdit(el);
    });

    // max one field editable at a time
    elem.addEventListener('blur', function () {
        el = editelem != null ? editelem : this;
        finishEdit(el, removeEmpty);
    });

    // allow multiline entries
    el = editelem != null ? editelem : elem;
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
        elem.classList.add(editclass);
        elem.focus();
    }

    /**
     * Finish editing
     * 
     * @param {} elem element being editable
     * @param {} removeEmpty remove if empty string
     */
    function finishEdit(elem, removeEmpty = false) {
        elem.contentEditable = false;
        elem.classList.remove(editclass);
        if (removeEmpty && elem.textContent.trim().length == 0) {
            elem.remove();
        }
    }

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
 * Add a long press listener for pointer and touch devices
 * 
 * @param {Element} element 
 * @param {Function}} callback 
 * @param {number} duration 
 */
function addLongPressListener(element, callback, duration = 500) {
    let timerId = null;

    const start = (event) => {
        if ((event.type === 'mousedown' && event.button !== 0) || event.target !== element) return;
        timerId = setTimeout(() => callback(element), duration);
    };

    const cancel = () => {
        clearTimeout(timerId);
    };

    // Attach listeners
    element.addEventListener('mousedown', start);
    element.addEventListener('touchstart', start, { passive: true });
    element.addEventListener('mouseup', cancel);
    element.addEventListener('mouseleave', cancel);
    element.addEventListener('touchend', cancel);
    element.addEventListener('touchcancel', cancel);
}



