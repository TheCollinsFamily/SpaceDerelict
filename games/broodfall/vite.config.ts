import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: { port: 5199, strictPort: true },
  preview: { port: 5199, strictPort: true },
});
