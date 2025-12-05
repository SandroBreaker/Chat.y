import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Importante para funcionar tanto em subdomínios (Web) quanto no Android (Capacitor)
  base: './',
  server: {
    host: true
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    // Garante que arquivos pequenos não sejam inline (evita problemas com CSP estritos)
    assetsInlineLimit: 0,
  }
});