/// <reference types="vitest/config" />
import { defineConfig, type Connect, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { STATIONS_ENDPOINT_PATH, stationsResponse } from './src/lib/stationsEndpoint'

/** Serves /api/stations under `npm run dev` and `npm run preview`, as the Netlify function does in production. */
function stationsEndpoint(): Plugin {
  const handle: Connect.NextHandleFunction = (req, res, next) => {
    if (req.method !== 'GET' || req.url?.split('?')[0] !== STATIONS_ENDPOINT_PATH) return next()
    stationsResponse()
      .then(async (answer) => {
        res.statusCode = answer.status
        answer.headers.forEach((value, name) => res.setHeader(name, value))
        res.end(await answer.text())
      })
      .catch(next)
  }
  return {
    name: 'skicast-stations-endpoint',
    configureServer: (server) => void server.middlewares.use(handle),
    configurePreviewServer: (server) => void server.middlewares.use(handle),
  }
}

export default defineConfig({
  // Relative base so the static build works from any path (Netlify, GitHub Pages, Cloudflare Pages).
  base: './',
  plugins: [react(), tailwindcss(), stationsEndpoint()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/setupTests.ts'],
    css: false,
  },
})
