import { type RefObject, useEffect, useRef } from 'react';

export interface DragSource {
  cellId: number;
  cardIndex: number;
}

const DRAG_CLASS = 'dragging';
const HIGHLIGHT_CLASS = 'highlight';
const MOVE_THRESHOLD_PX = 10;

/**
 * Module-level source tracker. Set on drag start, read on drop, cleared
 * after. HTML5 drag-and-drop only allows one active drag at a time, so a
 * module-level ref is appropriate.
 */
let currentSource: DragSource | null = null;

/**
 * Mark the referenced element as a drag source. `source` is recorded (into
 * module-level state) at drag start; the drop handler on a `useDroppable`
 * target reads it back.
 *
 * When `longPressMs > 0`, drag start triggers on a touch-hold (10 px move
 * threshold); otherwise uses the native HTML5 `dragstart` event. Mirrors
 * the legacy `makeDraggable` util behavior.
 */
export function useDraggable(
  ref: RefObject<HTMLElement | null>,
  source: DragSource,
  options: { longPressMs?: number } = {},
): void {
  const { longPressMs = 0 } = options;
  const sourceRef = useRef(source);
  useEffect(() => {
    sourceRef.current = source;
  }, [source]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.setAttribute('draggable', 'true');

    const onDragStart = (): void => {
      el.classList.add(DRAG_CLASS);
      currentSource = sourceRef.current;
      setTimeout(() => {
        el.style.display = 'none';
      }, 200);
    };

    const onDragEnd = (): void => {
      setTimeout(() => {
        el.style.display = 'block';
        el.classList.remove(DRAG_CLASS);
      }, 200);
    };

    // Long-press trigger: binds both mouse and touch, matches the legacy
    // `generateLongPressEvents` helper used inside makeDraggable.
    let lpTimer: ReturnType<typeof setTimeout> | null = null;
    let lpStartX = 0;
    let lpStartY = 0;

    const lpStart = (event: Event): void => {
      const te = event as TouchEvent;
      const me = event as MouseEvent;
      lpStartX = event.type === 'touchstart' ? te.touches[0]!.pageX : me.pageX;
      lpStartY = event.type === 'touchstart' ? te.touches[0]!.pageY : me.pageY;
      if ((event.type === 'mousedown' && me.button !== 0) || event.target !== el) return;
      lpTimer = setTimeout(onDragStart, longPressMs);
    };

    const lpCancel = (): void => {
      if (lpTimer !== null) {
        clearTimeout(lpTimer);
        lpTimer = null;
      }
    };

    const lpMove = (event: Event): void => {
      const te = event as TouchEvent;
      const me = event as MouseEvent;
      const x = event.type === 'touchmove' ? te.touches[0]!.pageX : me.pageX;
      const y = event.type === 'touchmove' ? te.touches[0]!.pageY : me.pageY;
      if (
        Math.abs(x - lpStartX) > MOVE_THRESHOLD_PX ||
        Math.abs(y - lpStartY) > MOVE_THRESHOLD_PX
      ) {
        lpCancel();
      }
    };

    if (longPressMs > 0) {
      el.addEventListener('mousedown', lpStart);
      el.addEventListener('touchstart', lpStart, { passive: true });
      el.addEventListener('mouseup', lpCancel);
      el.addEventListener('mouseleave', lpCancel);
      el.addEventListener('touchend', lpCancel);
      el.addEventListener('touchcancel', lpCancel);
      el.addEventListener('mousemove', lpMove);
      el.addEventListener('touchmove', lpMove, { passive: true });
    } else {
      el.addEventListener('dragstart', onDragStart);
    }
    el.addEventListener('dragend', onDragEnd);

    return () => {
      lpCancel();
      if (longPressMs > 0) {
        el.removeEventListener('mousedown', lpStart);
        el.removeEventListener('touchstart', lpStart);
        el.removeEventListener('mouseup', lpCancel);
        el.removeEventListener('mouseleave', lpCancel);
        el.removeEventListener('touchend', lpCancel);
        el.removeEventListener('touchcancel', lpCancel);
        el.removeEventListener('mousemove', lpMove);
        el.removeEventListener('touchmove', lpMove);
      } else {
        el.removeEventListener('dragstart', onDragStart);
      }
      el.removeEventListener('dragend', onDragEnd);
    };
  }, [ref, longPressMs]);
}

/**
 * Mark the referenced element as a drop target. `onDrop(source, event)` is
 * called when a drag-drop completes on this element; the `source` is the
 * record written by the corresponding `useDraggable`. Adds the `highlight`
 * class on dragenter and removes on dragleave / drop.
 *
 * When drop bubbles from a card to its cell container, the first handler
 * (the card's) clears `currentSource` — the cell handler's guard sees null
 * and skips. No manual filtering by the caller required.
 */
export function useDroppable(
  ref: RefObject<HTMLElement | null>,
  onDrop: (source: DragSource, event: DragEvent) => void,
): void {
  const onDropRef = useRef(onDrop);
  useEffect(() => {
    onDropRef.current = onDrop;
  }, [onDrop]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onDragOver = (e: Event): void => e.preventDefault();
    const onDragEnter = (): void => el.classList.add(HIGHLIGHT_CLASS);
    const onDragLeave = (): void => el.classList.remove(HIGHLIGHT_CLASS);
    const handleDrop = (e: Event): void => {
      e.preventDefault();
      el.classList.remove(HIGHLIGHT_CLASS);
      if (currentSource) {
        const source = currentSource;
        currentSource = null;
        onDropRef.current(source, e as DragEvent);
      }
    };

    el.addEventListener('dragover', onDragOver);
    el.addEventListener('dragenter', onDragEnter);
    el.addEventListener('dragleave', onDragLeave);
    el.addEventListener('drop', handleDrop);

    return () => {
      el.removeEventListener('dragover', onDragOver);
      el.removeEventListener('dragenter', onDragEnter);
      el.removeEventListener('dragleave', onDragLeave);
      el.removeEventListener('drop', handleDrop);
    };
  }, [ref]);
}
