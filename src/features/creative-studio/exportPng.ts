/**
 * PNG-Export im Browser, exakt in den Pixeln des Formats.
 * Safe-Zone und Transformer liegen auf einer anderen Ebene und fehlen hier.
 */

export async function loadHtmlImage(src: string): Promise<HTMLImageElement> {
  const image = new Image();
  image.decoding = 'async';
  const loaded = new Promise<HTMLImageElement>((resolve, reject) => {
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Bild konnte nicht gelesen werden'));
  });
  image.src = src;
  return loaded;
}

/** Zeichnet eine Konva-Daten-URL auf eine Leinwand in exakter Zielgröße. */
export async function dataUrlToExactPng(source: string, width: number, height: number): Promise<string> {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    throw new Error('Exportgröße ist ungültig');
  }
  const image = await loadHtmlImage(source);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas-Kontext fehlt');
  context.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL('image/png');
}

export function downloadDataUrl(filename: string, dataUrl: string): void {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export function readImageFile(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    return Promise.reject(new Error('Nur Bilddateien'));
  }
  if (file.size > 1_500_000) {
    return Promise.reject(new Error('Bild ist größer als 1,5 MB'));
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string' || !result.startsWith('data:image/')) {
        reject(new Error('Bild konnte nicht gelesen werden'));
        return;
      }
      resolve(result);
    };
    reader.onerror = () => reject(new Error('Bild konnte nicht gelesen werden'));
    reader.readAsDataURL(file);
  });
}
