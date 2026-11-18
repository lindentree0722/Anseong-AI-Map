import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react()],
    server: { proxy: {
      '/api/signals-service': {
        target: env.SIGNAL_API_TARGET || 'http://127.0.0.1:8001',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api\/signals-service/, '/api'),
      },
    } },
  }
})
