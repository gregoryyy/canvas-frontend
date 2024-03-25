/* static functions */

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

function makeDraggable(card) {
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



