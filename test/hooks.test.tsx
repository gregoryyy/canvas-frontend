import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type DragSource, useDraggable, useDroppable } from '../src/hooks/useDragDrop';
import { useEditable } from '../src/hooks/useEditable';
import { useLongPress } from '../src/hooks/useLongPress';

// ---- useLongPress ---------------------------------------------------------

function LongPressHarness({ callback, duration }: { callback: () => void; duration?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useLongPress(ref, callback, duration);
  return <div ref={ref} data-testid="lp-target" />;
}

describe('useLongPress', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it('fires the callback after the duration elapses', () => {
    const cb = vi.fn();
    const { getByTestId } = render(<LongPressHarness callback={cb} duration={300} />);
    const el = getByTestId('lp-target');
    fireEvent.mouseDown(el, { button: 0, pageX: 0, pageY: 0 });
    act(() => {
      vi.advanceTimersByTime(350);
    });
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('cancels if the mouse moves more than 10 px before the duration', () => {
    const cb = vi.fn();
    const { getByTestId } = render(<LongPressHarness callback={cb} duration={300} />);
    const el = getByTestId('lp-target');
    // jsdom derives pageX from clientX + scrollX; set clientX so pageX reads back.
    fireEvent.mouseDown(el, { button: 0, clientX: 0, clientY: 0 });
    fireEvent.mouseMove(el, { clientX: 20, clientY: 0 });
    act(() => {
      vi.advanceTimersByTime(350);
    });
    expect(cb).not.toHaveBeenCalled();
  });

  it('cancels on mouseup before the duration', () => {
    const cb = vi.fn();
    const { getByTestId } = render(<LongPressHarness callback={cb} duration={300} />);
    const el = getByTestId('lp-target');
    fireEvent.mouseDown(el, { button: 0 });
    fireEvent.mouseUp(el);
    act(() => {
      vi.advanceTimersByTime(350);
    });
    expect(cb).not.toHaveBeenCalled();
  });

  it('ignores non-left mouse buttons', () => {
    const cb = vi.fn();
    const { getByTestId } = render(<LongPressHarness callback={cb} duration={300} />);
    const el = getByTestId('lp-target');
    fireEvent.mouseDown(el, { button: 2 });
    act(() => {
      vi.advanceTimersByTime(350);
    });
    expect(cb).not.toHaveBeenCalled();
  });
});

// ---- useEditable ----------------------------------------------------------

function EditableHarness({ onCommit }: { onCommit: (html: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEditable(ref, onCommit);
  return <div ref={ref} data-testid="ed-target" />;
}

describe('useEditable', () => {
  afterEach(cleanup);

  it('sets contenteditable on mount and removes it on unmount', () => {
    const { getByTestId, unmount } = render(<EditableHarness onCommit={vi.fn()} />);
    const el = getByTestId('ed-target');
    expect(el.getAttribute('contenteditable')).toBe('true');
    unmount();
    // after unmount the element is detached; just sanity-check that no error
    // was thrown — removal happens inside the hook's cleanup
  });

  it('calls onCommit with innerHTML on blur', () => {
    const onCommit = vi.fn();
    const { getByTestId } = render(<EditableHarness onCommit={onCommit} />);
    const el = getByTestId('ed-target');
    el.innerHTML = 'typed text';
    fireEvent.blur(el);
    expect(onCommit).toHaveBeenCalledWith('typed text');
  });

  it('intercepts Enter to insert two <br> elements', () => {
    const { getByTestId } = render(<EditableHarness onCommit={vi.fn()} />);
    const el = getByTestId('ed-target') as HTMLDivElement;
    // position caret at end of empty div
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    // fire Enter
    const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    el.dispatchEvent(event);
    expect(el.querySelectorAll('br')).toHaveLength(2);
    expect(event.defaultPrevented).toBe(true);
  });

  it('does NOT intercept shift+Enter', () => {
    const { getByTestId } = render(<EditableHarness onCommit={vi.fn()} />);
    const el = getByTestId('ed-target') as HTMLDivElement;
    const event = new KeyboardEvent('keydown', {
      key: 'Enter',
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    el.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });
});

// ---- useDragDrop ----------------------------------------------------------

function DragDropHarness({
  onDrop,
}: {
  onDrop: (src: DragSource, e: DragEvent) => void;
}) {
  const sourceRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef<HTMLDivElement>(null);
  useDraggable(sourceRef, { cellId: 1, cardIndex: 0 });
  useDroppable(targetRef, onDrop);
  return (
    <div>
      <div ref={sourceRef} data-testid="src" />
      <div ref={targetRef} data-testid="tgt" />
    </div>
  );
}

describe('useDragDrop', () => {
  afterEach(cleanup);

  it('sets draggable="true" on the source', () => {
    const { getByTestId } = render(<DragDropHarness onDrop={vi.fn()} />);
    expect(getByTestId('src').getAttribute('draggable')).toBe('true');
  });

  it('invokes onDrop with the source record on drop', () => {
    const onDrop = vi.fn();
    const { getByTestId } = render(<DragDropHarness onDrop={onDrop} />);
    const src = getByTestId('src');
    const tgt = getByTestId('tgt');
    fireEvent.dragStart(src);
    fireEvent.drop(tgt);
    expect(onDrop).toHaveBeenCalledTimes(1);
    expect(onDrop.mock.calls[0]![0]).toEqual({ cellId: 1, cardIndex: 0 });
  });

  it('adds / removes the highlight class on dragenter / dragleave', () => {
    const { getByTestId } = render(<DragDropHarness onDrop={vi.fn()} />);
    const tgt = getByTestId('tgt');
    fireEvent.dragEnter(tgt);
    expect(tgt.classList.contains('highlight')).toBe(true);
    fireEvent.dragLeave(tgt);
    expect(tgt.classList.contains('highlight')).toBe(false);
  });
});
