import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Tauri 约定：固定端口，构建目标对齐系统 WebView
export default defineConfig({
  plugins: [react(), tailwindcss()],
  clearScreen: false,
  server: { port: 1420, strictPort: true },
  envPrefix: ["VITE_", "TAURI_ENV_"],
  // worker 用 ES 格式才能与主包一样按动态 import 分包，否则全部内联成单文件
  worker: { format: "es" },
  build: {
    target: "es2022",
    minify: "esbuild",
    sourcemap: false,
    // 工具实现的分包由 registry 的动态 import() 保证，无需额外手动分包
  },
});
