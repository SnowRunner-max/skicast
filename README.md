# Skicast

Wind and weather on Mammoth Mountain, read straight off the lift map.

One screen: a simplified lift map with a point (a "beacon") at Summit, McCoy Station, Main Lodge, Canyon Lodge and Eagle Lodge. Each beacon shows its gust speed and wind direction on the map. Tap one for current weather, current wind and wind for the next six hours.

Current values are measured where a beacon has a weather station, and come from the forecast model where it does not. The next six hours are always the model.

No backend. The browser asks [Open-Meteo](https://open-meteo.com/) for the forecast (one request for all five beacons) and the National Weather Service's public API for station readings (one request per station).

## Run it

```bash
npm install
npm run dev
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Type-check, then build static files into `dist/` |
| `npm run test:ci` | Run the tests once |
| `npm run map:build` | Rebuild `src/data/mapPaths.ts` from the checked-in data |
| `npm run map:fetch` | Pull lifts from OpenStreetMap again, then rebuild |
| `npm run map:terrain` | Sample USGS elevations again, then rebuild |

`dist/` is plain static files with relative paths, so it deploys as-is to GitHub Pages, Netlify or Cloudflare Pages.

## The map

The map is drawn from OpenStreetMap data, not from Mammoth's trail map (that artwork is theirs). `scripts/build-map.ts` does the work, by hand, not at build time:

1. `map:fetch` pulls every `aerialway` in the ski area from the Overpass API (falling back to the main OSM API when Overpass is down) and saves named chairlifts and gondolas to `src/data/mammoth-lifts.geojson`.
2. Review that file's diff against the current official trail map: lift names, which lifts exist, where they start and end. Fix mistakes in OSM itself, or in the `REVIEW` table at the top of the script.
3. `map:build` projects the GeoJSON into SVG paths in `src/data/mapPaths.ts`, rotated so 201° (south-south-west) is up. That is the trail-map view from town: lodges along the bottom, summit at the top.
4. `map:terrain` samples a grid of USGS 3DEP elevations (public domain) into `src/data/mammoth-terrain.json`; the build turns it into faint contour lines.

The app and the script share `src/lib/projection.ts`, and each beacon takes its coordinates from its station's OSM node, so a beacon always sits on its station.

Because the map is rotated, wind arrows are drawn in the map's frame: an arrow shows which way the wind blows across the mountain as you see it on screen. The compass text ("From SW") and the N mark on the dial give the true direction.

## Where things live

| To change | Edit |
| --- | --- |
| Wind band cutoffs and labels | `src/lib/wind.ts` |
| Beacons (lift station, weather station, elevation, label side) | `src/data/beacons.ts` |
| Forecast model, hosts, cache times, how old a reading may be | `src/config.ts` |
| Info text (the three wordings) | `src/components/DataInfo.tsx` |
| Which value comes from the station and which from the model | `src/lib/current.ts` |
| Colors and type | `src/apple.css` (Cottonwood tokens), `src/index.css` |
| Map rotation, which lifts are drawn | top of `scripts/build-map.ts` |

## Things to know

- **Measured first, forecast as the fallback, value by value.** `resolveCurrent` takes each of temperature, sustained wind, gust and direction from the station when it has a fresh reading, and from the model when it does not. Sky, cloud cover and precipitation are never measured at these stations, so they are always the model's. A point with no fresh station data gets a warning icon and "Not from weather station."
- **Which beacons have a station.** Summit (`MTH03`), McCoy (`MTH20`), Canyon (`MTH19`) and Eagle (`MTH17`) each have a Mammoth station at the spot. Main Lodge has none: the nearest, Sesame (`MTH05`), is 1,200 ft away and 125 ft higher, so Main stays on the model. Set `weatherStation` in `beacons.ts` to change that.
- **Stations are patchy.** Top Station reports temperature and gusts but no sustained wind or direction; Eagle's station reports temperature only. Each missing value falls back to the model on its own, and the screen says which.
- **Station gusts lag.** The NWS feed only publishes a gust after quality screening, so it is usually 1 to 2 hours old. Gusts up to 3 hours old are used and the screen shows their age; everything else must be under 2 hours old. The feed itself also runs up to an hour behind at times, so every reading is shown with its age rather than called live.
- **The forecast is NOAA's National Blend of Models (NBM)**, pinned in `config.ts` so the name on screen is the model in use. It is a 2.5 km grid, updated hourly, with gusts calibrated against recent observations. It replaced NOAA HRRR, which Open-Meteo stops serving on 2026-11-30. Neither is fine enough to resolve the summit ridge, so expect model gusts to differ from the stations; `reports/High resolution ski wind models.md` has the research and the plan for per-station correction.
- **Elevation corrects temperature, not wind.** Each beacon's elevation is sent to Open-Meteo, which adjusts temperature for it. Wind and gusts come back as the model grid cell's values whatever elevation is sent.
- **Wind bands are rough guides** (calm under 20 mph gusts, windy 20 to 39, strong 40 and up), not Mammoth's rules for running lifts.
- **Open-Meteo's free tier is for non-commercial use.** If Skicast ever makes money, point `OPEN_METEO_BASE_URL` at the paid host and add the key.
- **Caching.** A forecast is reused for 10 minutes and station readings for 5 (NWS caches them for 5). The last one is kept in `localStorage` so beacons show immediately on reload, and stays on screen (labelled with its age) if a refresh fails.

## Credits

Lift data © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright) (ODbL). Elevation data from the USGS 3D Elevation Program. Forecast by [Open-Meteo](https://open-meteo.com/) (CC BY 4.0). Station observations from the [National Weather Service](https://www.weather.gov/) API. Design tokens from the Cottonwood design system in Ev-made-easy.
