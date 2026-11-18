import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react()],
    define: { 'import.meta.env.VITE_COMMERCIAL_PROXY_ENABLED': JSON.stringify(Boolean(env.COMMERCIAL_API_TARGET).toString()) },
    server: { proxy: {
      '/api/traffic-overview': {
        target: 'http://127.0.0.1:8000',
        rewrite: path => path.replace(/^\/api\/traffic-overview/, '/traffic/overview'),
      },
      ...(env.COMMERCIAL_API_TARGET ? {
        '/api/commercial-service': { target: env.COMMERCIAL_API_TARGET, changeOrigin: true, rewrite: (path: string) => path.replace(/^\/api\/commercial-service/, '/api') },
      } : {}),
      '/api/signals-service': {
        target: env.SIGNAL_API_TARGET || 'http://127.0.0.1:8001',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api\/signals-service/, '/api'),
      },
    } },
  }
})
