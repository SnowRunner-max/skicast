# ai-weather-guy.com: what it is and whether it helps Mammoth lift-point wind/gust forecasting

Research date: 2026-11-16. "Verified directly" means I fetched the page, JSON or HTTP headers myself today. "Inferred" means I reasoned from the evidence. The site's pages were last modified 2026-11-16 around 17:01 UTC (from the Last-Modified headers).

## Who operates ai-weather-guy.com, and what is its purpose?

### Takeaway
The site exists and is reachable. It is a free, donation-supported hobby or independent map viewer for Google DeepMind's WeatherNext 3 AI ensemble, aimed at the US West, Western Canada, Alaska and Hawaii. It does not run its own model. The only operator identity is a linked GitHub account, which belongs to Andrew Joros, a meteorologist at Desert Research Institute in Reno, NV. The site never names him itself.

### Cited Findings
- The home page title is "AI Weather Guy — WeatherNext 3 products". It links to GitHub `ajoros` and Bluesky `aiweatherguy.bsky.social`. It shows no About, Pricing or API page (verified directly) — [ai-weather-guy.com](https://ai-weather-guy.com/)
- The site is free and says "These maps are free. Support pays the cloud bill." Donations go through Buy Me a Coffee — [ai-weather-guy.com](https://ai-weather-guy.com/); [buymeacoffee.com/aiweatherguy](https://buymeacoffee.com/aiweatherguy)
- The GitHub profile `ajoros` lists the name "Andrew Joros", company "Desert Research Institute", location "Reno, NV" and bio "Meteorologist / Pythonista". Related public repos include `alpine-weather-dashboard` ("Live Alpine Tahoe weather monitoring dashboard") and `snowdrought` (a SNOTEL dashboard). No repo for ai-weather-guy.com itself is public (verified through the GitHub API) — [github.com/ajoros](https://github.com/ajoros)
- The site lists five YouTube channels under "As seen on YouTube": California Weather Watch, Pacific Northwest Weather, World Wide Weather Watch, Western Washington Weather and West Coast Weather (@JonathanPulleyWCW) — [ai-weather-guy.com](https://ai-weather-guy.com/)
- Disclaimer on every page: "WeatherNext 3 experimental research data. Not an official forecast, watch, or warning, and not NWS. Do not use for life-and-property decisions." — [ai-weather-guy.com](https://ai-weather-guy.com/)
- Hosting: the main site is served by "Google Frontend", which suggests Google Cloud. Images come from `maps.ai-weather-guy.com`, which sits behind Cloudflare (verified from response headers) — [ai-weather-guy.com](https://ai-weather-guy.com/)
- The site has these pages: regional maps (Wide, PNW, BC, California, SoCal, West Coast, NE Pacific, Gulf of Alaska, Hawaii, N Hemisphere), Meteograms, El Niño (ENSO), NWS Alerts, Runs, Checks and Requests. Requests is a vote board for feature requests — [ai-weather-guy.com](https://ai-weather-guy.com/); [requests](https://ai-weather-guy.com/requests/)
- Web searches for "ai-weather-guy" and "AI Weather Guy" returned no press, blog or Substack coverage of the site — searched via WebSearch, no relevant hits.

### Inferences
- Joros as operator is inferred from the GitHub link and his Reno/Tahoe-focused repos. The site does not state it.
- It is a personal or independent project rather than a commercial service: no pricing, no accounts, donations only. Its audience appears to be West Coast weather YouTubers and hobbyists.

### Gaps
- I did not fetch the Bluesky profile or the YouTube channels. Any announcement post or launch date is unknown.
- The site's launch date is unknown. The meteogram verification history starts 2026-08-15, so it has existed since at least mid-August 2026.

## Which models does it display or run, and at what resolution, variables, cadence and horizon?

### Takeaway
The site shows only WeatherNext 3, Google DeepMind's 64-member AI ensemble, released August 2026. It does not run the model. It renders Google's precomputed statistics, mainly the ensemble mean.
- **Wind:** 10 m and 100 m wind speed on about a 0.1° (~10 km) grid.
- **Temperature:** station 2 m temperature at about 0.05° (~5 km).
- **Upper air:** about 0.25°.
- **Gusts:** neither the site nor WeatherNext 3 has a gust field.
- **Cadence and horizon:** hourly runs out to 48 h, plus 6-hourly runs out to 15 days.

### Cited Findings
- Data source in the site's own manifest: `"source": "gs://weathernext3_statistics_spatial/weathernext_3_0_0_statistics/zarr/2026_to_present/20261116_11hr_01_preds/predictions.zarr"`, with the note `"Maps only — no downloadable grids."` (verified directly, run init 2026-11-16T11:00Z) — [ca/manifest.json](https://ai-weather-guy.com/ca/manifest.json)
- Manifest `ensemble_note`: "Upper air is the 64-member mean from the ensemble Zarr, 6-hourly synoptic inits only (not the free stats mean)." — [ca/manifest.json](https://ai-weather-guy.com/ca/manifest.json)
- Runs page: "Surface maps use the newest hourly run for hours 1 through 48, then the latest 00, 06, 12, or 18Z run every 6 hours out to 15 days." — [runs](https://ai-weather-guy.com/runs/)
- Map variable IDs in the site's JavaScript and manifest:
  - Wind group: `wind10` "10 m wind speed" (mph), `wind100` "100 m wind speed" (kt), and `wind925`, `wind700`, `wind300` and `wind200` (kt).
  - Others: `station_t`, `dt24`, precipitation (`pcp1`, `pcp6`, `qpf_acc`, `qpf1_imerg`, `snow`), `ivt`, `pwat`, `cape`, MSLP and spread fields, and cloud layers.
  - A search of the page source found no gust variable (verified directly). — [ai-weather-guy.com](https://ai-weather-guy.com/); [ca/manifest.json](https://ai-weather-guy.com/ca/manifest.json)
- Site text: "Surface fields, including station-scale temperature, are produced at about 5 km; winds and other surfaces at about 10 km." — [ai-weather-guy.com](https://ai-weather-guy.com/)
- Google's official WeatherNext 3 specs:
  - **Wind variables:** `wind_speed_10m`, `wind_speed_100m`, `u/v_component_of_wind_10m` and `u/v_component_of_wind_100m` at 0.1°. Wind gust is not in the variable list.
  - **Station variables:** station temperature and dewpoint at 0.05°.
  - **Pressure levels:** 13 levels at 0.25°, available only on GCS for 6-hourly inits.
  - **Ensemble and cadence:** 64 members, hourly inits from 2026 (8 per day in 2024–25), 15-day horizon for 6-hourly inits and 48 h for interim inits.
  - **Release:** August 2026.
  - Source: [Google WeatherNext models guide](https://developers.google.com/weathernext/guides/models)
- The DeepMind page says surface temperature and humidity are at 5 km and "wind and other surface variables" at 10 km. It also offers open observational datasets PARDIG (10 km precipitation every 15 minutes) and SatWeave (geostationary mosaic) — [deepmind.google/science/weathernext](https://deepmind.google/science/weathernext)
- The Google blog, as summarised by search results, says "atmospheric variables, like wind speed, at 25 kilometers". This refers to pressure-level wind and does not conflict with the 10 km surface wind in the developer docs. Treat the developer docs as authoritative — [Google blog: Introducing WeatherNext 3](https://blog.google/innovation-and-ai/models-and-research/google-deepmind/introducing-weathernext-3/)
- The Checks page polls Google's bucket every 5 minutes and redraws ("cooks") maps when a new run appears. On 2026-11-16 at 10:00 PT, Google had the 11Z surface run and the page was showing 10Z (verified directly) — [watch/checks.json](https://ai-weather-guy.com/watch/checks.json)

### Inferences
- WeatherNext 3's 10 m wind grid (~10 km) is coarser than HRRR's 3 km. Over Mammoth, a 10 km cell averages across the whole mountain and the surrounding basins, so it cannot resolve differences between lifts.
- With no gust variable at all, the site and its underlying data cannot directly meet the core requirement, which is gust forecasts. HRRR does output a surface gust field (GUST), so on gusts specifically, WeatherNext 3 is a step backwards.

### Gaps
- I could not read the statistics Zarr's metadata (anonymous access is denied, see below). So I could not independently confirm the exact variable list in `weathernext3_statistics_spatial`. I relied on Google's docs.
- Google's docs do not state the publication latency of each run.

## Does it cover the Sierra Nevada / Mammoth Lakes area? Any point or ski-resort products?

### Takeaway
Yes. The California map domain covers Mammoth. The Meteograms page has a "Mammoth Mountain" point and a "June Mountain" point, plus about 30 other California and Nevada ski areas and passes. But each resort has one point, served only as a 15-day PNG chart of the ensemble-mean 10 m and 100 m wind speed. There is nothing per lift, no gusts and no numbers.

### Cited Findings
- California map domain: 27–45°N, 145–110°W (verified directly) — [ca/manifest.json](https://ai-weather-guy.com/ca/manifest.json)
- Meteogram points (263 cities in total) include `{"id": "mammoth", "label": "Mammoth Mountain", "lat": 37.631, "lon": -119.032}` with no observing station attached. The list also includes June Mountain, Bishop (BIH), Lee Vining, Tioga Pass, Sonora Pass, Heavenly, Kirkwood, Palisades Tahoe, Mt. Rose and others (verified directly) — [meteograms/manifest.json](https://ai-weather-guy.com/meteograms/manifest.json)
- Meteogram fields: `wind` ("10 m wind speed", mph), `wind100` ("100 m wind speed", mph), temp, precip, snow (10:1) and pwat. There is no gust field — [meteograms/manifest.json](https://ai-weather-guy.com/meteograms/manifest.json)
- The meteogram is served as an image. The page code builds `fid + "/" + cityId + "_15d.png"` on `https://maps.ai-weather-guy.com`. `https://maps.ai-weather-guy.com/meteograms/wind/mammoth_15d.png` returned HTTP 200 as `image/png` (~720 KB) (verified directly) — [meteograms](https://ai-weather-guy.com/meteograms/)

### Inferences
- The Mammoth point sits near the Main Lodge / lower mountain area. One 10 km ensemble-mean value cannot tell Chair 23, the summit gondola and the Canyon/Eagle base apart.

### Gaps
- I did not view the Mammoth chart image itself, so I cannot say what it shows today (for example whether it has a spread or percentile band).

## Is there an API, downloadable data or machine-readable feed? CORS? Licensing and cost?

### Takeaway
The site has no API and explicitly says "no downloadable grids". It does serve undocumented JSON files for its own pages. None of them contain forecast values (only run metadata, the city list and verification scores), and none send CORS headers, so a browser app on another origin cannot fetch them. The real route is Google's WeatherNext 3 data itself. That data is not anonymous: it is free but needs an allowlist request tied to a Google account, and it is served through GCS, BigQuery and Earth Engine. That suits a backend or proxy, not direct browser calls. Real-time data falls under Google's experimental terms; data more than 1 hour old is CC BY 4.0.

### Cited Findings
- JSON files the site serves (all HTTP 200, `application/json`, with no `Access-Control-Allow-Origin` header even when sent an `Origin` header): `/manifest.json`, `/ca/manifest.json`, `/meteograms/manifest.json`, `/meteograms/scores.json`, `/runs/status.json`, `/watch/checks.json` and `/enso/enso.json`. These hold run, time and frame image paths, city lists, scores and status, not gridded or point forecast values. Map frames are JPGs, for example `frames/wind10/f001.jpg` (verified directly) — [manifest.json](https://ai-weather-guy.com/manifest.json)
- Manifest note: "Free stats Zarr, ensemble mean. Maps only — no downloadable grids." — [manifest.json](https://ai-weather-guy.com/manifest.json)
- An OPTIONS preflight to `/manifest.json` returned HTTP 405, and the image host sent no CORS headers. robots.txt allows all crawling. I found no terms-of-use page on the site (verified directly) — [robots.txt](https://ai-weather-guy.com/robots.txt)
- Anonymous reads of `gs://weathernext3_statistics_spatial` failed (verified directly). Listing returned HTTP 401, and getting a Zarr object (`.zmetadata`, `zarr.json`) returned HTTP 403 AccessDenied.
- WeatherNext access steps:
  - Submit the "WeatherNext Data Request Form" with a Google account or service account. Requests are "typically approved within 5--7 business days".
  - Approval covers Cloud Storage, BigQuery and Earth Engine at once.
  - No paid Google Cloud contract is needed.
  - Source: [Google WeatherNext access guide](https://developers.google.com/weathernext/guides/access-forecast)
- Data locations:
  - Cloud Storage buckets (Zarr v3): `gs://weathernext3_spatial/` holds the raw 64-member ensemble; `gs://weathernext3_statistics_spatial/` holds the surface statistics.
  - BigQuery and Earth Engine collections: `weathernext_3_0_0_0p1deg` and `weathernext_3_0_0_0p05deg`. They carry the mean and the p10, p25, p50, p75 and p90 percentiles.
  - Source: [Google WeatherNext access guide](https://developers.google.com/weathernext/guides/access-forecast); [BigQuery guide](https://developers.google.com/weathernext/guides/bigquery)
- Licensing: real-time data (less than 1 hour old, or future-dated) falls under the "GDM Real-Time Weather Forecasting Experimental Data Terms of Use". Data 1 hour old or more is CC BY 4.0. The guides do not address commercial use or cost — [Google WeatherNext models guide](https://developers.google.com/weathernext/guides/models)

### Inferences
- A browser app could only use WeatherNext 3 through its own backend: an allowlisted service account querying BigQuery or Earth Engine, or reading GCS Zarr, then serving the app's origin with CORS. That rules out a pure client-side approach like the app's current Open-Meteo/NWS calls.
- Scraping ai-weather-guy.com's PNG and JPG images is not a viable data source. There is no numeric data, no CORS and no stated terms.

### Gaps
- I did not read the full text of the GDM Real-Time Experimental Data Terms PDF. Whether a public app may redistribute real-time forecasts is unconfirmed.
- I did not check whether Open-Meteo or another CORS-friendly aggregator republishes WeatherNext 3.

## Any evidence of skill for wind/gusts in complex alpine terrain?

### Takeaway
There is no evidence of skill at alpine wind, and some evidence against. The site's own 90-day check at western airports shows the WeatherNext 3 ensemble-mean 10 m wind running consistently and substantially below observations at 24 h lead. That is typical of a smoothed ensemble mean on a coarse grid. Mammoth itself has no verification because it has no observing station. Google's public materials give no wind or gust skill numbers for complex terrain.

### Cited Findings
- Method shown on the meteogram page:
  - Each daily value is "the WeatherNext 3 ensemble mean minus the airport observation, 24 hours after the run. A plus means the forecast was higher."
  - Cities qualify only "within 2 miles of an airport".
  - Wind counts as close within 5 mph and fully red at 15 mph.
  - Source: [meteograms](https://ai-weather-guy.com/meteograms/)
- My own calculation from the site's `scores.json` (generated 2026-11-12, daily 10 m wind differences in mph, 2026-08-15 to 2026-11-12, about 90 days):

  | Station | Mean difference (mph) | Mean absolute difference (mph) |
  |---|---|---|
  | Bishop (BIH), nearest station to Mammoth | −7.5 | 8.0 |
  | Reno (RNO) | −4.0 | 4.9 |
  | Tehachapi (TSP) | −5.2 | 5.7 |
  | San Francisco (SFO) | −9.3 | 9.6 |
  | Fresno (FAT) | −1.6 | 2.5 |

  Source: [meteograms/scores.json](https://ai-weather-guy.com/meteograms/scores.json)
- The verification list (61 sites) has no entry for Mammoth, June or any ski area. Ski-area meteogram points have no station attached (verified directly) — [meteograms/scores.json](https://ai-weather-guy.com/meteograms/scores.json); [meteograms/manifest.json](https://ai-weather-guy.com/meteograms/manifest.json)
- The DeepMind WeatherNext page gives no quantitative wind, gust or complex-terrain accuracy figures. It cites a hurricane (Melissa) case study — [deepmind.google/science/weathernext](https://deepmind.google/science/weathernext)

### Inferences
- A negative bias of 4–9 mph at valley and airport sites suggests the ensemble mean will underforecast ridge-top and lift-top winds even more. Exposed alpine winds are where smoothing hurts most. Raw members or the p90 field would be less biased than the mean, but they still carry no gust information.
- Some of this low bias may come from how the comparison is done. The site does not say whether the observation is an instantaneous METAR reading or a daily maximum. So the bias size is indicative, not rigorous.

### Gaps
- I did not find independent peer-reviewed verification of WeatherNext 3 10 m wind over mountainous terrain.
- I found no direct comparison against HRRR for wind or gusts in the Sierra.

## Bottom line for the app, and leads worth following up

### Takeaway
ai-weather-guy.com cannot give a browser app better lift-point wind or gust forecasts than HRRR. It is a picture-only viewer with no data feed and no CORS. Its underlying model, WeatherNext 3, has 10 km 10 m and 100 m wind, no gust variable, and a documented low wind bias in the site's own airport checks. The one lead worth noting is WeatherNext 3's free (allowlisted) BigQuery and Earth Engine percentile data. It could at most serve as an hourly-updated ensemble context or spread signal behind a backend. It is not a replacement for HRRR's 3 km GUST field.

### Cited Findings
- WeatherNext 3 has hourly inits, 64 members, 10 m and 100 m wind at 0.1°, precomputed p10–p90 percentiles, and CC BY 4.0 licensing once data is more than 1 hour old — [Google WeatherNext models guide](https://developers.google.com/weathernext/guides/models); [Google WeatherNext access guide](https://developers.google.com/weathernext/guides/access-forecast)
- Google's open PARDIG (precipitation) and SatWeave (satellite) datasets need no request form, but they are observational and not wind forecasts — [deepmind.google/science/weathernext](https://deepmind.google/science/weathernext); [Google WeatherNext access guide](https://developers.google.com/weathernext/guides/access-forecast)
- The operator's related public repos (`alpine-weather-dashboard` for Tahoe and `snowdrought`) may show useful patterns for pulling Sierra station data — [github.com/ajoros](https://github.com/ajoros)

### Inferences
- Leads to follow up:
  1. WeatherNext 3 `wind_speed_10m_p90` (or similar percentile) from BigQuery or Earth Engine, through a backend, as a ridge-wind upper bound. Gusts would have to be derived statistically (for example a gust factor calibrated against Mammoth summit and lift sensors).
  2. Check whether Open-Meteo or other aggregators add WeatherNext 3.
  3. For gusts at lift points, the stronger path stays HRRR GUST, with downscaling or calibration against on-mountain observations (Mammoth's lift-top weather stations, Synoptic/MesoWest). That is outside this site's scope.

### Gaps
- I did not test whether BigQuery or Earth Engine column names include percentiles for wind specifically (for example `wind_speed_10m_p90`). The docs say each variable has the six statistics, but I did not confirm this for wind.
