import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

declare const process: { env: Record<string, string | undefined> };

// Ruta donde vive la página:
// - En un dominio propio (Cloudflare Pages, etc.) es '/', que es el valor por defecto.
// - En GitHub Pages la página vive dentro de una subcarpeta; el despliegue la define con VITE_BASE.
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE || '/',
  build: {
    outDir: 'dist',
  },
});
