/**
 * Calculs LFBB jeunes 2025-2026, isolés du parseur TournamentSoftware.
 * Entrées attendues : un résultat de simple vérifié, avec niveau et catégorie
 * d'épreuve normalisés au préalable. Les doublons/forfaits sont traités en amont.
 * Aucune écriture sur le classement officiel.
 */
import {classifyEventDiscipline} from "./event-discipline.mjs";

function participantBucket(count) {
  if (!Number.isInteger(count) || count < 1) throw new Error("Nombre de participants réels invalide");
  if (count <= 3) return "1à3";
  if (count <= 7) return "4à7";
  if (count <= 15) return "8à15";
  if (count <= 31) return "16à31";
  throw new Error("Table de ranking 32+ participants non fournie : validation nécessaire");
}

function pointForPlacement(rankings, age, level, bucket, placement) {
  const table = rankings.tables?.[age]?.[level]?.[bucket];
  if (!table) throw new Error(`Barème absent: ${age}/${level}/${bucket}`);
  if (placement === "V.Conso" || placement === "F.Conso") {
    const score = table[placement];
    if (!Number.isFinite(score)) throw new Error("Barème de consolation absent");
    return score;
  }
  const ranks = Array.isArray(placement) ? placement : [placement];
  if (!ranks.length || ranks.some(v => !Number.isInteger(v) || v < 1)) {
    throw new Error("Position finale invalide");
  }
  const values = ranks.map(rank => table[String(rank)]);
  if (values.some(v => !Number.isFinite(v))) throw new Error("Position absente du barème");
  if (!values.every(v => v === values[0])) {
    throw new Error("Égalité de places traversant deux niveaux de points : validation nécessaire");
  }
  return values[0];
}

export function calculateYouthPoints(result, rankingTables, promotionRules) {
  const age = String(result.eventAge || "").toUpperCase();
  const level = String(result.eventLevel || "").toUpperCase();
  const base = {rankingD: 0, rankingC: 0, promotionDToC: 0};
  const discipline = classifyEventDiscipline(result);
  if (discipline === "doubles") return {...base, included: false, reason: "épreuve de double hors ranking LFBB jeunes"};
  if (discipline !== "singles") throw new Error("Discipline du tableau non confirmée : calcul bloqué, simple à vérifier");
  if (result.cancelled || result.friendly) return {...base, included: false, reason: "tournoi ou tableau non officiel"};
  if (age === "U9") return {...base, included: false, reason: "tableau exclusivement U9"};
  if (!["U11","U13","U15","U17","U19"].includes(age)) {
    throw new Error("Catégorie d'épreuve à confirmer (notamment âge fusionné)");
  }
  if (!["D","C"].includes(level)) throw new Error("Niveau de tableau D/C à confirmer");
  const n = result.validParticipants;
  const bucket = participantBucket(n);
  const value = pointForPlacement(rankingTables, age, level, bucket, result.placement);
  if (level === "D") {
    const bracket = promotionRules.participantBrackets.find(b => n >= b.min && (b.max === null || n <= b.max));
    if (!bracket) throw new Error("Barème de montée absent");
    let promotion = 0;
    if (result.placement === 1 || (Array.isArray(result.placement) && result.placement.length === 1 && result.placement[0] === 1)) promotion = bracket.winner;
    if (result.placement === 2 || (Array.isArray(result.placement) && result.placement.length === 1 && result.placement[0] === 2)) promotion = bracket.finalist;
    return {...base, rankingD:value, promotionDToC:promotion, included:true, bucket};
  }
  return {...base, rankingC:value, included:true, bucket};
}
