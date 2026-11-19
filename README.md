# Skicast

Wind and weather on Mammoth Mountain, read straight off the lift map.

One screen: a simplified lift map with a point (a "beacon") at eight of Mammoth's weather stations: Summit, McCoy Station, Top of Broadway, Top of Gold Rush, Cloud Nine, Sesame, Top of Eagle and Canyon Lodge. Each beacon shows its gust speed and wind direction on the map. Tap one for current weather, current wind and wind for the next six hours.

Across the top, the **Mountain Forecast** gives the whole mountain at a glance without tapping anything: the weather now as an icon with the summit's sustained wind, then the next four hours, one hour apart, to its right. Mountain weather is broader than any one station (cloud on the summit usually means cloud everywhere), so it comes from the summit's NWS forecast and stays the same whichever beacon is selected. Summit is selected when the app opens.

A switch in the toolbar's top right corner (wind or thermometer), beside the light and dark mode button, changes what the Mountain Forecast and the beacons show: wind, as above, or the air temperature in °F. Showing temperature, a beacon is a plain dot with the temperature where its gust was, since green, amber and red mean wind and nothing else. The tapped beacon's card always shows both. The choice is kept in `localStorage` for next time.

Current values are measured where the station has a fresh reading, and come from the forecast model where it does not. The next six hours are always the model.

One small server function and no database. Two sources:

- **Station readings** come from Mammoth Mountain's own weather stations, as published on its public station site ([mammothmountain.westernweathergroup.com](https://mammothmountain.westernweathergroup.com), run by Western Weather Group). They report every 5 minutes. The site sends no cross-origin headers, so a browser can't read it directly; the app asks `/api/stations` on its own host instead, which asks Mammoth's site (see below).
- **The forecast**, and readings for any station Mammoth's feed has nothing fresh for, come from the National Weather Service's public API (free, keyless, public domain, open to cross-origin requests): one forecast request per NWS grid square (the eight beacons sit in four) and one request per station. The NWS copy of Mammoth's stations drops values (Top Station's sustained wind, much of the time) and runs 30 minutes to 2 hours behind, so it is the fallback only.

Each beacon reads its own station and nothing else. Summit used to borrow sustained wind from Gondola 2 Tower 10, about 220 ft away, but that tower reads a tenth of Top Station's wind in a storm.

## Station readings (`/api/stations`)

`/api/stations` asks Mammoth's station site for every station in its group (24 Mammoth stations and 2 at June Mountain) at four intervals: 5-minute, 15-minute, hourly and daily. Each interval has its own fields, from wind and gusts to snow depth, storm totals, season precipitation, daily peaks and battery voltage. It answers with all of them, with each field's name and units, as one JSON snapshot. The app uses temperature, sustained wind, gust and direction; the rest is there for later.

- In production it is a Netlify Function (`netlify/functions/stations.ts`). Netlify's CDN keeps each answer for 60 seconds, so Mammoth's site is asked about once a minute however many people have the app open, and a reading is at most about 6 minutes old.
- `npm run dev` and `npm run preview` serve the same endpoint from Vite (`vite.config.ts`), so local runs see Mammoth's readings too.
- The endpoint Mammoth's site uses (`/mapapi/query`, the one its own map page calls) is undocumented. `src/lib/mammoth.ts` checks everything it reads. If the 5-minute readings fail, `/api/stations` answers 502 and the app reads NWS for every station.
- Mammoth's reading always wins while it is at most 10 minutes old (one report plus one missed cycle), even if NWS has a newer one. Past that the station has stalled: the app also asks NWS for it and shows the newer of the two (`chooseReading` in `src/lib/observations.ts`; the limit is `MAMMOTH_FRESH_MS` in `src/config.ts`).
- The data is Mammoth's. The site states no terms of use; ask Mammoth before using it commercially.

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

The site is hosted on Netlify (`netlify.toml`): it builds `dist/` and deploys `netlify/functions/` beside it. `dist/` alone still runs anywhere static (GitHub Pages, say), but without `/api/stations` every reading comes from NWS.

Every pull request and push to `main` runs the typecheck, tests and build (`.github/workflows/ci.yml`). Netlify builds and publishes each push to `main` itself.

