document.addEventListener('DOMContentLoaded', function () {
    // state
    let bookData = {
        preface: "Content for A",
        chapters: [
            { content: "Paragraph 1 in Chapter 1\nParagraph 2 in Chapter 1" },
            { content: "Paragraph 1 in Chapter 2\nParagraph 2 in Chapter 2" },
            { content: "Paragraph 1 in Chapter 3" }
        ],
        references: ["Ref1", "Ref2"]
    };

    function createBookStructure() {
        // only be called initially, all changes are done in-place
        const bookContainer = document.getElementById('bookContainer');
        bookContainer.innerHTML = '';

        const addDiv = (parent, contentClass, text, index = undefined) => {
            const div = document.createElement('div');
            div.className = 'editable ' + contentClass;
            div.setAttribute('contenteditable', 'true');
            if (index) div.setAttribute('data-index', index);
            div.setAttribute('data-type', contentClass);
            div.innerText = text;
            parent.appendChild(div);
        };

        addDiv(bookContainer, 'preface', bookData.preface);

        const chaptersDiv = document.createElement('div');
        bookData.chapters.forEach((chapter, index) => {
            const chDiv = addDiv(chaptersDiv, 'chapter', chapter.content, index);
        });
        bookContainer.appendChild(chaptersDiv);

        const referencesDiv = document.createElement('div');
        bookData.references.forEach((ref, index) => {
            addDiv(referencesDiv, 'reference', ref, index);
        });
        bookContainer.appendChild(referencesDiv);
    }

    function saveEdits(editedElement) {
        const type = editedElement.getAttribute('data-type');
        const content = editedElement.innerText.trim();

        switch (type) {
            case 'preface':
                bookData.preface = content;
                break;
            case 'chapter':
                const chapterIndex = editedElement.getAttribute('data-index');
                if (content === '') {
                    // remove from state
                    bookData.chapters.splice(chapterIndex, 1);
                    // remove from DOM
                    editedElement.remove();
                } else {
                    bookData.chapters[chapterIndex].content = content;
                }
                break;
            case 'reference':
                const referenceIndex = editedElement.getAttribute('data-index');
                bookData.references[referenceIndex] = content;
                break;
        }
    }

    function addChapter() {
        bookData.chapters.push({ content: "New chapter content" });
        createBookStructure();
    }

    function saveBookData() {
        localStorage.setItem('bookData', JSON.stringify(bookData));
    }

    function loadBookData() {
        const savedData = localStorage.getItem('bookData');
        if (savedData) {
            bookData = JSON.parse(savedData);
            createBookStructure();
        }
    }

    function init() {
        document.getElementById('addChapterBtn').addEventListener('click', addChapter);
        document.getElementById('saveBtn').addEventListener('click', saveBookData);
        document.getElementById('loadBtn').addEventListener('click', loadBookData);
        document.getElementById('bookContainer').addEventListener('blur', function (event) {
            if (event.target.matches('[contenteditable="true"]')) {
                saveEdits(event.target);
            }
        }, true);
        createBookStructure();
    }

    init();
    
});
