import { type ChangeEvent, type MouseEvent, useRef, useState } from 'react';
import { type DragSource, useDroppable } from '../hooks/useDragDrop';
import { useLongPress } from '../hooks/useLongPress';
import { addCard, moveCard, setScore } from '../state/store';
import type { Cell as CellData } from '../types/canvas';
import type { CellStructure } from '../types/config';
import { trimPluralS } from '../util/sanitize';
import { Card } from './Card';
import { HoverHelp } from './HoverHelp';

interface CellProps {
  cell: CellData;
  structure: CellStructure;
}

/**
 * Cell — title, optional scoring dropdown, hover-help overlay, card list.
 * M3 wires long-press alternates for the dblclick triggers, drag/drop target
 * on the card container (drop-on-empty-area → append), and dispatches
 * `addCard` / `setScore` / `moveCard` to the store.
 */
export function Cell({ cell, structure }: CellProps) {
  const hasScore = structure.score === 'yes';
  const [helpOpen, setHelpOpen] = useState(false);

  const titleRef = useRef<HTMLHeadingElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const toggleHelp = (): void => setHelpOpen((o) => !o);
  const createCard = (): void => {
    addCard(cell.id, 'New ' + trimPluralS(structure.title));
  };

  useLongPress(titleRef, toggleHelp);
  useLongPress(containerRef, createCard);

  useDroppable(containerRef, (source: DragSource) => {
    // Drop-on-empty-area → append. Card-level drop handlers fire first and
    // clear the shared drag source, so this only runs when drop landed
    // outside any card.
    moveCard(source.cellId, source.cardIndex, cell.id, cell.cards?.length ?? 0);
  });

  const handleScoreChange = (e: ChangeEvent<HTMLSelectElement>): void => {
    setScore(cell.id, e.target.value);
  };

  const handleContainerDoubleClick = (e: MouseEvent<HTMLDivElement>): void => {
    if (e.target === e.currentTarget) createCard();
  };

  return (
    <div className="cell" id={String(structure.id)} data-index={cell.id}>
      <div className="cell-title-container">
        <h3 ref={titleRef} className="cell-title" onDoubleClick={toggleHelp}>
          {structure.title}
        </h3>
        {hasScore && (
          <select
            id={`score${structure.id}`}
            className="scoring-dropdown"
            value={String(cell.score ?? 0)}
            onChange={handleScoreChange}
          >
            <option value="0">-</option>
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
            <option value="4">4</option>
            <option value="5">5</option>
          </select>
        )}
        <HoverHelp
          subtitle={structure.subtitle}
          description={structure.description}
          open={helpOpen}
        />
      </div>
      <div
        ref={containerRef}
        className="cell-card-container"
        onDoubleClick={handleContainerDoubleClick}
      >
        {(cell.cards ?? []).map((card, i) => (
          <Card key={i} card={card} cellId={cell.id} cardIndex={i} />
        ))}
      </div>
    </div>
  );
}