## The map

The map is drawn from OpenStreetMap data, not from Mammoth's trail map (that artwork is theirs). `scripts/build-map.ts` does the work, by hand, not at build time:

1. `map:fetch` pulls every `aerialway` in the ski area from the Overpass API (falling back to the main OSM API when Overpass is down) and saves named chairlifts and gondolas to `src/data/mammoth-lifts.geojson`.
2. Review that file's diff against the current official trail map: lift names, which lifts exist, where they start and end. Fix mistakes in OSM itself, or in the `REVIEW` table at the top of the script.
3. `map:build` projects the GeoJSON into SVG paths in `src/data/mapPaths.ts`, rotated so 201° (south-south-west) is up. That is the trail-map view from town: lodges along the bottom, summit at the top.
4. `map:terrain` samples a 30 m grid of USGS 3DEP elevations (public domain) into `src/data/mammoth-terrain.json`; the build turns it into faint contour lines every 40 m, with each fifth line (200 m) a touch stronger so the summit, ridges and bowls read at a glance.

The app and the script share `src/lib/projection.ts`, and each beacon takes its coordinates from its station's OSM node, so a beacon always sits on its station.

Because the map is rotated, wind arrows are drawn in the map's frame: an arrow shows which way the wind blows across the mountain as you see it on screen. The compass text ("From SW") and the N mark on the dial give the true direction.

OpenStreetMap's attribution guidelines want the credit on the map itself, readable without a tap, so a small "© OpenStreetMap" link sits in its bottom corner (just above the sheet on a phone). The info dialog repeats it with the other sources.

## Where things live

