/* static UI functions */

function createElement(tagName, attributes = {}, text = '') {
    const element = document.createElement(tagName);
    Object.keys(attributes).forEach(key => element.setAttribute(key, attributes[key]));
    if (text) element.textContent = text;
    return element;
};

function makeEditable(elem, cbFinishEdit) {
    elem.setAttribute('contenteditable', 'true');
    //const editClass = 'editing';

    elem.addEventListener('blur', cbFinishEdit);

    elem.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            if (e.shiftKey) {
                cbFinishEdit();
            } else {
                e.preventDefault();
                insertBr();
            }
        }
        if (e.key === 'Escape') {
            cbFinishEdit();
        }
    });

    function insertBr() {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;

        const range = selection.getRangeAt(0);
        // optional: clear selected content
        range.deleteContents();
        const br = document.createElement('br');
        const zeroWidthSpace = document.createTextNode('\u200B');
        range.insertNode(zeroWidthSpace);
        range.insertNode(br);
        range.setStartAfter(zeroWidthSpace);
        selection.removeAllRanges();
        selection.addRange(range);
    }
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
function overlayMenu(elem, list, cbLoad, cbDel = undefined) {
    let menu = document.querySelector('.overlay-menu');
    if (!menu) {
        menu = createElement('div', { class: 'overlay-menu' });
        document.addEventListener('click', (event) => {
            //if (!menu.contains(event.target)) menu.style.display = 'none';
        });
    } else {
        menu.innerHTML = '';
    }

    list.forEach((itemText, index) => {
        const item = createElement('div', { class: 'overlay-menu-item' }, itemText);
        item.addEventListener('click', () => {
            cbLoad(itemText);
            menu.style.display = 'none';
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
            menu.style.display = 'none';
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
        elem.textContent += '??';
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

function sanitize(text) { return DOMPurify.sanitize(text); }

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


