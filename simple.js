document.addEventListener('DOMContentLoaded', function() {
    let bookData = {
        preface: "Content for A",
        chapters: [
            {content: "Paragraph 1 in Chapter 1\nParagraph 2 in Chapter 1"},
            {content: "Paragraph 1 in Chapter 2\nParagraph 2 in Chapter 2"},
            {content: "Paragraph 1 in Chapter 3"}
        ],
        references: ["Ref1", "Ref2"]
    };

    function updateBookDataFromDOM() {
        const preface = document.querySelector('.preface');
        bookData.preface = preface ? preface.innerText : '';

        bookData.chapters = [];
        document.querySelectorAll('.chapter').forEach(chapterDiv => {
            bookData.chapters.push({content: chapterDiv.innerText});
        });

        const references = [];
        document.querySelectorAll('.reference').forEach(refDiv => {
            references.push(refDiv.innerText);
        });
        bookData.references = references;
    }

    function createBookStructure(data) {
        const bookContainer = document.getElementById('bookContainer');
        bookContainer.innerHTML = ''; // Clear previous structure

        // Preface
        const preface = document.createElement('div');
        preface.className = 'editable preface';
        preface.contentEditable = true;
        preface.innerText = data.preface;
        bookContainer.appendChild(preface);

        // Chapters
        data.chapters.forEach((chapter, index) => {
            const chapterDiv = document.createElement('div');
            chapterDiv.className = 'editable chapter';
            chapterDiv.contentEditable = true;
            chapterDiv.innerText = chapter.content;
            bookContainer.appendChild(chapterDiv);
        });

        // References
        const references = document.createElement('div');
        data.references.forEach((ref, index) => {
            const refDiv = document.createElement('div');
            refDiv.className = 'editable reference';
            refDiv.contentEditable = true;
            refDiv.innerText = ref;
            bookContainer.appendChild(refDiv);
        });

        // Reattach event listeners
        attachEventListeners();
    }

    function attachEventListeners() {
        const elements = document.querySelectorAll('.editable');
        elements.forEach(element => {
            element.removeEventListener('keydown', handleEditing);
            element.addEventListener('keydown', handleEditing);
            element.removeEventListener('blur', saveEdits);
            element.addEventListener('blur', saveEdits);
        });

        document.getElementById('addChapterBtn').removeEventListener('click', addChapter);
        document.getElementById('addChapterBtn').addEventListener('click', addChapter);

        document.getElementById('saveBtn').removeEventListener('click', saveBookData);
        document.getElementById('saveBtn').addEventListener('click', saveBookData);

        document.getElementById('loadBtn').removeEventListener('click', loadBookData);
        document.getElementById('loadBtn').addEventListener('click', loadBookData);
    }

    function handleEditing(event) {
        // Optional: Handle specific key events if needed
    }

    function saveEdits() {
        // This function now simply triggers an update from the DOM
        updateBookDataFromDOM();
    }

    function addChapter() {
        updateBookDataFromDOM();
        bookData.chapters.push({content: "New chapter content"});
        createBookStructure(bookData);
    }

    function saveBookData() {
        updateBookDataFromDOM();
        localStorage.setItem('bookData', JSON.stringify(bookData));
    }

    function loadBookData() {
        const savedData = localStorage.getItem('bookData');
        if (savedData) {
            bookData = JSON.parse(savedData);
            createBookStructure(bookData);
        }
    }

    createBookStructure(bookData);
});
