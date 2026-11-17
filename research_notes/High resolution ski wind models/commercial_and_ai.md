# Commercial weather APIs and AI weather models for point wind and gust forecasts on Mammoth Mountain

Scope: commercial APIs and AI models that might forecast 10 m wind and gusts at Summit (11,053 ft, 37.6308,-119.0326), McCoy (9,600 ft), Main Lodge (8,900 ft), Canyon Lodge (8,350 ft) and Eagle Lodge (8,100 ft) better than HRRR 3 km. Today is 2026-11-16. Free government and academic models (NBM, RRFS, WindNinja, Open-Meteo) are out of scope.

Method note: on 2026-11-16 I sent unauthenticated curl requests to most vendors' endpoints, using a fake key and `Origin: https://example.github.io`. I logged the CORS headers and error bodies. I did not sign up for anything. The raw output is summarised in the CORS section and labelled "[curl test 2026-11-16]".

Back-of-envelope request budget used below: 5 points refreshed every 10 min is 6/h × 24 × 5 = **720 point-calls/day (~21,600/month)**. If the API accepts several points in one request, it is **144 calls/day (~4,300/month)**. Hourly refresh is 120 point-calls/day, or 24/day multi-point. No forecast source found here updates faster than hourly. Calls more often than hourly mostly re-fetch the same forecast. *(This is my own arithmetic, not from a source.)*

---

## 1. Per-provider and per-model facts: resolution, gust variable, calibration, cadence, pricing, licence

### Takeaway
No commercial or AI product found publishes gust verification for alpine terrain. Two products are explicitly station-calibrated and mountain-targeted with gust output: OpenSnow PEAKS 2.0 (no API) and meteoblue (multimodel, MOS). Meteomatics has a free tier that includes `wind_gusts_10m_1h` plus 90 m terrain downscaling, but its auth model is hostile to static sites. The big AI global models (WeatherNext 2/3, Aurora, AIFS, CorrDiff, StormCast) do not, as documented, emit a gust variable at km scale over the Sierra. Most are 0.1–0.25° (10–25 km), far too coarse to separate an 11,000 ft summit from an 8,000 ft base.

### Cited Findings

