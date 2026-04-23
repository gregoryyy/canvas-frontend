import { type RefObject, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ConfirmStep } from './ConfirmStep';

type MenuItem = string | [label: string, value: string];

interface OverlayMenuProps {
  open: boolean;
  triggerRef: RefObject<HTMLElement | null>;
  title: string;
  items: MenuItem[];
  onSelect: (value: string) => void;
  onDelete?: (value: string) => void;
  onClose: () => void;
}

/**
 * Popover menu anchored above a trigger element. Portal-rendered into
 * `document.body` so the menu escapes parent `overflow: hidden` clipping.
 * Click outside closes; selecting an item calls `onSelect` and closes; the
 * optional per-item Delete uses a confirm-twice pattern via ConfirmStep.
 * Matches the legacy `overlayMenu` util behavior.
 */
export function OverlayMenu({
  open,
  triggerRef,
  title,
  items,
  onSelect,
  onDelete,
  onClose,
}: OverlayMenuProps) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState<{ left: number; top: number }>({
    left: -9999,
    top: -9999,
  });

  useLayoutEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    const menu = menuRef.current;
    if (!trigger || !menu) return;
    const rect = trigger.getBoundingClientRect();
    const wanted = window.scrollY + rect.top - menu.offsetHeight;
    setPosition({
      left: rect.left,
      top: Math.max(window.scrollY, wanted),
    });
  }, [open, triggerRef]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent): void => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      onClose();
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [open, triggerRef, onClose]);

  if (!open) return null;

  const normalize = (item: MenuItem): [string, string] =>
    typeof item === 'object' ? item : [item, item];

  return createPortal(
    <div
      ref={menuRef}
      className="overlay-menu"
      style={{
        position: 'absolute',
        left: position.left,
        top: position.top,
        display: 'block',
      }}
    >
      <h3>{title}</h3>
      {items.length === 0 && <div className="overlay-menu-item">(empty)</div>}
      {items.map((item, i) => {
        const [label, value] = normalize(item);
        return (
          <div
            key={`${value}-${i}`}
            className="overlay-menu-item"
            onClick={() => {
              onSelect(value);
              onClose();
            }}
          >
            {label}
            {onDelete && (
              <ConfirmStep
                className="overlay-menu-item-delete"
                label="Delete"
                stopPropagation
                onConfirm={() => onDelete(value)}
              />
            )}
          </div>
        );
      })}
    </div>,
    document.body,
  );
}
