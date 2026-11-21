import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

// 独立 demo：不依赖主项目，手写一份分镜 JSON 就能播放、编辑逐字稿。
export default defineConfig({
  root: resolve(__dirname, 'demo'),
  plugins: [react()],
  server: { port: 5190, strictPort: false },
  build: { outDir: resolve(__dirname, 'dist-demo'), emptyOutDir: true },
});
