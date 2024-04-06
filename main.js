// import { FileUploader } from './network.js';

let app = undefined;
let ctl = undefined;
let conf = undefined;
const defaultLsKey = 'preseedcanvas';
const defaultModel = 'template';
const defaultConfigFile = 'preseed';

document.addEventListener('DOMContentLoaded', () => {

    const param = (key) => new URLSearchParams(window.location.search).get(key);
    const configName = param('config');
    const modelName =  param('model');
    app = Application.load(configName, modelName || defaultModel, (config, modelContent) => {
        conf = Settings.create(config);
        // structure type overrides content type
        modelContent.meta.canvas = configName;
        app = Application.create(config, modelContent);
        ctl = Controls.create();
    });
    console.log('canvas started');
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

    static load(configName, modelName, callback) {
        fetch(`models/${modelName}.json`)
            .then(response => response.json())
            .then(sanitizeJSON)
            .then(modelContent => {
                const configFile = configName || modelContent.meta.canvas || defaultConfigFile;
                return fetch(`conf/${configFile}.json`)
                    .then(response => response.json())
                    .then(sanitizeJSON)
                    .then(config => ({ config, modelContent }));
            })
            .then(({ config, modelContent }) => {
                callback(config, modelContent);
            })
            .catch(error => console.error('Error setting up application:', error));
    };

    static create(structure, content) {
        // meta always stored even if not displayed
        const meta = conf.layout.precanvas === 'yes' ? new PreCanvas(content.meta) : content.meta;
        const canvas = new Canvas(structure, content);
        const analysis = conf.layout.postcanvas === 'yes' ? new PostCanvas(canvas, structure, content) : undefined;
        const newApp = new Application(meta, canvas, analysis);
        newApp.render(defaultConfigFile);
        if (analysis) document.addEventListener('scoreChanged', () => {
            analysis.computeScore();
        });
        newApp.check();
        return newApp;
    }

    update() { this.renderables.forEach(renderable => renderable.update()); }

    render() { this.renderables.forEach(renderable => renderable.render()); }

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
        fetch(`conf/${content.meta?.canvas}.json`)
            .then(response => response.json())
            .then(sanitizeJSON)
            .then(config => {
                document.getElementById('content').innerHTML = '';
                conf = new Settings(config.settings);
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
            ['lsload', 'Load LS', loadMenu.bind(app)],
            ['lssave', 'Save LS', save],
            ['lsclear', 'Clear LS', confirmLsClear],
            ['cvclear', 'Clear Canvas', confirmCanvasClear]];

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

        function loadMenu(event) { overlayMenu(event.target, 'Load canvas:', app.getCanvasNames(), app.loadFromLs.bind(app), app.delFromLs.bind(app)); }

        function save(event) { app.saveToLs(); }

        function confirmCanvasClear(event) { confirmStep(event.target, app.clear.bind(app)); }

        function confirmLsClear(event) { confirmStep(event.target, Application.clearLocalStorage); }

        function confirmDownloadLs(event) { confirmStep(event.target, app.downloadLs.bind(app)); }

        function uploadLsFile(event) { document.getElementById('lsFileInput').click(); }
    }
}
