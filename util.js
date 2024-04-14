/* static UI functions */

function createElement(tagName, attributes = {}, text = '', format = 'text') {
    const element = document.createElement(tagName);
    Object.keys(attributes).forEach(key => element.setAttribute(key, attributes[key]));
    if (text) {
        switch (format) {
            case 'text': element.textContent = text; break;
            case 'html': element.innerHTML = text; break;
            default: /* none */
        }
    }
    return element;
};

function toggleElements(sel) {
    var elems = document.querySelectorAll(sel);
    const shown = elems[0]?.style.display === 'block';
    elems.forEach(elem => elem.style.display = shown ? 'none' : 'block');
}

function makeEditable(elem, cbFinishEdit) {
    elem.setAttribute('contenteditable', 'true');
    elem.addEventListener('blur', cbFinishEdit);

    // Handle Enter key for line breaks
    elem.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            document.execCommand('insertHTML', false, '<br><br>');
            e.preventDefault();
        }
    });
}

function addLongPressListener(element, callback, duration = 500) {
    generateLongPressEvents(element, duration);
    element.addEventListener('longpress', () => { callback(); });
}

function generateLongPressEvents(element, duration = 500) {
    let timerId = null;
    let startX = 0;
    let startY = 0;

    const start = (event) => {
        // first touch point
        startX = event.type === 'touchstart' ? event.touches[0].pageX : event.pageX;
        startY = event.type === 'touchstart' ? event.touches[0].pageY : event.pageY;
        if ((event.type === 'mousedown' && event.button !== 0) || event.target !== element) return;
        timerId = setTimeout(() => {
            const longPressEvent = new CustomEvent('longpress', { detail: { startX, startY }, bubbles: true, cancelable: true });
            element.dispatchEvent(longPressEvent);
        }, duration);
    };

    const cancel = () => { clearTimeout(timerId); };

    const move = (event) => {
        let newX = event.type === 'touchmove' ? event.touches[0].pageX : event.pageX;
        let newY = event.type === 'touchmove' ? event.touches[0].pageY : event.pageY;
        if (Math.abs(newX - startX) > 10 || Math.abs(newY - startY) > 10) cancel();
    };

    element.addEventListener('mousedown', start);
    element.addEventListener('touchstart', start, { passive: true });
    element.addEventListener('mouseup', cancel);
    element.addEventListener('mouseleave', cancel);
    element.addEventListener('touchend', cancel);
    element.addEventListener('touchcancel', cancel);
    element.addEventListener('mousemove', move);
    element.addEventListener('touchmove', move, { passive: true });
}

const highlightClass = 'highlight';
const dragClass = 'dragging';

const eventOnClass = (e, c) => e.target.classList.contains(c);
const eventAddClass = (e, c) => e.target.classList.add(c);
const eventRemoveClass = (e, c) => e.target.classList.remove(c);

// optionally listen to nonzero milliseconds long-press gesture
function makeDraggable(elem, longPressMillis = 0, cbStart = undefined, cbFinish = undefined) {
    elem.setAttribute('draggable', 'true');
    const onPressStart = (e) => { e.stopPropagation(); eventAddClass(e, dragClass); if (cbStart) cbStart(); };
    const onDragStart = (e) => { eventAddClass(e, dragClass); if (cbStart) cbStart(); setTimeout(() => e.target.style.display = 'none', 200); };
    const onDragEnd = (e) => { setTimeout(() => { e.target.style.display = 'block'; eventRemoveClass(e, dragClass); }, 200); };
    const onDragOver = (e) => e.preventDefault();
    const onDragEnter = (e) => { if (eventOnClass(e, 'card')) eventAddClass(e, highlightClass); };
    const onDragLeave = (e) => { if (eventOnClass(e, 'card') && eventOnClass(e, highlightClass)) eventRemoveClass(e, highlightClass); };
    const onDropOnCard = (e) => {
        e.preventDefault();
        const draggedElem = document.querySelector('.' + dragClass);
        if (eventOnClass(e, 'card') && draggedElem && eventOnClass(e, highlightClass)) {
            eventRemoveClass(e, highlightClass);
            eventRemoveClass(e, dragClass);
            e.target.parentNode.insertBefore(draggedElem, e.target);
            if (cbFinish) cbFinish();
        }
    };

    if (longPressMillis > 0) {
        generateLongPressEvents(elem, longPressMillis);
        elem.addEventListener('longpress', onPressStart);
    } else {
        elem.addEventListener('dragstart', onDragStart);
    }
    elem.addEventListener('dragend', onDragEnd);
    elem.addEventListener('dragover', onDragOver);
    elem.addEventListener('dragenter', onDragEnter);
    elem.addEventListener('dragleave', onDragLeave);
    elem.addEventListener('drop', onDropOnCard);
};

