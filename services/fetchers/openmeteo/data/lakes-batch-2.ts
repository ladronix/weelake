/**
 * Extra lakes seed batch #2 — adds ~65 lakes across regions
 * previously under-represented: East Asia, Australia/NZ, Middle
 * East, Africa, South America, Balkans, and Alpine microlakes
 * popular for recreation.
 *
 * Format identical to lakes-seed.json so the existing
 * `pnpm --filter openmeteo-refresh seed-more` script picks these
 * up on INSERT-IGNORE (dedupe by slug).
 */
export const LAKES_BATCH_2 = [
  // East Asia
  { slug: "biwa",             name: "Lake Biwa",           country_code: "JP", lat: 35.333, lng: 136.167, area_km2:  670, type: "lake" },
  { slug: "poyang",           name: "Poyang Lake",         country_code: "CN", lat: 29.100, lng: 116.283, area_km2: 3585, type: "lake" },
  { slug: "dongting",         name: "Dongting Lake",       country_code: "CN", lat: 29.317, lng: 112.950, area_km2: 2820, type: "lake" },
  { slug: "taihu",            name: "Lake Tai",            country_code: "CN", lat: 31.200, lng: 120.217, area_km2: 2250, type: "lake" },
  { slug: "chao-hu",          name: "Chao Lake",           country_code: "CN", lat: 31.550, lng: 117.500, area_km2:  760, type: "lake" },
  { slug: "hulun",            name: "Hulun Lake",          country_code: "CN", lat: 48.967, lng: 117.383, area_km2: 2339, type: "lake" },
  { slug: "sonhwa",           name: "Cheonji (Heaven Lake)", country_code: "KP", lat: 41.983, lng: 128.083, area_km2:    9.8, type: "lake" },
  { slug: "khanka",           name: "Lake Khanka",         country_code: "RU", lat: 44.917, lng: 132.400, area_km2: 4190, type: "lake" },

  // South-East Asia
  { slug: "tonle-sap",        name: "Tonle Sap",           country_code: "KH", lat: 12.900, lng: 104.100, area_km2: 2700, type: "lake" },
  { slug: "toba",             name: "Lake Toba",           country_code: "ID", lat:  2.617, lng:  98.833, area_km2: 1130, type: "lake" },
  { slug: "laguna-de-bay",    name: "Laguna de Bay",       country_code: "PH", lat: 14.383, lng: 121.267, area_km2:  911, type: "lake" },
  { slug: "songkhla",         name: "Songkhla Lake",       country_code: "TH", lat:  7.400, lng: 100.383, area_km2: 1040, type: "lake" },

  // Middle East / Central Asia
  { slug: "urmia",            name: "Lake Urmia",          country_code: "IR", lat: 37.667, lng:  45.500, area_km2: 5200, type: "lake" },
  { slug: "van-golu",         name: "Lake Van",            country_code: "TR", lat: 38.633, lng:  42.933, area_km2: 3755, type: "lake" },
  { slug: "sevan",            name: "Lake Sevan",          country_code: "AM", lat: 40.550, lng:  45.400, area_km2: 1240, type: "lake" },
  { slug: "dead-sea",         name: "Dead Sea",            country_code: "IL", lat: 31.500, lng:  35.500, area_km2:  605, type: "lake" },
  { slug: "kinneret",         name: "Sea of Galilee",      country_code: "IL", lat: 32.833, lng:  35.583, area_km2:  166, type: "lake" },

  // Africa
  { slug: "kariba",           name: "Lake Kariba",         country_code: "ZW", lat: -16.917, lng:  27.850, area_km2: 5580, type: "lake" },
  { slug: "kivu",             name: "Lake Kivu",           country_code: "CD", lat: -2.000, lng:  29.250, area_km2: 2700, type: "lake" },
  { slug: "edward",           name: "Lake Edward",         country_code: "CD", lat: -0.400, lng:  29.567, area_km2: 2325, type: "lake" },
  { slug: "albert",           name: "Lake Albert",         country_code: "UG", lat:  1.680, lng:  30.900, area_km2: 5300, type: "lake" },
  { slug: "kyoga",            name: "Lake Kyoga",          country_code: "UG", lat:  1.500, lng:  33.000, area_km2: 1720, type: "lake" },
  { slug: "chad",             name: "Lake Chad",           country_code: "TD", lat: 13.000, lng:  14.000, area_km2: 1350, type: "lake" },
  { slug: "volta",            name: "Lake Volta",          country_code: "GH", lat:  7.333, lng:  -0.333, area_km2: 8482, type: "lake" },
  { slug: "nasser",           name: "Lake Nasser",         country_code: "EG", lat: 22.667, lng:  31.833, area_km2: 5250, type: "lake" },

  // South America
  { slug: "maracaibo",        name: "Lake Maracaibo",      country_code: "VE", lat:  9.833, lng: -71.567, area_km2: 13210, type: "lake" },
  { slug: "buenos-aires",     name: "General Carrera / Buenos Aires", country_code: "AR", lat: -46.500, lng: -72.000, area_km2: 1850, type: "lake" },
  { slug: "poopo",            name: "Lake Poopó",          country_code: "BO", lat: -18.750, lng: -67.083, area_km2: 1000, type: "lake" },
  { slug: "argentino",        name: "Lago Argentino",      country_code: "AR", lat: -50.267, lng:  -72.750, area_km2: 1466, type: "lake" },
  { slug: "llanquihue",       name: "Lago Llanquihue",     country_code: "CL", lat: -41.117, lng:  -72.783, area_km2:  860, type: "lake" },

  // Oceania
  { slug: "eyre",             name: "Lake Eyre",           country_code: "AU", lat: -28.567, lng: 136.917, area_km2: 9500, type: "lake" },
  { slug: "gairdner",         name: "Lake Gairdner",       country_code: "AU", lat: -31.583, lng: 135.883, area_km2: 4351, type: "lake" },
  { slug: "argyle",           name: "Lake Argyle",         country_code: "AU", lat: -16.317, lng: 128.750, area_km2:  980, type: "lake" },
  { slug: "wanaka",           name: "Lake Wanaka",         country_code: "NZ", lat: -44.583, lng: 169.150, area_km2:  192, type: "lake" },
  { slug: "wakatipu",         name: "Lake Wakatipu",       country_code: "NZ", lat: -45.083, lng: 168.667, area_km2:  291, type: "lake" },
  { slug: "te-anau",          name: "Lake Te Anau",        country_code: "NZ", lat: -45.183, lng: 167.717, area_km2:  344, type: "lake" },

  // North America (additional)
  { slug: "great-salt-lake",  name: "Great Salt Lake",     country_code: "US", lat: 41.117, lng: -112.567, area_km2: 4400, type: "lake" },
  { slug: "utah-lake",        name: "Utah Lake",           country_code: "US", lat: 40.217, lng: -111.800, area_km2:  386, type: "lake" },
  { slug: "tahoe",            name: "Lake Tahoe",          country_code: "US", lat: 39.083, lng: -120.033, area_km2:  496, type: "lake" },
  { slug: "okeechobee",       name: "Lake Okeechobee",     country_code: "US", lat: 26.933, lng:  -80.800, area_km2: 1900, type: "lake" },
  { slug: "champlain",        name: "Lake Champlain",      country_code: "US", lat: 44.533, lng:  -73.333, area_km2: 1269, type: "lake" },
  { slug: "mead",             name: "Lake Mead",           country_code: "US", lat: 36.150, lng: -114.383, area_km2:  640, type: "lake" },
  { slug: "powell",           name: "Lake Powell",         country_code: "US", lat: 37.067, lng: -111.250, area_km2:  658, type: "lake" },
  { slug: "yellowstone-lake", name: "Yellowstone Lake",    country_code: "US", lat: 44.417, lng: -110.367, area_km2:  341, type: "lake" },

  // UK / Ireland
  { slug: "lough-neagh",      name: "Lough Neagh",         country_code: "GB", lat: 54.633, lng:   -6.417, area_km2:  392, type: "lake" },
  { slug: "lough-corrib",     name: "Lough Corrib",        country_code: "IE", lat: 53.433, lng:   -9.267, area_km2:  176, type: "lake" },
  { slug: "lough-derg",       name: "Lough Derg",          country_code: "IE", lat: 52.917, lng:   -8.317, area_km2:  118, type: "lake" },
  { slug: "windermere",       name: "Windermere",          country_code: "GB", lat: 54.367, lng:   -2.933, area_km2:   14.7, type: "lake" },
  { slug: "loch-lomond",      name: "Loch Lomond",         country_code: "GB", lat: 56.100, lng:   -4.600, area_km2:   71, type: "lake" },
  { slug: "loch-awe",         name: "Loch Awe",            country_code: "GB", lat: 56.383, lng:   -5.117, area_km2:   38.5, type: "lake" },
  { slug: "loch-morar",       name: "Loch Morar",          country_code: "GB", lat: 56.933, lng:   -5.667, area_km2:   26.7, type: "lake" },

  // Balkans / Eastern Europe
  { slug: "ohrid",            name: "Lake Ohrid",          country_code: "MK", lat: 41.017, lng:  20.717, area_km2:  358, type: "lake" },
  { slug: "prespa",           name: "Lake Prespa",         country_code: "MK", lat: 40.933, lng:  20.983, area_km2:  273, type: "lake" },
  { slug: "shkoder",          name: "Lake Skadar",         country_code: "ME", lat: 42.183, lng:  19.317, area_km2:  391, type: "lake" },
  { slug: "bled",             name: "Lake Bled",           country_code: "SI", lat: 46.367, lng:  14.117, area_km2:    1.45, type: "lake" },
  { slug: "bohinj",           name: "Lake Bohinj",         country_code: "SI", lat: 46.283, lng:  13.883, area_km2:    3.18, type: "lake" },
  { slug: "koman",            name: "Koman Reservoir",     country_code: "AL", lat: 42.083, lng:  20.033, area_km2:   34, type: "reservoir" },
  { slug: "srebrno-jezero",   name: "Srebrno Lake",        country_code: "RS", lat: 44.700, lng:  21.583, area_km2:    5, type: "reservoir" },

  // Baltics / Belarus
  { slug: "peipsi",           name: "Lake Peipus",         country_code: "EE", lat: 58.680, lng:  27.500, area_km2: 3555, type: "lake" },
  { slug: "vortsjarv",        name: "Võrtsjärv",           country_code: "EE", lat: 58.283, lng:  26.033, area_km2:  270, type: "lake" },
  { slug: "narach",           name: "Lake Naroch",         country_code: "BY", lat: 54.867, lng:  26.767, area_km2:   80, type: "lake" },
  { slug: "drivyaty",         name: "Lake Drivyaty",       country_code: "BY", lat: 55.583, lng:  27.100, area_km2:   36.1, type: "lake" },

  // Alpine microlakes
  { slug: "sils",             name: "Lake Sils",           country_code: "CH", lat: 46.433, lng:   9.750, area_km2:    4.1, type: "lake" },
  { slug: "silvaplana",       name: "Lake Silvaplana",     country_code: "CH", lat: 46.450, lng:   9.800, area_km2:    2.7, type: "lake" },
  { slug: "st-moritz",        name: "St. Moritz Lake",     country_code: "CH", lat: 46.500, lng:   9.833, area_km2:    0.78, type: "lake" },
  { slug: "resia",            name: "Lake Reschen",        country_code: "IT", lat: 46.817, lng:  10.517, area_km2:    6.6, type: "reservoir" },
];
