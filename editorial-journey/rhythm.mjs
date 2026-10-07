export function createRhythmState(){
  return {
    sceneCount:0,
    recentSceneTypes:[],
    recentVisualWeights:[],
    heavyRun:0,
    currentDepth:0,
    sinceTextOnly:0,
    sinceImageOnly:0,
    variationCount:0,
  };
}

export function advanceRhythm(state=createRhythmState(), sceneSpec={}){
  const recentSceneTypes=[...(state.recentSceneTypes||[]),sceneSpec.sceneType].slice(-6);
  const weight=Number.isFinite(sceneSpec.visualWeight)?sceneSpec.visualWeight:0.5;
  const recentVisualWeights=[...(state.recentVisualWeights||[]),weight].slice(-6);
  const heavy = weight >= 0.72 && sceneSpec.sceneType === 'image-text';
  const previousType=(state.recentSceneTypes||[]).at(-1);
  return {
    ...state,
    sceneCount:(state.sceneCount||0)+1,
    recentSceneTypes,
    recentVisualWeights,
    heavyRun:heavy ? (state.heavyRun||0)+1 : 0,
    currentDepth:Number.isFinite(sceneSpec.sceneDepth)?sceneSpec.sceneDepth:(state.currentDepth||0),
    sinceTextOnly:sceneSpec.sceneType==='text-only'?0:(state.sinceTextOnly||0)+1,
    sinceImageOnly:sceneSpec.sceneType==='image-only'?0:(state.sinceImageOnly||0)+1,
    variationCount:(state.variationCount||0)+(previousType && previousType!==sceneSpec.sceneType?1:0),
  };
}
