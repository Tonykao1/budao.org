export function validateSceneCandidate(candidate, context = {}){
  const reasons=[];
  const viewportWidth = Number(context.viewport?.width) || 1200;
  const safeInset = Number(context.safeInset) || Math.max(20,viewportWidth*0.04);
  const minTextPx = Number(context.minTextPx) || 18;
  const hasText = candidate.sceneType !== 'image-only';
  const hasImage = candidate.sceneType !== 'text-only';
  if (hasText){
    if (typeof candidate.text !== 'string' || candidate.text.length === 0) reasons.push('missing-text');
    if (Number(candidate.textFontPx) < minTextPx) reasons.push('text-too-small');
    if (Number(candidate.textLeft) < safeInset || Number(candidate.textRight) > viewportWidth-safeInset || Number(candidate.textRight) <= Number(candidate.textLeft)) reasons.push('text-overflow');
    if (Math.abs(Number(candidate.textBlurPx)||0) > 0.01) reasons.push('focus-text-blur');
    if (Math.abs(Number(candidate.textPerspective)||0) > 0.01) reasons.push('focus-text-perspective');
    if (Number(candidate.estimatedTextHeightPx) > Number(candidate.availableTextHeightPx) && Number(candidate.availableTextHeightPx) > 0) reasons.push('text-vertical-overflow');
  }
  if (hasImage){
    if (!(Number(candidate.mediaArea) > 0)) reasons.push('zero-media-area');
    if (candidate.cropSpec && (Number(candidate.cropSpec.confidence) < 0.85 || candidate.cropSpec.subjectSafe !== true)) reasons.push('unsafe-crop');
  }
  return { valid:reasons.length===0, reasons };
}
