
describe("Card manipulations", function () {

    beforeAll(function () { });

    afterAll(function () { })

    beforeEach(function () { });

    afterEach(function () { });

    it("edits a card", function () {
        const cellIndex = 4;
        const cardIndex = 1;
        // edit a card
        const elem = Card.indexElem(app.canvas.cells[cellIndex].cardIndex(cardIndex));
        elem.dispatchEvent(new MouseEvent('click'));
        elem.textContent = elem.textContent + ' Test';
        // finish editing
        elem('blur');
        // assert changes in the state
        const cardState = app.canvas.cells[cellIndex].cards[cardIndex];
        expect(cardState).toMatch(new RegExp('.+ Test$'));
    });

    // it("removes a card", function () {
    //     // remove a card
    //     // assert the card is removed from the DOM
    //     // assert changes in the state
    // });

    // it("adds a new card", function () {
    //     // add a new card
    //     // assert the new card is added to the DOM
    //     // assert changes in the state
    // });

    // it("changes a card type", function () {
    //     // change a card type
    //     // assert the DOM reflects the new card type
    //     // assert changes in the state
    // });
})

