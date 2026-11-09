/** Individual ranking presentation: age is based ONLY on birth-year and display year.
 * Tournament points retain their original event age and point tables.
 */
export function youthCategoryByBirthYear(birthYear,displayYear=new Date().getFullYear()) {
 if (!Number.isInteger(birthYear)||!Number.isInteger(displayYear)||birthYear>displayYear)return 'À VÉRIFIER';
 const age=displayYear-birthYear;
 for(const [max,label] of [[6,'U7'],[8,'U9'],[10,'U11'],[12,'U13'],[14,'U15'],[16,'U17'],[18,'U19']])if(age<=max)return label;
 return 'HORS JEUNES';
}
export function yearWithinCategory(birthYear,displayYear=new Date().getFullYear()) {
 const age=youthCategoryByBirthYear(birthYear,displayYear);
 return ['À VÉRIFIER','HORS JEUNES'].includes(age)?null:(displayYear-birthYear)%2===0?2:1;
}
export function crossLevelColor(registeredLevel,rankingLevel) {
 if(rankingLevel==='D'&&registeredLevel==='C')return 'red';
 if(rankingLevel==='C'&&registeredLevel==='D')return 'green';
 return null;
}
export function dedupeRankingParticipants(rows) {
 const players=new Map();
 for(const row of rows){
  const key=row.memberId?'ID:'+String(row.memberId):row.playerKey;
  if(!key)throw new Error('player identity is required');
  if(!players.has(key))players.set(key,{...row,playerKey:key,rankingD:0,rankingC:0,promotionDToC:0});
  const player=players.get(key);
  if(row.status!=='calculated')continue;
  for(const field of ['rankingD','rankingC','promotionDToC'])player[field]+=Number(row[field]||0);
 }
 return [...players.values()];
}
