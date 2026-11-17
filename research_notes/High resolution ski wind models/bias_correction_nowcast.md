# Station-based post-processing, bias correction and 0–6 h nowcasting of wind gusts at Mammoth Mountain lift points

Scope note: these notes cover correcting and nowcasting any model's gusts using the MTH stations. They do not survey which forecast models exist. "Own test" means a live curl/Python check run on 2026-11-16 (about 18:00 UTC) against the listed public endpoint. All own-test statistics come from a small sample (about 7 days) and are in-sample, so treat them as indicative only.

## 1. Training data: where to get multi-year MTH observations, who runs the stations, sensor heights and gust definition

### Takeaway
api.weather.gov serves the MTH stations with open CORS and no token, but only keeps about 7 days of history. Multi-year history sits with Synoptic Data (MesoWest), which needs a token. Synoptic's free tier is now limited to U.S. .edu users and up to 1 year of history, so for a hobby or commercial app the realistic path is to start archiving now with a small cron job. The Iowa Environmental Mesonet (IEM) does not appear to carry these stations.

### Cited Findings
- **Station metadata from api.weather.gov (own test).** All five stations report `provider: MesoWest` and `subProvider: MAMMOTH`. Names, elevations and coordinates:
  - MTH03 "Top Stn/Summit - 11,053ft": 3363 m, 37.63059, -119.03282
  - MTH20 "McCoy Stn - 9,630ft": 2936 m. The station name says 9,630 ft; the app's config says 9,600 ft.
  - MTH05 "Sesame - 9,014ft": 2751 m
  - MTH19 "Canyon Lodge - 8,343ft": 2545 m
  - MTH17 "Bottom of 15 (Little Eagle) - 8,107ft": 2468 m
  - Source: [api.weather.gov/stations/MTH03](https://api.weather.gov/stations/MTH03) (and the equivalent URLs for MTH20, MTH05, MTH19, MTH17).
- **History depth on api.weather.gov (own test).** A request with `start=2026-11-01` returned records back to 2026-11-09T17:20Z for MTH03, MTH20 and MTH19, which is exactly 7 days. It took 5 pages of up to 500 records each, at 5-minute resolution. MTH05 only went back to 2026-11-12 and MTH17 to 2026-11-09. Requests for September 2026 and for 2026-11-09 00–06Z returned 0 features. The response header is `access-control-allow-origin: *`. — [api.weather.gov observations](https://api.weather.gov/stations/MTH03/observations?start=2026-11-09T18:00:00Z)
- **Field completeness and gust latency (own test, last 500 records per station).**
  - MTH03 has `windSpeed` and `windDirection` null in 389 of 500 records, while `windGust` is non-null in 238 of 500. The latest 3 summit records had a gust of about 50–55 km/h but null speed and direction.
  - MTH20 and MTH05 have speed and direction in about 97% of records and a gust in about 50%.
  - MTH17 had no non-null gust anywhere in its 7-day history.
  - At 18:02Z the newest record was 17:40Z but the newest record with a gust was 16:40Z. That is roughly a 1-hour gust lag on top of the 20-minute record lag, which confirms the app's "gusts arrive 1–2 h late" observation.
  - Source: [api.weather.gov observations](https://api.weather.gov/stations/MTH03/observations?limit=3)
- **Synoptic API needs a token (own test).** The Synoptic API without a token returns HTTP 401 "Missing token". It does send `access-control-allow-origin: *`, so browser calls would work technically, but the token would be exposed in client code. — [api.synopticdata.com](https://api.synopticdata.com/v2/stations/metadata?stid=MTH03)
- **Synoptic Open Access terms (current page).**
  - Eligibility: "a .edu email address is required for Open Access", for members of accredited U.S. institutions doing non-commercial research or coursework.
  - Limits: "1 simultaneous API response" and "Up to 1 year of historical weather observations for your approved geographic region".
  - Access is valid for 1 year and must be renewed. Longer history requires commercial plans.
  - Source: [Synoptic Open Access](https://synopticdata.com/pricing/open-access-pricing/)
- **Synoptic's 2022 announcement conflicts with today's terms.** In 2022 Synoptic said all public data, current and historical, was free to all users with no volume limits. That is contradicted by the current .edu-only terms above. — [Business Wire 2022](https://www.businesswire.com/news/home/20220315005424/en/Synoptic-Data-PBC-Launches-New-Open-Access-Weather-Data-Service)
- **Synoptic free trial.** A 14-day Enterprise trial is available once per service. It could be used for a one-time backfill, but that requires signing up. — [Synoptic trial docs](https://docs.synopticdata.com/account/trial-access)
- **IEM (own test).** The IEM station API returned `{"detail":"No stations found."}` for MTH03. — [IEM API](https://mesonet.agron.iastate.edu/api/1/station/MTH03.json)
- **Gust definition context from RAWS.** The MTH stations are not RAWS, but RAWS-standard mesonets report a sustained wind averaged over 10 minutes at 6.1 m (20 ft) AGL, and the gust is "the fastest 3-s sample in each 10-min interval". RAWS hourly reports carry the hour's fastest gust. — [Fovell et al. 2017 / Atmosphere 2025 (via search summary)](https://www.atmos.albany.edu/facstaff/rfovell/papers/2017-fovell-cao.pdf); [Atmosphere 2025](https://www.mdpi.com/2073-4433/16/1/16)
- **Why averaging rules matter.** Gust-factor estimates depend strongly on the averaging and reporting rules, and hourly METAR-style gust data are "inadequate for site gust characterization". — [Harris & Kahl 2017 (via review)](https://www.mdpi.com/2674-0494/4/3/24)

### Inferences
- The stations appear to belong to a Mammoth-operated network ingested by MesoWest, based on the "MAMMOTH" sub-provider and names like "Top Stn" and "Bottom of 15". This is likely Mammoth Mountain Ski Area or its ski patrol. A local forecaster site lists a "Ski Patrol Weather Station 9000 Feet" ([Mammoth Snowman](https://www.mammothsnowman.com/?p=22801)), which is consistent with MTH05 Sesame at 9,014 ft. I did not confirm who operates them.
- The summit station (MTH03) seems to have an intermittent or failed speed/direction channel, likely an iced or damaged anemometer or vane, or a QC rejection, while gusts still report. This has two consequences:
  - A gust-factor method (gust = speed × factor) cannot be anchored on MTH03's observed speed right now.
  - Any running-bias scheme must work on gust alone at the summit.
- Because gusts lag about 1–2 h, a nowcast has to start from the latest gust-bearing record, not the latest record. The bias then has to be carried forward over that 1–2 h gap.
- Every hour that is not archived is lost after 7 days. Archiving 5-minute observations for all 5 stations every hour (about 300 records per hour in total) is tiny: a GitHub Action committing JSON, or a Cloudflare Worker writing to KV or R2, would do. This is the main justification for adding a scheduled job.

### Gaps
- Sensor heights, anemometer type, sampling rate and gust definition for the MAMMOTH network (for example 3-s peak over 5 or 10 minutes) are not published in api.weather.gov metadata. I could not reach Synoptic's per-station metadata without a token. The next step is to view the station pages on MesoWest/Synoptic Weather or ask Mammoth ski patrol.
- The exact start date of each station's record in Synoptic is unknown; it needs a token or the website.
- Whether the MTH03 speed nulls come from a sensor fault or from NWS-side QC (`qualityControl: 'Z'` appears on the null values) is unknown.
- How Synoptic rate-limits or prices commercial access to 5+ years of five stations is not on the public pages I could read.

## 2. Historical model forecasts for pairing

### Takeaway
The model side of the training set is easy. Open-Meteo's Historical Forecast API returns HRRR (`gfs_hrrr`) hourly `wind_gusts_10m` back to at least 2018. Its Previous Runs API returns lead-specific HRRR gusts (`wind_gusts_10m_previous_day1`) from about mid-2024. The raw HRRR archive on AWS covers 2014 onward. One flag: Open-Meteo's docs list HRRR as "Discontinued 2026-11-30", while NWS says HRRR is not being retired with RRFSv1.

### Cited Findings
- **Historical Forecast API (own test).** It accepts dates from 2016-01-01. HRRR gust values were all null for 2016-06-01 and 2017-06-01 but complete for 2018-08-01 and 2023-01-01 at the summit point. The grid point snapped to 37.61922, -119.02136 with model elevation 3310–3356 m, versus 3363 m for the station. — [Open-Meteo Historical Forecast API](https://historical-forecast-api.open-meteo.com/v1/forecast?latitude=37.6306&longitude=-119.0328&start_date=2018-08-01&end_date=2018-08-02&hourly=wind_gusts_10m&models=gfs_hrrr)
- **Previous Runs API (own test).** `wind_gusts_10m_previous_day1` for `gfs_hrrr` was null on 2023-06-01 and 2024-01-05 and complete on 2024-06-01. `previous_day2` was null, which fits HRRR's 48-hour horizon. The response header showed no `access-control-allow-origin`; this needs checking before relying on browser fetches. — [Open-Meteo Previous Runs API](https://previous-runs-api.open-meteo.com/v1/forecast?latitude=37.6306&longitude=-119.0328&start_date=2024-06-01&end_date=2024-06-01&hourly=wind_gusts_10m_previous_day1&models=gfs_hrrr)
- **Previous Runs documentation.**
  - Most models are archived from January 2024.
  - Offsets go from `_previous_day1` to `_previous_day7`.
  - The model list shows "NCEP HRRR U.S. CONUS (Discontinued 2026-11-30)".
  - The variable list on the docs page shows wind speed and direction but not gusts, even though the API returned gusts in my test.
  - Source: [Open-Meteo Previous Runs docs](https://open-meteo.com/en/docs/previous-runs-api)
- **NWS position on HRRR.** NWS says RRFS/REFS v1 replaces NAM, HREF, SREF and HiresW, effective around November 3, 2026. "HRRR is not being retired" alongside RRFSv1; its retirement awaits a later RRFS upgrade. — [NWS SCN 26-48 (rev.)](https://www.weather.gov/media/notification/pdf_2026/scn26-048_Updated_RRFS_and_REFS_Implementation.aaf.pdf); [RRFS webinar Q&A](https://www.weather.gov/media/wrn/calendar/RRFS_REF-Webinar%26RegistrationFormQANotes.pdf); [SCN 26-100](https://www.weather.gov/media/notification/pdf_2026/scn26-100_EVS%20_RRFS_REFS_Website_Update.pdf)
- **Raw HRRR archive on AWS.** Bucket `noaa-hrrr-bdp-pds` (us-east-1) holds "HRRR data since 2014", updated hourly. A Zarr copy is in `hrrrzarr` (us-west-1). No AWS account is needed, and NODD data are open to the public. — [AWS Registry: NOAA HRRR](https://registry.opendata.aws/noaa-hrrr-pds/)
- **Open-Meteo 15-minute gusts (own test).** Open-Meteo's forecast API returns 15-minute `wind_gusts_10m` for `gfs_hrrr` (96 of 96 non-null for one day). Hourly HRRR gusts were non-null for 61 of 72 hours, because HRRR runs out about 48 h. — [Open-Meteo forecast API](https://api.open-meteo.com/v1/forecast?latitude=37.6306&longitude=-119.0328&minutely_15=wind_gusts_10m&models=gfs_hrrr&forecast_days=1)
- **NBM gust calibration.** NBM's own gust calibration (quantile mapping, v4.2, May 2024) is described in Section 4.

### Inferences
- Open-Meteo's `past_days` and Historical Forecast data are stitched from the freshest runs (short leads), so they measure the bias of near-analysis HRRR. The bias of a 12–24 h forecast can differ. For lead-dependent correction use the Previous Runs API (`previous_day1` means a 24–48 h lead), or archive each issued forecast yourself in the cron job.
- The "Discontinued 2026-11-30" label probably means Open-Meteo is changing its HRRR feed, perhaps to RRFS, not that NOAA stops HRRR on that date. Either way, a correction trained on HRRR may need retraining when the upstream model changes. This argues for a self-adapting (running or Kalman) bias over a frozen regression.
- Pairing note: model grid elevation is 3310–3356 m against a station at 3363 m, so the summit grid cell is close in height. The low bias is therefore probably not an elevation mismatch. More likely it is the model's smoothed ridge (missing speed-up) and the gust parameterisation.

### Gaps
- I could not fetch Open-Meteo's Historical Forecast docs (connection reset), so the exact HRRR start date there (somewhere between 2018-01 and 2018-08) is unconfirmed.
- Whether Open-Meteo's HRRR `wind_gusts_10m` is an instantaneous gust at the valid time or the maximum over the preceding hour is not confirmed for HRRR specifically. This matters when pairing with an hourly maximum of 5-minute observed gusts.
- NBM archive availability via Open-Meteo Previous Runs was not tested.

## 3. Methods for correcting gusts and nowcasting 0–6 h

### Takeaway
The summit error is large, systematic and persistent. That favors cheap methods: a per-station linear or multiplicative correction plus a running (Kalman-type) bias update, with persistence of the current error decaying over about 3–4 h for the nowcast. Distributional methods (EMOS), tree models and analog ensembles add value only once a season or more of paired data exists.

### Cited Findings
- **Own test: HRRR gust bias per station.** Data: about 7–8 days, 2026-11-09 to 2026-11-16. Each station's hourly maximum observed gust from api.weather.gov was compared with the Open-Meteo `gfs_hrrr` hourly gust at that station's own coordinates (past_days=7). Bias is observed minus HRRR.

  | Station | Paired hours | Mean observed gust (mph) | Mean HRRR gust (mph) | Bias (mph) | SD (mph) | Obs/HRRR ratio |
  |---|---|---|---|---|---|---|
  | MTH03 Summit | 152 | 28.2 | 19.3 | +8.9 | 6.8 | 1.46 |
  | MTH20 McCoy | 156 | 15.4 | 19.4 | -4.0 | 8.8 | 0.79 |
  | MTH05 Sesame | 83 | 16.4 | 26.8 | -10.4 | 7.8 | 0.61 |
  | MTH19 Canyon | 156 | 9.6 | 16.1 | -6.5 | 8.2 | 0.59 |
  | MTH17 Eagle | 0 | – | – | – | – | – |

  - So HRRR is too low at the summit but too high at the more sheltered mid and base stations.
  - A shorter 78-hour sample at MTH03 gave +10.6 mph (median +11.4), matching the app's "10+ mph below".
  - The MTH05, MTH19 and MTH17 figures rest on thin data (see the gust-report counts in Section 1).
  - Source: [api.weather.gov](https://api.weather.gov/stations/MTH03/observations); [Open-Meteo](https://api.open-meteo.com/v1/forecast?latitude=37.63059&longitude=-119.03282&hourly=wind_gusts_10m&models=gfs_hrrr&past_days=7)
- **Own test: in-sample MAE after a constant correction (raw / additive / multiplicative, mph).** This is in-sample, so it overstates out-of-sample skill.
  - MTH03: 9.4 / 5.4 / 6.7. Additive is best, a 43% reduction.
  - MTH20: 7.2 / 6.8 / 5.5. Multiplicative is best.
  - MTH05: 10.6 / 6.0 / 4.2. Multiplicative is best.
  - MTH19: 7.7 / 6.2 / 3.4. Multiplicative is best.
  - Source: same data as above.
- **Own test: how long the error persists.** The lag autocorrelation of the hourly gust error (observed minus HRRR) was:
  - MTH03: 0.73 at 1 h, 0.58 at 2 h, 0.47 at 3 h, 0.13 at 6 h.
  - The other stations: 0.74–0.77 at 1 h, 0.34–0.50 at 3 h, 0.35–0.50 at 6 h.
  - Source: same data as above.
- **Own test: observed gust factor.** The median hourly-maximum gust divided by mean speed, for hours with mean speed above 5 mph, was 1.35 at MTH03 (n=90) and 2.18 at MTH20 (n=49). It was 3.7–4.6 at MTH19 and MTH05, but with small samples (n of 13–15). — same data
- **EMOS and ML for gusts (Schulz & Lerch 2022, MWR).**
  - Setup: COSMO-DE-EPS, 175 German stations, 2010–2015 training, 2016 test.
  - Results: EMOS with a truncated logistic distribution, fitted per station by minimum CRPS, cut CRPS from 1.33 (raw ensemble) to 0.95, about 29%. Gradient-boosted EMOS reached 0.88, quantile regression forest 0.87, and distributional and Bernstein-quantile neural networks 0.84 (about 37%).
  - The gust ensemble mean and spread were the top predictors, followed by station-specific terms, day of year and shortwave radiation.
  - Postprocessing also fixes the 0–1 h spin-up bias and the evening-transition bias.
  - At 13 of 175 stations, mostly mountainous or coastal, QRF or EMOS-GB beat the neural networks.
  - Source: [Schulz & Lerch, arXiv 2106.09512](https://ar5iv.arxiv.org/html/2106.09512); [EGU21 abstract](https://meetingorganizer.copernicus.org/EGU21/EGU21-1326.html)
- **Analog ensemble and Kalman filter (Delle Monache et al. 2011).** For 10-m WRF wind at 400 western-US stations over 6 months, analogs gave centered RMSE about 35% lower than raw and about 20% lower than a Kalman filter. Analogs handled regime-change error jumps better than the Kalman filter. — [UCAR dataset/abstract](https://data.ucar.edu/dataset/2c49c4fe-6b04-4d77-8775-e10a8e875de4)
- **Analogs lose their edge on pure bias (Nagarajan et al. 2015).** "When the errors are strictly systematic (i.e., a bias), the analog methods lose their advantage over the time series methods." — [Nagarajan et al. 2015 record](https://harvester.ues.edu.sv/vufind/ProQuestFSGRecord/2827711362)
- **Complex terrain, Croatia (Plenković et al. 2018, ALADIN).** For 10-m wind at 14 stations, the Kalman filter and Kalman-analog were "most successful in removing bias". Analogs reduced dispersion error better in complex terrain and with strong winds. — [UCAR dataset/abstract](https://ckanprod.data-commons.k8s.ucar.edu/dataset/493e1f68-ee3d-4682-a00c-6996f1226a53); [EMS2018 abstract](https://meetingorganizer.copernicus.org/EMS2018/EMS2018-133.pdf)
- **Gust factor approach (Harris & Kahl 2017; Kahl 2020).**
  - Gust-factor models "demonstrate skill" for peak gusts and improve with meteorologically stratified factors (by wind speed, direction, stability).
  - Mean gust factor was 1.74 at Milwaukee ASOS.
  - Site characteristics and local obstructions strongly affect the factor.
  - Source: [Harris & Kahl 2017 (UCAR record)](https://impacts.ucar.edu/en/publications/gust-factors-meteorologically-stratified-climatology-data-artifac/); [MDPI review](https://www.mdpi.com/2674-0494/4/3/24)
- **Persistence versus model for short leads.**
  - Basque Country gust study: "for horizons less than 1–4 h, persistence is the best model"; random forest did best beyond that. Its comparator was a reanalysis, not an operational model. — [arXiv 2503.18797](https://arxiv.org/html/2503.18797v1)
  - MeteoSwiss station deep learning (PeakWeather): ML models were more accurate than ICON "in the nowcasting regime, and up to approximately 12 hours ahead" for wind speed. — [PeakWeather, arXiv 2506.13652](https://arxiv.org/pdf/2506.13652)
  - A French hybrid of station observations and ARPEGE/AROME output beat raw NWP, persistence and linear regression at 1–6 h. — [arXiv 2512.08974](https://arxiv.org/html/2512.08974v1)
  - A MeteoSwiss MOS-versus-neural-network gust study used persistence predictors only for the first 2 h. — [arXiv 2401.11896](https://arxiv.org/pdf/2401.11896)

### Inferences
Methods, ranked by fit to this app (complexity, data needed, where it runs):

1. **Running bias per station (exponentially weighted mean, or a scalar Kalman filter on bias).** It needs only the trailing 7 days of NWS observations plus Open-Meteo past_days or Previous Runs, which the browser already fetches. It is O(n) arithmetic in the browser.
   - Use an additive bias at MTH03 and a multiplicative ratio (or both, as obs = a + b·HRRR) at the sheltered stations, where errors scale with wind.
   - For a scalar Kalman filter on bias, Q/R ≈ 0.01–0.1 gives memory of several days. That figure is my own suggestion, not taken from any cited paper.
   - Directly targets the systematic summit error, where the Kalman filter is strongest (Plenković; Nagarajan).
2. **Per-station linear MOS: gust_obs ~ HRRR gust + HRRR speed + sin/cos(direction) + hour of day (+ a stability proxy).** Needs one season or more of archived pairs. Fit offline, ship the coefficients as JSON, apply in the browser. Direction terms capture ridge exposure: for example, SW flow over the summit versus NE "upslope" events.
3. **Gust factor (gust = corrected speed × site factor by direction and speed class).** Attractive at MTH20 and MTH05, where speed is reported. At MTH03 the speed channel is currently mostly null, and observed factors at the sheltered sites (3–4.6) are unstable. So use it as a secondary check, not the primary method.
4. **Quantile mapping (gamma CDF, NBM-style).** Fixes distribution shape. Needs months of data per station. NBM's experience shows it under-corrects high winds when training is thin (Section 4).
5. **EMOS (truncated logistic or normal) on a time-lagged HRRR "ensemble" (several recent runs), or on RRFS/REFS members.** Gives calibrated gust probabilities, for example P(gust > 50 mph) for lift-hold thresholds. Moderate complexity (CRPS optimisation offline, about 4 parameters per station). Expected about 25–30% CRPS gain over raw, based on the Germany results.
6. **Gradient boosting or QRF per station, or pooled with station ID.** Best for nonlinear direction and stability effects, but needs 1–2+ seasons. Fit offline and run in the cron job (QRF is awkward in the browser).
7. **Analog ensemble.** Needs a long paired archive (Delle Monache used months to years). Useful later for regime-dependent errors (storms versus fair-weather mixing). Not a first step, because the main error is systematic.

**Nowcast for 0–6 h.** Let e₀ be the latest observed gust minus the corrected forecast, taken at the time of the latest gust-bearing record. Then:

forecast(t+h) = corrected_model(t+h) + e₀·exp(−(h+lag)/τ)

- τ ≈ 3–4 h, from the lag-1/2/3 autocorrelations of 0.73, 0.58 and 0.47 at MTH03 (−1/ln 0.73 ≈ 3.2 h).
- "lag" is the 1–2 h observation latency.
- This matches the literature finding that persistence dominates for the first 1–4 h and the corrected model takes over after that.

### Gaps
- My autocorrelation and MAE numbers come from one week with no cross-validation. I found no published decorrelation time for gust errors at Sierra ridgetops.
- No published direction-sector (ridge-exposure) gust bias study for the Sierra Nevada turned up.
- No study quantifying a running Kalman bias for gusts specifically (rather than mean wind) turned up.

## 4. Documented skill gains for gust post-processing in complex terrain

### Takeaway
Gust post-processing typically cuts CRPS by about 26–37% against raw ensembles (Germany, with mountain stations among the hardest). Analog and Kalman methods cut 10-m wind RMSE by about 20–35% in the western US. HRRR's known pattern (too low at windy, exposed sites; too high at sheltered sites) matches what the MTH stations show. Hard numbers for Alpine operational systems (INCA, MeteoSwiss) were not retrievable.

### Cited Findings
- **Germany, 175 stations (Schulz & Lerch 2022).** CRPS improvement over raw COSMO-DE-EPS gusts was about 26–29% for basic methods and up to about 37% for neural networks. An EGU abstract says simple gust-only methods improve CRPS by "up to 40%". — [ar5iv 2106.09512](https://ar5iv.arxiv.org/html/2106.09512); [EGU21-1326](https://meetingorganizer.copernicus.org/EGU21/EGU21-1326.html); [KIT press release (36%)](https://kit.edu/kit/english/pi_2022_021_better-forecasts-of-wind-gusts-with-ai.php)
- **Western US, 10-m wind (Delle Monache et al. 2011).** The analog method gave about 35% lower centered RMSE than raw WRF, and about 20% lower than a Kalman filter. — [UCAR](https://data.ucar.edu/dataset/2c49c4fe-6b04-4d77-8775-e10a8e875de4)
- **MeteoSwiss COSMO-E wind.** Parametric postprocessing with terrain covariates (DEM, TPI) extends to unobserved Alpine sites. Gains come "mainly" from better reliability rather than resolution. — [EGU21-9849](https://meetingorganizer.copernicus.org/EGU21/EGU21-9849.html); [EGU2020-22298](https://meetingorganizer.copernicus.org/EGU2020/EGU2020-22298.html)
- **Swiss EMOS for temperature (for scale).** Up to 30% CRPS improvement over elevation-corrected direct model output. — [EGU2020-11422](https://presentations.copernicus.org/EGU2020/EGU2020-11422_presentation.pdf)
- **Swiss convective gusts.** GEV-based statistical and deep-learning postprocessing of Pangu-Weather gusts beat direct forecasts, ICON and climatology. — [arXiv 2504.00128](https://arxiv.org/html/2504.00128v3)
- **NBM gust calibration (NOAA MDL).**
  - v4.2 (May 2024) added quantile-mapped 10-m wind and gust, using gamma distributions and a forecast CDF mapped to an analysis CDF.
  - Gains were mostly at light winds. NOAA found "a significant low speed bias … for higher wind speeds", especially at night.
  - v4.3 (2025) sets a gust below the speed to 1.08 × speed.
  - The v4.1 24-hour peak-wind product used gamma quantile mapping over the previous 120 days.
  - Source: [NBM v4.2 note](https://vlab.noaa.gov/web/mdl/-/nbm-upgraded-to-version-4-2); [NBM webinar Apr 2026](https://www.weather.gov/media/wrn/calendar/NBMUserWebinar4-15-26.pdf); [SCN25-34 NBM v4.3](https://www.weather.gov/media/notification/pdf_2025/scn25-34_upgradeNBM_V4.3.pdf); [Schnapp, NBM v4.1 wind](https://www.weather.gov/media/rev/IWAWS/PDFs/2022/Adam%20Schnapp%20-%20Wind%20Updates%20to%20the%20NBM%20v4.1.pdf)
- **HRRR in Wyoming and Colorado (Collins et al.).** Positive bias for weak winds and gusts, large negative bias for strong ones, and the largest biases on lee slopes (downslope winds). Part II found resolution increases help only slightly; PBL and surface-layer scheme changes helped more. — [Collins et al. Part I](https://bohrium.dp.tech/paper/arxiv/0e4134843e19b071c04c273213a085e939f427db751a4e2aa50981aeee473f96); [NOAA repository](https://repository.library.noaa.gov/view/noaa/67853)
- **HRRR against ASOS, RAWS and utility mesonets (Fovell et al., Atmosphere 2025).** HRRR "tends to underpredict the highest wind speeds and at the windiest locations" and overpredicts at slower-wind stations. — [MDPI Atmosphere 16(1):16](https://www.mdpi.com/2073-4433/16/1/16)
- **INCA in Austrian complex terrain (WegenerNet JBT).** Significant biases for strong wind events: summit-region overestimation and valley underestimation in the analysis. — [GMD 12, 2855 (2019)](https://gmd.copernicus.org/articles/12/2855/2019/gmd-12-2855-2019.pdf); [gmd-2018-238 preprint](https://gmd.copernicus.org/preprints/gmd-2018-238/gmd-2018-238.pdf)
- **NWP in the nowcasting range (Kann et al. 2012).** NWP has "comparatively low skill within the nowcasting range (0–6 h)", which motivates INCA-style observation-anchored nowcasts. — [ASR 8, 115 (2012)](https://asr.copernicus.org/articles/8/115/2012/asr-8-115-2012.pdf)

### Inferences
- Realistic expectation for MTH03: a running additive bias should remove most of the 9–11 mph mean error. In-sample MAE fell about 43% (9.4 to 5.4 mph). Out of sample, perhaps 30–40%, in line with the literature range. The remaining MAE of about 5–7 mph reflects hour-to-hour gust variability that only nowcasting (the first few hours) or richer predictors can address.
- The sign reversal across stations (summit too low, lodges too high) matches Fovell et al. 2025 and Collins et al. A single mountain-wide offset would make things worse. Corrections must be per station.

### Gaps
- No MAE or bias numbers were retrieved for INCA wind or gust nowcasts, MeteoSwiss operational gust MOS, or Météo-France gust postprocessing. Haiden et al. 2011 (W&F) is the primary INCA reference, but its gust verification numbers were not in the snippets.
- No Sierra Nevada ridgetop gust verification study was found.
- Wind-energy ramp-forecasting skill numbers were not researched for lack of budget.

## 5. How ski areas and avalanche centers handle this

### Takeaway
Little documented practice turned up. The Alpine operational precedent is INCA: an observation-plus-NWP analysis and nowcast designed for mountainous terrain. In the Eastern Sierra, the evidence available is limited to local forecasters and ski patrol reading ridgetop stations directly. I found nothing on ESAC or Mammoth patrol post-processing model gusts.

### Cited Findings
- **INCA (Haiden et al. 2011).** Developed for mountainous terrain in Austria. Its analysis and nowcast fields include wind, temperature, precipitation and more, combining station observations with NWP background fields. — [Haiden et al. 2011, W&F](https://zendy.io/title/10.1175/2010waf2222451.1)
- **INCA verification against a dense station network.** Kann et al. reported high analysis skill across seasons against WegenerNet over 2007–2010. — [ASR 12, 51 (2015)](https://asr.copernicus.org/articles/12/51/2015/asr-12-51-2015.pdf)
- **MeteoSwiss station-based wind nowcasting.** MeteoSwiss work stresses that persistence of wind is very important for nowcasting, and uses ML on station observations for 0–24 h. — [EGU/Buzzi et al. via arXiv 2506.13652](https://arxiv.org/pdf/2506.13652)
- **Mammoth local practice.** The Mammoth local forecaster lists a "Ski Patrol Weather Station 9000 Feet" alongside summit observations. Posts quote summit wind and gusts directly, for example "S wind at 43 MPH, gusting to 46 MPH at the summit". — [Mammoth Snowman](https://www.mammothsnowman.com/?p=22801); [Mammoth Snowman Oct 2024](https://www.mammothsnowman.com/2024/10/21/mammoth-mountain-weather-forecast-from-the-snowman-13/)

### Inferences
- Ski patrol lift-hold decisions are likely made from live ridgetop station readings plus experience, not from post-processed model output. The app's value-add would be an observation-anchored, bias-corrected 0–6 h outlook in the INCA spirit, at points.

### Gaps
- I found no source on how the Eastern Sierra Avalanche Center (ESAC) uses or corrects model winds, or on Mammoth's internal wind-hold criteria.
- No source on whether other U.S. resorts (for example Vail, Jackson Hole or Palisades Tahoe) run station MOS.

## 6. Concrete recommendation

### Takeaway
Start with the simplest method: a per-station running bias correction plus a decaying-persistence nowcast, computed entirely in the browser from the 7 days of data the app can already fetch. It should remove most of the summit's 9–11 mph low bias immediately. In parallel, add an hourly cron job that archives observations and issued forecasts. After one season, fit per-station MOS or EMOS with direction and stability terms, and ship the coefficients as JSON.

### Cited Findings
- 7-day NWS history with open CORS (own test): [api.weather.gov](https://api.weather.gov/stations/MTH03/observations)
- HRRR gusts at 15-minute and hourly resolution, plus past_days, from Open-Meteo (own test): [Open-Meteo](https://api.open-meteo.com/v1/forecast?latitude=37.63059&longitude=-119.03282&hourly=wind_gusts_10m&models=gfs_hrrr&past_days=7)
- Lead-specific HRRR gusts from about June 2024: [Previous Runs API](https://previous-runs-api.open-meteo.com/v1/forecast?latitude=37.6306&longitude=-119.0328&start_date=2024-06-01&end_date=2024-06-01&hourly=wind_gusts_10m_previous_day1&models=gfs_hrrr)
- Kalman/running-bias methods are best at removing systematic bias: [Plenković 2018](https://ckanprod.data-commons.k8s.ucar.edu/dataset/493e1f68-ee3d-4682-a00c-6996f1226a53); [Nagarajan 2015](https://harvester.ues.edu.sv/vufind/ProQuestFSGRecord/2827711362)
- Persistence wins at 1–4 h: [arXiv 2503.18797](https://arxiv.org/html/2503.18797v1)
- EMOS and QRF gains of 29–35% CRPS: [Schulz & Lerch](https://ar5iv.arxiv.org/html/2106.09512)
- Synoptic multi-year history is gated (.edu only, 1 year, or commercial): [Synoptic](https://synopticdata.com/pricing/open-access-pricing/)

### Inferences

**Phase 1: browser only, about 100–200 lines of TypeScript.**
1. For each station, fetch 7 days of 5-minute observations from api.weather.gov (3–5 pages each) and HRRR hourly gusts from Open-Meteo with `past_days=7` at the station's own coordinates.
2. Build hourly pairs: the maximum observed gust in each hour against the HRRR gust.
3. Estimate the correction: obs ≈ a + b·HRRR by exponentially weighted least squares (half-life about 2–3 days), clamped. Or, more simply, an additive EW bias at MTH03 and an EW ratio elsewhere.
4. Apply the correction to all forecast hours.
5. Nowcast: add e₀·exp(−(h+lag)/τ) with τ ≈ 3 h, where e₀ is the latest gust error and lag is its observation age.
6. Show "corrected" and "raw" values side by side.
7. Main Lodge: borrow MTH05's correction, but flag the uncertainty. MTH05 is a sheltered, high-gust-factor site where HRRR runs high, and it is about 115 ft above Main Lodge.
8. Eagle Lodge (MTH17): no gusts were reported in 7 days, so leave the model raw or borrow MTH19's correction, and say so in the UI.
9. Compute cost is negligible. The main cost is about 20 extra API calls per page load; cache them in sessionStorage.

**Phase 2: a tiny scheduled job (GitHub Action hourly, or a Cloudflare Worker cron).** This is justified because api.weather.gov drops data after 7 days and Synoptic history is gated.
- Every hour, append to the archive:
  - the new MTH observations;
  - the full issued HRRR forecast from Open-Meteo, so each lead time is kept;
  - optionally RRFS/NBM forecasts, so the correction survives the HRRR change.
- Optionally the job also computes the Phase 1 coefficients and publishes them as a static JSON. That removes per-client API fan-out and lets corrections be lead-time-specific.

**Phase 3: after one season of archive, or a one-time Synoptic backfill if commercial or trial access is obtained.**
- Fit per-station MOS or EMOS (truncated logistic) with these predictors: HRRR gust, HRRR speed, sin/cos of direction (ridge-exposure sectors), hour of day, lead time, and a stability proxy (for example the HRRR temperature difference between summit and base grid points).
- Output calibrated quantiles and P(gust > lift-hold thresholds).
- Later, try gradient boosting, QRF or an analog ensemble pooled across stations.
- Keep the Phase 1 running bias on top to absorb model upgrades.

### Gaps
- Out-of-sample skill of the Phase 1 scheme has not been measured. It should be backtested over an archived month before claiming numbers in the UI.
- Whether Open-Meteo's Previous Runs endpoint allows browser CORS is unconfirmed: the header was absent in my curl test. If it does not, lead-specific pairing would need the Phase 2 job.
