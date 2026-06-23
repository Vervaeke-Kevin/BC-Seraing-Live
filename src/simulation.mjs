export const WARMUP_SECONDS = 5 * 60;

export const players = [
  ["Yannick Küpper", "BC Seraing", "H"],
  ["Tuan Dinh", "Grâce BC", "H"],
  ["Pierre Pieds-Ferrés", "BC Seraing", "H"],
  ["Arnaud Maire", "Waremme BC", "H"],
  ["Kevin Vervaeke", "BC Seraing", "H"],
  ["Olivier V.", "BC Seraing", "H"],
  ["William D.", "Olve", "H"],
  ["Quentin D.", "Olve", "H"],
  ["Martin Leemans", "BC Seraing", "H"],
  ["Nathan Noël", "Grâce BC", "H"],
  ["Florent Hinault", "Liège Badminton", "H"],
  ["Arnaud B.", "Waremme BC", "H"],
  ["Noa Lallemant", "BC Seraing", "H"],
  ["Baptiste R.", "Grâce BC", "H"],
  ["Alexandre Janssens", "BC Seraing", "H"],
  ["Sophie Peiffer", "Olve", "F"],
  ["Manon Orban", "BC Seraing", "F"],
  ["Lily Crochelet", "BC Seraing", "F"],
  ["Alexandra Baumans", "Waremme BC", "F"],
  ["Séverine Meers", "Liège Badminton", "F"],
  ["Rose King", "Olve", "F"],
  ["Marine Hardy", "BC Seraing", "F"],
  ["Clara H.", "BC Seraing", "F"],
  ["Léa M.", "Grâce BC", "F"]
].map(([name, club, gender]) => ({ name, club, gender }));

export const liveCourts = [
  { court: 1, draw: "SM 3/4", round: "Quart", playersText: "Yannick Küpper vs Tuan Dinh", players: ["Yannick Küpper", "Tuan Dinh"], status: "playing", warmupAgo: 660, startedAgo: 360 },
  { court: 2, draw: "SM 5/6", round: "Groupe B", playersText: "Pierre Pieds-Ferrés vs Arnaud Maire", players: ["Pierre Pieds-Ferrés", "Arnaud Maire"], status: "warmup", warmupAgo: 110 },
  { court: 3, draw: "SD 12", round: "Groupe A", playersText: "Sophie Peiffer vs Manon Orban", players: ["Sophie Peiffer", "Manon Orban"], status: "ready", warmupAgo: 365 },
  { court: 4, draw: "MX 9/10", round: "Demi-finale", playersText: "Noa Lallemant / Clara H. vs Baptiste R. / Léa M.", players: ["Noa Lallemant", "Clara H.", "Baptiste R.", "Léa M."], status: "playing", warmupAgo: 920, startedAgo: 610 },
  { court: 5, draw: "DM 11", round: "Groupe C", playersText: "Fabrice Vella / Julien M. vs Loïc D. / Timéo K.", players: ["Fabrice Vella", "Julien M.", "Loïc D.", "Timéo K."], status: "warmup", warmupAgo: 40 },
  { court: 6, draw: "DD 12", round: "Groupe A", playersText: "Lily Crochelet / Manon Orban vs Alexandra Baumans / Séverine Meers", players: ["Lily Crochelet", "Manon Orban", "Alexandra Baumans", "Séverine Meers"], status: "warmup", warmupAgo: 260 },
  { court: 7, draw: "SM 12", round: "Huitième", playersText: "Martin Leemans vs Nathan Noël", players: ["Martin Leemans", "Nathan Noël"], status: "playing", warmupAgo: 1420, startedAgo: 1110 },
  { court: 8, draw: "MX 11", round: "Groupe D", playersText: "Célia Mois / Romain P. vs Sarah P. / Hugo V.", players: ["Célia Mois", "Romain P.", "Sarah P.", "Hugo V."], status: "ready", warmupAgo: 430 },
  { court: 9, draw: "SD 7/8", round: "Groupe A", playersText: "Auriane V. vs Karla S.", players: ["Auriane V.", "Karla S."], status: "playing", warmupAgo: 780, startedAgo: 470 },
  { court: 10, draw: "DM 5/6", round: "Quart", playersText: "Kevin Vervaeke / Olivier V. vs William D. / Quentin D.", players: ["Kevin Vervaeke", "Olivier V.", "William D.", "Quentin D."], status: "warmup", warmupAgo: 185 },
  { court: 11, draw: "SM 10", round: "Groupe F", playersText: "Florent Hinault vs Arnaud B.", players: ["Florent Hinault", "Arnaud B."], status: "playing", warmupAgo: 1030, startedAgo: 725 },
  { court: 12, draw: "MX 12", round: "Groupe B", playersText: "Rose King / Louis B. vs Fiona G. / Pierre A.", players: ["Rose King", "Louis B.", "Fiona G.", "Pierre A."], status: "warmup", warmupAgo: 0 }
];

