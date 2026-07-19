"use client";

import { usePrefs, type Language } from "./prefs";

/**
 * V-Lake · lightweight i18n
 * Message dictionary lookup, no external library — bundle stays small.
 * Add more keys as UI grows.
 */

type Dict = Record<string, string>;

const en: Dict = {
  "nav.map":              "Map",
  "nav.countries":        "Countries",
  "nav.openMap":          "Open map",
  "nav.signIn":           "Sign in",
  "nav.settings":         "Settings",

  "hero.live":            "Live · updated hourly · Free forever",
  "hero.title1":          "Every lake.",
  "hero.title2":          "One map. Live.",
  "hero.subtitle":        "Live water temperatures for lakes worldwide. Search a name, tap your location, and find the perfect swim near you. Data from Copernicus and Open-Meteo.",

  "search.placeholder":   "Search a lake, or use your location…",
  "search.searching":     "Searching…",
  "search.noResults":     "No lakes match your query.",

  "stats.lakes":          "Lakes tracked",
  "stats.countries":      "Countries",
  "stats.warmest":        "Warmest now",
  "stats.coldest":        "Coldest now",

  "near.title":           "Lakes near you",
  "near.subtitle":        "Share your location to find swimming spots nearby",
  "near.find":            "Find nearby",
  "near.denied":          "Location access was denied. Search by lake name above, or open the map to explore.",

  "countries.title":      "Explore by country",
  "countries.subtitle":   "Pick a country to see all its tracked lakes and their live temperatures.",

  "extremes.title":       "Today's extremes",
  "extremes.subtitle":    "The hottest and coldest lakes on the planet right now.",
  "extremes.warmest":     "Warmest right now",
  "extremes.coldest":     "Coldest right now",

  "cta.title":            "Ready to dive in?",
  "cta.subtitle":         "Open the full map. Filter by country, temperature, or activity. It's free — forever.",
  "cta.openMap":          "Open the map →",

  "settings.title":       "Settings",
  "settings.units":       "Temperature units",
  "settings.language":    "Language",
  "settings.celsius":     "Celsius",
  "settings.fahrenheit":  "Fahrenheit",

  "map.searchArea":       "Search this area",
  "map.showingArea":      "Showing this area only",
  "map.layers":           "Layers",
  "map.basemap":          "Basemap",
  "map.heatmap":          "Heatmap",
  "map.locate":           "Find my location",

  "filter.title":         "Filters",
  "filter.temperature":   "Water temperature",
  "filter.country":       "Country",
  "filter.type":          "Type",
  "filter.sortBy":        "Sort by",
  "filter.reset":         "Reset",
  "filter.showN":         "Show {n} lakes on map",
  "filter.showOne":       "Show 1 lake on map",
  "filter.presetCold":    "❄ Cold-plunge",
  "filter.presetFresh":   "🌊 Fresh",
  "filter.presetPleasant":"☀ Pleasant",
  "filter.presetWarm":    "🔥 Warm",

  "sort.top":             "Featured",
  "sort.warmest":         "Warmest",
  "sort.coldest":         "Coldest",
  "sort.name":            "Name",
  "sort.distance":        "Nearest",
  "sort.area":            "Biggest",
};

