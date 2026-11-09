/**
 * Classement jeunes LFBB : seules les épreuves de SIMPLE sont éligibles.
 * SG et SF sont des labels de simple; un tableau SG/SF réunissant filles et
 * garçons reste UNE épreuve de simple. DG, DF, DM, DX et MX sont des doubles.
 * Le niveau D/C et le sexe des joueurs ne déterminent pas la discipline.
 */
const clean = value => String(value ?? "").normalize("NFKD")
  .replace(/[\u0300-\u036f]/g, "").trim().toUpperCase();

export function classifyEventDiscipline(result = {}) {
  const explicit = clean(result.eventDiscipline ?? result.discipline ?? result.eventType ?? "");
  if (explicit) {
    if (/^(S|SINGLE|SINGLES|SIMPLE|ENKEL|ENKELSPEL)$/.test(explicit)) return "singles";
    if (/^(D|DOUBLE|DOUBLES|DUBBEL|DUBBELSPEL|MIXED_DOUBLES|MIXED-DOUBLES|MIXTE_DOUBLES|MIXTE-DOUBLES)$/.test(explicit)) return "doubles";
    // Un nom de discipline inconnu est un cas à contrôler, pas une preuve de simple.
    return "unknown";
  }

  const name = clean(result.drawName ?? result.eventName ?? result.eventLabel ?? "");
  if (name) {
    if (/^(DG|DF|DM|DD|DX|MX|MD|WD|XD)\b/.test(name)
      || /\b(DOUBLE(S)?|DUBBEL(SPEL)?|MIXED DOUBLES|DOUBLE MIXTE)\b/.test(name)) return "doubles";
    if (/^(SG|SF|SM|SD|MS|WS|BS|GS)\b/.test(name)
      || /\b(SIMPLE(S)?|SINGLE(S)?|ENKELSPEL|ENKEL)\b/.test(name)) return "singles";
  }

  // Les rencontres peuvent confirmer la discipline seulement si chaque match
  // a des équipes dont l'effectif est connu et cohérent.
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
