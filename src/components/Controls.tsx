import type { CanvasConfig } from '../types/config';

interface ControlsProps {
  config: CanvasConfig;
}

interface ButtonSpec {
  id: string;
  label: string;
}

/**
 * Control bar. Matches the legacy button order from Controls.render in
 * src/app.ts, including the conditional Export/Import LS buttons driven by
 * `settings.localstorage.filemenu`.
 *
 * Dumb component: no click handlers in M2. M5 wires the save/load/clear
 * behavior and the hidden `<input type="file">` change listener.
 */
export function Controls({ config }: ControlsProps) {
  const filemenu = config.settings.localstorage.filemenu === 'yes';

  const buttons: ButtonSpec[] = [
    { id: 'cvclear', label: 'Clear Canvas' },
    { id: 'chtype', label: 'Canvas Type' },
    { id: 'cvsvg', label: 'Export SVG' },
    { id: 'lsload', label: 'Load from LS' },
    { id: 'lssave', label: 'Save to LS' },
    { id: 'lsclear', label: 'Clear LS' },
  ];
  if (filemenu) {
    buttons.push({ id: 'lsdown', label: 'Export LS' });
    buttons.push({ id: 'lsup', label: 'Import LS' });
  }

  return (
    <>
      {buttons.map((btn) => (
        <div key={btn.id} id={btn.id} className="control">
          {btn.label}
        </div>
      ))}
      {filemenu && <input type="file" id="lsFileInput" style={{ display: 'none' }} />}
    </>
  );
}
