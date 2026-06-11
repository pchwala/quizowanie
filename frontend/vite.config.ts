import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // Relative base: the Capacitor WebView loads the build from file://, where
  // absolute asset paths break.
  base: './',
  plugins: [react()],
  optimizeDeps: {
    // Stencil web component — pre-bundling breaks its lazy chunk loading.
    exclude: ['jeep-sqlite'],
  },
})