const cs: Partial<Dict> = {
  "nav.map":              "Mapa",
  "nav.countries":        "Země",
  "nav.openMap":          "Otevřít mapu",
  "nav.signIn":           "Přihlásit",
  "nav.settings":         "Nastavení",

  "hero.live":            "Živě · aktualizace hodinově · Zdarma navždy",
  "hero.title1":          "Každé jezero.",
  "hero.title2":          "Jedna mapa. Živě.",
  "hero.subtitle":        "Živé teploty vody pro jezera po celém světě. Vyhledej jméno, nasdílej polohu a najdi ideální místo ke koupání. Data z Copernicus a Open-Meteo.",

  "search.placeholder":   "Vyhledej jezero nebo použij svou polohu…",
  "search.searching":     "Hledám…",
  "search.noResults":     "Žádné výsledky.",

  "stats.lakes":          "Jezer sledováno",
  "stats.countries":      "Zemí",
  "stats.warmest":        "Nejteplejší",
  "stats.coldest":        "Nejchladnější",

  "near.title":           "Jezera poblíž",
  "near.subtitle":        "Sdílej polohu a najdi místa ke koupání ve svém okolí",
  "near.find":            "Najít poblíž",
  "near.denied":          "Přístup k poloze zamítnut. Vyhledej jezero podle jména nebo otevři mapu.",

  "countries.title":      "Prozkoumat podle zemí",
  "countries.subtitle":   "Vyber zemi a uvidíš všechna sledovaná jezera s aktuálními teplotami.",

  "extremes.title":       "Dnešní extrémy",
  "extremes.subtitle":    "Nejteplejší a nejchladnější jezera na planetě právě teď.",
  "extremes.warmest":     "Nejteplejší právě teď",
  "extremes.coldest":     "Nejchladnější právě teď",

  "cta.title":            "Skočíme?",
  "cta.subtitle":         "Otevři plnou mapu. Filtruj podle země, teploty nebo aktivity. Zdarma — navždy.",
  "cta.openMap":          "Otevřít mapu →",

  "settings.title":       "Nastavení",
  "settings.units":       "Jednotky teploty",
  "settings.language":    "Jazyk",
  "settings.celsius":     "Celsius",
  "settings.fahrenheit":  "Fahrenheit",

  "map.searchArea":       "Hledat v této oblasti",
  "map.showingArea":      "Pouze v této oblasti",
  "map.layers":           "Vrstvy",
  "map.basemap":          "Podklad",
  "map.heatmap":          "Teplotní mapa",
  "map.locate":           "Najít moji polohu",

  "filter.title":         "Filtry",
  "filter.temperature":   "Teplota vody",
  "filter.country":       "Země",
  "filter.type":          "Typ",
  "filter.sortBy":        "Řadit podle",
  "filter.reset":         "Reset",
  "filter.showN":         "Zobrazit {n} jezer",
  "filter.showOne":       "Zobrazit 1 jezero",

  "sort.top":             "Doporučené",
  "sort.warmest":         "Nejteplejší",
  "sort.coldest":         "Nejchladnější",
  "sort.name":            "Podle jména",
  "sort.distance":        "Nejbližší",
  "sort.area":            "Největší",
};

const de: Partial<Dict> = {
  "nav.map":              "Karte",
  "nav.countries":        "Länder",
  "nav.openMap":          "Karte öffnen",
  "nav.signIn":           "Anmelden",
  "nav.settings":         "Einstellungen",

  "hero.live":            "Live · stündliches Update · Für immer kostenlos",
  "hero.title1":          "Jeder See.",
  "hero.title2":          "Eine Karte. Live.",
  "hero.subtitle":        "Live-Wassertemperaturen für Seen weltweit. Ort suchen, Standort teilen — den perfekten Badesee finden.",

  "search.placeholder":   "See suchen oder Standort verwenden…",
  "stats.lakes":          "Seen verfolgt",
  "stats.countries":      "Länder",
  "stats.warmest":        "Am wärmsten",
  "stats.coldest":        "Am kältesten",

  "near.title":           "Seen in deiner Nähe",
  "near.subtitle":        "Standort teilen und Badeplätze in der Nähe finden",
  "near.find":            "In der Nähe finden",

  "countries.title":      "Nach Land",
  "extremes.title":       "Heutige Extreme",
  "extremes.warmest":     "Am wärmsten",
  "extremes.coldest":     "Am kältesten",

  "cta.title":            "Bereit einzutauchen?",
  "cta.openMap":          "Karte öffnen →",

  "settings.title":       "Einstellungen",
  "settings.units":       "Temperatureinheit",
  "settings.language":    "Sprache",

  "map.searchArea":       "Diesen Bereich durchsuchen",
  "map.showingArea":      "Nur dieser Bereich",
  "map.layers":           "Ebenen",
  "map.basemap":          "Kartenstil",
  "map.heatmap":          "Heatmap",
  "map.locate":           "Mein Standort",

  "filter.title":         "Filter",
  "filter.temperature":   "Wassertemperatur",
  "filter.country":       "Land",
  "filter.type":          "Typ",
  "filter.reset":         "Zurücksetzen",
  "filter.showN":         "{n} Seen anzeigen",
  "filter.showOne":       "1 See anzeigen",

  "sort.top":             "Empfohlen",
  "sort.warmest":         "Am wärmsten",
  "sort.coldest":         "Am kältesten",
  "sort.name":            "Name",
};

const DICTS: Record<Language, Partial<Dict>> = { en, cs, de };

/**
 * Return the localised message for `key`, with `{placeholder}` substitution.
 * Falls back to English, then to the key itself.
 */
export function useT() {
  const { prefs } = usePrefs();
  const dict = DICTS[prefs.lang] ?? en;
  return (key: string, vars?: Record<string, string | number>) => {
    const raw = (dict[key] as string | undefined) ?? en[key] ?? key;
    if (!vars) return raw;
    return raw.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`));
  };
}
