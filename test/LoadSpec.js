/* copyright 2024 Unlost GmbH. All rights reserved. */

describe("Application loading and saving", function () {

    beforeAll(function () {

        console.log('test started');
    });

    afterAll(function () { })

    beforeEach(function () { });

    afterEach(function () { });

    sampleCard = () => {
        expect(app.meta.title).toEqual("Example Startup");
        const sample = app.canvas.cells[4];
        expect(sample.cards[1].text).toEqual("GTM Strategy 2");
        const cards = sample.cardElems();
        expect(cards.length).toEqual(2);
    }

    it("loads the state correctly for model=test", function (done) {
        expect(app).toBeDefined();
        expect(ctl).toBeDefined();
        expect(app.meta.title).toBeDefined();
        sampleCard();
        done();
    });

    it("saves to local storage and loads correctly", function (done) {
        app.saveToLs();
        app.clear();
        const sample = app.canvas.cells[4];
        expect(sample.cards.length).toEqual(0);
        const cards = sample.cardElems();
        expect(cards.length).toEqual(0);
        app.loadFromLs();
        sampleCard();
        done();
    });
});

