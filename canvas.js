/*
 * load data and populate canvas
 */
document.addEventListener('DOMContentLoaded', function () {
    fetch('preseed.json')
        .then(response => response.json())
        .then(data => {
            const precanvas = new PreCanvas(data.meta);
            const canvas = new Canvas(data);
            canvas.initCards();
            const postcanvas = new PostCanvas(canvas, data);
            precanvas.render();
            canvas.render();
            postcanvas.render();

            // load actual data
            canvas.load('example.json');
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
        // TODO: only as a placeholder
        this.cells.forEach(cell => {
            cell.addCard(new Card("Item 1"));
        });
    }

    load(file) {

    }

    render() {
        const canvas = document.querySelector('.canvas');
        this.cells.forEach(cell => {
            canvas.appendChild(cell.render());
        });
    }
}

/**
 * A cell is a part of a Canvas
 */
class Cell {
    constructor(cellData) {
        this.title = cellData.title;
        this.subtitle = cellData.subtitle;
        this.description = cellData.description;
        this.score = cellData.score;
        this.cards = [];
    }

    addCard(card) {
        this.cards.push(card);
    }

    render() {
        const cellDiv = document.createElement('div');
        cellDiv.className = 'cell';

        const cellTitle = document.createElement('div');
        cellTitle.classList.add('cell-title-container');

        const title = document.createElement('h3');
        title.textContent = this.title;
        cellTitle.appendChild(title);

        // TODO: hover
        // if (this.subtitle) {
        //     const subtitle = document.createElement('h4');
        //     subtitle.textContent = this.subtitle;
        //     cellDiv.appendChild(subtitle);
        // }

        // if (this.description) {
        //     const description = document.createElement('p');
        //     description.textContent = this.description;
        //     cellDiv.appendChild(description);
        // }

        if (this.score === "yes") {
            this.addScoringDropdown(cellTitle);
        }

        cellDiv.appendChild(cellTitle);

        this.cards.forEach(card => {
            cellDiv.appendChild(card.render());
        });


        return cellDiv;
    }

    addScoringDropdown(parentElement) {
        const select = document.createElement('select');
        select.className = 'scoring-dropdown';
        for (let i = 0; i <= 5; i++) {
            let option = document.createElement('option');
            option.value = i;
            option.text = i === 0 ? "-" : i;
            select.appendChild(option);
        }
        parentElement.appendChild(select);
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
        return card;
    }
}

/**
 * Help cards have special layout 
 */
class HelpCard {

    render() {
        const card = super.render();
        card.classList.add('helpcard');
    }
}

/**
 * PreCanvas contains meta information about the canvas
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
        //title.addEventListener('click', toggleEditable);
        const description = document.createElement('p');
        description.textContent = this.content;
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
        this.content = data.description;
        this.canvas = canvas;
    }

    render() {
        const metaDiv = document.querySelector('.postcanvas');
        const title = document.createElement('h3');
        title.textContent = this.title;
        const description = document.createElement('p');
        description.textContent = this.content;
        metaDiv.appendChild(title);
        metaDiv.appendChild(description);
    }
}

