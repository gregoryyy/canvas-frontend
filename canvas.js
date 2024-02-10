document.addEventListener('DOMContentLoaded', function () {
    fetch('preseed.json')
        .then(response => response.json())
        .then(data => {
            loadPrecanvas(document, data);
            const canvas = document.querySelector('.canvas');
            data.canvas.forEach(cell => {
                const cellDiv = document.createElement('div');
                cellDiv.className = 'cell';

                const title = document.createElement('h3');
                title.textContent = cell.title;
                cellDiv.appendChild(title);
                canvas.appendChild(cellDiv);
                if (cell.score === "yes") {
                    // Adjust this selector based on your implementation
                    addScoringDropdown(cellDiv);
                }

                const subtitle = document.createElement('h4');
                subtitle.textContent = cell.subtitle;
                cellDiv.appendChild(subtitle);

                const description = document.createElement('p');
                description.textContent = cell.description;
                cellDiv.appendChild(description);

            });
            initializeCanvasCells(document);
            loadPostcanvas(document, data);
        });
});

function loadPrecanvas(document, data) {
    const metaDiv = document.querySelector('.precanvas');
    const title = document.createElement('h2');
    title.textContent = data.meta.type;
    // Add click event listener for R1
    title.addEventListener('click', toggleEditableDiv);
    const description = document.createElement('p');
    description.textContent = data.meta.description;
    metaDiv.appendChild(title);
    metaDiv.appendChild(description);
}

function loadPostcanvas(document, data) {
    const metaDiv = document.querySelector('.postcanvas');
    const title = document.createElement('h3');
    title.textContent = 'Analysis';
    const description = document.createElement('p');
    description.textContent = data.meta.description; // Adjust according to your JSON structure
    metaDiv.appendChild(title);
    metaDiv.appendChild(description);
}

// TODO: hook to cards
function toggleEditableDiv(event) {
    const target = event.target;
    if (target.getAttribute('contentEditable') === 'true') {
        target.setAttribute('contentEditable', 'false');
    } else {
        target.setAttribute('contentEditable', 'true');
        target.focus();
    }
}

function addScoringDropdown(parentElement) {
    const select = document.createElement('select');
    select.className = 'scoring-dropdown'; // Add class for styling
    for (let i = 0; i <= 5; i++) {
        let option = document.createElement('option');
        if (i == 0) option.classList.add("empty-score");
        option.value = i;
        option.text = i;
        select.appendChild(option);
    }

    // Wrap title and select in a container
    const titleAndSelectContainer = document.createElement('div');
    titleAndSelectContainer.className = 'cell-title-container';

    // Assuming you have a way to reference the title element, append it and the select box to the container
    // This might require adjusting how you're currently handling the title (h2) elements
    // For demonstration, assuming title is a variable holding the h3 element
    const title = parentElement.querySelector('h3');
    if (title) {
        parentElement.removeChild(title); // Remove the title from its current parent
        titleAndSelectContainer.appendChild(title); // Add title to the new container
    }
    titleAndSelectContainer.appendChild(select); // Add select to the container

    parentElement.appendChild(titleAndSelectContainer); // Add the container back to the parent element
}

function initializeCanvasCells(document) {
    const cells = document.querySelectorAll('.cell');
    cells.forEach(cell => {
        addCard(cell, "Item 1");
        addCard(cell, "Item 2");
        addCard(cell, "Item 3");
        // addCard(cell, "Item 4");
        // addCard(cell, "Item 5");
    });
}

function addCard(cell, text) {
    const card = document.createElement('div');
    card.textContent = text;
    card.classList.add('card');
    cell.appendChild(card);
}
