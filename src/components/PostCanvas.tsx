import type { Analysis } from '../types/canvas';
import type { CanvasConfig } from '../types/config';
import { convertNL } from '../util/sanitize';

interface PostCanvasProps {
  analysis: Analysis | undefined;
  config: CanvasConfig;
  display: boolean;
}

/**
 * Analysis + optional score total below the canvas. Matches the legacy
 * PostCanvas.render structure. Returns null when `display` is false
 * (driven by `settings.layout.postcanvas === 'yes'`).
 *
 * Phase-2 M2 renders a static "0.0" placeholder for the score span; the
 * real `evaluateFormula` wire-up lands in M3/M5 along with the score
 * dropdown change handlers.
 */
export function PostCanvas({ analysis, config, display }: PostCanvasProps) {
  if (!display) return null;
  const hasScore = Boolean(config.scoring[0]?.total);
  const content = analysis?.content ?? '';

  return (
    <div id="postcanvas">
      <div className="cell-title-container">
        <h3 className="cell-title">Analysis</h3>
        {hasScore && (
          <>
            <h3 className="score-total-label">Score</h3>
            <span className="score-total">0.0</span>
          </>
        )}
      </div>
      <p dangerouslySetInnerHTML={{ __html: convertNL(content) }} />
    </div>
  );
}
