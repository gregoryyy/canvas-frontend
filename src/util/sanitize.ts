import DOMPurify from 'dompurify';

export function sanitize(text: string): string {
  return DOMPurify.sanitize(text, { ALLOWED_TAGS: ['br', 'p', 'i', 'b', 'a'] }) as string;
}

export function sanitizeJSON<T>(value: T): T {
  if (typeof value === 'string') return sanitize(value) as T;
  if (Array.isArray(value)) return value.map(sanitizeJSON) as T;
  if (typeof value === 'object' && value !== null) {
    const sanitizedObject: Record<string, unknown> = {};
    for (const key in value) {
      sanitizedObject[key] = sanitizeJSON((value as Record<string, unknown>)[key]);
    }
    return sanitizedObject as T;
  }
  return value;
}

export function convertBR(text: string): string {
  return text.replace(/<br\s*\/?>/gi, '\n').replace(/[\u200B]/g, '');
}

export function convertNL(text: string): string {
  return text.replace(/\n/g, '<br>');
}

export function decodeHtml(html: string): string {
  return new DOMParser().parseFromString(html, 'text/html').documentElement.textContent as string;
}

export function encodeHtml(text: string): string {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(text));
  return div.innerHTML;
}

export function trimPluralS(s: string): string {
  if (s.endsWith('ss')) return s;
  if (s.endsWith('s')) return s.substring(0, s.length - 1);
  return s;
}
