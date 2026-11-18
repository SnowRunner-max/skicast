# Skicast

Wind and weather on Mammoth Mountain, read straight off the lift map.

One screen: a simplified lift map with a point (a "beacon") at eight of Mammoth's weather stations: Summit, McCoy Station, Top of Broadway, Top of Gold Rush, Cloud Nine, Sesame, Top of Eagle and Canyon Lodge. Each beacon shows its gust speed and wind direction on the map. Tap one for current weather, current wind and wind for the next six hours.

Across the top, the **Mountain Forecast** gives the whole mountain at a glance without tapping anything: the weather now as an icon with the summit's sustained wind, then the next four hours, one hour apart, to its right. Mountain weather is broader than any one station (cloud on the summit usually means cloud everywhere), so it comes from the summit's NWS forecast and stays the same whichever beacon is selected. Summit is selected when the app opens.

Current values are measured where the station has a fresh reading, and come from the forecast model where it does not. The next six hours are always the model.

No backend, and every number comes from the National Weather Service's public API (free, keyless, public domain, open to cross-origin requests): the forecast (one request per NWS grid square; the eight beacons sit in four) and station readings (one request per station, for all 20 Mammoth stations, including the ones not drawn on the map).

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
4. `map:terrain` samples a 30 m grid of USGS 3DEP elevations (public domain) into `src/data/mammoth-terrain.json`; the build turns it into faint contour lines every 40 m, with each fifth line (200 m) a touch stronger so the summit, ridges and bowls read at a glance.

The app and the script share `src/lib/projection.ts`, and each beacon takes its coordinates from its station's OSM node, so a beacon always sits on its station.

Because the map is rotated, wind arrows are drawn in the map's frame: an arrow shows which way the wind blows across the mountain as you see it on screen. The compass text ("From SW") and the N mark on the dial give the true direction.

## Where things live

| To change | Edit |
| --- | --- |
| Wind band cutoffs and labels | `src/lib/wind.ts` |
| Beacons (which station, name, label side) | `src/data/beacons.ts` |
| Every Mammoth weather station (id, coordinates, elevation) | `src/data/stations.ts` |
| Forecast source, hosts, cache times, how old a reading may be | `src/config.ts` |
| Which NWS grid square each beacon's forecast comes from | `forecastCell` in `src/data/beacons.ts` |
| Info text (the three wordings) | `src/components/DataInfo.tsx` |
| Which value comes from the station and which from the model | `src/lib/current.ts` |
| Mountain Forecast: which beacon stands for the mountain, how many hours, which icon each sky gets | `src/lib/mountainForecast.ts`; the icons are drawn in `src/components/SkyIcon.tsx` |
| Sustained wind at which the Mountain Forecast shows "windy" | `WINDY_SUSTAINED_MPH` in `src/lib/wind.ts` |
| Colors and type | `src/apple.css` (Cottonwood tokens), `src/index.css` |
| When the screen switches between bottom sheet, phone-on-its-side and desktop | `src/hooks/useLayout.ts` (the stylesheet reads its answer from `data-layout`) |
| How much of the screen the bottom sheet covers at each stop | top of `src/components/BottomSheet.tsx` |
| Map rotation, which lifts are drawn, contour interval and detail | top of `scripts/build-map.ts` |

## Things to know

- **Measured first, forecast as the fallback, value by value.** `resolveCurrent` takes each of temperature, sustained wind, gust and direction from the station when it has a fresh reading, and from the model when it does not. Sky, cloud cover and precipitation are never measured at these stations, so they are always the model's. A point with no fresh station data gets a warning icon and "Not from weather station."
- **Every station is fetched; eight are drawn.** `src/data/stations.ts` lists all 20 Mammoth stations on the NWS feed, and `useObservations` reads every one of them (keyed by station id) so the data is on hand for interpolating between stations later. `src/data/beacons.ts` picks the eight drawn on the map; each beacon sits at its station's coordinates. Add or swap a beacon by pointing `weatherStation` at another station there.
- **A beacon can borrow from a neighbour.** `backupStations` lists stations that fill in, value by value, what the main station does not send. Summit uses it: Top Station (`MTH03`) has no sustained wind or direction, so they come from Gondola 2 Tower 10 (`MTH12`), about 220 ft away and 50 ft lower. The screen names both stations and the info dialog says which value came from which.
- **Stations are patchy.** Top Station (`MTH03`) reports temperature and gusts but no sustained wind or direction; Top of Broadway, Top of Gold Rush and Cloud Nine report wind but no temperature. The comment on each line of `stations.ts` says what that station sent when it was surveyed. Each missing value falls back to the model on its own, and the screen says which.
- **Station gusts lag.** The NWS feed only publishes a gust after quality screening, so it is usually 1 to 2 hours old. Gusts up to 3 hours old are used; everything else must be under 2 hours old. The screen shows only the reading's age, which stands in for the gust's, and the info dialog says gusts can lag. The feed itself also runs up to an hour behind at times, so every reading is shown with its age rather than called live.
- **The forecast is the National Weather Service's gridded forecast (NDFD)**, read from `api.weather.gov/gridpoints/REV/x,y`. The Reno office's forecasters start from NOAA's National Blend of Models and edit it, on a 2.5 km grid. Squares are that coarse, so Summit, Gold Rush and Cloud Nine share one forecast, as do McCoy, Broadway and Sesame. Values come in blocks (often three hours for wind, six for precipitation), so the hourly strip can repeat a number. It is not fine enough to resolve the summit ridge, so expect forecast gusts to differ from the stations; `reports/High resolution ski wind models.md` has the research and the plan for per-station correction. On 16 November 2026 it was within about 9 mph of measured gusts across the eight beacons, against about 11 for the National Blend via Open-Meteo, which it replaced so the site can carry ads (Open-Meteo's free tier is non-commercial).
- **Elevation corrects temperature, not wind.** A grid square's forecast is for its average ground height, which can be hundreds of metres off the station's (Top Station is about 360 m above its square). `beaconForecast` moves the temperature to the station's height at the standard 6.5 °C per km and works out feels-like from that. Wind is left as the square's.
- **The Mountain Forecast's icons, in order of precedence:** thunder; snow (light, or heavy for moderate and heavy, and a rain and snow mix counts as snow); rain; fog; then "windy" when the sustained wind is 25 mph or more; then the cloud cover (sun or moon under 37.5%, sun or moon behind a cloud under 62.5%, cloud above). A "slight chance" of anything is drawn as the sky, though the words (read aloud and shown on hover) still say it. Sun or moon follows the sun's real height at the summit, not a fixed clock. The current wind is the same sustained wind the Summit card shows (measured when Top Station's neighbour has it, otherwise the forecast); later hours are always the forecast. On an upright phone the strip takes a row of its own under the toolbar, so the map is 46px shorter there.
- **Wind bands are rough guides** (calm under 20 mph gusts, windy 20 to 39, strong 40 and up), not Mammoth's rules for running lifts.
- **Caching.** A forecast is reused for 10 minutes and station readings for 5 (NWS caches them for 5). The last one is kept in `localStorage` so beacons show immediately on reload, and stays on screen (labelled with its age) if a refresh fails.

## Credits

Lift data © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright) (ODbL). Elevation data from the USGS 3D Elevation Program. Forecast and station observations from the [National Weather Service](https://www.weather.gov/) API (public domain). Design tokens from the Cottonwood design system in Ev-made-easy.
