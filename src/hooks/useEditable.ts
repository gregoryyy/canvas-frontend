import { type RefObject, useEffect, useRef } from 'react';

/**
 * Make the referenced element inline-editable: sets `contenteditable="true"`,
 * binds Enter-inserts-`<br><br>` via the Selection/Range API, and calls
 * `onCommit(innerHTML)` on blur with the raw HTML. Caller is responsible for
 * sanitizing + converting BR → NL before dispatching to the store.
 *
 * 1:1 with the legacy `makeEditable` util, plus a proper cleanup on unmount.
 * `onCommit` is captured via a ref so callback identity changes don't
 * re-attach the DOM listeners.
 */
export function useEditable(
  ref: RefObject<HTMLElement | null>,
  onCommit: (html: string) => void,
): void {
  const onCommitRef = useRef(onCommit);
  useEffect(() => {
    onCommitRef.current = onCommit;
  }, [onCommit]);

  useEffect(() => {
    const elem = ref.current;
    if (!elem) return;

    elem.setAttribute('contenteditable', 'true');

    const handleBlur = (): void => {
      onCommitRef.current(elem.innerHTML);
    };

    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key !== 'Enter' || e.shiftKey) return;
      e.preventDefault();
      const selection = window.getSelection();
      if (!selection || !selection.rangeCount) return;
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
    };

    elem.addEventListener('blur', handleBlur);
    elem.addEventListener('keydown', handleKeyDown);

    return () => {
      elem.removeAttribute('contenteditable');
      elem.removeEventListener('blur', handleBlur);
      elem.removeEventListener('keydown', handleKeyDown);
    };
  }, [ref]);
}
