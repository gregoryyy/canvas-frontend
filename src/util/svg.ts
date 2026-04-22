import * as htmlToImage from 'html-to-image';
import { createElement } from './dom';

export function convertDivToSvg(divId: string, filename: string): void {
  const node = document.getElementById(divId)!;

  const downloadImage = (svgContent: string): void => {
    const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = createElement('a', { href: url, download: filename }) as HTMLAnchorElement;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  htmlToImage
    .toSvg(node)
    .then((dataUrl) => {
      const svgContent =
        '<?xml version="1.0" encoding="UTF-8"?>' + decodeURIComponent(dataUrl.split(',')[1]!);
      downloadImage(svgContent);
    })
    .catch((error) => console.error('Could not convert the div to SVG:', error));
}
