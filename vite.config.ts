import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Carrega variáveis de ambiente baseadas no modo atual (ex: .env)
  const env = loadEnv(mode, '.', '');

  // PRIORIDADE: Usa a chave do .env se existir, senão usa a chave fornecida para estudo.
  const API_KEY = env.API_KEY || "AIzaSyCI_Fv_H9QT5TZnVQ4EEc0tIDv2DXP1iq4";

  return {
    plugins: [react()],
    // Importante para funcionar tanto em subdomínios (Web) quanto no Android (Capacitor)
    base: './',
    server: {
      host: true
    },
    define: {
      // Expõe a API_KEY para o código do cliente de forma segura
      // Isso permite usar 'process.env.API_KEY' no App.tsx
      'process.env.API_KEY': JSON.stringify(API_KEY)
    },
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      // Garante que arquivos pequenos não sejam inline (evita problemas com CSP estritos)
      assetsInlineLimit: 0,
    }
  };
});