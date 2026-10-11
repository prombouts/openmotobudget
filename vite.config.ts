import react from '@vitejs/plugin-react'
import { defineConfig, type PreviewServer, type ViteDevServer } from 'vite'

const isolationHeaders = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'credentialless',
}

function applyIsolationHeaders(server: ViteDevServer | PreviewServer) {
  server.middlewares.use((_req, res, next) => {
    res.setHeader('Cross-Origin-Opener-Policy', isolationHeaders['Cross-Origin-Opener-Policy'])
    res.setHeader('Cross-Origin-Embedder-Policy', isolationHeaders['Cross-Origin-Embedder-Policy'])
    next()
  })
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'isolation-headers',
      configureServer: applyIsolationHeaders,
      configurePreviewServer: applyIsolationHeaders,
    },
  ],
  server: {
    headers: isolationHeaders,
  },
  preview: {
    headers: isolationHeaders,
  },
  optimizeDeps: { exclude: ['@sqlite.org/sqlite-wasm'] },
})
