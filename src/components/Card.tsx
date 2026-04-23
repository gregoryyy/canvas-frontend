import { useEffect, useRef } from 'react';
import { type DragSource, useDraggable, useDroppable } from '../hooks/useDragDrop';
import { useEditable } from '../hooks/useEditable';
import { moveCard, removeCard, updateCard } from '../state/store';
import type { Card as CardData, CardType } from '../types/canvas';
import { convertBR, convertNL, sanitize } from '../util/sanitize';

interface CardProps {
  card: CardData;
  cellId: number;
  cardIndex: number;
}

const PREFIXES: Record<string, CardType | undefined> = {
  ':?': 'query',
  ':!': 'comment',
  ':=': 'analysis',
  ':*': 'emphasis',
  ':- ': undefined,
};

/**
 * Single card. M3 wires the edit + drag/drop hooks:
 *   - useEditable → inline edit. On blur, sanitize + convertBR + detect
 *     prefix commands, dispatch updateCard / removeCard.
 *   - useDraggable → drag source. Long-press (mouse or touch) triggers.
 *   - useDroppable → drop target for reorder. Inserts before this card.
 *
 * innerHTML is set imperatively (useEffect on `card.content`) rather than via
 * React's `dangerouslySetInnerHTML` — the latter can clash with the user's
 * in-progress contenteditable edits when React re-renders for unrelated
 * reasons. Ref-based updates only touch DOM when content actually changes.
 */
export function Card({ card, cellId, cardIndex }: CardProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.innerHTML = convertNL(card.content);
  }, [card.content]);

  useEditable(ref, (html) => {
    const normalized = convertBR(sanitize(html)).trim();
    if (!normalized) {
      removeCard(cellId, cardIndex);
      return;
    }
    for (const [cmd, type] of Object.entries(PREFIXES)) {
      if (normalized.startsWith(cmd)) {
        updateCard(cellId, cardIndex, normalized.substring(2).trim(), type);
        return;
      }
    }
    updateCard(cellId, cardIndex, normalized, card.type);
  });

  useDraggable(ref, { cellId, cardIndex }, { longPressMs: 500 });

  useDroppable(ref, (source: DragSource) => {
    // Drop-on-card: insert source before this card. Same-cell source with a
    // lower index shifts this position down by one after removal — caller
    // adjusts toIndex so the pure post-removal `store.moveCard` sees the
    // intended final slot.
    const toIndex =
      source.cellId === cellId && source.cardIndex < cardIndex ? cardIndex - 1 : cardIndex;
    moveCard(source.cellId, source.cardIndex, cellId, toIndex);
  });

  const className = card.type ? `card ${card.type}` : 'card';
  return <div ref={ref} className={className} />;
}
