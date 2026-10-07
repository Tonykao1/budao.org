function clamp(v,min,max){ return Math.max(min,Math.min(max,v)); }
function textFont(text, viewport){
  const base = text?.densityClass === 'long' ? 21 : text?.densityClass === 'short' ? 29 : 25;
  return viewport?.mode === 'mobile' ? clamp(base,20,27) : base;
}
function makeBase({ image, text, viewport, sceneType, cropSpec=null, imageScale, textWidth, visualWeight }){
  const width = Math.max(320, Number(viewport?.width) || 1200);
  const inset = Math.max(24, width * (viewport?.mode === 'mobile' ? 0.05 : 0.07));
  const font = text ? textFont(text, viewport) : null;
  const textPx = textWidth ? width * textWidth : 0;
  const charsPerLine = text && font ? Math.max(1, Math.floor(textPx / (font * 1.02))) : 0;
  const estimatedTextLines = text ? Math.max(1, Math.ceil(text.characters / Math.max(1, charsPerLine))) : 0;
  const estimatedTextHeightPx = text && font ? estimatedTextLines * font * 1.72 + 44 : 0;
  const availableTextHeightPx = text ? Math.max(160, (Number(viewport?.height)||800) * (sceneType === 'text-only' ? 0.76 : 0.58)) : 0;
  return {
    sceneType,
    imageId:image?.id,
    messageId:text?.id,
    text:text?.text,
    imageScale:imageScale ?? null,
    imageAnchor:image ? (image.orientation === 'portrait' ? 'center' : 'leading') : null,
    cropSpec,
    textWidth:textWidth ?? null,
    textAnchor:text ? 'trailing' : null,
    sceneLength:clamp(0.58 + (text?.densityClass === 'long' ? 0.26 : 0) + (image?.orientation === 'portrait' ? 0.08 : 0),0.55,1.15),
    sceneDepth:clamp(0.26 + (visualWeight || 0.5) * 0.28,0.2,0.7),
    focusPoint:0.5,
    transitionStrength:'strong',
    mobileFallback:'reduced-depth',
    visualWeight:visualWeight ?? 0.5,
    textFontPx:font,
    textLeft:text ? Math.max(inset, width - inset - textPx) : null,
    textRight:text ? width - inset : null,
    mediaArea:image ? Math.max(1, width * (Number(viewport?.height)||800) * (imageScale ?? 0.6) * 0.5) : null,
    textBlurPx:0,
    textPerspective:0,
    estimatedTextLines,
    estimatedTextHeightPx,
    availableTextHeightPx,
  };
}

export function generateSceneCandidates({ image=null, text=null, rhythm={}, viewport={} } = {}){
  const candidates=[];
  const mobile = viewport?.mode === 'mobile' || Number(viewport?.width) <= 980;
  if (image && text){
    const long = text.densityClass === 'long';
    const portrait = image.orientation === 'portrait';
    const imageScale = mobile ? 0.88 : portrait ? 0.42 : long ? 0.54 : 0.58 + image.largeFormatScore * 0.04;
    const textWidth = mobile ? 0.88 : long ? 0.34 : text.densityClass === 'short' ? 0.22 : 0.29;
    candidates.push(makeBase({ image,text,viewport,sceneType:'image-text',imageScale,textWidth,visualWeight:long?0.7:0.78 }));
    if (image.safeCrop){
      const cropImageScale = mobile ? imageScale : clamp(Math.min(imageScale + 0.04, 0.94 - textWidth), 0.32, 0.9);
      candidates.push(makeBase({ image,text,viewport,sceneType:'image-text',cropSpec:{...image.safeCrop,subjectSafe:true},imageScale:cropImageScale,textWidth,visualWeight:0.82 }));
    }
  }
  if (image){
    const scale = mobile ? 0.9 : image.orientation === 'portrait' ? 0.46 : 0.78 + image.largeFormatScore * 0.08;
    candidates.push(makeBase({ image,text:null,viewport,sceneType:'image-only',imageScale:clamp(scale,0.36,0.92),visualWeight:image.orientation==='portrait'?0.52:0.76 }));
    if (image.safeCrop){
      candidates.push(makeBase({ image,text:null,viewport,sceneType:'image-only',cropSpec:{...image.safeCrop,subjectSafe:true},imageScale:clamp(scale+0.03,0.36,0.94),visualWeight:0.8 }));
    }
  }
  if (text){
    const textWidth = mobile ? 0.88 : text.densityClass === 'short' ? 0.34 : text.densityClass === 'long' ? 0.56 : 0.44;
    candidates.push(makeBase({ image:null,text,viewport,sceneType:'text-only',textWidth,visualWeight:text.densityClass==='long'?0.48:0.3 }));
  }
  return candidates;
}
