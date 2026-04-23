import type { Cell as CellData } from '../types/canvas';
import type { CanvasConfig } from '../types/config';
import { Cell } from './Cell';

interface CanvasProps {
  cells: CellData[];
  config: CanvasConfig;
}

/**
 * Grid of cells. The `canvasclass` from settings.layout drives the grid
 * styling (`ps-canvas`, `bm-canvas`, `lean-canvas`, etc.) via `canvas.css`
 * and `layout.css`, unchanged from phase 1.
 */
export function Canvas({ cells, config }: CanvasProps) {
  const canvasClass = config.settings.layout.canvasclass || '.lean-canvas';
  return (
    <div id="canvas" className={canvasClass}>
      {cells.map((cell, i) => {
        const structure = config.canvas[i];
        if (!structure) return null;
        return <Cell key={cell.id} cell={cell} structure={structure} />;
      })}
    </div>
  );
}
