/* static functions */

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

function md2html(markdown) { return marked.parse(convertBR(markdown)); }

function convertBR(text) { return text.replace(/<br\s*\/?>/gi, '\n').replace(/[\u200B]/g, ''); }

function convertNL(text) { return text.replace(/\n/g, '<br>'); }

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

