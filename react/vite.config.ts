import { defineConfig } from 'vite'
import { reactRouter } from '@react-router/dev/vite'

export default defineConfig({
  plugins: [reactRouter()],
  server: {
    proxy: {
      '/api': 'http://localhost:5000',
    },
  },
})