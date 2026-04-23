import { useEffect, useRef, useState } from 'react';
import { useEditable } from '../hooks/useEditable';
import { evaluateFormula } from '../scoring/formula';
import { setAnalysis } from '../state/store';
import { useStore } from '../state/useStore';
import type { Analysis } from '../types/canvas';
import type { CanvasConfig } from '../types/config';
import { convertBR, convertNL, sanitize } from '../util/sanitize';

interface PostCanvasProps {
  analysis: Analysis | undefined;
  config: CanvasConfig;
  display: boolean;
}

/**
 * Analysis + optional score total below the canvas. Returns null when
 * `display` is false. Score total is recomputed in a `useEffect` whenever
 * `cells` change, so dropdown updates flow through immediately. The legacy
 * `evaluateFormula` reads `<select>` values from the DOM by id; the effect
 * runs after commit, so the selects are current when the formula runs.
 */
export function PostCanvas({ analysis, config, display }: PostCanvasProps) {
  const paragraphRef = useRef<HTMLParagraphElement>(null);
  const cells = useStore((s) => s.cells);

  useEffect(() => {
    if (paragraphRef.current) {
      paragraphRef.current.innerHTML = convertNL(analysis?.content ?? '');
    }
  }, [analysis?.content]);

  useEditable(paragraphRef, (html) => {
    setAnalysis(sanitize(convertBR(html)));
  });

  const scoring = config.scoring[0];
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (!display || !scoring?.total) {
      setTotal(0);
      return;
    }
    const context: Record<string, number> = {};
    for (const [name, formula] of Object.entries(scoring.scores)) {
      context[name] = evaluateFormula(formula, context);
    }
    setTotal(evaluateFormula(scoring.total, context));
    // re-runs whenever any cell (incl. score) changes, after Cells commit
  }, [cells, scoring, display]);

  if (!display) return null;
  const hasScore = Boolean(scoring?.total);

  return (
    <div id="postcanvas">
      <div className="cell-title-container">
        <h3 className="cell-title">Analysis</h3>
        {hasScore && (
          <>
            <h3 className="score-total-label">Score</h3>
            <span className="score-total">{total.toFixed(1)}</span>
          </>
        )}
      </div>
      <p ref={paragraphRef} />
    </div>
  );
}
