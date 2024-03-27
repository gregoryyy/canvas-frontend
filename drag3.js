// script.js
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.card').forEach(makeDraggable);
    document.querySelectorAll('.cell').forEach(makeDroppable);
});

const highlightClass = 'highlight';
const dragClass = 'dragging'

const eventOnClass = (e, c) => e.target.classList.contains(c);
const eventAddClass = (e, c) => e.target.classList.add(c);
const eventRemoveClass = (e, c) => e.target.classList.remove(c);

function makeDraggable(elem) {
    const onDragStart = (e) => { eventAddClass(e, dragClass); setTimeout(() => e.target.style.display = 'none', 200); };
    const onDragEnd = (e) => { setTimeout(() => { e.target.style.display = 'block'; eventRemoveClass(e, dragClass); }, 200); };
    const onDragOver = (e) => e.preventDefault();
    const onDragEnter = (e) => { if (eventOnClass(e, 'card')) eventAddClass(e, highlightClass); };
    const onDragLeave = (e) => { if (eventOnClass(e, 'card') && eventOnClass(e, highlightClass)) eventRemoveClass(e, highlightClass); };
    const onDropOnCard = (e) => {
        e.preventDefault();
        if (eventOnClass(e, 'card') && eventOnClass(e, highlightClass)) {
            const draggedCard = document.querySelector('.dragging');
            eventRemoveClass(e, highlightClass);
            eventRemoveClass(e, dragClass);
            e.target.parentNode.insertBefore(draggedCard, e.target);
        }
    };

    elem.addEventListener('dragstart', onDragStart);
    elem.addEventListener('dragend', onDragEnd);
    elem.addEventListener('dragover', onDragOver);
    elem.addEventListener('dragenter', onDragEnter);
    elem.addEventListener('dragleave', onDragLeave);
    elem.addEventListener('drop', onDropOnCard);
};

function makeDroppable(elem) {
    const onDropOnCell = (e) => {
        e.preventDefault();
        const draggedCard = document.querySelector('.dragging');
        if (!eventOnClass(e, 'card') && draggedCard) {
            e.target.appendChild(draggedCard);
            elem.classList.remove(highlightClass);
            draggedCard.style.display = 'block';
        }
    };
    const onDragEnter = (e) => { if (!eventOnClass(e, 'card')) elem.classList.add(highlightClass); };
    const onDragLeave = (e) => { if (!eventOnClass(e, 'card')) elem.classList.remove(highlightClass); };
    elem.addEventListener('dragover', (e) => e.preventDefault());
    elem.addEventListener('dragenter', onDragEnter);
    elem.addEventListener('dragleave', onDragLeave);
    elem.addEventListener('drop', onDropOnCell);
}
