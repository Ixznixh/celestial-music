interface ExtractedColors {
  primary: string;
  secondary: string;
  glowRgb: string;
}

const colorCache = new Map<string, ExtractedColors>();

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function hexToRgb(hex: string): string {
  const clean = hex.replace('#', '');
  if (clean.length === 6) {
    const r = parseInt(clean.substring(0, 2), 16);
    const g = parseInt(clean.substring(2, 4), 16);
    const b = parseInt(clean.substring(4, 6), 16);
    return `${r}, ${g}, ${b}`;
  }
  return '236, 72, 153';
}

/**
 * Dynamically extracts dominant colors from album artwork.
 */
export async function extractDominantColor(
  imageUrl: string | undefined | null,
  fallbackPrimary = '#ec4899',
  fallbackSecondary = '#818cf8'
): Promise<ExtractedColors> {
  const defaultResult: ExtractedColors = {
    primary: fallbackPrimary,
    secondary: fallbackSecondary,
    glowRgb: hexToRgb(fallbackPrimary),
  };

  if (!imageUrl) return defaultResult;

  if (colorCache.has(imageUrl)) {
    return colorCache.get(imageUrl)!;
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    const proxyUrl = `/api/image-proxy?url=${encodeURIComponent(imageUrl)}`;
    let attemptedProxy = false;

    img.onload = () => {
      try {
        const colors = analyzeImageCanvas(img, fallbackPrimary, fallbackSecondary);
        colorCache.set(imageUrl, colors);
        resolve(colors);
      } catch {
        if (!attemptedProxy && !imageUrl.startsWith('/api/')) {
          attemptedProxy = true;
          img.src = proxyUrl;
        } else {
          resolve(defaultResult);
        }
      }
    };

    img.onerror = () => {
      if (!attemptedProxy && !imageUrl.startsWith('/api/')) {
        attemptedProxy = true;
        img.src = proxyUrl;
      } else {
        resolve(defaultResult);
      }
    };

    img.src = imageUrl;
  });
}

function analyzeImageCanvas(
  img: HTMLImageElement,
  fallbackPrimary: string,
  fallbackSecondary: string
): ExtractedColors {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    return {
      primary: fallbackPrimary,
      secondary: fallbackSecondary,
      glowRgb: hexToRgb(fallbackPrimary),
    };
  }

  const width = 40;
  const height = 40;
  canvas.width = width;
  canvas.height = height;

  ctx.drawImage(img, 0, 0, width, height);
  const imageData = ctx.getImageData(0, 0, width, height).data;

  let totalR = 0, totalG = 0, totalB = 0;
  let sampleCount = 0;

  const colorBuckets: { [key: string]: { r: number; g: number; b: number; count: number; score: number } } = {};

  for (let i = 0; i < imageData.length; i += 4) {
    const r = imageData[i];
    const g = imageData[i + 1];
    const b = imageData[i + 2];
    const a = imageData[i + 3];

    if (a < 128) continue;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2 / 255;
    const s = max === min ? 0 : (max - min) / (1 - Math.abs(2 * l - 1)) / 255;

    if (l < 0.12 || l > 0.88 || s < 0.15) {
      totalR += r;
      totalG += g;
      totalB += b;
      sampleCount++;
      continue;
    }

    const qR = Math.floor(r / 32) * 32;
    const qG = Math.floor(g / 32) * 32;
    const qB = Math.floor(b / 32) * 32;
    const key = `${qR},${qG},${qB}`;

    const vibrancyScore = s * (1 - Math.abs(l - 0.5));

    if (!colorBuckets[key]) {
      colorBuckets[key] = { r: qR, g: qG, b: qB, count: 0, score: 0 };
    }
    colorBuckets[key].count++;
    colorBuckets[key].score += vibrancyScore;
  }

  const sorted = Object.values(colorBuckets).sort((a, b) => b.score * b.count - a.score * a.count);

  let primaryR = 0, primaryG = 0, primaryB = 0;
  let secondaryR = 0, secondaryG = 0, secondaryB = 0;

  if (sorted.length > 0) {
    primaryR = sorted[0].r + 16;
    primaryG = sorted[0].g + 16;
    primaryB = sorted[0].b + 16;

    if (sorted.length > 1) {
      secondaryR = sorted[1].r + 16;
      secondaryG = sorted[1].g + 16;
      secondaryB = sorted[1].b + 16;
    } else {
      secondaryR = Math.min(255, primaryR + 40);
      secondaryG = Math.max(0, primaryG - 30);
      secondaryB = Math.min(255, primaryB + 60);
    }
  } else if (sampleCount > 0) {
    primaryR = Math.round(totalR / sampleCount);
    primaryG = Math.round(totalG / sampleCount);
    primaryB = Math.round(totalB / sampleCount);
    secondaryR = Math.min(255, primaryR + 30);
    secondaryG = Math.max(0, primaryG - 20);
    secondaryB = Math.min(255, primaryB + 50);
  } else {
    return {
      primary: fallbackPrimary,
      secondary: fallbackSecondary,
      glowRgb: hexToRgb(fallbackPrimary),
    };
  }

  const primaryHex = rgbToHex(primaryR, primaryG, primaryB);
  const secondaryHex = rgbToHex(secondaryR, secondaryG, secondaryB);

  return {
    primary: primaryHex,
    secondary: secondaryHex,
    glowRgb: `${primaryR}, ${primaryG}, ${primaryB}`,
  };
}
