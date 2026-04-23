import { useStore } from '../state/useStore';

const APP_SIGNATURE = 'Unlost Canvas App v1.3.5';

/**
 * Footer-style attribution rendered below the canvas. Matches the legacy
 * `Application.renderSignature` 1:1 — `<div class="signature">` with the
 * canvas-type display name (resolved via `canvasTypes`) and the app version.
 */
export function Signature() {
  const meta = useStore((s) => s.meta);
  const canvasTypes = useStore((s) => s.canvasTypes);
  const typeName = canvasTypes.find(([, file]) => file === meta.canvas)?.[0] ?? meta.canvas;
  return (
    <div className="signature">
      <div className="canvastype">{typeName}</div>
      <div className="canvassource">{APP_SIGNATURE}</div>
    </div>
  );
}
