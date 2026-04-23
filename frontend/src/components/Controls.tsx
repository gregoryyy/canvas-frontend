import { type ChangeEvent, type MouseEvent, useRef, useState } from 'react';
import {
  type CanvasState,
  changeType,
  clearAll,
  clearLocalStorage,
  init,
  saveToLs,
} from '../state/store';
import { useStore } from '../state/useStore';
import type { CanvasConfig } from '../types/config';
import { downloadLs, loadJson, uploadLs } from '../util/io';
import { sanitizeJSON } from '../util/sanitize';
import { convertDivToSvg } from '../util/svg';
import { ConfirmStep } from './ConfirmStep';
import { OverlayMenu } from './OverlayMenu';
import { showToast } from './ToastContainer';

interface ControlsProps {
  config: CanvasConfig;
}

type OpenMenu = 'type' | 'load' | null;

const LS_KEY = 'preseedcanvas';
const FLASH_MS = 500;

/**
 * Adds the `clicked` class to the click target for 500 ms then runs the real
 * handler — matches the legacy Controls visual flash. ConfirmStep handles
 * its own flash via the `flashOnClick` prop.
 */
function withFlash(handler: () => void): (e: MouseEvent<HTMLDivElement>) => void {
  return (e) => {
    const target = e.currentTarget;
    target.classList.add('clicked');
    setTimeout(() => target.classList.remove('clicked'), FLASH_MS);
    handler();
  };
}

/**
 * Control bar. M5 wires every button to its store action, mirroring the
 * legacy `Controls.render` in src/app.ts. The `Canvas Type` and `Load from
 * LS` buttons open an OverlayMenu; the rest are confirm-twice via
 * ConfirmStep, except Import LS which opens a hidden file picker.
 *
 * Toast feedback flows through the `<ToastContainer />` mounted at App's
 * root — `showToast(...)` is a no-op when no container is mounted.
 */
export function Controls({ config }: ControlsProps) {
  const filemenu = config.settings.localstorage.filemenu === 'yes';
  const canvasTypes = useStore((s) => s.canvasTypes);

  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
  const typeRef = useRef<HTMLDivElement>(null);
  const loadRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ---- direct actions ------------------------------------------------------

  const handleClearCanvas = (): void => {
    clearAll();
    showToast('Canvas cleared');
  };

  const handleSaveToLs = (): void => {
    saveToLs();
    showToast('Saved');
  };

  const handleClearLs = (): void => {
    clearLocalStorage();
    showToast('Local storage cleared');
  };

  const handleExportSvg = (): void => {
    convertDivToSvg('content', 'canvas.svg');
    showToast('SVG exported');
  };

  const handleExportLs = (): void => {
    downloadLs(LS_KEY);
    showToast('Exported');
  };

  const handleImportLs = (e: ChangeEvent<HTMLInputElement>): void => {
    uploadLs(e.nativeEvent, LS_KEY);
  };

  // ---- menu-driven actions -------------------------------------------------

  const handleChangeType = (file: string): void => {
    loadJson(`conf/${file}.json`).then((cfg) => {
      if (!cfg) return;
      changeType(cfg as CanvasConfig);
    });
  };

  const handleLoadFromLs = (title: string): void => {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return;
    const all = JSON.parse(raw) as Record<string, unknown>;
    const entry = all[title];
    if (!entry) return;
    const content = sanitizeJSON(entry) as CanvasState;
    loadJson(`conf/${content.meta.canvas}.json`).then((cfg) => {
      if (!cfg) return;
      init(cfg as CanvasConfig, content);
    });
  };

  const handleDelFromLs = (title: string): void => {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return;
    const all = JSON.parse(raw) as Record<string, unknown>;
    delete all[title];
    localStorage.setItem(LS_KEY, JSON.stringify(all));
  };

  const getCanvasNames = (): string[] => {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const all = JSON.parse(raw) as Record<string, unknown>;
    return Object.keys(all).filter((key) => all[key] != null);
  };

  // ---- render --------------------------------------------------------------

  return (
    <>
      <ConfirmStep
        id="cvclear"
        className="control"
        label="Clear Canvas"
        onConfirm={handleClearCanvas}
        flashOnClick
      />
      <div
        ref={typeRef}
        id="chtype"
        className="control"
        onClick={withFlash(() => setOpenMenu((m) => (m === 'type' ? null : 'type')))}
      >
        Canvas Type
      </div>
      <ConfirmStep
        id="cvsvg"
        className="control"
        label="Export SVG"
        onConfirm={handleExportSvg}
        flashOnClick
      />
      <div
        ref={loadRef}
        id="lsload"
        className="control"
        onClick={withFlash(() => setOpenMenu((m) => (m === 'load' ? null : 'load')))}
      >
        Load from LS
      </div>
      <ConfirmStep
        id="lssave"
        className="control"
        label="Save to LS"
        onConfirm={handleSaveToLs}
        flashOnClick
      />
      <ConfirmStep
        id="lsclear"
        className="control"
        label="Clear LS"
        onConfirm={handleClearLs}
        flashOnClick
      />
      {filemenu && (
        <ConfirmStep
          id="lsdown"
          className="control"
          label="Export LS"
          onConfirm={handleExportLs}
          flashOnClick
        />
      )}
      {filemenu && (
        <div
          id="lsup"
          className="control"
          onClick={withFlash(() => fileInputRef.current?.click())}
        >
          Import LS
        </div>
      )}
      {filemenu && (
        <input
          ref={fileInputRef}
          type="file"
          id="lsFileInput"
          style={{ display: 'none' }}
          onChange={handleImportLs}
        />
      )}

      {openMenu === 'type' && (
        <OverlayMenu
          open
          triggerRef={typeRef}
          title="Select canvas type:"
          items={canvasTypes}
          onSelect={handleChangeType}
          onClose={() => setOpenMenu(null)}
        />
      )}
      {openMenu === 'load' && (
        <OverlayMenu
          open
          triggerRef={loadRef}
          title="Load canvas:"
          items={getCanvasNames()}
          onSelect={handleLoadFromLs}
          onDelete={handleDelFromLs}
          onClose={() => setOpenMenu(null)}
        />
      )}
    </>
  );
}
