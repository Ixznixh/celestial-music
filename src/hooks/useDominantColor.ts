import { useState, useEffect } from 'react';
import { extractDominantColor } from '../utils/colorExtractor';

export interface ColorPalette {
  primary: string;
  secondary: string;
  glowRgb: string;
}

export function useDominantColor(
  imageUrl?: string,
  fallbackPrimary = '#ec4899',
  fallbackSecondary = '#818cf8'
): ColorPalette {
  const [colors, setColors] = useState<ColorPalette>({
    primary: fallbackPrimary,
    secondary: fallbackSecondary,
    glowRgb: '236, 72, 153',
  });

  useEffect(() => {
    let isCurrent = true;

    if (!imageUrl) {
      setColors({
        primary: fallbackPrimary,
        secondary: fallbackSecondary,
        glowRgb: '236, 72, 153',
      });
      return;
    }

    extractDominantColor(imageUrl, fallbackPrimary, fallbackSecondary).then((res) => {
      if (isCurrent) {
        setColors(res);
      }
    });

    return () => {
      isCurrent = false;
    };
  }, [imageUrl, fallbackPrimary, fallbackSecondary]);

  return colors;
}
