import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // '' prefix loads every key from .env files; only VITE_* keys ever reach the browser bundle
  const env = loadEnv(mode, process.cwd(), '');
  // The page may only talk to its own API: the address in VITE_API_URL (or this site itself when the API is on the same domain).
  const api = (() => { try { return new URL(process.env.VITE_API_URL ?? env.VITE_API_URL).origin; } catch { return "'self'"; } })();
  const csp = [
    "default-src 'self'", "script-src 'self'", "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com", 'font-src https://fonts.gstatic.com',
    "img-src 'self' data:", `connect-src 'self' ${api}`, "base-uri 'self'", "form-action 'self'", "object-src 'none'",
  ].join('; ');
  return {
    plugins: [react(), {
      name: 'content-security-policy',
      // in `npm run dev` Vite needs inline scripts, so the policy is only added to production builds
      transformIndexHtml: { order: 'post', handler: html => (mode === 'production' ? html.replace('<head>', `<head>\n    <meta http-equiv="Content-Security-Policy" content="${csp}" />`) : html) },
    }],
    server: {
      port: Number(env.WEB_PORT || 5173),
      proxy: { '/api': env.API_PROXY_TARGET || 'http://localhost:4000' },
    },
  };
});
