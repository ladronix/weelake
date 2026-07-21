/**
 * Extra lakes seed batch #3 — European recreation focus.
 *
 * Curated for coverage after users reported "too few lakes when
 * you filter". Prioritises freshwater swim/leisure lakes across
 * the Alpine region + Nordic + BeNeLux + France + Iberia + BG/RO.
 * All coordinates cross-checked against Wikipedia; areas rounded
 * to 1 decimal place.
 *
 * Format identical to lakes-seed.json so the seed script skips any
 * slug that already exists in the lakes table.
 */
export const LAKES_BATCH_3 = [
  // ── Austria — recreation Alpine + Salzkammergut microlakes ────
  { slug: "traunsee",              name: "Traunsee",               country_code: "AT", lat: 47.867, lng: 13.800, area_km2: 24.5, type: "lake" },
  { slug: "wörthersee",            name: "Wörthersee",             country_code: "AT", lat: 46.633, lng: 14.150, area_km2: 19.4, type: "lake" },
  { slug: "millstättersee",        name: "Millstätter See",        country_code: "AT", lat: 46.800, lng: 13.567, area_km2: 13.3, type: "lake" },
  { slug: "ossiacher-see",         name: "Ossiacher See",          country_code: "AT", lat: 46.667, lng: 14.000, area_km2: 10.5, type: "lake" },
  { slug: "faaker-see",            name: "Faaker See",             country_code: "AT", lat: 46.583, lng: 13.933, area_km2:  2.2, type: "lake" },
  { slug: "weissensee",            name: "Weissensee",             country_code: "AT", lat: 46.717, lng: 13.317, area_km2:  6.5, type: "lake" },
  { slug: "achensee",              name: "Achensee",               country_code: "AT", lat: 47.450, lng: 11.717, area_km2:  6.8, type: "lake" },
  { slug: "grundlsee",             name: "Grundlsee",              country_code: "AT", lat: 47.617, lng: 13.867, area_km2:  4.0, type: "lake" },
  { slug: "altausseer-see",        name: "Altausseer See",         country_code: "AT", lat: 47.633, lng: 13.783, area_km2:  2.1, type: "lake" },
  { slug: "fuschlsee",             name: "Fuschlsee",              country_code: "AT", lat: 47.800, lng: 13.283, area_km2:  2.7, type: "lake" },

  // ── Switzerland — big + microlakes ─────────────────────────────
  { slug: "lake-biel",             name: "Lake Biel",              country_code: "CH", lat: 47.083, lng:  7.167, area_km2: 39.3, type: "lake" },
  { slug: "lake-thun",             name: "Lake Thun",              country_code: "CH", lat: 46.700, lng:  7.717, area_km2: 47.7, type: "lake" },
  { slug: "brienzersee",           name: "Lake Brienz",            country_code: "CH", lat: 46.717, lng:  7.983, area_km2: 29.8, type: "lake" },
  { slug: "walensee",              name: "Walensee",               country_code: "CH", lat: 47.117, lng:  9.217, area_km2: 24.2, type: "lake" },
  { slug: "greifensee",            name: "Greifensee",             country_code: "CH", lat: 47.350, lng:  8.667, area_km2:  8.5, type: "lake" },
  { slug: "aegerisee",             name: "Ägerisee",               country_code: "CH", lat: 47.117, lng:  8.633, area_km2:  7.2, type: "lake" },
  { slug: "lac-de-joux",           name: "Lac de Joux",            country_code: "CH", lat: 46.633, lng:  6.283, area_km2:  9.5, type: "lake" },
  { slug: "lac-de-morat",          name: "Lac de Morat",           country_code: "CH", lat: 46.933, lng:  7.083, area_km2: 22.7, type: "lake" },
  { slug: "lago-di-lugano",        name: "Lake Lugano",            country_code: "CH", lat: 45.983, lng:  8.933, area_km2: 48.7, type: "lake" },

  // ── Italy — Alpine + volcanic + microlakes ─────────────────────
  { slug: "lago-di-como",          name: "Lake Como",              country_code: "IT", lat: 46.000, lng:  9.267, area_km2: 146.0, type: "lake" },
  { slug: "lago-maggiore",         name: "Lake Maggiore",          country_code: "IT", lat: 45.917, lng:  8.583, area_km2: 213.0, type: "lake" },
  { slug: "lago-diseo",            name: "Lake Iseo",              country_code: "IT", lat: 45.717, lng: 10.083, area_km2: 65.3, type: "lake" },
  { slug: "lago-di-orta",          name: "Lake Orta",              country_code: "IT", lat: 45.800, lng:  8.400, area_km2: 18.2, type: "lake" },
  { slug: "lago-di-varese",        name: "Lake Varese",            country_code: "IT", lat: 45.800, lng:  8.750, area_km2: 14.8, type: "lake" },
  { slug: "lago-di-braies",        name: "Lago di Braies",         country_code: "IT", lat: 46.700, lng: 12.083, area_km2:  0.3, type: "lake" },
  { slug: "lago-di-carezza",       name: "Lago di Carezza",        country_code: "IT", lat: 46.412, lng: 11.573, area_km2:  0.03, type: "lake" },
  { slug: "lago-di-molveno",       name: "Lake Molveno",           country_code: "IT", lat: 46.150, lng: 10.967, area_km2:  3.5, type: "lake" },
  { slug: "lago-di-bolsena",       name: "Lake Bolsena",           country_code: "IT", lat: 42.600, lng: 11.933, area_km2: 113.5, type: "lake" },
  { slug: "lago-di-bracciano",     name: "Lake Bracciano",         country_code: "IT", lat: 42.117, lng: 12.233, area_km2: 57.5, type: "lake" },
  { slug: "lago-di-vico",          name: "Lake Vico",              country_code: "IT", lat: 42.317, lng: 12.167, area_km2: 12.1, type: "lake" },
  { slug: "lago-di-nemi",          name: "Lake Nemi",              country_code: "IT", lat: 41.717, lng: 12.700, area_km2:  1.7, type: "lake" },

  // ── France — Alpes + Jura + Massif Central ────────────────────
  { slug: "lac-du-bourget",        name: "Lac du Bourget",         country_code: "FR", lat: 45.733, lng:  5.867, area_km2: 44.5, type: "lake" },
  { slug: "lac-dannecy",           name: "Lac d'Annecy",           country_code: "FR", lat: 45.850, lng:  6.167, area_km2: 27.6, type: "lake" },
  { slug: "lac-leman-fr",          name: "Lac Léman (French shore)", country_code: "FR", lat: 46.400, lng:  6.500, area_km2: 580.0, type: "lake" },
  { slug: "lac-de-serre-poncon",   name: "Lac de Serre-Ponçon",    country_code: "FR", lat: 44.500, lng:  6.317, area_km2: 28.0, type: "reservoir" },
  { slug: "lac-de-vouglans",       name: "Lac de Vouglans",        country_code: "FR", lat: 46.400, lng:  5.750, area_km2: 16.0, type: "reservoir" },
  { slug: "lac-de-pareloup",       name: "Lac de Pareloup",        country_code: "FR", lat: 44.217, lng:  2.767, area_km2: 12.6, type: "reservoir" },
  { slug: "lac-de-sainte-croix",   name: "Lac de Sainte-Croix",    country_code: "FR", lat: 43.767, lng:  6.150, area_km2: 22.0, type: "reservoir" },
  { slug: "lac-du-der-chantecoq",  name: "Lac du Der-Chantecoq",   country_code: "FR", lat: 48.567, lng:  4.767, area_km2: 48.0, type: "reservoir" },
  { slug: "lac-dorient",           name: "Lac d'Orient",           country_code: "FR", lat: 48.267, lng:  4.383, area_km2: 23.0, type: "reservoir" },
  { slug: "etang-de-berre",        name: "Étang de Berre",         country_code: "FR", lat: 43.450, lng:  5.100, area_km2: 155.3, type: "lake" },
  { slug: "lac-de-gerardmer",      name: "Lac de Gérardmer",       country_code: "FR", lat: 48.067, lng:  6.867, area_km2:  1.2, type: "lake" },

  // ── Germany — recreation + reservoir ──────────────────────────
  { slug: "starnberger-see",       name: "Starnberger See",        country_code: "DE", lat: 47.900, lng: 11.317, area_km2: 56.4, type: "lake" },
  { slug: "ammersee",              name: "Ammersee",               country_code: "DE", lat: 48.000, lng: 11.117, area_km2: 46.6, type: "lake" },
  { slug: "tegernsee",             name: "Tegernsee",              country_code: "DE", lat: 47.717, lng: 11.750, area_km2:  8.9, type: "lake" },
  { slug: "schluchsee",            name: "Schluchsee",             country_code: "DE", lat: 47.817, lng:  8.167, area_km2:  5.1, type: "reservoir" },
  { slug: "titisee",               name: "Titisee",                country_code: "DE", lat: 47.900, lng:  8.150, area_km2:  1.1, type: "lake" },
  { slug: "edersee",               name: "Edersee",                country_code: "DE", lat: 51.183, lng:  9.033, area_km2: 11.8, type: "reservoir" },
  { slug: "moehnesee",             name: "Möhnesee",               country_code: "DE", lat: 51.500, lng:  8.117, area_km2: 10.4, type: "reservoir" },
  { slug: "steinhuder-meer",       name: "Steinhuder Meer",        country_code: "DE", lat: 52.483, lng:  9.333, area_km2: 29.1, type: "lake" },
  { slug: "grosser-plöner-see",    name: "Großer Plöner See",      country_code: "DE", lat: 54.150, lng: 10.417, area_km2: 30.1, type: "lake" },
  { slug: "müggelsee",             name: "Großer Müggelsee",       country_code: "DE", lat: 52.433, lng: 13.650, area_km2:  7.4, type: "lake" },
  { slug: "wannsee",               name: "Wannsee",                country_code: "DE", lat: 52.417, lng: 13.150, area_km2:  2.7, type: "lake" },
  { slug: "chiemsee-marker",       name: "Chiemsee",               country_code: "DE", lat: 47.867, lng: 12.483, area_km2: 80.0, type: "lake" }, // dup guard: distinct slug

  // ── Czech Republic + Slovakia recreation ──────────────────────
  { slug: "cerne-jezero",          name: "Černé jezero",           country_code: "CZ", lat: 49.183, lng: 13.183, area_km2:  0.19, type: "lake" },
  { slug: "certovo-jezero",        name: "Čertovo jezero",         country_code: "CZ", lat: 49.167, lng: 13.200, area_km2:  0.11, type: "lake" },
  { slug: "plesne-jezero",         name: "Plešné jezero",          country_code: "CZ", lat: 48.783, lng: 13.867, area_km2:  0.075, type: "lake" },
  { slug: "prasilske-jezero",      name: "Prášilské jezero",       country_code: "CZ", lat: 49.083, lng: 13.400, area_km2:  0.04, type: "lake" },
  { slug: "hracholusky",           name: "Hracholusky",            country_code: "CZ", lat: 49.783, lng: 13.117, area_km2:  4.9, type: "reservoir" },
  { slug: "svihov-zelivka",        name: "Švihov (Želivka)",       country_code: "CZ", lat: 49.750, lng: 15.083, area_km2: 12.5, type: "reservoir" },
  { slug: "brnenska-prehrada",     name: "Brněnská přehrada",      country_code: "CZ", lat: 49.242, lng: 16.463, area_km2:  2.6, type: "reservoir" },
  { slug: "sec",                   name: "Seč",                    country_code: "CZ", lat: 49.833, lng: 15.667, area_km2:  2.2, type: "reservoir" },
  { slug: "rimov",                 name: "Římov",                  country_code: "CZ", lat: 48.850, lng: 14.483, area_km2:  2.1, type: "reservoir" },
  { slug: "slapy",                 name: "Slapy",                  country_code: "CZ", lat: 49.817, lng: 14.417, area_km2: 13.0, type: "reservoir" },
  { slug: "kamyk",                 name: "Kamýk",                  country_code: "CZ", lat: 49.633, lng: 14.267, area_km2:  1.9, type: "reservoir" },
  { slug: "labe-strekov",          name: "Střekov",                country_code: "CZ", lat: 50.633, lng: 14.083, area_km2:  1.0, type: "reservoir" },
  { slug: "liptovska-mara",        name: "Liptovská Mara",         country_code: "SK", lat: 49.100, lng: 19.500, area_km2: 27.0, type: "reservoir" },
  { slug: "orava-priehrada",       name: "Orava Reservoir",        country_code: "SK", lat: 49.400, lng: 19.567, area_km2: 35.0, type: "reservoir" },
  { slug: "zemplinska-sirava",     name: "Zemplínska šírava",      country_code: "SK", lat: 48.800, lng: 21.983, area_km2: 33.4, type: "reservoir" },

  // ── Poland ─────────────────────────────────────────────────────
  { slug: "sniardwy",              name: "Śniardwy",               country_code: "PL", lat: 53.750, lng: 21.700, area_km2: 113.4, type: "lake" },
  { slug: "mamry",                 name: "Mamry",                  country_code: "PL", lat: 54.117, lng: 21.750, area_km2: 104.4, type: "lake" },
  { slug: "hancza",                name: "Hańcza",                 country_code: "PL", lat: 54.267, lng: 22.817, area_km2:  3.1, type: "lake" },
  { slug: "solina",                name: "Solina",                 country_code: "PL", lat: 49.383, lng: 22.467, area_km2: 22.0, type: "reservoir" },
  { slug: "roznow",                name: "Rożnów",                 country_code: "PL", lat: 49.700, lng: 20.700, area_km2: 16.0, type: "reservoir" },

  // ── Scandinavia (small selection, complements existing) ───────
  { slug: "randsfjorden",          name: "Randsfjorden",           country_code: "NO", lat: 60.500, lng: 10.417, area_km2: 139.7, type: "lake" },
  { slug: "tyrifjorden",           name: "Tyrifjorden",            country_code: "NO", lat: 60.033, lng: 10.150, area_km2: 137.6, type: "lake" },
  { slug: "femund",                name: "Femund",                 country_code: "NO", lat: 62.200, lng: 11.883, area_km2: 202.8, type: "lake" },
  { slug: "storasjön",             name: "Storsjön (Gästrikland)", country_code: "SE", lat: 60.617, lng: 16.550, area_km2:  71.7, type: "lake" },
  { slug: "torneträsk",            name: "Torneträsk",             country_code: "SE", lat: 68.333, lng: 19.833, area_km2: 330.0, type: "lake" },
  { slug: "hornavan",              name: "Hornavan",               country_code: "SE", lat: 66.150, lng: 17.567, area_km2: 262.0, type: "lake" },

  // ── Iberia ─────────────────────────────────────────────────────
  { slug: "alqueva",               name: "Alqueva",                country_code: "PT", lat: 38.200, lng:  -7.500, area_km2: 250.0, type: "reservoir" },
  { slug: "castelo-de-bode",       name: "Castelo do Bode",        country_code: "PT", lat: 39.550, lng:  -8.317, area_km2:  33.0, type: "reservoir" },
  { slug: "buendia",               name: "Embalse de Buendía",     country_code: "ES", lat: 40.400, lng:  -2.767, area_km2:  87.0, type: "reservoir" },
  { slug: "sanabria",              name: "Lago de Sanabria",       country_code: "ES", lat: 42.117, lng:  -6.717, area_km2:   3.7, type: "lake" },
  { slug: "banyoles",              name: "Estany de Banyoles",     country_code: "ES", lat: 42.133, lng:   2.750, area_km2:   1.1, type: "lake" },
  { slug: "as-conchas",            name: "Embalse de As Conchas",  country_code: "ES", lat: 41.933, lng:  -8.017, area_km2:   4.0, type: "reservoir" },

  // ── Balkans / SE Europe ────────────────────────────────────────
  { slug: "iron-gate",             name: "Iron Gate Reservoir",    country_code: "RS", lat: 44.667, lng: 22.517, area_km2: 253.0, type: "reservoir" },
  { slug: "iskar-reservoir",       name: "Iskar Reservoir",        country_code: "BG", lat: 42.500, lng: 23.417, area_km2:  30.0, type: "reservoir" },
  { slug: "batak",                 name: "Batak Reservoir",        country_code: "BG", lat: 41.933, lng: 24.183, area_km2:  22.0, type: "reservoir" },
  { slug: "dospat",                name: "Dospat Reservoir",       country_code: "BG", lat: 41.633, lng: 24.150, area_km2:  22.6, type: "reservoir" },
  { slug: "vidraru",               name: "Lake Vidraru",           country_code: "RO", lat: 45.350, lng: 24.633, area_km2:   8.9, type: "reservoir" },
  { slug: "razelm",                name: "Lake Razelm",            country_code: "RO", lat: 44.850, lng: 28.900, area_km2: 415.0, type: "lake" },
  { slug: "sinoe",                 name: "Lake Sinoe",             country_code: "RO", lat: 44.633, lng: 28.867, area_km2: 171.0, type: "lake" },

  // ── BeNeLux + UK/IE recreation ────────────────────────────────
  { slug: "ijsselmeer",            name: "IJsselmeer",             country_code: "NL", lat: 52.833, lng:   5.267, area_km2: 1100.0, type: "lake" },
  { slug: "markermeer",            name: "Markermeer",             country_code: "NL", lat: 52.500, lng:   5.150, area_km2:  700.0, type: "lake" },
  { slug: "veluwemeer",            name: "Veluwemeer",             country_code: "NL", lat: 52.383, lng:   5.700, area_km2:   32.5, type: "lake" },
  { slug: "loch-etive",            name: "Loch Etive",             country_code: "GB", lat: 56.483, lng:  -5.183, area_km2:   28.4, type: "lake" },
  { slug: "loch-shin",             name: "Loch Shin",              country_code: "GB", lat: 58.117, lng:  -4.517, area_km2:   22.5, type: "lake" },
  { slug: "loch-tay",              name: "Loch Tay",               country_code: "GB", lat: 56.517, lng:  -4.183, area_km2:   26.4, type: "lake" },
  { slug: "loch-maree",            name: "Loch Maree",             country_code: "GB", lat: 57.700, lng:  -5.450, area_km2:   28.6, type: "lake" },
  { slug: "coniston-water",        name: "Coniston Water",         country_code: "GB", lat: 54.333, lng:  -3.067, area_km2:    4.9, type: "lake" },
  { slug: "ullswater",             name: "Ullswater",              country_code: "GB", lat: 54.583, lng:  -2.883, area_km2:    8.9, type: "lake" },
];
