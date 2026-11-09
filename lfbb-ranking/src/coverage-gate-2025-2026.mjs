/** Vérifie la couverture des épreuves de SIMPLE uniquement.
 * Les tournois de doubles ne sont ni attendus ni comptabilisés dans les rankings.
 * Garçons et filles peuvent partager un même tableau de simple.
 */
import {classifyEventDiscipline} from "./event-discipline.mjs";

export function verifyCoverage(expected,actual) {
 const review = expected.map(event => {
  const discipline = classifyEventDiscipline(event);
  if (discipline === "doubles") {
    return {...event,discipline,status:"EXCLUDED_DOUBLES",calculated:0,pending:0};
  }
  if (discipline === "unknown") {
    return {...event,discipline,status:"DISCIPLINE_TO_VERIFY",calculated:0,pending:0};
  }
  const sameEvent = candidate =>
    (candidate.tournamentId || candidate.tournament) === (event.tournamentId || event.tournament)
    && candidate.level === event.level
    && (!event.eventId || candidate.eventId === event.eventId)
    && classifyEventDiscipline(candidate) === "singles";
  const a = actual.find(sameEvent);
  const calculated=a?.calculated??0, pending=a?.pending??0;
  const status=calculated+pending===0?'MISSING_SOURCE'
    :pending>0?'UNRESOLVED_PLACEMENTS'
    :calculated<event.expectedPlayers?'INCOMPLETE_PLAYERS'
    :'POINTS_A_AUDITER';
  return {...event,discipline,calculated,pending,status};
 });
 const singles = review.filter(e=>e.discipline==="singles");
 const ready = singles.length>0 && singles.every(x=>x.status==="POINTS_A_AUDITER")
    && review.every(x=>x.status!=="DISCIPLINE_TO_VERIFY");
 return {
  sourcesReadyForPointsAudit:ready,
  canPublishOfficial:false,
  reason:ready?'point_review_and_human_approval_still_required':'singles_sources_or_disciplines_unverified',
  sourcesMissing:singles.filter(x=>x.status==="MISSING_SOURCE").length,
  doublesExcluded:review.filter(x=>x.status==="EXCLUDED_DOUBLES").length,
  disciplinesToVerify:review.filter(x=>x.status==="DISCIPLINE_TO_VERIFY").length,
  review
 };
}
export function allowSource(result) {
 if(result.source==='historical' && result.tournament!=='Brussels D')
   throw new Error('Historical fallback forbidden outside Brussels D');
 return true;
}
