import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: {
      stream: path.resolve(__dirname, './src/polyfills/stream.ts'),
      util: path.resolve(__dirname, './src/polyfills/util.ts'),
      crypto: path.resolve(__dirname, './src/polyfills/crypto.ts'),
    },
  },
  server: {
    port: 5173,
  },
});
