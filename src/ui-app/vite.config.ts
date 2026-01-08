import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
      '@screens': path.resolve(__dirname, './screens'),
      '@components': path.resolve(__dirname, './components'),
      '@game': path.resolve(__dirname, './game'),
      '@styles': path.resolve(__dirname, './styles'),
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
