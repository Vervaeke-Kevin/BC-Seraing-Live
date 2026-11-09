/**
 * Classement jeunes LFBB : seules les épreuves de SIMPLE sont éligibles.
 * La présence de filles et garçons dans un MÊME tableau n'en fait pas un double.
 * Des tableaux SM et SD distincts ne doivent pas être fusionnés.
 */
const clean = value => String(value ?? "").normalize("NFKD")
  .replace(/[\u0300-\u036f]/g, "").trim().toUpperCase();

export function classifyEventDiscipline(result = {}) {
  const name = clean(result.drawName ?? result.eventName ?? result.eventLabel ?? "");
  const declared = clean(result.eventDiscipline ?? result.discipline ?? result.eventType ?? "");
  let fromName = "unknown";
  if (name) {
    // "C U13-DG" et "BDU13" sont également des épreuves de double.
    if (/^(DG|DF|DM|DD|DX|MX|MD|WD|XD)\b/.test(name)
      || /^BDU\d+\b/.test(name)
      || /(?:^|[\s-])(DG|DF|DM|DD|DX|MX|MD|WD|XD)(?:\b|$)/.test(name)
      || /\b(DOUBLE(S)?|DUBBEL(SPEL)?|MIXED DOUBLES)\b/.test(name)) fromName = "doubles";
    else if (/^(SG|SF|SM|SD|MS|WS|BS|GS)\b/.test(name)
      || /^BSU\d+\b/.test(name)
      || /(?:^|[\s-])(SG|SF|SM|SD|MS|WS)(?:\b|$)/.test(name)
      || /\b(SIMPLE(S)?|SINGLE(S)?|ENKELSPEL|ENKEL)\b/.test(name)) fromName = "singles";
  }

  let fromDeclared = "unknown";
  if (/^(S|SINGLE|SINGLES|SIMPLE|ENKEL|ENKELSPEL)$/.test(declared)) fromDeclared = "singles";
  if (/^(D|DOUBLE|DOUBLES|DUBBEL|DUBBELSPEL|MIXED_DOUBLES|MIXED-DOUBLES|MIXTE_DOUBLES|MIXTE-DOUBLES)$/.test(declared)) fromDeclared = "doubles";

  // Un tableau clairement nommé « doubles » ne peut jamais compter pour le simple,
  // même si l’ancien importateur l’a incorrectement étiqueté « simple ».
  if (fromName === "doubles") return "doubles";
  // Toute autre contradiction doit être vérifiée avant attribution de points.
  if (fromDeclared !== "unknown" && fromName !== "unknown" && fromDeclared !== fromName) return "unknown";
  if (fromDeclared !== "unknown") return fromDeclared;
  if (fromName !== "unknown") return fromName;

  const teams = result.teams;
  if (Array.isArray(teams) && teams.length === 2 && teams.every(Array.isArray)
      && teams.every(t => t.length === teams[0].length)) {
    if (teams[0].length === 1) return "singles";
    if (teams[0].length === 2) return "doubles";
  }
  return "unknown";
}

export function isEligibleSinglesEvent(event) {
  return classifyEventDiscipline(event) === "singles";
}
