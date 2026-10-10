import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // '' prefix loads every key from .env files; only VITE_* keys ever reach the browser bundle
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    server: {
      port: Number(env.WEB_PORT || 5173),
      proxy: { '/api': env.API_PROXY_TARGET || 'http://localhost:4000' },
    },
  };
});
