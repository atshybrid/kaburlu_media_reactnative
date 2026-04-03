type SizingInput = {
  screenWidth: number;
  screenHeight: number;
  wordCount: number;
  aspectRatio?: number;
};

export function computeAdaptiveBodyBaseFont(wordCount: number): number {
  if (wordCount >= 160) return 14;
  if (wordCount >= 120) return 15;
  if (wordCount >= 80) return 16;
  if (wordCount >= 50) return 17;
  if (wordCount >= 30) return 18;
  return 20;
}

export function computeAdaptiveImageHeight({
  screenWidth,
  screenHeight,
  wordCount,
  aspectRatio,
}: SizingInput): number {
  const ratio = typeof aspectRatio === 'number' && aspectRatio > 0 ? aspectRatio : 16 / 9;

  const naturalHeight = screenWidth / ratio;

  let targetFactor = 0.56;
  if (wordCount < 25) targetFactor = 0.68;
  else if (wordCount < 45) targetFactor = 0.62;
  else if (wordCount < 75) targetFactor = 0.56;
  else if (wordCount < 120) targetFactor = 0.50;
  else targetFactor = 0.46;

  const targetHeight = screenWidth * targetFactor;
  const minHeight = screenWidth * 0.40;
  const maxHeight = screenHeight * 0.74;

  const blended = naturalHeight * 0.55 + targetHeight * 0.45;
  return Math.round(Math.max(minHeight, Math.min(maxHeight, blended)));
}

export function computeBodyLineClamp(args: {
  availableHeight: number;
  titleHeight: number;
  lineHeight: number;
  minLines?: number;
  maxLines?: number;
}): number {
  const {
    availableHeight,
    titleHeight,
    lineHeight,
    minLines = 5,
    maxLines = 30,
  } = args;

  const remaining = Math.max(0, availableHeight - titleHeight);
  const lines = Math.floor(remaining / Math.max(1, lineHeight));
  return Math.max(minLines, Math.min(maxLines, lines));
}
