export function addLongPressListener(
  element: Element,
  callback: () => void,
  duration = 500,
): void {
  generateLongPressEvents(element, duration);
  element.addEventListener('longpress', () => {
    callback();
  });
}

export function generateLongPressEvents(element: Element, duration = 500): void {
  let timerId: ReturnType<typeof setTimeout> | null = null;
  let startX = 0;
  let startY = 0;

  const start = (event: Event): void => {
    const touchEvent = event as TouchEvent;
    const mouseEvent = event as MouseEvent;
    startX = event.type === 'touchstart' ? touchEvent.touches[0]!.pageX : mouseEvent.pageX;
    startY = event.type === 'touchstart' ? touchEvent.touches[0]!.pageY : mouseEvent.pageY;
    if ((event.type === 'mousedown' && mouseEvent.button !== 0) || event.target !== element) return;
    timerId = setTimeout(() => {
      const longPressEvent = new CustomEvent('longpress', {
        detail: { startX, startY },
        bubbles: true,
        cancelable: true,
      });
      element.dispatchEvent(longPressEvent);
    }, duration);
  };

  const cancel = (): void => {
    if (timerId !== null) clearTimeout(timerId);
  };

  const move = (event: Event): void => {
    const touchEvent = event as TouchEvent;
    const mouseEvent = event as MouseEvent;
    const newX = event.type === 'touchmove' ? touchEvent.touches[0]!.pageX : mouseEvent.pageX;
    const newY = event.type === 'touchmove' ? touchEvent.touches[0]!.pageY : mouseEvent.pageY;
    if (Math.abs(newX - startX) > 10 || Math.abs(newY - startY) > 10) cancel();
  };

  element.addEventListener('mousedown', start);
  element.addEventListener('touchstart', start, { passive: true });
  element.addEventListener('mouseup', cancel);
  element.addEventListener('mouseleave', cancel);
  element.addEventListener('touchend', cancel);
  element.addEventListener('touchcancel', cancel);
  element.addEventListener('mousemove', move);
  element.addEventListener('touchmove', move, { passive: true });
}
