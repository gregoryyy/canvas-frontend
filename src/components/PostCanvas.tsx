import { useEffect, useRef } from 'react';
import { useEditable } from '../hooks/useEditable';
import { setAnalysis } from '../state/store';
import type { Analysis } from '../types/canvas';
import type { CanvasConfig } from '../types/config';
import { convertBR, convertNL, sanitize } from '../util/sanitize';

interface PostCanvasProps {
  analysis: Analysis | undefined;
  config: CanvasConfig;
  display: boolean;
}

/**
 * Analysis + optional score total below the canvas. M3 wires useEditable on
 * the paragraph; on commit dispatches `setAnalysis`. Score span stays at the
 * `0.0` placeholder — real `evaluateFormula` integration waits for M5.
 */
export function PostCanvas({ analysis, config, display }: PostCanvasProps) {
  const paragraphRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (paragraphRef.current) {
      paragraphRef.current.innerHTML = convertNL(analysis?.content ?? '');
    }
  }, [analysis?.content]);

  useEditable(paragraphRef, (html) => {
    setAnalysis(sanitize(convertBR(html)));
  });

  if (!display) return null;
  const hasScore = Boolean(config.scoring[0]?.total);

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
      <p ref={paragraphRef} />
    </div>
  );
}