**Meteomatics**
- The free "Basic" package lists `wind_gusts_10m_1h:ms` among its 15 basic parameters. Limits: 500 queries/day, no time limit, 10 parameters per query. — [Meteomatics Available Parameters](https://meteomatics.com/en/api/available-parameters); [Meteomatics Free Basic API Account](https://www.meteomatics.com/en/api-entry-level/) (the second page returned 404 when fetched on 2026-11-16; the details come from the search snippet)
- Paid pricing is not published: "pricing based on the capabilities you need" and volume discounts. A 14-day trial exists. — [TrustRadius Meteomatics pricing](https://www.trustradius.com/products/meteomatics-ag/pricing); [Meteomatics trial page](https://www.meteomatics.com/en/api-trial-redirect/)
- Downscaling: "dynamic downscaling technique ... post-processing with NASA's global terrain and elevation model" at 90 m, "applied to all output data from the Meteomatics Weather API". The worked example is temperature, adjusted for altitude. The page does not describe a wind-specific terrain adjustment, names no MOS, and shows no verification metrics. It says downscaling "does not reveal small-scale weather patterns initially missed". — [Meteomatics Downscaling](https://meteomatics.com/en/weather-api/downscaling)
- The wind-power product advertises "forecast wind speed, direction and gusts at hub height, downscaled to 90 m". — [Meteomatics wind power forecasting](https://www.meteomatics.com/en/energy-forecasting/wind-power/)
- Meteomatics states that coarse models "may not adequately represent ... topographically complex areas such as alpine regions". — [Meteomatics approach / downscaling page](https://www.meteomatics.com/en/meteomatics-approach-offers-unprecedented-accuracy-of-weather-forecasts/)
- Their 1 km proprietary model (EURO1k) covers Europe, not California. — [Meteomatics Downscaling](https://meteomatics.com/en/weather-api/downscaling); [europeanpurpose.com profile](https://europeanpurpose.com/tool/meteomatics)
- [curl test 2026-11-16] `api.meteomatics.com` answers `401` with `WWW-Authenticate: Basic realm="Meteomatics API Login"`, so auth is HTTP Basic (username:password). A token endpoint exists at `login.meteomatics.com/api/v1/token`, which also requires Basic auth. Responses and the OPTIONS preflight returned `Access-Control-Allow-Methods/Headers` including `Authorization` and `Allow-Credentials: true`. Neither the 401 nor the preflight carried an `Access-Control-Allow-Origin` header, so I could not confirm that browser calls succeed.

**meteoblue**
- Premium Weather API costs are per call in credits: Current 4,000; MultiModel Wind 8,000; MultiModel Windpower 16,000. The default yearly tier is shown at €2,400/yr for the Premium Weather API. Monthly call tiers start at 75,000 calls. — [meteoblue Pricing](https://business.meteoblue.com/pricing)
- The free Weather API includes 5,000 calls and lasts one year (renewable). It excludes advanced packages (PV Pro, Wind Power). A discount on those is offered for non-commercial use. — [meteoblue Free Weather API](https://content.meteoblue.com/en/business-solutions/weather-apis/free-weather-api)
- "Point+" is a premium, ad-free web product for professional use. Common variables including wind are free on the website. — [meteoblue products](https://www.meteoblue.com/en/products)
- [curl test 2026-11-16] `my.meteoblue.com/packages/basic-1h_wind-1h` returned `Access-Control-Allow-Origin: *` with a JSON error for the invalid key. The API is CORS-open, and the key goes in the query string (`apikey=`).

**Tomorrow.io**
- Free plan: 500 requests/day, 25/hour, 3/second. The 429 status comes back on breach. — [Tomorrow.io Free API Plan Rate Limits](https://support.tomorrow.io/hc/en-us/articles/20273728362644-Free-API-Plan-Rate-Limits)
- `windGust` is defined as "the maximum brief increase in the speed of the wind, usually less than 20 seconds (at 10m)". — [Tomorrow.io Data Fields](https://docs.tomorrow.io/reference/data-layers-core)
- NVIDIA says Tomorrow.io uses CorrDiff for storm-scale predictions, including wind gust forecasts (NVIDIA blog, Nov 2025). — [NVIDIA developer blog](https://developer.nvidia.com/blog/gen-ai-super-resolution-accelerates-weather-prediction-with-scalable-low-compute-models)
- [curl test 2026-11-16] Tomorrow.io echoes the request Origin in `Access-Control-Allow-Origin` and answers the OPTIONS preflight with 200. Browser calls work, and the key is in the query string (`apikey=`).

**Spire Weather**
- The core bundle includes wind gust speed. The High-Resolution Forecast runs at 3 km, twice daily, over the U.S., Europe and SE Asia. Improved 100 m wind predictions have been announced. — [Spire Global Weather Forecast API](https://spire.com/weather-climate/weather-forecast); [Spire high-resolution forecast blog](https://spire.com/blog/weather-climate/spire-enhances-its-high-resolution-forecast-with-powerful-new-features/); [Spire press release, 2026-05-21](https://www.businesswire.com/news/home/20260521564677/en/Spire-Global-Expands-Energy-Trading-Intelligence-with-Intraday-to-45-Day-Weather-Forecasts-and-Trader-Grade-Decision-Platform)
- No public pricing: sales-contact only (third-party review site). — [rfp.wiki Spire](https://www.rfp.wiki/specialty-industries/energy-utilities-software/weather-data-solutions-for-energy-and-utilities/spire)

**WindBorne Systems (WeatherMesh)**
- Self-serve free trial key: Forecast and Insights endpoints for two weeks, 5 req/min, 2,000 total requests. Paid and commercial access is by email or sales. No price list. — [WindBorne API getting started](https://api.windbornesystems.com/getting-started/); [WindBorne API docs](https://windbornesystems.com/docs/api)
- [curl test 2026-11-16] `api.windbornesystems.com/forecasts/v1/point_forecast.json` → `401 Unauthorized` with `Access-Control-Allow-Origin: *`.

**Google WeatherNext 2 / WeatherNext 3 / Maps Platform Weather API**
- WeatherNext 2: 0.25° (~25 km) global, 6-hourly steps, 15-day horizon, 64-member ensemble. Published on BigQuery, Earth Engine and GCS (Zarr). The documented surface wind fields are 10 m u/v (plus 100 m). No gust variable was found in the docs. Google now recommends WeatherNext 3 for new projects. — [WeatherNext 2 model guide](https://developers.google.com/weathernext/guides/models-wn2); [Earth Engine catalog WeatherNext 2](https://developers.google.com/earth-engine/datasets/catalog/projects_gcp-public-data-weathernext_assets_weathernext_2_0_0)
- WeatherNext 3 (announced 2026-09-03): temperature and moisture at 5 km, other surface variables at 10 km, atmospheric variables at 25 km. Hourly new forecasts. Variables include 10 m wind speed and 100 m wind speed. **Gusts are not mentioned.** Delivered via Search, Gemini, Google Maps, the Maps Platform Weather API, Earth Engine, BigQuery and GCS. No terrain-specific verification is published; the blog says it "resolves the intricate local topography" with only a UK temperature example. — [Google blog: Introducing WeatherNext 3](https://blog.google/innovation-and-ai/models-and-research/google-deepmind/introducing-weathernext-3/); [ppc.land on WeatherNext 3 hourly refresh](https://ppc.land/weathernext-3-cuts-google-forecast-refresh-from-six-hours-to-one/)
- The Maps Platform Weather API uses "a blend of AI weather models (including WeatherNext) and traditional forecasting systems". It gives current, hourly and daily forecasts, and gust is a returned data point. — [Google Maps Platform Weather API](https://mapsplatform.google.com/maps-products/weather/); [Weather API docs](https://developers.google.com/maps/documentation/weather)
- Pricing: Essentials SKUs include 10K free calls per SKU per month. A third-party blog quotes $0.15 CPM beyond that; this is unconfirmed against the official price sheet. Bundled plans cost $100 / $275 / $1,200 per month for 50k / 100k / 250k combined calls. A billing account is required. — [Google Maps Platform pricing overview](https://developers.google.com/maps/billing/overview/); [Weather API usage and billing](https://developers.google.com/maps/documentation/weather/usage-and-billing); [afi.io blog](https://blog.afi.io/blog/meet-the-google-weather-api-real-time-weather-for-maps/)
- [curl test 2026-11-16] `weather.googleapis.com/v1/forecast/hours:lookup` echoes the Origin in `Access-Control-Allow-Origin`, so browser calls work. The key is in the query string.

**Microsoft Aurora**
- Published in Nature in May 2025 (DOI 10.1038/s41586-025-09005-y). Resolution is 0.1° (~11 km). Code and weights are open. Microsoft said in Nov 2025 that future releases and training pipelines will also be open-sourced. — [Microsoft Source feature](https://news.microsoft.com/source/features/ai/microsofts-aurora-ai-foundation-model-goes-beyond-weather-forecasting/); [Azure AI Labs Aurora](https://labs.ai.azure.com/innovations/aurora/); [Microsoft On the Issues, 2025-11-13](https://blogs.microsoft.com/on-the-issues/2025/11/13/the-next-phase-of-aurora-open-and-collaborative-ai-for-weather-and-climate-forecasting/)
- ECMWF stopped producing charts from third-party experimental ML models (Aurora, FourCastNet, GraphCast, Pangu) as part of AIFS v2. — [ECMWF open data / news](https://ecmwf.int/en/forecasts/datasets/open-data)

**ECMWF AIFS**
- AIFS open data is on a 0.25° grid under CC-BY-4.0. ECMWF open data lists `10fg` (max 10 m gust since previous post-processing), but I could not confirm whether 10fg is in the AIFS subset or only in IFS. An older third-party page says gust is "currently not available for AIFS". — [ECMWF Open data](https://ecmwf.int/en/forecasts/datasets/open-data); [LuckGrib ECMWF AIFS](https://luckgrib.com/models/ecmwf_aifs/)

**NVIDIA Earth-2: CorrDiff and StormCast**
- CorrDiff US GEFS-HRRR (NIM v1.0.0, Nov 2024) downscales 25 km GEFS to a 3 km HRRR-style grid over CONUS. Its outputs are 10 m u/v, 2 m temperature, total precipitation and precipitation-type indicators. **No gust.** — [NVIDIA CorrDiff model card](https://build.nvidia.com/nvidia/corrdiff/modelcard); [NGC catalog CorrDiff US GEFS-HRRR](https://catalog.ngc.nvidia.com/orgs/nim/teams/nvidia/models/earth2-corrdiff-us-gefs-hrrr)
- Earth2Studio also ships CorrDiffEra5Hrrr (0.25° ERA5 → 3 km HRRR, CONUS). — [Earth2Studio CorrDiffEra5Hrrr](https://nvidia.github.io/earth2studio/main/modules/generated/models/dx/CorrDiffEra5Hrrr/)
- StormCast is a diffusion emulator of HRRR at 3 km with a 1 h step. It predicts 99 variables, conditioned on 26 synoptic variables. It has competitive 1–6 h skill for reflectivity, and it covers a central-US window of the HRRR grid. The scorecard evaluates u10m/v10m, not gusts. — [arXiv 2408.10958](https://arxiv.org/html/2408.10958v1); [Earth2Studio StormCast scorecard](https://nvidia.github.io/earth2studio/main/scorecard/generated/stormcast/); [PhysicsNeMo StormCast README](https://docs.nvidia.com/physicsnemo/latest/physicsnemo/examples/weather/stormcast/README.html)
- Press accounts disagree on StormCast skill. A secondary summary says it is "10% more accurate than HRRR"; the-decoder says "similar forecast quality". — [the-decoder](https://the-decoder.com/nvidia-researchers-create-ai-that-predicts-thunderstorms-with-kilometer-scale-precision/); [Maginative](https://www.maginative.com/article/nvidias-stormcast-advances-severe-weather-forecasting/)
- HRRRCast (Jul 2025) is a separate data-driven HRRR emulator. — [arXiv 2507.05658](https://arxiv.org/html/2507.05658v1)

**OpenSnow PEAKS / PEAKS 2.0**
- As of 2026-10-15/30, PEAKS 2.0 drives temperature, precipitation, snowfall, wind speed, wind direction and wind **gust** in all OpenSnow forecasts for 15 days. The pipeline: baseline global model at ~15-mile boxes → emulated ~1.5-mile resolution → ~50 ft terrain-adjusted point. It "learns from actual observations at thousands of weather stations" with bias correction. The vendor's own verification covers ~8 million wind forecasts across CONUS; PEAKS 2.0 ranked first versus NBM, NWS, ECMWF and GFS by MAE. Gust results are not broken out. No API is mentioned. — [OpenSnow: New PEAKS 2.0](https://opensnow.com/news/post/new-peaks-20); [OpenSnow PEAKS support page](https://support.opensnow.com/feature-guides/peaks-ai-model)
- PEAKS 1.0 was described as a 3 km grid, with wind "~72% more accurate than traditional models" (vendor claim). — [Snow Industry News](https://www.snowindustrynews.com/articles/opensnow-launches-peaks-a-groundbreaking-ai-forecast-model-for-mountain-weather)

**Windy Point Forecast API**
- Trial: 500 req/day, but the data is "randomly shuffled and slightly modified", so it is unusable for real forecasts. Professional: €990/yr, 10,000 req/day. ECMWF is excluded for licensing reasons. Staff say point forecasts come at 3-hour intervals. — [Windy Point Forecast pricing](https://api.windy.com/point-forecast/pricing); [Windy Community thread](https://community.windy.com/topic/15880/i-have-some-question-about-professional)
- [curl test 2026-11-16] The POST preflight to `api.windy.com/api/point-forecast/v2` returned 204 with the Origin echoed, so it is CORS-enabled. The key goes in the JSON body. The API accepted `windGust` as a parameter name (the validation error complained only about `levels`).

**Other mass-market APIs (brief, from curl tests and docs)**
- [curl test 2026-11-16] OpenWeatherMap One Call 3.0 (needs the separate "One Call by Call" subscription), Visual Crossing, Weatherbit, Xweather (`client_id` + `client_secret` in the query string), IBM/TWC `api.weather.com` and WindBorne all return `Access-Control-Allow-Origin: *`. AccuWeather returned 401 with no CORS headers observed (compressed body).
- [OpenWeatherMap pricing note](https://openweathermap.org/price), from the 401 body text.

**Mountain-Forecast.com and Mammoth's own page**
- Mountain-forecast.com publishes elevation-banded forecasts for Mammoth Mountain at fixed heights (e.g. 1,500 m, 2,500 m, 3,369 m peak). — [Mountain-Forecast Mammoth 3369 m](https://mountain-forecast.com/peaks/Mammoth-Mountain/forecasts/3369); [2500 m](https://www.mountain-forecast.com/peaks/Mammoth-Mountain/forecasts/2500)
- Windfinder shows live observations from "Mammoth Summit", "Mammoth Chair 1 Summit" and "Mammoth Chair 22 Summit" stations. — [Windfinder Mammoth Summit](https://www.windfinder.com/report/mammoth_summit)
- The Mammoth Snowman (local forecaster) posts summit and Main Lodge wind forecasts in text, e.g. "SW wind at 36 mph, gusting to 53 mph at the top" (Oct 2025). — [Mammoth Snowman](https://www.mammothsnowman.com/mammoth-mountain-weather-forecast/)

### Inferences
- **Meteomatics** is the best "free and finer than HRRR" candidate on paper: a gust variable on the free tier and 90 m elevation downscaling. But its downscaling is documented mainly for temperature. Without published terrain wind verification, the gust may simply be the driving model's gust (likely a mix including HRRR/ECMWF over the US) with a height correction, so it may not fix a systematic summit low bias. Multi-point requests (Meteomatics URL syntax allows several coordinates per query; this is from my prior knowledge and not re-verified here) would fit 144/day inside the 500/day free cap.
- **meteoblue's** gust skill at a summit is unverified. Its multimodel package costs 8,000 credits per call, and the €2,400/yr entry tier is far beyond a hobby budget. The free API (5,000 calls/yr, ≈ 14/day) is too small for 10-minute refresh, though once per hour for one multi-point call might fit only if multi-point is billed as one call (unverified).
- **OpenSnow PEAKS 2.0** is the product most directly aimed at this problem: station-trained, terrain-adjusted to ~50 ft points, and gust-aware. It has no public API, so it is usable only as a human-facing comparison or link, not as a data source.
- **AI global models** (WeatherNext 3 at 10–25 km for wind, Aurora at 0.1°, AIFS at 0.25°) are too coarse for a 3,000 ft summit-base difference. Running CorrDiff or StormCast yourself needs GPUs and a backend, still gives 3 km (the same as HRRR), and has no gust output. None of these is a realistic improvement for this app.
- **Google Maps Weather API** is the only AI-blend product with easy browser access (CORS plus referrer-restrictable keys) and a gust field. Its resolution and calibration at specific mountain points are undocumented.

### Gaps
- Meteomatics: which models feed `mix` over California, whether `wind_gusts_10m_1h` is downscaled for terrain or only interpolated, and the actual non-trial commercial price. The free-account page 404'd.
- meteoblue: whether gust is in `basic-1h`/`wind-1h`, and whether NEMS/mLM resolution or MOS applies to gusts in the Sierra. There was no time to fetch the package docs.
- Tomorrow.io: model resolution behind `windGust` over the US, and whether CorrDiff output reaches the public v4 API.
- WeatherNext 3: whether a gust field exists in BigQuery/Earth Engine, and Earth Engine or BigQuery pricing for non-commercial use.
- Aurora: no fine-tuned high-resolution regional (≤3 km) US version found in this search.
- AIFS: whether 10fg is in AIFS open data; unresolved.
- Spire, DTN, AccuWeather, Xweather, Weatherbit, Visual Crossing, IBM GRAF: I found no source on native resolution or gust derivation in this pass. GRAF (3 km, IBM/TWC) is from prior knowledge only and is unverified here.
- Mammoth Mountain's own weather page: both fetched URLs returned 404 and search found no mammothmountain.com page, so its data source is unknown.
- Snow-Forecast, Weather Underground/PWS and SnowBrains: not researched in this pass because of the tool-call budget.

---

## 2. Which products actually tell an ~11,000 ft summit from an ~8,000 ft base, and how?

### Takeaway
Only three products claim explicit elevation or terrain handling at sub-km scale. OpenSnow PEAKS 2.0 claims ~50 ft terrain-adjusted points trained on stations. Meteomatics has 90 m DEM downscaling, documented mainly for temperature. Mountain-forecast.com uses fixed elevation bands. AI global models and CorrDiff or StormCast cannot, at 3–25 km.

### Cited Findings
- PEAKS 2.0 refines ~1.5-mile emulated output to a ~50 ft point "adjusted for local terrain", with a station-learned bias correction (example: valley inversion bias). — [OpenSnow PEAKS 2.0](https://opensnow.com/news/post/new-peaks-20)
- Meteomatics downscaling uses a 90 m DEM and land cover. Its documented example adjusts temperature for altitude, and it "does not reveal small-scale weather patterns initially missed". — [Meteomatics Downscaling](https://meteomatics.com/en/weather-api/downscaling)
- Mountain-forecast.com gives separate forecasts per elevation (peak 3,369 m, 2,500 m, 1,500 m). — [Mountain-Forecast](https://mountain-forecast.com/peaks/Mammoth-Mountain/forecasts/3369)
- WeatherNext 3 wind is effectively 10–25 km. — [Google blog](https://blog.google/innovation-and-ai/models-and-research/google-deepmind/introducing-weathernext-3/)
- Aurora is 0.1°. — [Azure AI Labs](https://labs.ai.azure.com/innovations/aurora/)
- CorrDiff and StormCast are 3 km HRRR-grid. — [CorrDiff model card](https://build.nvidia.com/nvidia/corrdiff/modelcard); [StormCast arXiv](https://arxiv.org/html/2408.10958v1)
- Swiss gust studies found that no single gust parameterisation is best in complex topography. Gusts in downslope windstorms are often underestimated. — [Forecasting wind gusts in complex terrain (Meteorol. Atmos. Phys.)](https://scispace.com/papers/forecasting-wind-gusts-in-complex-terrain-5ayrmpp1o7)

### Inferences
- A 90 m DEM tells summit from base apart in elevation, but wind gust bias at an exposed ridge is driven by speed-up and exposure, not just height. DEM elevation correction alone may not remove HRRR's 10+ mph summit gust deficit. A station-trained correction (the PEAKS approach) is what targets that failure mode. That points back to local bias correction, which is covered by other researchers.
- Mountain-forecast's elevation bands are model free-atmosphere winds at a pressure level. For an exposed summit they may track peak gusts better than 10 m surface gusts do. This is unverified, and they offer no API.

### Gaps
- None of the vendors gave numeric resolution for their gust field at a summit.
- No vendor publishes a summit-versus-base comparison for Mammoth or any Sierra site.

---

## 3. Who publishes gust verification in mountains?

### Takeaway
I found no vendor that publishes mountain-specific gust verification. OpenSnow publishes CONUS-wide wind verification (vendor-run, gusts not broken out). Meteomatics and Google publish only illustrative maps. NVIDIA's StormCast scorecard covers 10 m u/v in the central US.

### Cited Findings
- OpenSnow: ~8 million wind forecasts verified; PEAKS 2.0 ranked first by MAE versus NBM, NWS and global models. The numbers are in charts and gusts are not separated. — [OpenSnow PEAKS 2.0](https://opensnow.com/news/post/new-peaks-20)
- Meteomatics: an Innsbruck map comparison and a 3–6 °C temperature example; no metrics. — [Meteomatics Downscaling](https://meteomatics.com/en/weather-api/downscaling)
- WeatherNext 3: a UK 2 m temperature comparison; it cites independent Brightband live evaluations without terrain metrics. — [Google blog](https://blog.google/innovation-and-ai/models-and-research/google-deepmind/introducing-weathernext-3/)
- StormCast scorecard: u10m/v10m against HRRR, 8-member ensemble, 2025 initial conditions. — [Earth2Studio scorecard](https://nvidia.github.io/earth2studio/main/scorecard/generated/stormcast/)
- Spire's AI-S2S skill claims (weeks 3–6, temperature) are company-sourced and not relevant to gusts. — [Spire press release](https://www.businesswire.com/news/home/20260521564677/en/Spire-Global-Expands-Energy-Trading-Intelligence-with-Intraday-to-45-Day-Weather-Forecasts-and-Trader-Grade-Decision-Platform)

### Inferences
- With no published gust verification in alpine terrain, the only reliable way to rank providers for Mammoth is a local bake-off. For a few weeks, log each candidate's forecast for the Summit and Main Lodge points against the NWS or Mammoth station gusts the app already ingests. Meteomatics free and the Tomorrow.io free tier can be logged at zero cost.

### Gaps
- No peer-reviewed or vendor studies on commercial-API gust skill in the Sierra Nevada were found.

---

## 4. What a no-backend hobby app can realistically use: free tier, CORS, key exposure, proxy needs

### Takeaway
CORS is not the blocker: almost every vendor tested returns permissive CORS. The real blockers are three. First, keys in client code: every option below puts a key in the URL or body. Second, free-tier quotas versus 10-minute refresh. Third, Meteomatics' HTTP Basic auth, which would expose an account password. A ~20-line Cloudflare Worker that holds the key and caches responses for 10–60 min solves all three. It also turns 5 points × N visitors into a fixed ~24–144 upstream calls per day.

### Cited Findings
- [curl test 2026-11-16] CORS headers seen with `Origin: https://example.github.io`:

  | Endpoint | Access-Control-Allow-Origin | Auth location |
  |---|---|---|
  | meteoblue `my.meteoblue.com/packages/...` | `*` | `apikey` query |
  | Tomorrow.io v4 | echoes Origin; preflight 200 | `apikey` query |
  | Google Maps Weather API | echoes Origin | `key` query |
  | Windy Point Forecast v2 (POST) | echoes Origin; preflight 204 | `key` in JSON body |
  | OpenWeatherMap 3.0 | `*` | `appid` query |
  | Visual Crossing | `*` | `key` query |
  | Weatherbit | `*` | `key` query |
  | Xweather | `*` | `client_id` + `client_secret` query |
  | IBM/TWC `api.weather.com` | `*` | `apiKey` query |
  | WindBorne | `*` | (401) |
  | Meteomatics | not observed (only Allow-Credentials, Methods, Headers) | HTTP Basic user:password |
  | AccuWeather | not observed | `apikey` query |

- Free-tier ceilings:
  - **Tomorrow.io:** 500/day, 25/hour. [Tomorrow.io](https://support.tomorrow.io/hc/en-us/articles/20273728362644-Free-API-Plan-Rate-Limits)
  - **Meteomatics Basic:** 500/day. [Meteomatics parameters](https://meteomatics.com/en/api/available-parameters)
  - **meteoblue free:** 5,000 calls/year. [meteoblue](https://content.meteoblue.com/en/business-solutions/weather-apis/free-weather-api)
  - **Google Weather:** 10k/month free, billing account required. [Google pricing](https://developers.google.com/maps/billing/overview/)
  - **Windy trial:** 500/day of shuffled data. [Windy](https://api.windy.com/point-forecast/pricing)
  - **WindBorne:** 2-week, 2,000-request trial. [WindBorne](https://api.windbornesystems.com/getting-started/)

### Inferences
- **Direct from browser, no proxy (accepting key exposure):**
  - **Tomorrow.io free:** 5 points × hourly = 5 calls/hour, under the 25/hour cap. Every-10-min per point would be 30/hour, over the cap and per visitor. Only viable if each visitor's browser makes few calls. A shared key hit by many visitors will exhaust 500/day quickly. The key is visible in devtools.
  - **Google Maps Weather API:** the key can be restricted by HTTP referrer (standard Maps Platform practice), which is the only option here designed for client-side keys. But overage bills a real card. 720/day for one viewer already exceeds 10k/month, so use hourly refresh or cache.
  - **meteoblue free:** CORS-open, but 5,000/year is ≈ 14/day, so it is too small without a cache.
- **Needs a proxy:**
  - **Meteomatics** must have one. Basic auth in client JS exposes the account username and password. The token endpoint also needs Basic auth, so a Worker would fetch the short-lived token or make the call itself.
  - **Xweather** puts a client secret in the URL.
  - Any paid key (meteoblue, Windy Pro, Spire, TWC) needs one so that a leaked key cannot run up charges.
- **Not usable:** OpenSnow PEAKS (no API), WindBorne beyond trial (sales-only), Spire (sales-only), WeatherNext, Aurora, AIFS, CorrDiff and StormCast (bulk gridded data or GPU inference; a backend is required, and the resolution is no better than HRRR).
- **Cost for 5 points every 10 min with a Worker cache** (my arithmetic): one multi-point upstream call per 10 min is 4,320/month. That fits:
  - Meteomatics free: 144/day versus 500/day.
  - Google free: 4,320 versus 10k/month, if multi-point is not supported then 21,600/month ≈ $1.7/month at the unconfirmed $0.15 per 1,000 CPM.
  - Tomorrow.io free, only at ~hourly per-point refresh: 120/day.
- **Licensing:** most free tiers (Tomorrow.io, meteoblue free) are stated as development or non-commercial. Windy forbids real use of trial data. AIFS is CC-BY-4.0. Verify the Meteomatics Basic terms before public display.

### Gaps
- I could not confirm whether Meteomatics returns `Access-Control-Allow-Origin` on authenticated responses.
- Exact Tomorrow.io and Google Weather terms on caching or redistribution through a proxy were not checked.
- Whether Tomorrow.io, Google Weather or meteoblue accept several points in one call (which changes quota math) was not verified in this pass.
