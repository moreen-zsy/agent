import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      // clarinet (via @ag-ui/a2ui-middleware) does `require('stream').Stream`
      // at module init; without a browser shim it resolves to undefined.
      { find: 'stream', replacement: path.resolve(__dirname, './src/shims/stream.js') },
    ],
  },
});
