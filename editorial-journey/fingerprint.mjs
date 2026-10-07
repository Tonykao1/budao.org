const CROP_CONFIDENCE = 0.85;

function clamp(value, min=0, max=1){ return Math.min(max, Math.max(min, value)); }
function finite(value, fallback=0){ return Number.isFinite(Number(value)) ? Number(value) : fallback; }
function stableId(prefix, value){
  let hash = 2166136261;
  for (const ch of String(value)) { hash ^= ch.codePointAt(0); hash = Math.imul(hash, 16777619); }
  return `${prefix}-${(hash >>> 0).toString(36)}`;
}
function normalizeCrop(crop){
  if (!crop || finite(crop.confidence, -1) < CROP_CONFIDENCE) return null;
  const { x, y, width, height } = crop;
  if (![x,y,width,height].every(Number.isFinite)) return null;
  if (x < 0 || y < 0 || width <= 0 || height <= 0 || x + width > 1.000001 || y + height > 1.000001) return null;
  return { ...crop };
}

export function fingerprintImage(item = {}){
  const width = Math.max(1, finite(item.width, 1));
  const height = Math.max(1, finite(item.height, 1));
  const aspect = width / height;
  const orientation = aspect > 1.1 ? 'landscape' : aspect < 0.9 ? 'portrait' : 'square';
  const pixels = width * height;
  const density = clamp(finite(item.density ?? item.visualDensity, 0.5));
  const dimensionScore = clamp(Math.sqrt(pixels) / 1800);
  const aspectScore = orientation === 'landscape' ? 1 : orientation === 'square' ? 0.82 : 0.68;
  return {
    id: String(item.id || stableId('image', `${item.src || item.path || ''}:${width}x${height}`)),
    aspect,
    orientation,
    density,
    safeCrop: normalizeCrop(item.safeCrop),
    largeFormatScore: clamp((dimensionScore * 0.72) + (aspectScore * 0.28)),
  };
}

export function fingerprintText(text = ''){
  const exact = String(text);
  const characters = [...exact].length;
  const sentenceMatches = exact.match(/[^。！？!?]+[。！？!?]?/gu) || [];
  const punctuationMatches = exact.match(/[，。！？；：、,.!?;:…—]/gu) || [];
  const densityClass = characters <= 12 ? 'short' : characters <= 48 ? 'medium' : 'long';
  const widths = { narrow: 12, medium: 18, wide: 28 };
  return {
    id: stableId('text', exact),
    text: exact,
    characters,
    sentences: exact.trim() ? sentenceMatches.length : 0,
    punctuation: punctuationMatches.length,
    densityClass,
    estimatedLines(widthClass='medium'){
      const perLine = widths[widthClass] || widths.medium;
      return Math.max(1, Math.ceil(Math.max(1, characters) / perLine));
    },
  };
}
