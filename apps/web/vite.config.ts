import { defineConfig, type PluginOption } from 'vite';
import react from '@vitejs/plugin-react';

// `base` is the public path assets/fetches are served from.
// - dev / default: '/' (works with the API proxy below)
// - GitHub Pages: CI sets VITE_BASE=/website_bug_finder/ at build time
//   (use VITE_BASE=/ for a custom domain or user/org Pages).
//
// NOTE: `react()` is typed against apps/web's vite@6, while `defineConfig`
// here resolves to the root vite@5 that vitest pulls in. The two Plugin types
// are structurally identical but nominally distinct across the duplicate
// installs, so we cast to the local PluginOption. Harmless — this file isn't
// type-checked in the build (tsconfig includes only `src`) and runs untyped.
export default defineConfig({
  plugins: [react() as unknown as PluginOption],
  base: process.env.VITE_BASE ?? '/',
  server: {
    port: 5173,
    proxy: {
      // Forward API + screenshot requests to the Fastify server (live/dev mode).
      '/api': { target: 'http://localhost:3001', changeOrigin: true },
      '/screenshots': { target: 'http://localhost:3001', changeOrigin: true },
    },
  },
});
