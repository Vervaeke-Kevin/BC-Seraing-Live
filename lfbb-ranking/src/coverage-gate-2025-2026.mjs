/** Empêche de confondre couverture partielle et ranking complet.
 * La couverture numérique seule ne valide ni les points, ni l'officialité.
 */
export function verifyCoverage(expected,actual) {
 const review=expected.map(e=>{
  const a=actual.find(x=>x.tournament===e.tournament && x.level===e.level);
  const calculated=a?.calculated??0, pending=a?.pending??0;
  const status=calculated+pending===0?'MISSING_SOURCE'
    :pending>0?'UNRESOLVED_PLACEMENTS'
    :calculated<e.expectedPlayers?'INCOMPLETE_PLAYERS'
    :'POINTS_A_AUDITER';
  return {...e,calculated,pending,status};
 });
 const sourcesReady=review.length>0 && review.every(x=>x.status==='POINTS_A_AUDITER');
 return {sourcesReadyForPointsAudit:sourcesReady,canPublishOfficial:false,
  reason:sourcesReady?'point_review_and_human_approval_still_required':'missing_or_unresolved_sources',
  sourcesMissing:review.filter(x=>x.status==='MISSING_SOURCE').length,review};
}
export function allowSource(result) {
 if(result.source==='historical' && result.tournament!=='Brussels D')
   throw new Error('Historical fallback forbidden outside Brussels D');
 return true;
}
