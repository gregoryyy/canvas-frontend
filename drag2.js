// script.js
document.addEventListener('DOMContentLoaded', (event) => {
    let draggedCard = null;

    document.querySelectorAll('.card').forEach(item => {
        item.addEventListener('dragstart', e => {
            draggedCard = item;
            setTimeout(() => item.style.display = 'none', 0);
        });

        item.addEventListener('dragend', e => {
            setTimeout(() => {
                draggedCard.style.display = 'block';
                draggedCard = null;
            }, 0);
        });

        item.addEventListener('dragover', e => {
            e.preventDefault();
        });

        item.addEventListener('dragenter', e => {
            if (e.target.className === 'card') {
                e.target.classList.add('highlight');
            }
        });

        item.addEventListener('dragleave', e => {
            if (e.target.className === 'card highlight') {
                e.target.classList.remove('highlight');
            }
        });

        item.addEventListener('drop', e => {
            e.preventDefault();
            if (e.target.className === 'card highlight') {
                e.target.classList.remove('highlight');
                e.target.parentNode.insertBefore(draggedCard, e.target);
            }
        });
    });

    document.querySelectorAll('.cell').forEach(cell => {
        cell.addEventListener('dragover', e => {
            e.preventDefault();
        });

        cell.addEventListener('drop', e => {
            if (!e.target.classList.contains('card')) {
                cell.appendChild(draggedCard);
            }
        });
    });
});