| To change | Edit |
| --- | --- |
| Wind band cutoffs and labels | `src/lib/wind.ts` |
| Beacons (which station, name, label side) | `src/data/beacons.ts` |
| Every Mammoth weather station (Mammoth's id, NWS id, coordinates, elevation) | `src/data/stations.ts` |
| Reading Mammoth's station site, and `/api/stations` | `src/lib/mammoth.ts`, `src/lib/stationsEndpoint.ts`, `netlify/functions/stations.ts` |
| Mammoth's feed first, NWS for the rest, and when NWS may win | `src/lib/observations.ts`, `MAMMOTH_FRESH_MS` in `src/config.ts` |
| Forecast source, hosts, cache times, how old a reading may be | `src/config.ts` |
| Which NWS grid square each beacon's forecast comes from | `forecastCell` in `src/data/beacons.ts` |
| Info text (the three wordings) | `src/components/DataInfo.tsx` |
| Which value comes from the station and which from the model | `src/lib/current.ts` |
| Mountain Forecast: which beacon stands for the mountain, how many hours, which icon each sky gets | `src/lib/mountainForecast.ts`; the icons are drawn in `src/components/SkyIcon.tsx` |
| Sustained wind at which the Mountain Forecast shows "windy" | `WINDY_SUSTAINED_MPH` in `src/lib/wind.ts` |
| Colors and type | `src/apple.css` (Cottonwood tokens), `src/index.css` |
| When the screen switches between bottom sheet, phone-on-its-side and desktop | `src/hooks/useLayout.ts` (the stylesheet reads its answer from `data-layout`) |
| How much of the screen the bottom sheet covers at each stop, and how it moves | top of `src/components/BottomSheet.tsx`; the springs are in `src/lib/spring.ts` |
| Map rotation, which lifts are drawn, contour interval and detail | top of `scripts/build-map.ts` |

## Things to know

- **Measured first, forecast as the fallback, value by value.** `resolveCurrent` takes each of temperature, sustained wind, gust and direction from the station when it has a fresh reading, and from the model when it does not. Sky, cloud cover and precipitation are never measured at these stations, so they are always the model's. A point with no fresh station data gets a warning icon and "Not from weather station."
- **Every station is fetched; eight are drawn.** `src/data/stations.ts` lists all 24 Mammoth stations by Mammoth's own id (`MM-SUM`), with the NWS id where NWS carries one (`MTH03`), and `useObservations` reads every one of them (keyed by Mammoth's id) so the data is on hand for interpolating between stations later. `src/data/beacons.ts` picks the eight drawn on the map; each beacon sits at its station's coordinates. Add or swap a beacon by pointing `weatherStation` at another station there.
- **One station per beacon, one feed per station.** A beacon shows its own station's values and the model's for anything that station doesn't measure, never a neighbour's. A station's reading comes whole from Mammoth's feed or from NWS, never a mix of the two. The info dialog says which.
- **Stations measure different things.** Top of Broadway, Top of Gold Rush and Cloud Nine report wind but no temperature; Top of 3 and The Mill report temperature only. The comment on each line of `stations.ts` says what that station sent when it was surveyed. Each missing value falls back to the model on its own, and the screen says which.
- **NWS gusts lag.** When a station falls back to NWS, its gust is usually 1 to 2 hours old, because NWS publishes a gust only after quality screening. Gusts up to 3 hours old are used; everything else must be under 2 hours old. The screen shows only the reading's age, and the info dialog says gusts can lag. Mammoth's own gust is the peak of the same 5-minute reading as the wind.
- **The forecast is the National Weather Service's gridded forecast (NDFD)**, read from `api.weather.gov/gridpoints/REV/x,y`. The Reno office's forecasters start from NOAA's National Blend of Models and edit it, on a 2.5 km grid. Squares are that coarse, so Summit, Gold Rush and Cloud Nine share one forecast, as do McCoy, Broadway and Sesame. Values come in blocks (often three hours for wind, six for precipitation), so the hourly strip can repeat a number. It is not fine enough to resolve the summit ridge, so expect forecast gusts to differ from the stations; `reports/High resolution ski wind models.md` has the research and the plan for per-station correction. On 16 November 2026 it was within about 9 mph of measured gusts across the eight beacons, against about 11 for the National Blend via Open-Meteo, which it replaced so the site can carry ads (Open-Meteo's free tier is non-commercial).
- **Elevation corrects temperature, not wind.** A grid square's forecast is for its average ground height, which can be hundreds of metres off the station's (Top Station is about 360 m above its square). `beaconForecast` moves the temperature to the station's height at the standard 6.5 °C per km and works out feels-like from that. Wind is left as the square's.
- **The Mountain Forecast's icons, in order of precedence:** thunder; snow (light, or heavy for moderate and heavy, and a rain and snow mix counts as snow); rain; fog; then "windy" when the sustained wind is 25 mph or more; then the cloud cover (sun or moon under 37.5%, sun or moon behind a cloud under 62.5%, cloud above). An hour the forecast gives no cloud cover for shows a dash and "Sky not forecast", never a sun. A "slight chance" of anything is drawn as the sky, though the words (read aloud and shown on hover) still say it. Sun or moon follows the sun's real height at the summit, not a fixed clock. The current wind is the same sustained wind the Summit card shows (measured at Top Station when it reports, otherwise the forecast); later hours are always the forecast.
- **The toolbar gives way on small screens.** On an upright phone the Mountain Forecast strip takes a row of its own under the toolbar, so the map is 46px shorter there. On an upright phone the status drops "Updated" and shows just the age ("12 min ago") to make room for the wind and temperature switch, and below about 368px the subtitle is left out too. On a phone on its side the toolbar is one row, so when it is narrow the subtitle and then the "Updated" status give way to the five hours (the card beside the map still says when it was updated).
- **Wind bands are rough guides** (calm under 20 mph gusts, windy 20 to 39, strong 40 and up), not Mammoth's rules for running lifts.
- **Caching.** A forecast is reused for 10 minutes and station readings for 5 (NWS caches them for 5). The last one is kept in `localStorage` so beacons show immediately on reload, and stays on screen (labelled with its age) if a refresh fails.

## Credits

Lift data © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright) (ODbL). Elevation data from the USGS 3D Elevation Program. Station readings from Mammoth Mountain's own weather stations, via its public station site run by [Western Weather Group](https://mammothmountain.westernweathergroup.com) (the data is Mammoth's). Forecast, and fallback station readings, from the [National Weather Service](https://www.weather.gov/) API (public domain). Design tokens from the Cottonwood design system in Ev-made-easy.
