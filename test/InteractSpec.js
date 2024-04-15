/* copyright 2024 Unlost GmbH. All rights reserved. */

describe("Other UI interaction", function () {

    beforeAll(function () { });

    afterAll(function () { })

    beforeEach(function () { });

    afterEach(function () { });

    const pause = (millis) => new Promise(resolve => setTimeout(resolve, millis));

    const mouse = (elem, type) => elem.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: false }));

    it("toggles a help overlay when clicking", function () {
        const cellIndex = 4;

        const titleElem = document.querySelector(`.cell[data-index='${cellIndex}'] .cell-title`);
        const helpElem = document.querySelector(`.cell[data-index='${cellIndex}'] .hover-help`);

        // simulate clicking on a canvas title
        mouse(titleElem, 'dblclick');
        pause(500);
        // assert the visibility of the help overlay
        expect(helpElem.getAttribute('display')).toEqual('block');
        // simulate clicking again
        mouse(titleElem, 'dblclick');
        pause(500);
        // assert the help overlay is gone
        expect(helpElem.getAttribute('display')).toEqual('none');
    });

    it("changes the overall score when a cell updates its score", function () {
        const cellIndex = 3;
        // 5 --> 0 means total goes from 4.1 --> 3.7
        const newValue = 0;

        const scoreElem = document.querySelector(`.cell[data-index='${cellIndex}'] select`);
        const totalElem = document.querySelector(`span.score-total`);
        const scorePre = scoreElem.value;

        // change the score in one of the canvas elements
        scoreElem.value = newValue;
        scoreElem.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
        pause(500);

        // assert that the overall score is updated accordingly
        expect(+ totalElem.textContent).toBeLessThan(4.0);
    });
});