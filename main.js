/* copyright 2025 Unlost GmbH. All rights reserved. */

// application state and configuration
export { app, ctl, conf };

import { Canvas, Cell, Card, PreCanvas, PostCanvas } from './canvas.js';
import { createElement, overlayMenu, confirmStep, convertDivToSvg,
    downloadLs, uploadLs, loadJson, sanitizeJSON, showToast, lg } from './util.js';

let app = undefined;
let ctl = undefined;
let conf = undefined;
const defaultLsKey = 'preseedcanvas';
const defaultModel = 'template';
const configsFile = 'configs.json';
const defaultConfigName = 'preseed';
const appSignature = 'Unlost Canvas App v1.3.5';

document.addEventListener('DOMContentLoaded', () => {
    const param = (key) => new URLSearchParams(window.location.search).get(key);
    const modelName = param('model') || defaultModel;
    loadJson(`models/${modelName}.json`)
        .then(modelData => {
            const configName = param('config') || modelData.meta.canvas || defaultConfigName;
            return Promise.all([modelData, loadJson(`conf/${configName}.json`), loadJson(`conf/${configsFile}`)]);
        })
        .then(([modelData, config, configList]) => {
            conf = Settings.create(config);
            conf.canvasTypes = configList.map(type => [type.name, type.file]);
            app = Application.create(config, modelData);
            ctl = Controls.create();
            console.log('Canvas started');
        })
        .catch(error => {
            console.error('Error during the canvas setup:', error);
        });
});

// auto-save to localStorage before page unload
window.addEventListener('beforeunload', () => {
    if (app?.meta?.title) {
        try { app.saveToLs(app.meta.title, true); } catch (e) { /* silent */ }
    }
});

// keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Ctrl+S / Cmd+S: save to localStorage
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (app) {
            app.saveToLs();
        }
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
        newApp.render(defaultConfigName);
        if (newApp.analysis.display && analysis.total) {
            document.addEventListener('scoreChanged', () => analysis.computeScore());
        }
        newApp.check();
        return newApp;
    }

    restructure(structure) {
        const elem = document.getElementById('content');
        lg(structure.canvas.map(cell => cell.title));
        lg(this.canvas.cells.map(cell => cell.cards?.length));
        elem.innerHTML = '';
        this.structure = structure;
        this.meta.canvas = structure.meta.canvas;

        this.meta.display = conf.layout.precanvas === 'yes';
        if (!this.meta.display) this.meta.description = undefined;
        else this.meta.description ??= "Description...";

        this.analysis.display = conf.layout.postcanvas === 'yes';
        if (!this.analysis.display) this.analysis.content = undefined;
        else this.analysis.content ??= "Analysis...";

        this.analysis.total = structure.scoring[0]?.total;
        this.analysis.scores = structure.scoring[0]?.scores;
        this.canvas.cells = structure.canvas.map((structData, index) => new Cell(index, structData,
            this.canvas.cells[index] ?? []));
        this.render();
        lg(this.canvas.cells.map(cell => cell.cards?.length));
    }

    update() { this.renderables.forEach(renderable => renderable.update()); }

    render() {
        this.renderables.forEach(renderable => renderable.render());
        this.renderSignature();
    }

    renderSignature() {
        const content = document.getElementById('content');
        const sig = createElement('div', { class: 'signature' });
        content.appendChild(sig);

        sig.appendChild(createElement('div',
            { class: 'canvastype' }, conf.canvasTypes.find(([_, e1]) => e1 === this.meta.canvas)[0]));
        sig.appendChild(createElement('div',
            { class: 'canvassource' }, appSignature));

    }

    rerender() { this.renderables.forEach(renderable => renderable.rerender()); }

    clear() { this.renderables.forEach(renderable => renderable.clear()); }

    saveToLs(title = this.meta.title, silent = false) {
        this.check();
        const canvases = JSON.parse(localStorage.getItem(defaultLsKey)) || {};
        canvases[this.meta.title] = this.toJSON();
        localStorage.setItem(defaultLsKey, JSON.stringify(canvases));
        if (!silent) showToast('Saved');
    }

    loadFromLs(title) {
        title ||= this.meta?.title;
        const storedCanvases = localStorage.getItem(defaultLsKey);
        if (!storedCanvases) return;
        const canvases = JSON.parse(storedCanvases);
        if (!canvases[title]) return;
        const content = sanitizeJSON(canvases[title]);
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
        delete canvases[title];
        localStorage.setItem(defaultLsKey, JSON.stringify(canvases));
    }

    getCanvasNames() {
        const canvases = JSON.parse(localStorage.getItem(defaultLsKey)) || {};
        return Object.keys(canvases).filter(key => canvases[key] != null);
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
        const convertCanvasToSvg = () => convertDivToSvg('content', 'canvas.svg');

        let buttons = [
            ['cvclear', 'Clear Canvas', confirmCanvasClear],
            ['chtype', 'Canvas Type', typeMenu.bind(app)],
            ['cvsvg', 'Export SVG', confirmCanvasSvg],
            ['lsload', 'Load from LS', loadMenu.bind(app)],
            ['lssave', 'Save to LS', confirmCanvasSave],
            ['lsclear', 'Clear LS', confirmLsClear]];

        if (conf.localstorage.filemenu === 'yes') {
            buttons.push(['lsdown', 'Export LS', confirmDownloadLs]);
            buttons.push(['lsup', 'Import LS', uploadLsFile]);
            const lsFileInput = createElement('input', { type: 'file', id: 'lsFileInput', style: 'display: none;' });
            lsFileInput.addEventListener('change', (event) => uploadLs(event, defaultLsKey));
            ctlElem.appendChild(lsFileInput);
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

        function confirmCanvasSvg(event) { confirmStep(event.target, () => { convertCanvasToSvg(); showToast('SVG exported'); }); }

        function confirmCanvasSave(event) { confirmStep(event.target, app.saveToLs.bind(app)); }

        function confirmCanvasClear(event) { confirmStep(event.target, () => { app.clear(); showToast('Canvas cleared'); }); }

        function confirmLsClear(event) { confirmStep(event.target, () => { Application.clearLocalStorage(); showToast('Local storage cleared'); }); }

        function confirmDownloadLs(event) { confirmStep(event.target, () => { app.downloadLs(); showToast('Exported'); }); }

        function uploadLsFile(event) { document.getElementById('lsFileInput').click(); }
    }
}
