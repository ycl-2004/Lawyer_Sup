/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // 单地址后端托管时为根路径 "/"；GitHub Pages 子路径部署时由 CI 传入 VITE_BASE=/Lawyer_Sup/
  base: process.env.VITE_BASE || "/",
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
