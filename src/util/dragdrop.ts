import { generateLongPressEvents } from './longpress';

const highlightClass = 'highlight';
const dragClass = 'dragging';

const eventOnClass = (e: Event, c: string): boolean =>
  (e.target as HTMLElement).classList.contains(c);
const eventAddClass = (e: Event, c: string): void => {
  (e.target as HTMLElement).classList.add(c);
};
const eventRemoveClass = (e: Event, c: string): void => {
  (e.target as HTMLElement).classList.remove(c);
};

export function makeDraggable(
  elem: HTMLElement,
  longPressMillis = 0,
  cbStart?: () => void,
  cbFinish?: () => void,
): void {
  elem.setAttribute('draggable', 'true');
  const onPressStart = (e: Event): void => {
    e.stopPropagation();
    eventAddClass(e, dragClass);
    if (cbStart) cbStart();
  };
  const onDragStart = (e: Event): void => {
    eventAddClass(e, dragClass);
    if (cbStart) cbStart();
    setTimeout(() => {
      (e.target as HTMLElement).style.display = 'none';
    }, 200);
  };
  const onDragEnd = (e: Event): void => {
    setTimeout(() => {
      (e.target as HTMLElement).style.display = 'block';
      eventRemoveClass(e, dragClass);
    }, 200);
  };
  const onDragOver = (e: Event): void => {
    e.preventDefault();
  };
  const onDragEnter = (e: Event): void => {
    if (eventOnClass(e, 'card')) eventAddClass(e, highlightClass);
  };
  const onDragLeave = (e: Event): void => {
    if (eventOnClass(e, 'card') && eventOnClass(e, highlightClass))
      eventRemoveClass(e, highlightClass);
  };
  const onDropOnCard = (e: Event): void => {
    e.preventDefault();
    const draggedElem = document.querySelector<HTMLElement>('.' + dragClass);
    const target = e.target as HTMLElement;
    if (eventOnClass(e, 'card') && draggedElem && eventOnClass(e, highlightClass)) {
      eventRemoveClass(e, highlightClass);
      eventRemoveClass(e, dragClass);
      target.parentNode!.insertBefore(draggedElem, target);
      if (cbFinish) cbFinish();
    }
  };

  if (longPressMillis > 0) {
    generateLongPressEvents(elem, longPressMillis);
    elem.addEventListener('longpress', onPressStart);
  } else {
    elem.addEventListener('dragstart', onDragStart);
  }
  elem.addEventListener('dragend', onDragEnd);
  elem.addEventListener('dragover', onDragOver);
  elem.addEventListener('dragenter', onDragEnter);
  elem.addEventListener('dragleave', onDragLeave);
  elem.addEventListener('drop', onDropOnCard);
}

export function makeDroppable(elem: HTMLElement, cbFinish?: () => void): void {
  const onDropOnCell = (e: Event): void => {
    e.preventDefault();
    const draggedElem = document.querySelector<HTMLElement>('.' + dragClass);
    const target = e.target as HTMLElement;
    if (!eventOnClass(e, 'card') && draggedElem) {
      target.appendChild(draggedElem);
      target.style.cursor = '';
      elem.classList.remove(highlightClass);
      draggedElem.style.display = 'block';
      if (cbFinish) cbFinish();
    }
  };
  const onDragEnter = (e: Event): void => {
    if (!eventOnClass(e, 'card')) elem.classList.add(highlightClass);
  };
  const onDragLeave = (e: Event): void => {
    if (!eventOnClass(e, 'card')) elem.classList.remove(highlightClass);
  };
  elem.addEventListener('dragover', (e) => e.preventDefault());
  elem.addEventListener('dragenter', onDragEnter);
  elem.addEventListener('dragleave', onDragLeave);
  elem.addEventListener('drop', onDropOnCell);
}
