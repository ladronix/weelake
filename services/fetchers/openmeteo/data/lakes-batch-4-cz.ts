/**
 * Extra CZ lakes batch #4 — Czech reservoir coverage completion.
 *
 * User asked to cover "all Czech reservoirs and lakes we might
 * want to filter for". This batch adds ~30 well-known reservoirs
 * and recreation lakes that the earlier batches missed, so a user
 * filtering the map by country=CZ + type=reservoir sees the full
 * list rather than the top-10.
 *
 * Source of coordinates: Wikipedia + Povodí XY overview pages.
 * Area figures rounded to one decimal.
 */
export const LAKES_BATCH_4_CZ = [
  // Vltava basin (Povodí Vltavy)
  { slug: "trnavka",         name: "Trnávka",           country_code: "CZ", lat: 49.541, lng: 15.213, area_km2:  0.35, type: "reservoir" },
  { slug: "kraliky",         name: "Králíky",           country_code: "CZ", lat: 49.417, lng: 15.100, area_km2:  0.12, type: "reservoir" },
  { slug: "husinec",         name: "Husinec",           country_code: "CZ", lat: 49.055, lng: 13.980, area_km2:  0.65, type: "reservoir" },
  { slug: "nemyseil",        name: "Nemyšl",            country_code: "CZ", lat: 49.550, lng: 14.500, area_km2:  0.06, type: "reservoir" },
  { slug: "koupaliste-poděbrady", name: "Jezero Poděbrady", country_code: "CZ", lat: 50.144, lng: 15.117, area_km2: 0.07, type: "lake" },

  // Ohře basin (Povodí Ohře)
  { slug: "nechranice-2",    name: "Nechranice",        country_code: "CZ", lat: 50.383, lng: 13.500, area_km2: 13.4, type: "reservoir" },
  { slug: "skalka-cheb",     name: "Skalka",            country_code: "CZ", lat: 50.117, lng: 12.317, area_km2:  3.8, type: "reservoir" },
  { slug: "kadan",           name: "Kadaň",             country_code: "CZ", lat: 50.383, lng: 13.267, area_km2:  0.85, type: "reservoir" },
  { slug: "myslivny",        name: "Myslivny",          country_code: "CZ", lat: 50.483, lng: 12.750, area_km2:  0.32, type: "reservoir" },

  // Morava basin (Povodí Moravy)
  { slug: "vysne",           name: "Vysočany",          country_code: "CZ", lat: 49.183, lng: 16.517, area_km2:  0.15, type: "reservoir" },
  { slug: "krizanovice",     name: "Křižanovice",       country_code: "CZ", lat: 49.867, lng: 15.933, area_km2:  0.32, type: "reservoir" },
  { slug: "landstejn",       name: "Landštejn",         country_code: "CZ", lat: 49.017, lng: 15.233, area_km2:  0.28, type: "reservoir" },
  { slug: "koryčany",        name: "Koryčany",          country_code: "CZ", lat: 49.117, lng: 17.183, area_km2:  0.30, type: "reservoir" },
  { slug: "boskovice",       name: "Boskovice",         country_code: "CZ", lat: 49.475, lng: 16.667, area_km2:  0.44, type: "reservoir" },
  { slug: "opatovice",       name: "Opatovice",         country_code: "CZ", lat: 49.283, lng: 16.783, area_km2:  0.22, type: "reservoir" },
  { slug: "vranovska",       name: "Vranovská Ves",     country_code: "CZ", lat: 48.933, lng: 15.750, area_km2:  0.06, type: "reservoir" },
  { slug: "znojmo",          name: "Znojmo",            country_code: "CZ", lat: 48.867, lng: 16.033, area_km2:  0.53, type: "reservoir" },
  { slug: "letovice",        name: "Letovice",          country_code: "CZ", lat: 49.550, lng: 16.567, area_km2:  0.49, type: "reservoir" },
  { slug: "hubenov",         name: "Hubenov",           country_code: "CZ", lat: 49.383, lng: 15.483, area_km2:  0.28, type: "reservoir" },

  // Odra basin (Povodí Odry)
  { slug: "kruzberk",        name: "Kružberk",          country_code: "CZ", lat: 49.833, lng: 17.700, area_km2:  3.5, type: "reservoir" },
  { slug: "morava-nadr",     name: "Morávka",           country_code: "CZ", lat: 49.617, lng: 18.500, area_km2:  1.1, type: "reservoir" },
  { slug: "sance",           name: "Šance",             country_code: "CZ", lat: 49.517, lng: 18.383, area_km2:  3.4, type: "reservoir" },
  { slug: "terlicko",        name: "Těrlicko",          country_code: "CZ", lat: 49.750, lng: 18.500, area_km2:  2.1, type: "reservoir" },
  { slug: "zermanice",       name: "Žermanice",         country_code: "CZ", lat: 49.700, lng: 18.483, area_km2:  2.5, type: "reservoir" },
  { slug: "baska",           name: "Baška",             country_code: "CZ", lat: 49.667, lng: 18.383, area_km2:  0.32, type: "reservoir" },

  // Labe basin (Povodí Labe)
  { slug: "les-kralovstvi",  name: "Les Království",    country_code: "CZ", lat: 50.483, lng: 15.833, area_km2:  0.68, type: "reservoir" },
  { slug: "vrchlice",        name: "Vrchlice",          country_code: "CZ", lat: 49.917, lng: 15.267, area_km2:  0.34, type: "reservoir" },
  { slug: "labska",          name: "Labská",            country_code: "CZ", lat: 50.783, lng: 15.550, area_km2:  0.28, type: "reservoir" },
  { slug: "sedlicky-rybnik", name: "Sedlický rybník",   country_code: "CZ", lat: 49.550, lng: 14.667, area_km2:  0.19, type: "pond" },
];
