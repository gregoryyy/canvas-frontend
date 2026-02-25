/* copyright 2025 Unlost GmbH. All rights reserved. */

describe("Card manipulations", function () {

    beforeAll(function () { });

    afterAll(function () { })

    beforeEach(function () { });

    afterEach(function () { });

    const pause = (millis) => new Promise(resolve => setTimeout(resolve, millis));
    const stateCards = (cell) => app.canvas.cells[cell].cards;
    const domCards = (cell) => app.canvas.cells[cell].cardElems();
    const mouse = (elem, type) =>  elem.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: false }));

    it("edits a card", function () {
        const cellIndex = 4; const cardPosition = 1;
        // edit a card
        const elem = Card.getElement(app.canvas.cells[cellIndex].getCardIndex(cardPosition));
        mouse(elem, 'click');
        elem.textContent = elem.textContent + ' Test';
        // finish editing
        elem.blur();
        pause(500);
        // assert changes in the state
        // TODO: cell.check()
        const cardState = app.canvas.cells[cellIndex].cards[cardPosition];
        expect(cardState.content).toMatch(new RegExp('.+ Test$'));
    });

    it("removes a card", async function () {
        const cellIndex = 0; const cardPosition = 1;
        const statePre = stateCards(cellIndex).length;
        const domPre = domCards(cellIndex).length;

        // state and dom agree
        expect(statePre).toEqual(domPre);

        const elem = Card.getElement(app.canvas.cells[cellIndex].getCardIndex(cardPosition));
        mouse(elem, 'click');
        // remove a card
        elem.textContent = '';
        // finish editing
        elem.blur();
        await pause(500);

        const statePost = stateCards(cellIndex).length;
        const domPost = domCards(cellIndex).length;

        // assert the card is removed from the DOM and state
        expect(statePost).toEqual(domPost);
        expect(statePost).toEqual(statePre - 1);
    });

    it("adds a new card", async function () {
        const cellIndex = 0;
        const statePre = stateCards(cellIndex).length;
        //const domPre = domCards(cellIndex).length;

        // add a new card
        const elem = app.canvas.cells[cellIndex].cardsElem();
        mouse(elem, 'dblclick');
        // bubble?
        elem.blur();
        await pause(500);

        // assert the new card is added to the DOM
        const statePost = stateCards(cellIndex).length;
        const domPost = domCards(cellIndex).length;

        // assert changes in the state
        expect(statePost).toEqual(domPost);
        expect(statePost).toEqual(statePre + 1);
    });

    it("changes a card type", function (done) {
        const cellIndex = 4;
        const cardPosition = 1;

        const stateCell = app.canvas.cells[cellIndex];

        // change a card type
        // edit a card
        const elem = Card.getElement(app.canvas.cells[cellIndex].getCardIndex(cardPosition));
        mouse(elem, 'click');
        const textPre = elem.textContent;
        elem.textContent = ':? ' + textPre;
        // finish editing
        elem.blur();
        // assert the DOM reflects the new card type
        expect(elem.classList.contains('query')).toBeTruthy();
        expect(elem.textContent).toEqual(textPre);
        // assert changes in the state
        expect(stateCell.cards[cardPosition].content).toEqual(textPre);
        expect(stateCell.cards[cardPosition].type).toEqual('query');
        done();
    });
})

