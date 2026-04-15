export function downloadQrPng(containerRef: React.RefObject<HTMLDivElement | null>, filename: string) {
  const svg = containerRef.current?.querySelector('svg');
  if (!svg) return;
  downloadSvgAsPng(svg, `${filename}.png`);
}

export async function downloadSvgAsPng(svgElement: SVGSVGElement, filename: string) {
  const widthAttr = Number(svgElement.getAttribute('width'));
  const heightAttr = Number(svgElement.getAttribute('height'));
  const width = Number.isFinite(widthAttr) && widthAttr > 0 ? widthAttr : 256;
  const height = Number.isFinite(heightAttr) && heightAttr > 0 ? heightAttr : 256;

  const clonedSvg = svgElement.cloneNode(true) as SVGSVGElement;
  if (!clonedSvg.getAttribute('xmlns')) {
    clonedSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  }
  if (!clonedSvg.getAttribute('xmlns:xlink')) {
    clonedSvg.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
  }

  const svgText = new XMLSerializer().serializeToString(clonedSvg);
  const svgBlob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
  const objectUrl = URL.createObjectURL(svgBlob);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to load QR SVG image'));
      img.src = objectUrl;
    });

    const scale = 2;
    const canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = height * scale;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas context not available');
    }

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    const pngBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to convert canvas to PNG'));
        }
      }, 'image/png');
    });

    const pngUrl = URL.createObjectURL(pngBlob);
    const link = document.createElement('a');
    link.href = pngUrl;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(pngUrl);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
