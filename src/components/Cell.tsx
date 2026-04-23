import { useState } from 'react';
import type { Cell as CellData } from '../types/canvas';
import type { CellStructure } from '../types/config';
import { Card } from './Card';
import { HoverHelp } from './HoverHelp';

interface CellProps {
  cell: CellData;
  structure: CellStructure;
}

/**
 * Presentational cell. Matches the legacy DOM:
 *   <div class="cell" id="{id}" data-index="{id}">
 *     <div class="cell-title-container">
 *       <h3 class="cell-title">{title}</h3>
 *       [score select if hasScore]
 *       <div class="hover-help">[h4 subtitle][p description]</div>
 *     </div>
 *     <div class="cell-card-container">[cards]</div>
 *   </div>
 *
 * `hover-help` is in the DOM but styled hidden by default; M4 adds the
 * dblclick/long-press toggle. Score select is controlled by the store; the
 * no-op onChange satisfies React's controlled-input contract until M3
 * replaces it with a real handler.
 */
export function Cell({ cell, structure }: CellProps) {
  const hasScore = structure.score === 'yes';
  const [helpOpen, setHelpOpen] = useState(false);
  return (
    <div className="cell" id={String(structure.id)} data-index={cell.id}>
      <div className="cell-title-container">
        <h3 className="cell-title" onDoubleClick={() => setHelpOpen((o) => !o)}>
          {structure.title}
        </h3>
        {hasScore && (
          <select
            id={`score${structure.id}`}
            className="scoring-dropdown"
            value={String(cell.score ?? 0)}
            onChange={() => undefined}
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
      <div className="cell-card-container">
        {(cell.cards ?? []).map((card, i) => (
          <Card key={i} card={card} />
        ))}
      </div>
    </div>
  );
}
