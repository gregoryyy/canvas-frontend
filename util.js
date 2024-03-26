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

function makeDraggable(elem) {
    elem.setAttribute('draggable', 'true');

}


// allowOthers = any card container droppable
function makeDroppable(container, allowOthers = false) {
}

function addLongPressListener(element, callback, duration = 500) {
    let timerId = null;
    let startX = 0;
    let startY = 0;

    const start = (event) => {
        // first touch point
        startX = event.type === 'touchstart' ? event.touches[0].pageX : event.pageX;
        startY = event.type === 'touchstart' ? event.touches[0].pageY : event.pageY;
        if ((event.type === 'mousedown' && event.button !== 0) || event.target !== element) return;
        timerId = setTimeout(() => callback(element), duration);
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

// execute callback on item selected from list shown in overlay menu
function overlayMenu(elem, title, list, cbLoad, cbDel = undefined) {

    const closeMenu = () => {
        menu.remove();
        elem.classList.remove('menuopen');
    };

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

    list.forEach((itemText, index) => {
        const item = createElement('div', { class: 'overlay-menu-item' }, itemText);
        item.addEventListener('click', () => {
            cbLoad(itemText);
            closeMenu();
        });
        if (cbDel) {
            const delBtn = createElement('span', { class: 'overlay-menu-item-delete' }, 'Delete');
            delBtn.addEventListener('click', (event) => {
                event.stopPropagation();
                confirmStep(delBtn, () => {
                    cbDel(itemText);
                    delBtn.parentElement.remove();
                });
            });
            item.appendChild(delBtn);
        }
        menu.appendChild(item);
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

function lg(message) {
    const stack = new Error().stack;
    const stackLines = stack.split("\n");
    const callerLine = stackLines[2];
    const functionNameMatch = callerLine.match(/at (\S+)/);
    const functionName = functionNameMatch ? functionNameMatch[1] : 'anonymous function';
    //const formattedCallerLine = callerLine.substring(callerLine.indexOf("(") + 1, callerLine.length - 1);
    //console.log(`${message} - ${functionName} - ${formattedCallerLine}`);
    console.log(`${message} - ${functionName}()`);
}



