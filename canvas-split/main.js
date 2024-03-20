// import { FileUploader } from './upload.js';

let app = undefined;
let ctl = undefined;
let conf = undefined;
const defaultCanvasLsKey = 'canvas';
const defaultConfigFile = 'config.json';

document.addEventListener('DOMContentLoaded', () => {

    const param = (key) => new URLSearchParams(window.location.search).get(key);

    const load = (configFile, contentFile) => {
        configFile ||= defaultConfigFile;
        contentFile ||= 'template';
        Promise.all([
            fetch(configFile).then(res => res.json()),
            fetch(`models/${contentFile}.json`).then(res => res.json())
        ]).then(([config, content]) => {
            config = sanitizeJSON(config);
            content = sanitizeJSON(content);
            conf = Settings.create(config);
            app = Application.create(config, content);
            ctl = Controls.create();
        }).catch(error => console.error('Error setting up canvas:', error));
    };
    console.log('canvas started');
    load(param('config'), param('model'));
});

class Settings {

    constructor(settings) { Object.assign(this, settings); }

    static create(structure) { return conf || new Settings(structure.settings); }
}

// implicit interface { update(); render(); rerender(); clear(); } 
// to sync DOM to state, initial rendering, sync state to DOM and clear content
class Application {

    constructor(meta, canvas, analysis) {
        Object.assign(this, { meta, canvas, analysis });
        this.renderables = [meta, canvas, analysis];
    }

    // TODO: make singleton
    static create(structure, content) {
        const meta = new PreCanvas(content.meta);
        const canvas = new Canvas(structure, content);
        const analysis = new PostCanvas(canvas, structure, content);
        const newApp = new Application(meta, canvas, analysis);
        newApp.render(defaultConfigFile);
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
        localStorage.setItem(defaultCanvasLsKey, JSON.stringify(this));
    }

    loadFromLs() {
        const json = localStorage.getItem(defaultCanvasLsKey);
        if (!json || json.length == 0) return;
        const content = JSON.parse(sanitizeJSON(json));
        this.repopulate(content);
        this.rerender();
        this.check();
    }

    loadFromFile() {
        // this is called from the server
    }

    static clearLocalStorage() { localStorage.removeItem(defaultCanvasLsKey); }

    toJSON() { return { meta: this.meta, canvas: this.canvas, analysis: this.analysis }; }

    // simple consistency test on cells
    check() { this.canvas.cells.forEach(cell => cell.check()); }
}

class Controls {

    // TODO: make singleton
    static create() {
        const newCtl = new Controls();
        newCtl.render();
        return newCtl;
    }

    render() {
        const ctlElem = document.getElementById('controls');

        const useServer = conf.canvasd.mode !== 'off';
        const host = conf.canvasd.host;
        const port = conf.canvasd.port;
        const sec = conf.canvasd.tls === 'yes' ? "s" : "";

        let buttons = [
            ['lsload', 'Load LS', app.loadFromLs.bind(app)],
            ['lssave', 'Save LS', app.saveToLs.bind(app)],
            ['lsclear', 'Clear LS', Application.clearLocalStorage],
            ['cvclear', 'Clear Canvas', app.clear.bind(app)]];

        if (useServer) {
            ctlElem.appendChild(createElement('input', { type: 'file', id: 'fileInput', style: 'display: none;' }));
            const fileUploader = new FileUploader(`http${sec}://${host}:${port}/upload/`, `ws${sec}://${host}:${port}/ws/`);
            fileUploader.initFileInput('#fileInput');
            buttons.push(['upload', 'Upload File', () => document.getElementById('fileInput').click()]);
        };

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
