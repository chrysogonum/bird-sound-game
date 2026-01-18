import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  // Use root '/' for custom domain (chipnotes.app)
  // Use '/bird-sound-game/' for GitHub Pages subdomain
  // The CNAME file in public/ will trigger custom domain mode
  base: '/',
  // Ensure SPA mode for proper routing (this is the default, but explicit for clarity)
  appType: 'spa',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
      '@screens': path.resolve(__dirname, './screens'),
      '@components': path.resolve(__dirname, './components'),
      '@game': path.resolve(__dirname, './game'),
      '@styles': path.resolve(__dirname, './styles'),
      '@engine': path.resolve(__dirname, '../'),
    },
  },
  server: {
    port: 3000,
  },
  build: {
    outDir: '../../dist',
    emptyOutDir: true,
  },
});
