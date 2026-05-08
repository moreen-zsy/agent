import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    port: 3000,
  },
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: [
      // clarinet (via @ag-ui/a2ui-middleware) does `require('stream').Stream`
      // at module init; without a browser shim it resolves to undefined.
      { find: 'stream', replacement: path.resolve(__dirname, './src/shims/stream.js') },
      { find: '@', replacement: path.resolve(__dirname, './src') },
    ],
  },
});