export const upcomingMatches = [
  { id: "u1", time: "14:25", draw: "SM 12", round: "Quart", type: "simple", playersText: "Alexandre Janssens vs Florent Hinault", players: ["Alexandre Janssens", "Florent Hinault"] },
  { id: "u2", time: "14:30", draw: "SD 12", round: "Groupe A", type: "simple", playersText: "Marine Hardy [1] vs Manon Orban", players: ["Marine Hardy", "Manon Orban"] },
  { id: "u3", time: "14:35", draw: "DM 5/6", round: "Demi-finale", type: "double", playersText: "Kevin Vervaeke / Olivier V. vs William D. / Quentin D.", players: ["Kevin Vervaeke", "Olivier V.", "William D.", "Quentin D."] },
  { id: "u4", time: "14:40", draw: "DD 11", round: "Groupe A", type: "double", playersText: "Lily Crochelet / Manon Orban vs Rose King / Sophie Peiffer", players: ["Lily Crochelet", "Manon Orban", "Rose King", "Sophie Peiffer"] },
  { id: "u5", time: "14:45", draw: "MX 9/10", round: "Finale", type: "double", playersText: "Noa Lallemant / Clara H. vs Baptiste R. / Léa M.", players: ["Noa Lallemant", "Clara H.", "Baptiste R.", "Léa M."] },
  { id: "u6", time: "14:55", draw: "SM 10", round: "Groupe F", type: "simple", playersText: "Florent Hinault vs Arnaud B.", players: ["Florent Hinault", "Arnaud B."] }
];

export const completedMatches = [
  { id: "r1", endedAt: "13:24", draw: "SM 3/4", round: "Quart", type: "simple", playersText: "Yannick Küpper vs Tuan Dinh", players: ["Yannick Küpper", "Tuan Dinh"], winners: ["Yannick Küpper"], score: "21-18 18-21 21-19", duration: 51 },
  { id: "r2", endedAt: "13:37", draw: "MX 9/10", round: "Demi-finale", type: "double", playersText: "Noa Lallemant / Clara H. vs Baptiste R. / Léa M.", players: ["Noa Lallemant", "Clara H.", "Baptiste R.", "Léa M."], winners: ["Noa Lallemant", "Clara H."], score: "21-9 21-7", duration: 18 },
  { id: "r3", endedAt: "13:49", draw: "SD 12", round: "Groupe A", type: "simple", playersText: "Marine Hardy vs Rose King", players: ["Marine Hardy", "Rose King"], winners: ["Marine Hardy"], score: "21-5 21-8", duration: 16 },
  { id: "r4", endedAt: "14:05", draw: "SD 12", round: "Groupe A", type: "simple", playersText: "Sophie Peiffer vs Manon Orban", players: ["Sophie Peiffer", "Manon Orban"], winners: ["Sophie Peiffer"], score: "21-17 16-21 21-18", duration: 46 },
  { id: "r5", endedAt: "14:12", draw: "DM 5/6", round: "Quart", type: "double", playersText: "Kevin Vervaeke / Olivier V. vs William D. / Quentin D.", players: ["Kevin Vervaeke", "Olivier V.", "William D.", "Quentin D."], winners: ["Kevin Vervaeke", "Olivier V."], score: "21-14 21-17", duration: 27 },
  { id: "r6", endedAt: "14:16", draw: "DD 11", round: "Groupe A", type: "double", playersText: "Lily Crochelet / Manon Orban vs Alexandra Baumans / Séverine Meers", players: ["Lily Crochelet", "Manon Orban", "Alexandra Baumans", "Séverine Meers"], winners: ["Lily Crochelet", "Manon Orban"], score: "21-19 22-20", duration: 34 },
  { id: "r7", endedAt: "14:18", draw: "SM 10", round: "Groupe F", type: "simple", playersText: "Florent Hinault vs Arnaud B.", players: ["Florent Hinault", "Arnaud B."], winners: ["Florent Hinault"], score: "21-6 21-4", duration: 14 }
];
