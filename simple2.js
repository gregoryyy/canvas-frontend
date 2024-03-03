document.addEventListener('DOMContentLoaded', function() {
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
        const bookContainer = document.getElementById('bookContainer');
        bookContainer.innerHTML = '<div class="editable preface" contenteditable="true" data-type="preface">' + bookData.preface + '</div>';

        bookData.chapters.forEach((chapter, index) => {
            const chapterDiv = document.createElement('div');
            chapterDiv.className = 'editable chapter';
            chapterDiv.setAttribute('contenteditable', 'true');
            chapterDiv.setAttribute('data-chapter-index', index);
            chapterDiv.setAttribute('data-type', 'chapter');
            chapterDiv.innerText = chapter.content;
            bookContainer.appendChild(chapterDiv);
        });

        const referencesDiv = document.createElement('div');
        bookData.references.forEach((ref, index) => {
            const refDiv = document.createElement('div');
            refDiv.className = 'editable reference';
            refDiv.setAttribute('contenteditable', 'true');
            refDiv.setAttribute('data-reference-index', index);
            refDiv.setAttribute('data-type', 'reference');
            refDiv.innerText = ref;
            referencesDiv.appendChild(refDiv);
        });
        bookContainer.appendChild(referencesDiv);

        attachGlobalEventListeners();
    }

    function attachGlobalEventListeners() {
        document.getElementById('bookContainer').addEventListener('blur', function(event) {
            if (event.target.matches('[contenteditable="true"]')) {
                saveEdits(event.target);
            }
        }, true);

        document.getElementById('addChapterBtn').addEventListener('click', addChapter);
        document.getElementById('saveBtn').addEventListener('click', saveBookData);
        document.getElementById('loadBtn').addEventListener('click', loadBookData);
    }

    function saveEdits(editedElement) {
        const type = editedElement.getAttribute('data-type');
        const content = editedElement.innerText.trim();
        
        switch (type) {
            case 'preface':
                bookData.preface = content;
                break;
            case 'chapter':
                const chapterIndex = editedElement.getAttribute('data-chapter-index');
                if (content === '') {
                    bookData.chapters.splice(chapterIndex, 1);
                } else {
                    bookData.chapters[chapterIndex].content = content;
                }
                break;
            case 'reference':
                const referenceIndex = editedElement.getAttribute('data-reference-index');
                bookData.references[referenceIndex] = content;
                break;
        }

        // Directly update the DOM for empty chapters
        if (content === '' && type === 'chapter') {
            editedElement.remove();
        } else {
            createBookStructure(); // Optionally refresh the whole structure if necessary
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

    createBookStructure();
});
