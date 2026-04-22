import { sanitizeJSON } from './sanitize';
import { showToast } from './overlay';

export function loadJson(file: string): Promise<unknown> {
  return fetch(file)
    .then((response) => response.json())
    .then(sanitizeJSON)
    .catch((error) => console.error('Error loading file:', error));
}

export function downloadLs(key: string): void {
  const data = localStorage.getItem(key);
  if (data) {
    const blob = new Blob([data], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${key}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(a.href);
  } else console.log('No data to download!');
}

export function uploadLs(event: Event, key: string, replace = false): void {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function (loadEvent) {
      try {
        const result = (loadEvent.target as FileReader).result as string;
        const data = sanitizeJSON(JSON.parse(result)) as Record<string, unknown>;
        const storedCanvases = localStorage.getItem(key);
        if (!storedCanvases || replace) {
          localStorage.setItem(key, JSON.stringify(data));
        } else {
          const canvases = sanitizeJSON(JSON.parse(storedCanvases)) as Record<string, unknown>;
          Object.entries(data).forEach(([entryKey, value]) => {
            canvases[entryKey] = value;
          });
          localStorage.setItem(key, JSON.stringify(canvases));
        }
        showToast('Import successful');
      } catch (e) {
        console.error('Failed to upload data:', e);
        showToast('Import failed', true);
      }
    };
    reader.readAsText(file);
  } else console.log('No file selected!');
}
