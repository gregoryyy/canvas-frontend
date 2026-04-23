import { useStore } from '../state/useStore';
import { Canvas } from './Canvas';
import { Controls } from './Controls';
import { PostCanvas } from './PostCanvas';
import { PreCanvas } from './PreCanvas';
import { Signature } from './Signature';
import { ToastContainer } from './ToastContainer';

/**
 * The canvas area: PreCanvas (title/description), Canvas (grid of cells),
 * PostCanvas (analysis + score), and Signature (canvas-type label + app
 * version). Mounts inside `#content` in production; mirrors the legacy
 * `Application.render` output 1:1.
 */
export function CanvasArea() {
  const meta = useStore((s) => s.meta);
  const cells = useStore((s) => s.cells);
  const analysis = useStore((s) => s.analysis);
  const config = useStore((s) => s.config);

  if (!config) return null;
  const { layout } = config.settings;

  return (
    <>
      <PreCanvas meta={meta} display={layout.precanvas === 'yes'} />
      <Canvas cells={cells} config={config} />
      <PostCanvas
        analysis={analysis}
        config={config}
        display={layout.postcanvas === 'yes'}
      />
      <Signature />
    </>
  );
}

/**
 * The controls area: button bar + toast host. Mounts inside `#controls` in
 * production. Splitting controls off from the canvas lets phase-2 keep the
 * legacy `index.html` two-mount-point layout unchanged.
 */
export function ControlsArea() {
  const config = useStore((s) => s.config);
  if (!config) return null;
  return (
    <>
      <Controls config={config} />
      <ToastContainer />
    </>
  );
}

/**
 * Combined view for tests that expect a single tree. Production mounts
 * CanvasArea and ControlsArea into separate roots (see src/main.tsx).
 */
export function App() {
  return (
    <>
      <CanvasArea />
      <ControlsArea />
    </>
  );
}