function makeDroppable(elem, cbFinish = undefined) {
    const onDropOnCell = (e) => {
        e.preventDefault();
        const draggedElem = document.querySelector('.' + dragClass);
        if (!eventOnClass(e, 'card') && draggedElem) {
            e.target.appendChild(draggedElem);
            e.target.style.cursor = '';
            elem.classList.remove(highlightClass);
            draggedElem.style.display = 'block';
            if (cbFinish) cbFinish();
        }
    };
    const onDragEnter = (e) => { if (!eventOnClass(e, 'card')) elem.classList.add(highlightClass); };
    const onDragLeave = (e) => { if (!eventOnClass(e, 'card')) elem.classList.remove(highlightClass); };
    elem.addEventListener('dragover', (e) => e.preventDefault());
    elem.addEventListener('dragenter', onDragEnter);
    elem.addEventListener('dragleave', onDragLeave);
    elem.addEventListener('drop', onDropOnCell);
}

// TODO: touch gestures for drag and drop

// execute callback on item selected from list ([key] or [key --> val]) shown in overlay menu
function overlayMenu(elem, title, list, cbLoad, cbDel = undefined) {

    const closeMenu = () => {
        menu.remove();
        elem.classList.remove('menuopen');
    };

    const normalizeItem = (item) => typeof item === 'object' ? [item[0], item[1]] : [item, item];

    let menu = document.querySelector('.overlay-menu');
    if (!menu) {
        menu = createElement('div', { class: 'overlay-menu' });
        menu.appendChild(createElement('h3', {}, title));
        elem.classList.add('menuopen');
    } else {
        closeMenu();
        return;
    }

    if (list.length == 0) menu.appendChild(createElement('div', { class: 'overlay-menu-item' }, '(empty)'));

    list.forEach((item, index) => {
        const item2 = normalizeItem(item);
        const elem = createElement('div', { class: 'overlay-menu-item' }, item2[0]);
        elem.addEventListener('click', () => {
            cbLoad(item2[1]);
            closeMenu();
        });
        if (cbDel) {
            const delBtn = createElement('span', { class: 'overlay-menu-item-delete' }, 'Delete');
            delBtn.addEventListener('click', (event) => {
                event.stopPropagation();
                confirmStep(delBtn, () => {
                    cbDel(item2[1]);
                    delBtn.parentElement.remove();
                });
            });
            elem.appendChild(delBtn);
        }
        menu.appendChild(elem);
    });

    document.body.appendChild(menu);
    const rect = elem.getBoundingClientRect();
    menu.style.left = `${rect.left}px`;
    menu.style.top = `${rect.top - menu.offsetHeight}px`;
    menu.style.top = `${window.scrollY + rect.top - menu.offsetHeight}px`;
    menu.style.display = 'block';

    // close when clicked outside
    document.addEventListener('click', (event) => {
        if (!elem.contains(event.target) && !menu.contains(event.target))
            closeMenu();
    });
}

