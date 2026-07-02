import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget = env.VITE_API_TARGET ?? 'http://localhost:3001'
  // Sub-path where the app is served, e.g. /7k-planner/
  // Must match the path Kong (or any reverse proxy) exposes the frontend under.
  const base = env.VITE_BASE_PATH
    ? env.VITE_BASE_PATH.replace(/\/?$/, '/')  // ensure trailing slash
    : '/'

  return {
    base,
    plugins: [react(), tailwindcss()],
    server: {
      proxy: {
        '/api': apiTarget,
      },
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: './src/test-setup.ts',
    },
  }
})
