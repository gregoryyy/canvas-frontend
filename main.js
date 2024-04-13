// import { FileUploader } from './network.js';

let app = undefined;
let ctl = undefined;
let conf = undefined;
const defaultLsKey = 'preseedcanvas';
const defaultModel = 'template';
const configsFile = 'configs.json';
const defaultConfigFile = 'preseed';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const param = (key) => new URLSearchParams(window.location.search).get(key);

        const configName = param('config');
        const modelName = param('model') || defaultModel;
        const modelContent = await loadJson(`models/${modelName}.json`);
        const configFile = configName || modelContent.meta.canvas || defaultConfigFile;
        const config = await loadJson(`conf/${configFile}.json`);
        const configList = await loadJson(`conf/${configsFile}`);
        lg('data loaded');

        conf = Settings.create(config);
        conf.canvasTypes = configList.map(type => [type.name, type.file]);
        app = Application.create(config, modelContent);
        ctl = Controls.create();
        console.log('canvas started');
    } catch (error) {
        console.error('Error setting up application:', error);
    }
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
        this.renderables = [meta, canvas, analysis].filter(Boolean);
    }

    static create(structure, content) {
        // meta always stored even if not displayed
        Card.count = 0;
        const meta = new PreCanvas(content.meta, conf.layout.precanvas === 'yes');
        const canvas = new Canvas(structure, content);
        const analysis = new PostCanvas(canvas, structure, content, conf.layout.postcanvas === 'yes');
        const newApp = new Application(meta, canvas, analysis);
        // enforce type from config
        newApp.meta.canvas = structure.meta.canvas;
        newApp.render(defaultConfigFile);
        newApp.setupScorer();
        newApp.check();
        return newApp;
    }

    setupScorer() {
        if (this.analysis.display && this.analysis.total) {
            document.addEventListener('scoreChanged', () => this.analysis.computeScore());
        }
    }

    restructure(structure) {
        const elem = document.getElementById('content');
        lg(structure.canvas.map(cell => cell.title));
        lg(this.canvas.cells.map(cell => cell.cards?.length));
        elem.innerHTML = '';
        this.structure = structure;
        this.meta.canvas = structure.meta.canvas;
        this.meta.display = conf.layout.precanvas === 'yes';
        this.analysis.display = conf.layout.postcanvas === 'yes';
        this.canvas.cells = structure.canvas.map((structData, index) => new Cell(index, structData,
            this.canvas.cells[index] ?? []));
        this.render();
        lg(this.canvas.cells.map(cell => cell.cards?.length));
    }

    update() { this.renderables.forEach(renderable => renderable.update()); }

    render() {
        this.renderables.forEach(renderable => renderable.render());
        this.renderType();
    }

    renderType() {
        document.getElementById('content').appendChild(createElement('div',
            { class: 'canvastype' }, conf.canvasTypes.find(([_, e1]) => e1 === this.meta.canvas)[0]));
    }

    rerender() { this.renderables.forEach(renderable => renderable.rerender()); }

    clear() { this.renderables.forEach(renderable => renderable.clear()); }

    saveToLs(title = this.meta.title) {
        this.check();
        const canvases = JSON.parse(localStorage.getItem(defaultLsKey)) || {};
        canvases[this.meta.title] = JSON.stringify(this.toJSON());
        localStorage.setItem(defaultLsKey, JSON.stringify(canvases));
    }

    loadFromLs(title) {
        title ||= this.meta?.title;
        const storedCanvases = localStorage.getItem(defaultLsKey);
        if (!storedCanvases) return;
        const canvases = JSON.parse(storedCanvases);
        if (!canvases[title]) return;
        const content = sanitizeJSON(JSON.parse(canvases[title]));
        fetch(`conf/${content.meta?.canvas}.json`).then(response => response.json()).then(sanitizeJSON).then(config => {
            document.getElementById('content').innerHTML = '';
            const temp = conf.canvasTypes;
            conf = new Settings(config.settings);
            conf.canvasTypes = temp;
            app = Application.create(config, content);
            app.check();
        });
    }

    downloadLs() { downloadLs(defaultLsKey); }

    uploadLs() { uploadLs(defaultLsKey); }

    delFromLs(title) {
        const storedCanvases = localStorage.getItem(defaultLsKey);
        if (!storedCanvases) return;
        const canvases = JSON.parse(storedCanvases);
        canvases[title] = undefined;
        localStorage.setItem(defaultLsKey, JSON.stringify(canvases));
    }

    getCanvasNames() {
        const canvases = JSON.parse(localStorage.getItem(defaultLsKey)) || {};
        return Object.keys(canvases);
    }

    changeType(type) {
        loadJson(`conf/${type}.json`).then(config => {
            const temp = conf.canvasTypes;
            conf = new Settings(config.settings);
            conf.canvasTypes = temp;
            this.restructure(config);
            this.check();
        }).catch(error => console.error('Error loading file:', error));
    }

    static clearLocalStorage() { localStorage.removeItem(defaultLsKey); }

    toJSON() { return { meta: this.meta, canvas: this.canvas, analysis: this.analysis }; }

    // simple consistency test on cells
    check() { this.canvas.cells.forEach(cell => cell.check()); }
}

class Controls {

    static create() {
        if (ctl) return ctl;
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
            ['cvclear', 'Clear Canvas', confirmCanvasClear],
            ['chtype', 'Canvas Type', typeMenu.bind(app)],
            ['lsload', 'Load LS', loadMenu.bind(app)],
            ['lssave', 'Save LS', confirmCanvasSave],
            ['lsclear', 'Clear LS', confirmLsClear]];

        if (useServer) {
            ctlElem.appendChild(createElement('input', { type: 'file', id: 'fileInput', style: 'display: none;' }));
            const fileUploader = new FileUploader(`http${sec}://${host}:${port}/upload/`, `ws${sec}://${host}:${port}/ws/`);
            fileUploader.initFileInput('#fileInput');
            buttons.push(['upload', 'Upload File', () => document.getElementById('fileInput').click()]);
        };

        if (conf.localstorage.filemenu === 'yes') {
            buttons.push(['lsdown', 'Download LS', confirmDownloadLs]);
            buttons.push(['lsup', 'Upload LS', uploadLsFile]);
            ctlElem.appendChild(createElement('input',
                { type: 'file', id: 'lsFileInput', onchange: `uploadLs(event, '${defaultLsKey}')`, style: 'display: none;' }));
        }

        buttons.forEach(button => {
            const btn = createElement('div', { id: button[0], class: 'control' }, button[1])
            ctlElem.appendChild(btn);
            btn.addEventListener('click', button[2]);
            btn.addEventListener('click', () => {
                btn.classList.add('clicked');
                setTimeout(() => btn.classList.remove('clicked'), 500);
            });
        });

        function typeMenu(event) { overlayMenu(event.target, 'Select canvas type:', conf.canvasTypes, app.changeType.bind(app)); }

        function loadMenu(event) { overlayMenu(event.target, 'Load canvas:', app.getCanvasNames(), app.loadFromLs.bind(app), app.delFromLs.bind(app)); }

        function confirmCanvasSave(event) { confirmStep(event.target, app.saveToLs.bind(app)); }

        function confirmCanvasClear(event) { confirmStep(event.target, app.clear.bind(app)); }

        function confirmLsClear(event) { confirmStep(event.target, Application.clearLocalStorage); }

        function confirmDownloadLs(event) { confirmStep(event.target, app.downloadLs.bind(app)); }

        function uploadLsFile(event) { document.getElementById('lsFileInput').click(); }
    }
}
