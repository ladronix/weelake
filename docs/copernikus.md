# Copernicus CDS setup

> **⚠ Security note:** The API key below is a template. Never commit the real key.
> Put it in `.env.local` (gitignored) and in Railway / Vercel env vars.

## 1. Register + get API key

1. Register at https://cds.climate.copernicus.eu/user/register
2. Log in and accept the licence terms for the datasets you need
   (Lake Surface Water Temperature is on the CDS)
3. Copy your API key from https://cds.climate.copernicus.eu/how-to-api
4. Store it as:
   ```
   CDSAPI_URL=https://cds.climate.copernicus.eu/api
   CDSAPI_KEY=<your-uuid-key>
   ```
   in `.env.local` (for local dev) and Railway / Vercel env vars (for prod).

The Python client also supports the legacy `~/.cdsapirc` file:
```
url: https://cds.climate.copernicus.eu/api
key: <your-uuid-key>
```

## 2. Install the client

```bash
pip install "cdsapi>=0.7.7"
```

Or via the Python worker requirements (already declared in
`services/copernicus-fetcher/requirements.txt`).

## 3. Datasets we use

| Dataset | Purpose | Cadence | Resolution |
|---|---|---|---|
| `satellite-lake-water-temperature` | Global daily LSWT | Daily | ~1 km |
| `reanalysis-era5-single-levels` | Air temp / wind fallback | Hourly | 0.25° |

## 4. Python request skeleton

```python
import cdsapi

client = cdsapi.Client()  # reads CDSAPI_URL / CDSAPI_KEY env, or ~/.cdsapirc

dataset = "satellite-lake-water-temperature"
request = {
    "variable": ["lake_surface_water_temperature"],
    "year": ["2026"],
    "month": ["07"],
    "day": [f"{d:02d}" for d in range(1, 20)],
    "version": "4_5_2",
    "format": "zip",
}
client.retrieve(dataset, request, "lswt.zip")
```

Downloaded files are NetCDF grids that we sample per-lake at (lat, lng) and
upsert into Supabase — see `services/copernicus-fetcher/fetch.py`.

## 5. Rate limits and quotas

- Personal accounts: fair-use queue, few concurrent requests.
- One daily global tile fetch is well within limits.
- Add-on: use the `ecmwf-datastores-client` for async workflows if we
  outgrow the sync API.

## 6. Terms of Use

Data attribution required. We display "Copernicus Marine / CDS" in the
detail-page source line and in the footer.
