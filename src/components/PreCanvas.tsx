import { useEffect, useRef } from 'react';
import { useEditable } from '../hooks/useEditable';
import { setMeta } from '../state/store';
import type { Meta } from '../types/canvas';
import { convertBR, convertNL, sanitize } from '../util/sanitize';

interface PreCanvasProps {
  meta: Meta;
  display: boolean;
}

/**
 * Title + optional description above the canvas. M3 wires useEditable on
 * both elements and dispatches `setMeta` on commit. Title uses textContent
 * (plain text, no HTML); description uses innerHTML (BR preserved).
 *
 * DOM content is set imperatively via useEffect rather than JSX children to
 * avoid React fighting with contenteditable user edits.
 */
export function PreCanvas({ meta, display }: PreCanvasProps) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const descRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (titleRef.current) titleRef.current.textContent = meta.title;
  }, [meta.title]);

  useEffect(() => {
    if (descRef.current && meta.description !== undefined) {
      descRef.current.innerHTML = convertNL(meta.description);
    }
  }, [meta.description]);

  useEditable(titleRef, () => {
    setMeta({ title: sanitize(titleRef.current?.textContent ?? '') });
  });

  useEditable(descRef, (html) => {
    setMeta({ description: sanitize(convertBR(html)) });
  });

  return (
    <div id="precanvas">
      <h2 ref={titleRef} />
      {display && meta.description !== undefined && <p ref={descRef} />}
    </div>
  );
}
