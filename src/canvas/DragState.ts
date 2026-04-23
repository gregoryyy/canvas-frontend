/**
 * Module-level drag/drop tracker. Replaces the `static` fields on the legacy
 * Cell and Card classes (`Cell.dragSource`, `Card.dragDestIndex`, etc.).
 *
 * Cell-level fields carry either a numeric cell index (set by makeDroppable
 * on the cell background) or a string `data-index` read from a DOM attribute
 * (set by makeDraggable on a card). The mixed type is preserved 1:1 — the
 * strict `===` comparison in Canvas.updateDragDrop relies on it.
 */

export interface DragState {
  sourceCell: string | number | undefined;
  destCell: string | number | undefined;
  sourceCard: number | undefined;
  destCard: number | undefined;
  sourceCardIndex: number | undefined;
  destCardIndex: number | undefined;
}

export const dragState: DragState = {
  sourceCell: undefined,
  destCell: undefined,
  sourceCard: undefined,
  destCard: undefined,
  sourceCardIndex: undefined,
  destCardIndex: undefined,
};

export function resetDragState(): void {
  dragState.sourceCell = undefined;
  dragState.destCell = undefined;
  dragState.sourceCard = undefined;
  dragState.destCard = undefined;
  dragState.sourceCardIndex = undefined;
  dragState.destCardIndex = undefined;
}
