export function verifyCoverage(expected,actual) {
 const review = expected.map(e=>{
   const a=actual.find(x=>x.tournament===e.tournament&&x.level===e.level);
   const n=a?.calculated??0, pending=a?.pending??0;
   const status=n+pending===0?'MISSING_SOURCE':pending>0?'UNRESOLVED_PLACEMENTS':n<e.expectedPlayers?'INCOMPLETE_PLAYERS':'TO_VERIFY_POINTS';
   return {...e,calculated:n,pending,status};
 });
 return {isSeasonComplete:review.length>0 && review.every(x=>x.status==='TO_VERIFY_POINTS') && false,
  sourcesMissing:review.filter(x=>x.status==='MISSING_SOURCE').length,
  review};
}
// Seul Brussels D peut provenir d'anciennes positions/points.
export function allowSource(a){
 if(a.source==='historical' && a.tournament!=='Brussels D')throw new Error('historical fallback forbidden outside Brussels D');
 return true;
}
