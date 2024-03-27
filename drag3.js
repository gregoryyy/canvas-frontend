// script.js
document.addEventListener('DOMContentLoaded', () => {
    let draggedCard = null;

    const eventOnClass = (e, c) => e.target.classList.contains(c);

    function makeDraggable(item) {
        const onDragStart = (e) => { draggedCard = e.target; setTimeout(() => e.target.style.display = 'none', 0); };
        const onDragEnd = (e) => { setTimeout(() => { e.target.style.display = 'block'; draggedCard = null; }, 200); };
        const onDragOver = (e) => e.preventDefault();
        const onDragEnter = (e) => { if (eventOnClass(e, 'card')) e.target.classList.add('highlight'); };
        const onDragLeave = (e) => { if (eventOnClass(e, 'card') && eventOnClass(e, 'highlight')) e.target.classList.remove('highlight'); };
        const onDropOnCard = (e) => {
            e.preventDefault();
            if (eventOnClass(e, 'card') && eventOnClass(e, 'highlight')) {
                e.target.classList.remove('highlight');
                e.target.parentNode.insertBefore(draggedCard, e.target);
            }
        };

        item.addEventListener('dragstart', onDragStart);
        item.addEventListener('dragend', onDragEnd);
        item.addEventListener('dragover', onDragOver);
        item.addEventListener('dragenter', onDragEnter);
        item.addEventListener('dragleave', onDragLeave);
        item.addEventListener('drop', onDropOnCard);
    };

    function makeDroppable(cell) {
        const onDropOnCell = (e) => {
            e.preventDefault();
            if (!eventOnClass(e, 'card') && draggedCard) { e.target.appendChild(draggedCard); }
        };
        const onDragEnter = (e) => {  if (!e.target.classList.contains('card')) cell.classList.add('highlight'); };
        const onDragLeave = (e) => { if (!e.target.classList.contains('card')) cell.classList.remove('highlight'); };
        cell.addEventListener('dragover', (e) => e.preventDefault());
        cell.addEventListener('dragenter', onDragEnter);
        cell.addEventListener('dragleave', onDragLeave);
        cell.addEventListener('drop', onDropOnCell);
    }

    document.querySelectorAll('.card').forEach(makeDraggable);
    document.querySelectorAll('.cell').forEach(makeDroppable);
});
