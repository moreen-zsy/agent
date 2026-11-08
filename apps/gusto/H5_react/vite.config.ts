import path from "path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
// https://vite.dev/config/
export default defineConfig({
  base: "./",
  plugins: [react()],
  server: {
    port: 3333,
  },
  resolve: {
    dedupe: ["react", "react-dom"],
    alias: [
      // clarinet (via @ag-ui/a2ui-middleware) does `require('stream').Stream`
      // at module init; without a browser shim it resolves to undefined.
      {
        find: "stream",
        replacement: path.resolve(__dirname, "./src/shims/stream.js"),
      },
      { find: "@", replacement: path.resolve(__dirname, "./src") },
    ],
  },
  build: {
    chunkSizeWarningLimit: 700,
    cssCodeSplit: false, // 将css内联到js中，
    rolldownOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            // React 核心库
            if (/node_modules\/(react|react-dom|react-router)\//.test(id)) {
              return "react-core";
            }
            // AGUI / A2UI 生态
            if (/node_modules\/@(ag-ui|a2ui)\//.test(id)) {
              return "a2ui";
            }
            // AI SDK
            if (
              /node_modules\/@ai-sdk\//.test(id) ||
              /node_modules\/(ai|zod)\//.test(id)
            ) {
              return "ai-sdk";
            }
            // UI 组件库 (shadcn 底层依赖)
            if (/node_modules\/@radix-ui\//.test(id)) {
              return "radix-ui";
            }
            // 图表库
            if (/node_modules\/(recharts|d3)\//.test(id)) {
              return "charts";
            }
            // 动画库
            if (/node_modules\/(framer-motion|@motionone)\//.test(id)) {
              return "animation";
            }
            // 工具库
            if (
              /node_modules\/(lodash|date-fns|clsx|tailwind-merge)\//.test(id)
            ) {
              return "utils";
            }
            // 其他第三方库
            return "vendor";
          }
          // 业务代码：按页面分包
          if (id.includes("/src/pages/")) {
            const match = id.match(/\/src\/pages\/([^/]+)\.tsx$/);
            if (match) {
              return `page-${match[1].toLowerCase()}`;
            }
          }
        },
      },
    },
  },
});
