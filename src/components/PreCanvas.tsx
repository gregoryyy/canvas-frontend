import type { Meta } from '../types/canvas';
import { convertNL } from '../util/sanitize';

interface PreCanvasProps {
  meta: Meta;
  display: boolean;
}

/**
 * Title + optional description above the canvas. Matches the legacy
 * PreCanvas.render: the `#precanvas` div with its `<h2>` is always rendered;
 * the `<p>` description is only emitted when `display` is true (driven by
 * `settings.layout.precanvas === 'yes'` per config).
 */
export function PreCanvas({ meta, display }: PreCanvasProps) {
  return (
    <div id="precanvas">
      <h2>{meta.title}</h2>
      {display && meta.description !== undefined && (
        <p dangerouslySetInnerHTML={{ __html: convertNL(meta.description) }} />
      )}
    </div>
  );
}
