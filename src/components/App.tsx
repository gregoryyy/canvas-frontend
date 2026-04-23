import { useStore } from '../state/useStore';
import { Canvas } from './Canvas';
import { Controls } from './Controls';
import { PostCanvas } from './PostCanvas';
import { PreCanvas } from './PreCanvas';
import { ToastContainer } from './ToastContainer';

/**
 * Top-level composition. Subscribes to the store for meta / cells / analysis
 * / config and fans them out to child components. Returns null until
 * `init(config, content)` has been called on the store.
 *
 * Mount target is up to the caller (phase-2 M6 replaces the imperative
 * `document.getElementById('content').appendChild(...)` path in main.ts
 * with a `createRoot(...).render(<App />)`).
 */
export function App() {
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
      <Controls config={config} />
      <ToastContainer />
    </>
  );
}
