# Free / government / academic high-resolution wind and gust models for Mammoth Mountain (vs HRRR 3 km)

Research date: 2026-11-16. Live endpoint tests were run on this date from a terminal (curl). Raw probe files are in /private/tmp/claude-501/-Users-thomasbermant--claude-spares-spare-ki3aWt/d1ff7ee4-330f-4f9a-a96c-4c3d7a5d0077/scratchpad/probe (temporary). "Tested" means I hit the endpoint myself; everything else is cited.

## 1. NWS National Blend of Models (NBM) and NDFD/api.weather.gov gridpoints

### Takeaway
NBM (2.5 km, hourly updates, has gust) is available free and CORS-open in two forms a browser can call today: Open-Meteo `models=ncep_nbm_conus`, and (as forecaster-edited NDFD) api.weather.gov `gridpoints/REV/57,17` `windGust`. NBM's wind and gust are bias-corrected by quantile mapping against URMA/METAR observations, and in a one-morning test both NBM and NDFD gusts at the summit were far above HRRR's (HRRR read 24-26 mph, MTH03 measured 31-37 mph, NBM read 39-55 mph, NDFD read 40-47 mph). NBM looked like it over-forecast, but one morning proves nothing. Of the free options, these two are the most promising.

### Cited Findings
- **NBM bias correction method:** the NBM bias-corrects gridded model inputs against URMA (UnRestricted Mesoscale Analysis) as truth. URMA wind and gust analyses carry a "very noticeable low bias" because they lean on mesonet sites. Wind speed and gust use quantile mapping on a gamma distribution fitted to the previous 120 days of forecasts and observations, and models are then weighted by recent MAE. — [AMS 2020 abstract](https://ams.confex.com/ams/2020Annual/webprogram/Paper362976.html); [NBM v4.3 overview (VLab)](https://vlab.noaa.gov/documents/6609493/7858320/NBM+v4.3+Overview+.pdf); [Schnapp, Wind Updates to NBM v4.1 (WFO Reno IWAWS 2022)](https://www.weather.gov/media/rev/IWAWS/PDFs/2022/Adam%20Schnapp%20-%20Wind%20Updates%20to%20the%20NBM%20v4.1.pdf)
- **NBM v4.1 (Jan 2023):** for the 24 h max wind and gust probabilistic guidance, the observation used in quantile mapping switched from URMA to METAR. **v4.2:** added quantile mapping of instantaneous wind speed and gust, which mostly improved light winds; a "significant low speed bias remained at higher wind speeds." — [SCN 22-131 NBM v4.1](https://www.weather.gov/media/notification/pdf2/scn22-131_nbm_v4.1.pdf); [Manikin NBMv4.2 updates (WPC 2024)](https://www.wpc.ncep.noaa.gov/hmt/hmt_webpages/seminars/wwe/2024/20240215_Manikin_NBMv4.2_updates.pdf)
- **NBM v5.0:** the updated SCN gives an implementation date of **April 30, 2026** (an earlier version said April 23). For deterministic 10 m wind and gust it adds "percentile picking", which moves the QM deterministic value away from the mean depending on where the mean falls in the model distribution and the climatology. It also uses climatology to reduce the low bias at high thresholds in the medium and extended ranges. A later bug-fix SCN (26-58) and v5.0.14 (SCN 26-70) followed. Webinar notes mention a "slight high bias at lower wind thresholds." — [SCN 26-24 Updated NBM v5.0](https://www.weather.gov/media/notification/pdf_2026/scn26-24_Updated_NBM_V5.0_aac.pdf); [SCN 26-58 bug fix](https://www.weather.gov/media/notification/pdf_2026/scn26-58_Blendv5.0_bug_fix.pdf); [SCN 26-70 v5.0.14](https://www.weather.gov/media/notification/pdf_2026/scn26-70_nbmv5.0.14.pdf); [NBM 5.0 Q&A webinar notes](https://www.weather.gov/media/wrn/calendar/NBM5.0Q_A-Webinar-Notes.pdf); [NBM v5.0 overview (VLab)](https://vlab.noaa.gov/documents/6609493/7858320/NBMv5.0+Overview+for+Evaluation.pdf). (The VLab announcement page returned 403, so I could not read the final v5.0 change list myself.)
- **NBM on Open-Meteo:** listed as "NBM CONUS", 2.5 km, hourly data (3-hourly after 36 h, 6-hourly after 8 days), 11-day forecast, **updated every hour**, described as a "statistical blend", and "not affected by the HRRR/NAM discontinuation." — [Open-Meteo GFS/NOAA API docs](https://open-meteo.com/en/docs/gfs-api)
- **Tested (Open-Meteo NBM):** `models=ncep_nbm_conus&hourly=wind_gusts_10m` returns hourly gusts for the summit with `access-control-allow-origin: *`. The nearest NBM cell was 37.6294,-119.0236. With `elevation=nan`, the grid-cell elevation came back as **2998 m**, about 370 m below the 3369 m summit. — [Open-Meteo forecast API](https://open-meteo.com/en/docs)
- **Tested (api.weather.gov):** `/points/37.6308,-119.0326` resolves to **WFO REV (Reno), grid 57,17**. `/gridpoints/REV/57,17` returns `windGust`, `windSpeed`, `windDirection` and `transportWindSpeed` in km/h. Each value is a validTime interval (PT1H, PT3H, PT5H, PT6H, ...), so hourly values have to be expanded from those intervals. The grid elevation is 3009 m, and the response covers about 7.8 days. Headers: `access-control-allow-origin: *` and `cache-control: public, max-age=3600`. updateTime was 11:30 UTC, so forecasters update it a few times a day; it is not hourly. — [api.weather.gov gridpoint REV/57,17](https://api.weather.gov/gridpoints/REV/57,17); [points](https://api.weather.gov/points/37.6308,-119.0326)
- **Tested single-morning comparison (16 Nov 2026, 13-17 UTC, summit):** MTH03 measured gusts of **30-37 mph** ([NWS obs MTH03](https://api.weather.gov/stations/MTH03/observations)). Forecasts for the same hours:
  - HRRR (Open-Meteo): 24-26 mph
  - RRFS CONUS (Open-Meteo): 17-21 mph
  - NBM (Open-Meteo): 55, 49, 43, 39, 33 mph (falling)
  - NDFD gridpoint: 45 mph for 12-15 UTC and 40 mph for 15-18 UTC

  MTH03 sustained `windSpeed` was null in every observation, so only gusts can be compared. — tested via [Open-Meteo](https://api.open-meteo.com/v1/forecast) and [api.weather.gov](https://api.weather.gov)
- **Tested NBM spatial variation:** neighboring NBM cells near the summit differed by about 10 mph (54 vs 42 mph gust at 37.6294,-119.0236 vs 37.6255,-119.0512). Cell choice therefore matters, and `cell_selection=nearest` versus the default `land` (similar elevation) changes which cell is used. — [Open-Meteo docs (cell_selection)](https://open-meteo.com/en/docs)

### Inferences
- NBM is the only free product found that already applies station-based statistical calibration to gust. Its calibration targets METAR and URMA, and both are dominated by valley and airport sites, so ridgetop gust behavior is not specifically trained. v5.0's percentile picking, built to fix the high-wind low bias, may explain why NBM ran higher than HRRR here. Whether it over-forecasts the summit needs multi-week verification against MTH03, and Open-Meteo's previous-runs and historical-forecast APIs make that possible (section 4).
- The NDFD gridpoint (`windGust`) is NBM-initialized and then edited by WFO Reno forecasters. It adds human judgment about high-wind events but is updated less often and has blocky time intervals. It suits a "forecaster" line, not an hourly trace. Both NBM and NDFD grid cells sit about 360 m below the summit, so neither represents the exposed peak exactly.
- The app's current "elevation-corrected" HRRR call does not correct wind at all (see section 4).

### Gaps
- I found no published NBM gust verification at high-elevation or ridgetop stations in the Sierra.
- I could not confirm whether NBM v5.0 dropped HRRR or NAM inputs or added RRFS after the November 2026 model changes. The VLab page was 403.
- I found no documentation of WFO Reno's specific gust-editing practice or skill for the Mammoth area.
- NBM station-based text bulletins (NBH/NBS) were not checked for whether they include MTH03 or other Mammoth mesonet IDs.

## 2. HRRR (incl. 15-min), RRFS, REFS, WoFS: status as of Nov 2026

### Takeaway
RRFS v1 (3 km CONUS, FV3-based) and REFS became operational on **Nov 3, 2026**, replacing NAM, HREF, SREF and HiresW. Open-Meteo already uses RRFS as North America `best_match` and lists HRRR as **discontinued 2026-11-30**, so the app's `ncep_hrrr_conus` call will stop working in two weeks. RRFS is still 3 km, no sub-3 km operational nest was found, and in one test its summit gust was even lower than HRRR's.

### Cited Findings
- **RRFS/REFS go-live:** SCN 26-48 (updated, Oct 15, 2026) sets RRFS and REFS implementation "Effective November 3, 2026". They replace NAM, HREF, SREF and HiresW, and the legacy models retire the same day. A parallel feed has run since Aug 12, 2026. Production data is at `nomads.ncep.noaa.gov/pub/data/nccf/com/rrfs/prod/` and `/refs/prod/`. — [SCN 26-48 updated .aaf](https://www.weather.gov/media/notification/pdf_2026/scn26-048_Updated_RRFS_and_REFS_Implementation.aaf.pdf); [SCN 26-47 NAM/SREF/HREF/HiresW retirement](https://www.weather.gov/media/notification/pdf_2026/scn26-47_Retirement_of_NAM_SREF_HREF_HiresW_NAM_MOS.pdf)
- **RRFS on AWS:** RRFS and REFS operational data is listed in the AWS Open Data Registry. — [AWS registry noaa-rrfs-ops](https://registry.opendata.aws/noaa-rrfs-ops/)
- **On Open-Meteo:**
  - RRFS CONUS: 3 km, hourly, 84 h, updated every 6 h.
  - RRFS CONUS 15-min: 15-minutely, 18 h, updated hourly.
  - RRFS North America: about 13 km.
  - HRRR CONUS: 3 km, 18 h (48 h at 00/06/12/18Z), with 15-min variants; listed as "Discontinued 2026-11-30".
  - NAM CONUS: "Discontinued 2026-11-01".
  - Gusts are "maximum over the preceding hour", or over the preceding 15 minutes for 15-minutely data.

  — [Open-Meteo NOAA API docs](https://open-meteo.com/en/docs/gfs-api); [Open-Meteo docs model list](https://open-meteo.com/en/docs)
- **Tested:** `ncep_rrfs_conus`, `ncep_rrfs_conus_15min` and `ncep_rrfs_north_america` all return `wind_gusts_10m` for Mammoth. `ncep_hrrr_conus` still works, and `minutely_15=wind_gusts_10m` works with HRRR today. `ncep_nam_conus` returned all nulls, consistent with its retirement. — tested via [Open-Meteo](https://api.open-meteo.com/v1/forecast)
- **Tested:** the RRFS CONUS summit gust for 12-18 UTC on Nov 16 was 16-22 mph, versus HRRR at 24-26 mph and MTH03 measurements of 30-37 mph. — tested
- **HRRR gust skill in mountains:** in Wyoming and Colorado, HRRR has a positive bias for weak winds and gusts and a "large negative bias" for strong winds and gusts (2016-22 winters). The largest biases are on the lee side of high mountains, and the authors suggest PBL physics as a cause. A 2020 MesoWest-based CONUS verification found that HRRR over-forecasts low winds and gusts and significantly under-forecasts strong ones. Fovell & Capps (2025) found HRRR tends to under-predict the highest speeds and the windiest locations. — [NOAA IR: Forecasting High Wind Events in the HRRR over Wyoming and Colorado, Part I](https://repository.library.noaa.gov/view/noaa/67853); [AMS 2020 HRRR wind verification abstract](https://ams.confex.com/ams/2020Annual/webprogram/Paper370705.html); [Fovell & Capps 2025 PDF](https://www.atmos.albany.edu/facstaff/rfovell/papers/2025-fovell-capps.pdf) (I could not open this PDF myself because it exceeded the size limit; the finding comes from the search summary)

### Inferences
- The app must move off `ncep_hrrr_conus` before 2026-11-30. The most direct substitute on Open-Meteo is `ncep_rrfs_conus` (or `_15min`), but neither is finer than HRRR, and early evidence (one day) suggests the same or worse summit smoothing. The literature's HRRR result (strong ridge and lee gusts biased low) is the same symptom the app sees, and there is no reason yet to expect RRFS at 3 km to fix it.
- REFS (ensemble) could provide gust spread, but I did not confirm Open-Meteo exposure of REFS members.

### Gaps
- I found no NWS SCN for HRRR or RAP retirement. The 2026-11-30 date comes only from Open-Meteo's model list, so it is unconfirmed whether NCEP stops HRRR on that date or Open-Meteo just stops ingesting it.
- I did not confirm any RRFS sub-3 km nest (for example a 1 km fire-weather nest) or whether a fire-weather nest could be placed over the Sierra.
- Warn-on-Forecast (WoFS) was not researched in depth. It is an experimental, event-driven convective system and appears irrelevant to ski-area wind; no source was gathered.
- I did not verify how HRRR or RRFS diagnose their gust field (the PBL-based gust formula).

## 3. Open-Meteo's other models, APIs and post-processing over California

### Takeaway
Open-Meteo over Mammoth offers NBM 2.5 km, RRFS 3 km and 15-min, HRRR (until 11-30), GFS, ECMWF IFS, ICON and GEM global, plus ensemble, previous-runs and historical-forecast APIs. All are CORS-open and free for non-commercial use. Canada's HRDPS does **not** cover Mammoth. The `elevation` "statistical downscaling" changes temperature but **not wind**. No wind downscaling or gust calibration is applied except what NBM itself carries.

### Cited Findings
- **best_match:** combines a global backbone (DWD ICON, NOAA GFS, ECMWF IFS) with regional models; for **North America the regional model is NOAA RRFS** (15-minutely). "For each weather variable and forecast hour, the highest-resolution model takes precedence." — [Open-Meteo docs](https://open-meteo.com/en/docs)
- **elevation parameter:** "The elevation used for statistical downscaling. Per default, a 90 meter digital elevation model is used." `elevation=nan` disables downscaling and uses the grid-cell height. — [Open-Meteo docs](https://open-meteo.com/en/docs)
- **Tested:** for NBM at the summit, `elevation` default (3356 m), `nan` (grid 2998 m) and `3369` gave **identical wind_gusts_10m** (54.1, 54.8, 49.2, 42.7 mph), while temperature_2m shifted by about 2.3 °C. The downscaling is temperature-only for wind purposes. — tested via [Open-Meteo](https://api.open-meteo.com/v1/forecast)
- **cell_selection:** the default `land` "finds a suitable grid-cell on land with similar elevation to the requested coordinates using a 90-meter DEM"; `nearest` picks the nearest cell. — [Open-Meteo docs](https://open-meteo.com/en/docs)
- **Tested:** `gem_hrdps_continental` and `gem_hrdps_west` return "No data is available for this location" for Mammoth. `gem_seamless` works but falls back to coarser GEM. ECMWF IFS (`ecmwf_ifs`) returns gusts of 24-31 mph at the summit today. — tested
- **Tested, Previous Runs API** (`previous-runs-api.open-meteo.com`, e.g. `wind_gusts_10m_previous_day1` for NBM): works, CORS `*`. **Historical Forecast API** (`historical-forecast-api.open-meteo.com`): NBM gusts are available back to at least 2025-01-01, CORS `*`. **Ensemble API** (`ensemble-api.open-meteo.com`, `ncep_gefs025`, `ecmwf_ifs025`): returns per-member gusts at about 25 km resolution. — tested
- **Terms:** free non-commercial use is limited to fewer than 10,000 calls/day, 5,000/hour and 600/minute, under the CC-BY 4.0 licence; commercial use requires an API key and customer- endpoint. — [Open-Meteo terms](https://open-meteo.com/en/terms); [Open-Meteo docs](https://open-meteo.com/en/docs)

### Inferences
- Without a backend, the app can fetch NBM, RRFS and NDFD side by side and use the historical-forecast and previous-runs APIs to build a per-station gust bias table client-side (the other researcher covers methods). Open-Meteo provides the archived forecasts needed for this.
- Requesting several resort points from Open-Meteo may return the same 2.5-3 km cell for nearby points. The response `latitude`/`longitude` shows which cell was used, and the app should check it.

### Gaps
- I did not fully review Open-Meteo's GitHub changelog for 2025-2026. The 2026 additions seen on the docs page are RRFS (CONUS, 15-min, North America), AIGFS and the HGEFS ensemble mean.
- I did not confirm whether Open-Meteo's NBM `wind_gusts_10m` is NBM's native deterministic gust grid. The docs page did not state the gust source for NBM.

## 4. Academic and regional WRF runs, and what ESAC uses

### Takeaway
I found no free, machine-readable, sub-3 km operational WRF forecast covering Mammoth. CW3E West-WRF runs at 9 and 3 km (not finer), publishes graphics rather than data, and was paused for verification at the time of the page I read. The UW 1.33 km WRF is Pacific Northwest-focused. I found no public DRI, UC Davis or Caltrans Sierra sub-km data feed.

### Cited Findings
- **CW3E West-WRF:** GFS 0.25°- or ECMWF 0.1°-driven, 9 km and 3 km domains, hourly output, up to 240 h (120 h at 3 km). Products are graphics such as IVT, precipitation, near-surface fields and meteograms. The page said West-WRF "is not currently running in real-time" pending verification, to resume "prior to the next cool season". No raw data download is advertised, and contacts are listed for data requests. — [CW3E West-WRF](https://cw3e.ucsd.edu/west-wrf/)
- **CW3E 1 km forcing:** a 1 km hourly meteorological forcing product exists on the NWM grid (Globus hosted). It is hydrologic downscaled forcing, not a gust forecast. — [Zenodo CW3E 1-km forcing](https://zenodo.org/records/14714512); [reachhydro.org](https://www.reachhydro.org/home/records/1-km-conus-forcing)
- **ESAC:** my search returned only archived bulletins, which describe Sierra ridge winds up to about 100 mph in strong storms. I found nothing stating which wind models ESAC uses. — [avalog.co archived ESAC forecasts](https://avalog.co/forecasts/1ktgc8wvn7); [Sierra Avalanche Center page](https://www.sierraavalanchecenter.org/node/9003)

### Inferences
- For a no-backend app, academic WRF is not a practical source in Nov 2026. Even CW3E's best resolution (3 km) matches HRRR and RRFS.

### Gaps
- The West-WRF real-time status for the 2026-27 season is unconfirmed; the page I read may predate a restart.
- Not researched, no sources gathered: DRI WRF/CEFA, UC Davis, NCAR, Caltrans, Central Sierra Snow Lab, and the UW 1.33 km domain extent. The UW domain is believed to be PNW-only but is unverified.
- I could not confirm whether ESAC or NWS Reno's backcountry/ridgetop wind products rely on NDFD, NBM or HRRR.

## 5. Windy.com and WindNinja

### Takeaway
Windy's Point Forecast API does return gusts, but it is paid (the free key returns deliberately scrambled data), probably not browser-callable, and excludes ECMWF. It is out of scope beyond a note. WindNinja is the most physically relevant free tool for ridgetop speed-up (downscales HRRR or NAM to about 100 m), but it is a native desktop/CLI program. There is no documented public API, and running it requires a server or a precomputed pipeline. Evidence shows gains at well-exposed ridgetops when the input is biased low, which matches Mammoth's problem, but losses in lee canyons. It does not natively forecast gusts.

### Cited Findings
- **Windy Point Forecast API:**
  - The documentation lists `windGust` / `gust-surface`, and a developer reported the response key as `gust_surface`.
  - The free testing tier "returns randomly shuffled and slightly modified data".
  - A third-party review cites Professional at €990/yr.
  - ECMWF is excluded from point forecasts for licensing reasons.
  - There is no official CORS statement; a community thread reports CORS blocking on a different Windy endpoint.

  — [Windy Point Forecast API docs](https://api.windy.com/point-forecast/docs); [pricing](https://api.windy.com:443/point-forecast/pricing); [Windy community: gust null](https://community.windy.com/topic/19352/wind-gust-null-in-point-forecast-api); [Windy community: CORS](https://community.windy.com/topic/40170/forecast-api-access-to-xmlhttprequest-blocked-by-cors-policy); [europeanpurpose review](https://europeanpurpose.com/tool/windy)
- **WindNinja skill:** in Santa Ana events with HRRR 6 h forecasts as input, WindNinja improved accuracy at validation stations by about 13% on average. Stations at "well-exposed ridgetop sites benefitted from downscaling when the stations had negative input HRRR forecast biases, given that the ridgetops were sufficiently resolved." Downscaling made negative biases worse at lee-slope canyon stations, and skill declined at higher wind speeds. — [Seto et al., WindNinja Santa Ana evaluation (WEFO PDF via firelab)](https://ninjastorm.firelab.org/windninja/publications/wefo.pdf)
- **Earlier evaluations:** WindNinja has been evaluated at Askervein Hill and Big Southern Butte and captures terrain features such as ridgetop speed-up. Its results depend strongly on the input wind forcing. — [Wagenbrenner et al. 2016, ACP](https://acp.copernicus.org/articles/16/5229/2016/acp-16-5229-2016.pdf); [Fire (MDPI) plateau-terrain study](https://mdpi-res.com/d_attachment/fire/fire-09-00201/article_deploy/fire-09-00201.pdf)
- **WindNinja Mobile:** a "simplified interface to desktop WindNinja" that downscales NCEP forecasts, with registered users and run history (server-side). No public API was found. — [WindNinja Mobile](https://ninjastorm.firelab.org/windninja/mobile/); [WindNinja dev docs (MesoNet integration)](https://firelab.github.io/windninja/internal/devdoc/mesonet.html)

### Inferences
- Running WindNinja in the browser is not practical (native C++ with GDAL and OpenFOAM dependencies; this is my inference and no WebAssembly port was found). A realistic route is a scheduled job, such as a GitHub Action or cron, that runs the WindNinja CLI on HRRR or RRFS for a Mammoth DEM tile and publishes a small static JSON of point speed-up ratios. That breaks "no backend" only weakly, as a static file.
- WindNinja outputs mean wind, not gust. Gust would have to be derived by applying the input model's gust factor (gust/mean) to the downscaled mean (inference).

### Gaps
- I found no study of WindNinja at Sierra ski-area ridgetops or specifically for gusts.
- I did not confirm whether WindNinja Mobile covers Mammoth or can be called programmatically.
