import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // WHY a dev proxy: the browser calls /api on its own origin, so the
    // backend needs zero CORS config — and production would serve the built
    // frontend behind the same origin anyway, keeping dev/prod parity.
    proxy: {
      '/api': 'http://localhost:4000',
      '/socket.io': { target: 'http://localhost:4000', ws: true },
    },
  },
})
