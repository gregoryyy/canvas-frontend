import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { useRef, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfirmStep } from '../src/components/ConfirmStep';
import { HoverHelp } from '../src/components/HoverHelp';
import { OverlayMenu } from '../src/components/OverlayMenu';
import { Toast } from '../src/components/Toast';
import { ToastContainer, showToast } from '../src/components/ToastContainer';

describe('HoverHelp', () => {
  afterEach(cleanup);

  it('renders hidden when open=false', () => {
    const { container } = render(
      <HoverHelp subtitle="why" description="explain" open={false} />,
    );
    const help = container.querySelector<HTMLDivElement>('.hover-help')!;
    expect(help.style.display).toBe('none');
  });

  it('renders visible when open=true', () => {
    const { container } = render(
      <HoverHelp subtitle="why" description="<strong>explain</strong>" open />,
    );
    const help = container.querySelector<HTMLDivElement>('.hover-help')!;
    expect(help.style.display).toBe('block');
    expect(help.querySelector('h4')!.textContent).toBe('why');
    expect(help.querySelector('p')!.innerHTML).toBe('<strong>explain</strong>');
  });

  it('omits h4 and p when subtitle/description are absent', () => {
    const { container } = render(<HoverHelp open />);
    expect(container.querySelector('h4')).toBeNull();
    expect(container.querySelector('p')).toBeNull();
  });
});

describe('ConfirmStep', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it('first click primes confirmation, second click fires onConfirm', () => {
    const onConfirm = vi.fn();
    const { container } = render(<ConfirmStep label="Clear" onConfirm={onConfirm} />);
    const btn = container.querySelector('div')!;
    expect(btn.textContent).toBe('Clear');

    fireEvent.click(btn);
    expect(btn.textContent).toBe('Clear?');
    expect(btn.style.color).toBe('red');
    expect(onConfirm).not.toHaveBeenCalled();

    fireEvent.click(btn);
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(btn.textContent).toBe('Clear');
  });

  it('resets to the non-confirming state after the timeout', () => {
    const { container } = render(<ConfirmStep label="X" onConfirm={vi.fn()} timeout={500} />);
    const btn = container.querySelector('div')!;
    fireEvent.click(btn);
    expect(btn.textContent).toBe('X?');
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(btn.textContent).toBe('X');
  });

  it('stops propagation when stopPropagation is set', () => {
    const outerClick = vi.fn();
    const { container } = render(
      <div onClick={outerClick}>
        <ConfirmStep label="Del" onConfirm={vi.fn()} stopPropagation className="cs" />
      </div>,
    );
    fireEvent.click(container.querySelector('.cs')!);
    expect(outerClick).not.toHaveBeenCalled();
  });
});

describe('OverlayMenu', () => {
  afterEach(cleanup);

  function Harness({
    items,
    onSelect,
    onDelete,
    onClose,
  }: {
    items: (string | [string, string])[];
    onSelect: (v: string) => void;
    onDelete?: (v: string) => void;
    onClose: () => void;
  }) {
    const triggerRef = useRef<HTMLButtonElement>(null);
    const [open, setOpen] = useState(true);
    return (
      <div>
        <button ref={triggerRef}>Trigger</button>
        <OverlayMenu
          open={open}
          triggerRef={triggerRef}
          title="Menu"
          items={items}
          onSelect={onSelect}
          onDelete={onDelete}
          onClose={() => {
            onClose();
            setOpen(false);
          }}
        />
      </div>
    );
  }

  it('renders items into a portal on document.body', () => {
    render(<Harness items={['one', 'two']} onSelect={vi.fn()} onClose={vi.fn()} />);
    const menu = document.body.querySelector('.overlay-menu')!;
    expect(menu).toBeTruthy();
    expect(menu.querySelector('h3')!.textContent).toBe('Menu');
    expect(menu.querySelectorAll('.overlay-menu-item')).toHaveLength(2);
  });

  it('renders "(empty)" when items is an empty array', () => {
    render(<Harness items={[]} onSelect={vi.fn()} onClose={vi.fn()} />);
    expect(document.body.querySelector('.overlay-menu-item')!.textContent).toBe('(empty)');
  });

  it('calls onSelect and onClose when an item is clicked', () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    render(
      <Harness
        items={[['Label A', 'value-a'], ['Label B', 'value-b']]}
        onSelect={onSelect}
        onClose={onClose}
      />,
    );
    const items = document.body.querySelectorAll<HTMLElement>('.overlay-menu-item');
    fireEvent.click(items[0]!);
    expect(onSelect).toHaveBeenCalledWith('value-a');
    expect(onClose).toHaveBeenCalled();
  });

  it('closes when a click lands outside trigger and menu', () => {
    const onClose = vi.fn();
    render(<Harness items={['one']} onSelect={vi.fn()} onClose={onClose} />);
    fireEvent.click(document.body);
    expect(onClose).toHaveBeenCalled();
  });

  it('renders per-item Delete when onDelete is set; delete confirms twice', () => {
    const onDelete = vi.fn();
    render(
      <Harness items={['a', 'b']} onSelect={vi.fn()} onDelete={onDelete} onClose={vi.fn()} />,
    );
    const deleteBtns = document.body.querySelectorAll<HTMLElement>('.overlay-menu-item-delete');
    expect(deleteBtns).toHaveLength(2);

    fireEvent.click(deleteBtns[0]!);
    expect(onDelete).not.toHaveBeenCalled();
    fireEvent.click(deleteBtns[0]!);
    expect(onDelete).toHaveBeenCalledWith('a');
  });
});

describe('Toast + ToastContainer', () => {
  afterEach(cleanup);

  it('Toast renders the message into document.body', () => {
    render(<Toast message="hello" onDismiss={vi.fn()} />);
    const el = document.body.querySelector<HTMLDivElement>('.toast')!;
    expect(el).toBeTruthy();
    expect(el.textContent).toBe('hello');
  });

  it('Toast adds toast-error class when isError is set', () => {
    render(<Toast message="x" isError onDismiss={vi.fn()} />);
    expect(document.body.querySelector('.toast')!.className).toContain('toast-error');
  });

  it('showToast enqueues a toast onto a mounted ToastContainer', () => {
    render(<ToastContainer />);
    expect(document.body.querySelectorAll('.toast')).toHaveLength(0);
    act(() => {
      showToast('Saved');
    });
    expect(document.body.querySelectorAll('.toast')).toHaveLength(1);
    expect(document.body.querySelector('.toast')!.textContent).toBe('Saved');
  });

  it('showToast is a no-op when no ToastContainer is mounted', () => {
    expect(() => showToast('nobody home')).not.toThrow();
    expect(document.body.querySelectorAll('.toast')).toHaveLength(0);
  });
});
