let dragSrcEl = null;
let allowCrossContainerDrag = true; // Scenario B: true, Scenario A: false

function makeDraggable(elem) {

    const handleDragStart = (e) => {
        dragSrcEl = this;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', this.outerHTML);
        this.classList.add('dragging');
    }

    const handleDragOver = (e) => {
        e.preventDefault(); // Necessary for allowing drops
        e.dataTransfer.dropEffect = 'move';
        return false;
    }

    const handleDragEnter = (e) => {
        // Check if cross-container drag is allowed or if the drag is within the same container
        if (!allowCrossContainerDrag && dragSrcEl.parentNode !== this.parentNode) {
            return; // Exit if not allowed and it's a cross-container drag
        }
        this.classList.add('over');
    }

    const handleDragLeave = (e) => {
        this.classList.remove('over');
    }

    const handleDrop = (e) => {
        e.stopPropagation(); // Stop the browser from redirecting
        e.preventDefault();
        this.classList.remove('over');

        // Again, check for allowed movement
        if (!allowCrossContainerDrag && dragSrcEl.parentNode !== this.parentNode) {
            return; // Exit without doing anything if dropping in a different container is not allowed
        }

        if (dragSrcEl !== this) {
            // Remove the item from the original list
            dragSrcEl.parentNode.removeChild(dragSrcEl);
            // Add the dragged item into its new spot
            const dropHTML = e.dataTransfer.getData('text/html');
            this.insertAdjacentHTML('beforebegin', dropHTML);
            const dropElem = this.previousSibling;
            makeDraggable(dropElem);
        }
    }

    const handleDragEnd = (e) => {
        this.classList.remove('dragging');
        let items = document.querySelectorAll('.container .item');
        items.forEach(function (item) {
            item.classList.remove('over');
        });
    }

    elem.addEventListener('dragstart', handleDragStart, false);
    elem.addEventListener('dragenter', handleDragEnter, false);
    elem.addEventListener('dragover', handleDragOver, false);
    elem.addEventListener('dragleave', handleDragLeave, false);
    elem.addEventListener('drop', handleDrop, false);
    elem.addEventListener('dragend', handleDragEnd, false);
}

let items = document.querySelectorAll('.container .item');
items.forEach(makeDraggable);
