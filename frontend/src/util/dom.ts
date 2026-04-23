export type AttributeMap = Record<string, string | number>;
export type ElementFormat = 'text' | 'html';

export function createElement(
  tagName: string,
  attributes: AttributeMap = {},
  text = '',
  format: ElementFormat = 'text',
): HTMLElement {
  const element = document.createElement(tagName);
  for (const [key, value] of Object.entries(attributes)) {
    element.setAttribute(key, String(value));
  }
  if (text) {
    switch (format) {
      case 'text':
        element.textContent = text;
        break;
      case 'html':
        element.innerHTML = text;
        break;
    }
  }
  return element;
}

export function toggleElements(sel: string): void {
  const elems = document.querySelectorAll<HTMLElement>(sel);
  const shown = window.getComputedStyle(elems[0]!).getPropertyValue('display') === 'block';
  elems.forEach((elem) => {
    elem.style.display = shown ? 'none' : 'block';
  });
}
