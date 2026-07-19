import Link from "next/link";
import { ArrowLeft, ExternalLink, Satellite, CloudRain, Waves, Database, Camera, Flag } from "lucide-react";
import { Nav } from "@/components/layout/nav";
import { Footer } from "@/components/layout/footer";

export const metadata = {
  title: "Data sources",
  description: "Every dataset that powers Weelake: what it is, how often it refreshes, and its licence.",
};

interface Source {
  name: string;
  url: string;
  license: string;
  refresh: string;
  description: string;
  icon: typeof Satellite;
  fields: string[];
}

const SOURCES: Source[] = [
  {
    name: "Copernicus Marine LSWT",
    url: "https://marine.copernicus.eu",
    license: "Copernicus Licence (free)",
    refresh: "Daily (1 km resolution)",
    description:
      "Lake Surface Water Temperature derived from ESA satellites. Ground-truth quality water temperature; the primary source for large- and medium-sized lakes.",
    icon: Satellite,
    fields: ["Water temperature (LSWT)", "Chlorophyll-a (algae proxy)", "Turbidity", "Historical timeseries"],
  },
  {
    name: "Copernicus Climate Data Store",
    url: "https://cds.climate.copernicus.eu",
    license: "Copernicus Licence (free · registration)",
    refresh: "Daily / hourly (ERA5)",
    description:
      "Reanalysis and satellite datasets covering global climate. Used for air temperature and wind fallback plus long-term historical water temperature reanalysis.",
    icon: Satellite,
    fields: ["ERA5 air temperature & wind", "Historical LSWT satellite series"],
  },
  {
    name: "Open-Meteo",
    url: "https://open-meteo.com",
    license: "CC BY 4.0 (free, no key)",
    refresh: "Hourly forecast",
    description:
      "Free weather API. Powers the live conditions card, 7-day forecast, wind, UV, and precipitation. Used as fallback for water temperature where satellite doesn't reach.",
    icon: CloudRain,
    fields: ["Air temperature", "Wind speed & direction", "UV index", "Precipitation", "7-day forecast"],
  },
  {
    name: "Open-Meteo Marine",
    url: "https://open-meteo.com/en/docs/marine-weather-api",
    license: "CC BY 4.0 (free, no key)",
    refresh: "Hourly",
    description:
      "Sea and large-lake surface temperature grid. Used as an immediate fallback for coastal and very large inland lakes until Copernicus imagery is processed.",
    icon: Waves,
    fields: ["Sea surface temperature", "Wave height (future)"],
  },
  {
    name: "HydroLAKES",
    url: "https://www.hydrosheds.org/products/hydrolakes",
    license: "CC BY 4.0",
    refresh: "Static (one-time import)",
    description:
      "A global database of 1.4 million lakes ≥ 10 hectares. Provides the geographic footprint and physical properties (area, depth, elevation) of every tracked lake.",
    icon: Database,
    fields: ["Lake polygon", "Area (km²)", "Mean & max depth (m)", "Elevation"],
  },
  {
    name: "Wikipedia + Wikimedia Commons",
    url: "https://commons.wikimedia.org",
    license: "CC BY-SA (attribution required)",
    refresh: "On demand",
    description:
      "Lead photograph for each lake and article link on the detail page. Fetched via the MediaWiki REST API — no key required.",
    icon: Camera,
    fields: ["Lake photo", "Wikipedia article link"],
  },
  {
    name: "REST Countries",
    url: "https://restcountries.com",
    license: "Free",
    refresh: "Static",
    description:
      "Reference data for country codes, names, and flag emoji shown in the country grid and lake headers.",
    icon: Flag,
    fields: ["ISO 3166-1 alpha-2", "Country name", "Flag emoji"],
  },
  {
    name: "OpenStreetMap · CARTO · Esri",
    url: "https://www.openstreetmap.org",
    license: "ODbL · CC BY (per style)",
    refresh: "Continuous",
    description:
      "Basemap tiles powering the interactive map: CARTO for light/streets/dark styles, OpenTopoMap for terrain, Esri World Imagery for satellite.",
    icon: Waves,
    fields: ["Vector road tiles", "Terrain relief", "Satellite imagery"],
  },
];

export default function DataSourcesPage() {
  return (
    <>
      <Nav />
      <main className="section pt-4 pb-16">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-water-800 hover:text-water-900 font-semibold rounded-full py-2 px-3.5 bg-white/70 backdrop-blur border border-white/60 hover:bg-white shadow-sm transition"
        >
          <ArrowLeft className="h-4 w-4" /> Back home
        </Link>

        <header className="mt-6 max-w-2xl">
          <h1 className="text-3xl sm:text-4xl font-semibold text-deep tracking-tight">
            Data sources
          </h1>
          <p className="mt-2 text-slate-600">
            Weelake stitches together open climate, weather, geographic, and photographic
            datasets. Everything below is free to use. All contributions are attributed
            per their respective licences.
          </p>
        </header>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {SOURCES.map((s) => (
            <article
              key={s.name}
              className="rounded-4xl bg-white/70 backdrop-blur-md border border-white/60 p-5 sm:p-6 shadow-[0_8px_30px_rgba(14,165,233,0.08)]"
            >
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-2xl bg-water-100 flex items-center justify-center shrink-0">
                  <s.icon className="h-5 w-5 text-water-700" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="font-semibold text-deep text-lg leading-tight">{s.name}</h2>
                  <div className="mt-0.5 text-[11px] text-slate-500 flex items-center flex-wrap gap-x-2">
                    <span>{s.refresh}</span>
                    <span>·</span>
                    <span>{s.license}</span>
                  </div>
                </div>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                  className="h-8 w-8 rounded-full bg-water-50 hover:bg-water-100 flex items-center justify-center text-water-700 shrink-0 transition"
                  aria-label={`Visit ${s.name}`}
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
              <p className="mt-3 text-sm text-slate-700">{s.description}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {s.fields.map((f) => (
                  <span
                    key={f}
                    className="inline-block rounded-full bg-water-50 text-water-800 border border-water-100 px-2.5 py-0.5 text-[11px] font-medium"
                  >
                    {f}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>

        <section className="mt-12 rounded-4xl bg-white/70 backdrop-blur-md border border-white/60 p-6 shadow-[0_8px_30px_rgba(14,165,233,0.08)]">
          <h3 className="font-semibold text-deep text-lg">Refresh cadence</h3>
          <p className="mt-2 text-sm text-slate-600">
            Each lake&apos;s current temperature is updated at least once per day.
            Weather metrics (air temp, wind, UV, precipitation) are fetched live from
            Open-Meteo with a 15-minute HTTP cache. Historical charts store the last
            15 days of daily readings. Photos are fetched once and cached indefinitely
            until Wikipedia updates.
          </p>
          <dl className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            <div className="rounded-2xl bg-water-50/70 border border-water-100 px-4 py-3">
              <dt className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Water temperature</dt>
              <dd className="mt-1 font-semibold text-deep">Daily · 03:00 UTC</dd>
            </div>
            <div className="rounded-2xl bg-water-50/70 border border-water-100 px-4 py-3">
              <dt className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Weather</dt>
              <dd className="mt-1 font-semibold text-deep">Every 15 min (edge cache)</dd>
            </div>
            <div className="rounded-2xl bg-water-50/70 border border-water-100 px-4 py-3">
              <dt className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Lake registry</dt>
              <dd className="mt-1 font-semibold text-deep">Weekly (import job)</dd>
            </div>
          </dl>
        </section>
      </main>
      <Footer />
    </>
  );
}
