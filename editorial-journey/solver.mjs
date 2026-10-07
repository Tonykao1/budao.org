export const DEFAULT_SOLVER_WEIGHTS = Object.freeze({
  readability:3.2,
  composition:1.5,
  rhythm:2.2,
  continuity:1.1,
  variation:1.5,
  depthFitness:1.0,
  risk:2.8,
});

function clamp(v,min=0,max=1){ return Math.max(min,Math.min(max,v)); }
function deriveReadability(c){
  if (Number.isFinite(c.readabilityScore)) return clamp(c.readabilityScore);
  if (c.sceneType==='image-only') return 1;
  const font=Number(c.textFontPx)||20;
  const width=Number(c.textWidth)||0.3;
  return clamp(0.55 + (font-18)/22*0.25 + Math.min(width,0.55)*0.35);
}
function deriveComposition(c){
  if (Number.isFinite(c.compositionScore)) return clamp(c.compositionScore);
  const weight=Number.isFinite(c.visualWeight)?c.visualWeight:0.5;
  return clamp(1-Math.abs(weight-0.62)*0.7);
}
function rhythmScore(c,rhythm){
  const weight=Number.isFinite(c.visualWeight)?c.visualWeight:0.5;
  if ((rhythm?.heavyRun||0)>=2) return c.sceneType==='image-text' && weight>=0.72 ? 0.1 : weight<=0.55 ? 1 : 0.65;
  const recent=rhythm?.recentVisualWeights||[];
  const avg=recent.length?recent.reduce((a,b)=>a+b,0)/recent.length:0.5;
  return clamp(1-Math.abs((avg+weight)/2-0.58));
}
function variationScore(c,rhythm){
  const recent=rhythm?.recentSceneTypes||[];
  const last=recent.at(-1);
  const repeated=recent.slice(-2).every(t=>t===c.sceneType) && recent.length>=2;
  if (repeated) return 0.12;
  return last===c.sceneType?0.58:1;
}
function continuityScore(c,rhythm){
  const current=Number(rhythm?.currentDepth)||0;
  const next=Number(c.sceneDepth)||0.35;
  return clamp(1-Math.abs(next-current)*0.9);
}
function depthFitness(c){
  const d=Number(c.sceneDepth)||0.35;
  return clamp(1-Math.abs(d-0.42)*1.4);
}

export function scoreSceneCandidate(candidate, context={}){
  if (typeof context.scoreCandidate==='function') return context.scoreCandidate(candidate);
  const w={...DEFAULT_SOLVER_WEIGHTS,...context.weights};
  const risk=clamp(Number(candidate.riskPenalty)||0);
  return deriveReadability(candidate)*w.readability
    + deriveComposition(candidate)*w.composition
    + rhythmScore(candidate,context.rhythm)*w.rhythm
    + continuityScore(candidate,context.rhythm)*w.continuity
    + variationScore(candidate,context.rhythm)*w.variation
    + depthFitness(candidate)*w.depthFitness
    - risk*w.risk;
}

export function chooseSceneCandidate(candidates, context={}, random=Math.random){
  if (!Array.isArray(candidates) || !candidates.length) return null;
  const scored=candidates.map(candidate=>({candidate,score:scoreSceneCandidate(candidate,context)})).sort((a,b)=>b.score-a.score);
  const top=scored[0].score;
  const floor=top>=0?top*0.97:top-Math.abs(top)*0.03;
  const eligible=scored.filter(x=>x.score>=floor);
  const r=Math.max(0,Math.min(0.999999999,Number(random?.())||0));
  const selected=eligible[Math.floor(r*eligible.length)]||eligible[0];
  return selected.candidate;
}