// user needs to press twice within timeframe to execute callback
function confirmStep(elem, callback, timeout = 3000) {

    const resetElem = () => {
        elem.textContent = elem.originalText;
        elem.style.color = '';
        elem.confirming = false;
    };

    if (!elem.confirming) {
        // first click: prompt for confirmation
        elem.originalText = elem.textContent; // Save original button text
        elem.textContent += '?';
        elem.style.color = 'red';
        elem.confirming = true;
        elem.confirmTimeout = setTimeout(resetElem, timeout);
    } else {
        // second click: execute!
        clearTimeout(elem.confirmTimeout);
        callback();
        resetElem();
        elem.textContent = elem.originalText;
        elem.style.color = '';
        elem.confirming = false;
    }
}

/* static non-UI functions */

function loadJson(file) {
    return fetch(file)
        .then(response => response.json())
        .then(sanitizeJSON)
        .catch(error => console.error('Error loading file:', error));
};

function downloadLs(key) {
    // Retrieve the data from Local Storage
    const data = localStorage.getItem(key);
    if (data) {
        const blob = new Blob([data], { type: 'application/json' });
        // link to download the blob
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${key}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(a.href);
    } else console.log('No data to download!');
}

// TODO: security hardening and error handling
function uploadLs(event, key, replace = false) {
    const input = event.target;
    const file = input.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function (event) {
            try {
                const data = sanitizeJSON(JSON.parse(event.target.result));
                const storedCanvases = localStorage.getItem(defaultLsKey);
                if (!storedCanvases || replace) {
                    localStorage.setItem(key, JSON.stringify(data));
                } else {
                    const canvases = sanitizeJSON(JSON.parse(storedCanvases));
                    Object.entries(data).forEach(([key, value]) => {
                        // TODO: check input
                        canvases[key] = value;
                    });
                    localStorage.setItem(defaultLsKey, JSON.stringify(canvases));
                }
            } catch (e) { console.log('Failed to upload data'); }
        };
        reader.readAsText(file);
    } else console.log('No file selected!');
}

function convertBR(text) { return text.replace(/<br\s*\/?>/gi, '\n').replace(/[\u200B]/g, ''); }

function convertNL(text) { return text.replace(/\n/g, '<br>'); }

function decodeHtml(html) { return new DOMParser().parseFromString(html, "text/html").documentElement.textContent; }

function encodeHtml(text) { return document.createElement('div').appendChild(document.createTextNode(text)).outerHTML; }

function sanitize(text) { return DOMPurify.sanitize(text, { ALLOWED_TAGS: ['br', 'p', 'i', 'b'] }); }

function sanitizeJSON(value) {
    if (typeof value === 'string') return sanitize(value);
    else if (Array.isArray(value)) return value.map(sanitizeJSON);
    else if (typeof value === 'object' && value !== null) {
        const sanitizedObject = {};
        for (const key in value) sanitizedObject[key] = sanitizeJSON(value[key]);
        return sanitizedObject;
    } else return value;
}

function trimPluralS(s) {
    if (s.endsWith('ss')) return s;
    if (s.endsWith('s')) return s.substring(0, s.length - 1);
    return s;
}

// require htmlToImage
function convertDivToSvg(divId, filename) {
    const node = document.getElementById(divId);

    const downloadImage = (dataUrl, filename) => {
        const encode = dataUrl; //'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(dataUrl);
        const a = createElement('a', { href: encode, download: filename });
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    htmlToImage.toSvg(node)
    .then(function (dataUrl) {
        //const svgWithEncoding = '<?xml version="1.0" encoding="UTF-8"?>';
        //const mime = 'image/svg+xml;charset=utf-8' ;
        downloadImage(dataUrl, 'content.svg');
    })
    .catch(function (error) {
        console.error('Could not convert the div to SVG:', error);
    });
}

function lg(message, verbose = false) {
    const stack = new Error().stack;
    const stackLines = stack.split("\n");
    const callerLine = stackLines[2];
    const functionNameMatch = callerLine.match(/at (\S+)/);
    const functionName = functionNameMatch ? functionNameMatch[1] : 'anonymous function';
    if (verbose) {
        const formattedCallerLine = callerLine.substring(callerLine.indexOf("(") + 1, callerLine.length - 1);
        console.log(`${message} - ${functionName} - ${formattedCallerLine}`);
    } else { console.log(`${message} - ${functionName}()`); }
}



