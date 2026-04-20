import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// FE dev server on 5173, proxies /api to Express backend on 3700.
// Build writes straight into ../src/gui/public so Express static-serves it.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3700',
    },
  },
  build: {
    outDir: path.resolve(__dirname, '../src/gui/public'),
    emptyOutDir: true,
    assetsDir: 'assets',
  },
});
