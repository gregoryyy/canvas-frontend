export function makeEditable(elem: HTMLElement, cbFinishEdit: EventListener): void {
  elem.setAttribute('contenteditable', 'true');
  elem.addEventListener('blur', cbFinishEdit);

  // Enter inserts two <br>s (paragraph break) via the Selection/Range API.
  elem.addEventListener('keydown', (e) => {
    const event = e;
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      const selection = window.getSelection()!;
      if (!selection.rangeCount) return;
      const range = selection.getRangeAt(0);
      range.deleteContents();
      const br1 = document.createElement('br');
      const br2 = document.createElement('br');
      range.insertNode(br2);
      range.insertNode(br1);
      range.setStartAfter(br2);
      range.setEndAfter(br2);
      selection.removeAllRanges();
      selection.addRange(range);
    }
  });
}
