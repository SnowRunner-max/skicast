# Skicast

Wind and weather on Mammoth Mountain, read straight off the lift map.

One screen: a simplified lift map with a forecast point (a "beacon") at Summit, McCoy Station, Main Lodge, Canyon Lodge and Eagle Lodge. Each beacon shows its gust speed and wind direction on the map. Tap one for current weather, current wind and wind for the next six hours.

No backend. The browser asks [Open-Meteo](https://open-meteo.com/) directly, one request for all five beacons.

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
| Beacons (station, elevation, label side) | `src/data/beacons.ts` |
| Open-Meteo host, cache time | `src/config.ts` |
| Colors and type | `src/apple.css` (Cottonwood tokens), `src/index.css` |
| Map rotation, which lifts are drawn | top of `scripts/build-map.ts` |

## Things to know

- **Forecast points, not weather stations.** The numbers are model forecasts for each spot, corrected for its elevation. Models smooth out ridgelines, so summit gusts can read low.
- **Wind bands are rough guides** (calm under 20 mph gusts, windy 20 to 39, strong 40 and up), not Mammoth's rules for running lifts.
- **Open-Meteo's free tier is for non-commercial use.** If Skicast ever makes money, point `OPEN_METEO_BASE_URL` at the paid host and add the key.
- **Caching.** A forecast is reused for 10 minutes. The last one is kept in `localStorage` so beacons show immediately on reload, and stays on screen (labelled with its age) if a refresh fails.

## Credits

Lift data © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright) (ODbL). Elevation data from the USGS 3D Elevation Program. Weather data by [Open-Meteo](https://open-meteo.com/) (CC BY 4.0). Design tokens from the Cottonwood design system in Ev-made-easy.
