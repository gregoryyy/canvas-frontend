import type { Card as CardData } from '../types/canvas';
import { convertNL } from '../util/sanitize';

interface CardProps {
  card: CardData;
}

/**
 * Presentational card. Matches the legacy DOM: `<div class="card[ TYPE]">`,
 * content rendered as HTML after NL → `<br>` conversion. Content is already
 * sanitized at store-write time, so `dangerouslySetInnerHTML` is safe here.
 * No interaction handlers — M3 adds edit/drag via hooks.
 */
export function Card({ card }: CardProps) {
  const className = card.type ? `card ${card.type}` : 'card';
  return (
    <div className={className} dangerouslySetInnerHTML={{ __html: convertNL(card.content) }} />
  );
}
