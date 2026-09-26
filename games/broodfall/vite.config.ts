import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: { port: 5199, strictPort: false },  // players fall through to the next port; scripts use preview
  preview: { port: 5199, strictPort: true },
});
